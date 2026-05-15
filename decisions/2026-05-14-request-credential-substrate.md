---
title: "Decision: request_credential Substrate"
type: decision
status: accepted
tags: [decision, credentials, security, agent-tool, secrets, ux]
created: 2026-05-14
updated: 2026-05-15
linked_docs:
  - "[[02-architecture]]"
  - "[[03-epic-map]]"
  - "[[2026-05-14-skill-ingest-substrate]]"
  - "[[2026-05-14-claim-vs-evidence-audit]]"
canonical_path: wiki/decisions/2026-05-14-request-credential-substrate.md
---

# Decision: `request_credential` Substrate

**Status:** Accepted 2026-05-15 after operator review. No blockers; seven sharpening points folded in (see §"Provenance"). Implementation cleared to begin.

## Context

Today the operator-to-Agent credential pipeline runs through Settings → "skills & mcp servers" (per [[2026-05-14-skill-ingest-substrate]]). That pipeline solves the install-time bulk case: operator installs a skill, wizard collects N env values per Agent, vault seals them. It does NOT solve the runtime / dynamic case:

- Agent realizes mid-task it needs a credential the skill author didn't anticipate.
- Agent rotating a key on behalf of the operator (e.g. a new GitHub PAT after the old one expired).
- Agent doing first-run onboarding through a service that issues credentials interactively rather than at install time.

Today's workaround: Agent prompts the operator via `chat_send` ("I need your GitHub token"), operator opens Settings → MANAGE KEYS → pastes value → restarts agent. Five round-trips, separate UI surface, no verification that the prompt and the paste correspond.

There's also a class of failure the existing pipeline shares with every other agent platform: when the operator pastes a credential into ANY normal channel (Settings, chat, terminal), the value transits through the LLM provider on its way to the agent's hands. Even if 2200's vault seals it on disk, the agent's LLM context has the value temporarily. From there it can leak into transcripts, brain notes, supervisor logs. The OpenPub key incident this morning was an instance of this leak surface: a value the operator pasted into the install wizard ended up in a stderr log when the MCP server treated it as a path.

Doug's framing (2026-05-14): *"Agent puts up a popup. Human pastes the key. Goes directly to disk, encrypted. Never hits the network or the agent's context."*

The decision: build a runtime tool that lets an Agent **request** a credential from the operator without ever **handling** it. The Agent specifies the destination and shape; the operator responds via a UI surface that pipes the value directly into the per-Agent vault. The Agent gets back "fulfilled, name=X" — never the value.

## The bar

Four structural properties this substrate must guarantee:

1. **The secret value never enters the Agent's loop context.** Not in tool args, not in tool results, not in narration, not in any post-fulfillment LLM call.
2. **The secret value never transits the LLM provider.** Browser → runtime HTTP → vault. The model API never sees it.
3. **The Agent cannot fabricate possession.** If the Agent narrates "I have the GitHub token," the audit substrate can verify that claim against (a) the request ledger and (b) `vault.has(name)`. False claims are caught by the existing audit pipeline with no new substrate work.
4. **Credential prompts are surface-restricted to operator-private 1:1 chat by construction.** No Agent on this fleet can prompt for credentials in a shared channel. This closes the most plausible Agent-to-Agent social-engineering vector before it opens — a guarantee other agent platforms can't make because they lack a surface-aware task source.

These together produce a property other agent platforms can't claim: **operator-paste credentials whose plaintext is never reachable from the model side**, ever.

## Locked design constraints

Per Doug's design call (2026-05-14):

| Constraint | Value | Why |
|---|---|---|
| Pending-request timeout | **5 minutes** | Real-time conversation cadence; expiry is cheap (Agent can re-ask), staleness is expensive (a 24h-old prompt is a phishing vector). |
| Per-Agent rate cap | **15 requests / hour** (default) | Prevents Agent loop spam / abuse. Globally configurable; per-Agent override possible. |
| Cross-Agent destinations | **Forbidden** | Each Agent can only request into its own vault. Cross-Agent grants belong to a separate decision (probably never; supervisor-mediated grants exist for spawn). |
| Surface | **1:1 chat only** | The high-trust surface where Agent and operator are already conversing. A credential prompt in a pub message stream IS the social-engineering attack surface; constraining to 1:1 chat closes that vector by construction. |

## Architecture

### Tool: `request_credential`

```yaml
name: request_credential
description: |
  Ask the operator to provide a credential value via the 1:1 chat
  surface. The value goes directly into your per-Agent vault under
  the supplied credential_name; you never see it. Returns when the
  operator fulfills, declines, or the 5-minute timeout expires.
input_schema:
  credential_name: string  # slug, lowercase + digits + dashes; vault credential name to write to
  label: string            # operator-facing display name ("OpenPub Private Key")
  help: string             # explainer text ("Find this on your OpenPub dashboard...")
  kind: enum [value, secret, file]  # widget hint; matches mcp: extension
  reason: string           # justification surfaced to operator alongside the prompt
returns:
  status: enum [fulfilled, declined, expired]
  credential_name: string  # confirmation of where the value landed (when fulfilled)
  set_at: timestamp        # when fulfillment completed (when fulfilled)
  decline_reason: string   # structured code when runtime-generated ('rate_capped',
                           # 'surface_invalid', 'invalid_credential_name'); operator-typed
                           # text or empty when human-declined
  expired_reason: string   # 'timeout' (default) when status=expired; 'agent_crashed' /
                           # 'agent_archived' surface only in operator UI, never in tool result
```

The tool is **blocking**. The Agent's loop transitions to `blocked_on_user` (existing state from Epic 6) when the tool dispatches. The loop unblocks on operator response or timeout.

### Tool dispatch behavior

1. Validate constraints inline:
   - `credential_name` matches `^[a-z][a-z0-9-]*$` (existing vault slug regex)
   - Originating task came from a 1:1 chat (`task.source.kind === 'chat'`); reject if from pub / schedule / self-spawn
   - Per-Agent rate-cap check (15 / hour rolling window); reject if exceeded
2. Write a `CredentialRequest` record to `<home>/state/credential-requests/<request-id>.json` with the metadata. **The value field never exists.**
3. Broadcast WS event `credential_request.created` to every connected operator UI subscribed to the relevant chat.
4. Insert a system-role message into the chat thread carrying the request envelope (`kind: 'credential_request'`, body: serialized request) so the chat UI renders the inline card.
5. Transition the Agent loop to `blocked_on_user`.
6. Wait for either a fulfill / decline RPC OR the 5-min timeout.
7. Return the result to the Agent. The result NEVER contains the value.

**Inline-validation rejection shape.** Each of the three validation failures returns immediately (no record written, no WS event) with a structured decline:

- Slug-format violation → `{ status: 'declined', decline_reason: 'invalid_credential_name' }`
- Wrong surface (pub / schedule / self-spawn) → `{ status: 'declined', decline_reason: 'surface_invalid' }`
- Rate cap hit → `{ status: 'declined', decline_reason: 'rate_capped' }`

When the rate cap is hit, the runtime ALSO emits an operator notification at `important` tier (`kind: 'credential_request_rate_capped'`, body names the Agent + window-start + cap value). Otherwise the operator would just see an Agent failing to make progress and not know why.

**Rate-cap configuration.** Default `15 / hour` is set in `settings.json` under `requestCredential.ratePerHour`. Per-Agent override via the Agent's `identity.md` frontmatter (`request_credential_rate_per_hour: N`). The runtime resolves cap-at-dispatch as `identity.value ?? settings.value ?? 15`. There's no in-band way for the Agent to ask for a higher cap; that's an operator decision.

### Operator UX (1:1 chat surface only)

The chat thread renders an inline `CredentialRequestCard` component (mirrors the existing AuditCard pattern from the audit substrate). Card layout:

```
┌─────────────────────────────────────────────────┐
│  hobby is asking for a credential               │
│                                                 │
│  OpenPub Private Key                  [secret]  │
│                                                 │
│  Ed25519 private key from your OpenPub          │
│  dashboard "Register Agent" page. Treat like    │
│  an SSH key.                                    │
│                                                 │
│  Reason: I need this to authenticate to the     │
│  OpenPub MCP server you just installed.         │
│                                                 │
│  Destination: hobby's vault, key                │
│  "openpub--openpub-private-key"                 │
│                                                 │
│  Expires in 4m 23s                              │
│                                                 │
│  [paste value here ──────────────────────]      │
│                                                 │
│           [DECLINE]              [PROVIDE]      │
└─────────────────────────────────────────────────┘
```

Widget per `kind`:
- `value` → `<input type="text">`
- `secret` → `<input type="password">`
- `file` → `<textarea>` for contents (matches the file-materialization spec from the [[2026-05-14-skill-ingest-substrate]] addendum)

Submit path:
- `[PROVIDE]` → POST `/api/v1/agents/:name/credential-requests/:id/fulfill { value: <pasted> }` → runtime seals to vault → unblocks Agent's loop with `{ status: 'fulfilled', credential_name, set_at }`
- `[DECLINE]` → POST `/api/v1/agents/:name/credential-requests/:id/decline { reason?: string }` → unblocks Agent's loop with `{ status: 'declined', decline_reason }`
- 5-min timeout → automatic transition; unblocks Agent's loop with `{ status: 'expired' }`

After resolution the card transitions to a confirmation state (no further interaction):

```
┌─────────────────────────────────────────────────┐
│  ✓ Provided  ·  OpenPub Private Key             │
│  hobby received the value at 23:51 UTC.         │
└─────────────────────────────────────────────────┘
```

### Pub / fleet / settings surfaces

A `request_credential` tool call originating outside a 1:1 chat returns immediately with `{ status: 'declined', decline_reason: '...' }` and a runtime warning. The Agent never sees the credential request prompt anywhere except the originating chat thread.

This matters for pub etiquette: if hobby is mid-pub-conversation and tries to request a credential, the runtime refuses the dispatch entirely. The agent has to chat-to-the-operator first ("I need to step away for a sec"), get a 1:1 chat task, then issue the request from there.

### State machine

```
                  ┌─────────────┐
   tool dispatch  │             │  operator [PROVIDE]
   ──────────────▶│   pending   │────────────────────┐
                  │             │                    │
                  └──────┬──────┘                    │
                         │                           ▼
              5-min      │      operator       ┌──────────┐
              timeout    │      [DECLINE]      │ fulfilled│
                         │           │         └──────────┘
                         ▼           ▼
                    ┌────────┐  ┌──────────┐
                    │expired │  │ declined │
                    └────────┘  └──────────┘
```

All four states are terminal. Re-issuing the same `credential_name` after expiration creates a new request (subject to the rate cap); there is no resume.

### Storage

`<home>/state/credential-requests/<request-id>.json`:

```jsonc
{
  "schema_version": 1,
  "id": "credreq_<32 hex>",
  "agent": "hobby",
  "chat_id": "chat_<32 hex>",
  "credential_name": "openpub--openpub-private-key",
  "label": "OpenPub Private Key",
  "help": "Ed25519 private key from your OpenPub dashboard...",
  "kind": "secret",
  "reason": "I need this to authenticate to the OpenPub MCP server.",
  "created_at": "2026-05-14T23:51:00.000Z",
  "expires_at": "2026-05-14T23:56:00.000Z",
  "state": "pending | fulfilled | declined | expired",
  "fulfilled_at": null,
  "declined_at": null,
  "decline_reason": null,
  "expired_at": null,
  "expired_reason": null   // 'timeout' | 'agent_crashed' | 'agent_archived' when state=expired
}
```

**The `value` field never exists in this file.** When the operator fulfills, the value goes directly to vault; the request file's `state` flips to `fulfilled` with a timestamp, no reference to what the value was.

Per-Agent rate cap state at `<home>/state/credential-requests/.rate-<agent>.json`:

```jsonc
{
  "schema_version": 1,
  "window_start": "2026-05-14T23:00:00.000Z",
  "count": 5
}
```

Rolling 1-hour window. On each request: if `now - window_start > 1h`, reset to `{ window_start: now, count: 1 }`; else if `count >= cap`, reject inline; else `count++`.

### Wire format

```
POST /api/v1/agents/:name/credential-requests/:id/fulfill
  body: { value: string }
  response: { fulfilled_at: string, credential_name: string }

POST /api/v1/agents/:name/credential-requests/:id/decline
  body: { reason?: string }
  response: { declined_at: string }

GET /api/v1/agents/:name/credential-requests
  query: ?state=pending|fulfilled|declined|expired&limit=N
  response: { items: CredentialRequest[] }   // never includes values
```

WebSocket events:

```
credential_request.created    { agent, chat_id, request: {...metadata, no value...} }
credential_request.fulfilled  { agent, request_id, fulfilled_at, credential_name }
credential_request.declined   { agent, request_id, declined_at, decline_reason? }
credential_request.expired    { agent, request_id, expired_at, expired_reason }
```

### Supervisor + cost interactions

The tool sits on top of the existing supervisor + cost-cap machinery; the integration points are worth naming so they don't surprise anyone in production.

**Cost-cap clock pauses during `blocked_on_user`.** The wait is operator-latency, not Agent work. Charging it against the Agent's time-budget would create the wrong incentive (Agent races to dispatch the request before the budget expires, or worse, finalizes a fabricated reply rather than wait for the operator). The Agent's cost record gets a `blocked_on_user_total_ms` accumulator that's excluded from time-budget arithmetic. Token / dollar caps are unaffected ... no tokens flow during the wait.

**Supervisor restart with pending requests.** On boot, the supervisor scans `<home>/state/credential-requests/*.json` for records with `state: 'pending'` and partitions them:

- `expires_at > now` → the owning Agent is restored to `blocked_on_user` for that request. If the Agent itself isn't in `reviveStates` (e.g. archived), the request is marked `expired` with `expired_reason: 'agent_archived'` instead.
- `expires_at <= now` → marked `expired` with `expired_reason: 'timeout'` on the next sweeper tick; WS `credential_request.expired` event fires so the operator's UI updates if open.

The chat-thread system message inserted on dispatch persists in the chat log, so the operator sees the historical card with its final state regardless of restart timing.

**Agent crash during the wait.** When the supervisor's existing crash-handler detects an Agent process death without graceful shutdown, it sweeps any `pending` requests for that Agent and marks them `expired` with `expired_reason: 'agent_crashed'`. The operator UI surfaces this state distinctly (card transitions to "agent crashed mid-request" rather than the normal "expired"), so the operator doesn't waste time pasting into a card whose recipient is gone.

On Agent restart, the supervisor does NOT restore those requests ... they're terminal. If the Agent still needs the credential, its next reasoning step issues a fresh `request_credential`, subject to the rate cap. This deliberately avoids the "stale request from a previous reasoning context" trap.

**Agent archive during the wait.** Same path as crash, with `expired_reason: 'agent_archived'`. The directory rename ([[2026-05-14]] archive substrate) doesn't touch the request file's `agent` field, so the archived-Agent's audit log retains the trail.

### Frozen wire shape

The `credential_request_v1` envelope (used inside the chat-system message for the inline card) is the runtime ↔ web wire format. New fields go on a `v2` envelope, not in-place.

```jsonc
{
  "envelope": "credential_request_v1",
  "request_id": "credreq_<32 hex>",
  "label": "OpenPub Private Key",
  "help": "...",
  "kind": "secret",
  "reason": "...",
  "destination_credential_name": "openpub--openpub-private-key",
  "expires_at": "2026-05-14T23:56:00.000Z",
  "state": "pending | fulfilled | declined | expired"
}
```

## Audit integration

The audit substrate from [[2026-05-14-claim-vs-evidence-audit]] picks up two new claim verifiers cleanly:

### New claim category: `credential_request`

When the Agent's final reply says something like "I asked the operator for the OpenPub key," the claim extractor categorizes as `credential_request`. The verifier:

1. Looks for a `CredentialRequest` record in the loop's transcript window with matching `credential_name`.
2. If found AND in `pending | fulfilled | declined | expired` state → verified (the request was made; outcome is operator's choice).
3. If not found → unverified (Agent claimed to have asked but no request record exists; possible fabrication).

### Existing `external_send` extension

When the Agent claims "I have the GitHub token" or "the OpenPub key is in vault," route to vault verification:

1. Check `vault.has(<credential_name>)`.
2. If `true` → verified.
3. If `false` → contradicted (Agent claimed possession of a credential that isn't in vault).

The Agent literally cannot fabricate possession because the vault is the source of truth and is queryable directly.

### Kick-back loop integration

If the Agent claims possession without actually having requested OR if a request was declined and the Agent narrates as if it succeeded, the kick-back loop fires per existing audit substrate semantics. The Agent's three-path correction options (PERFORM / FORMALLY ASK / REFUSE) include a fourth implicit path here: **request the credential properly via `request_credential`**. The PERFORM path covers it.

## Security properties summary

| Property | Mechanism |
|---|---|
| Secret never in LLM context | Tool result excludes the value; only `{status, credential_name, set_at}` returned |
| Secret never in model provider request | Direct browser → runtime → vault path; model never sees the value |
| Secret never in transcripts | Same; tool args don't carry it (only metadata) |
| Secret never in brain notes | Vault is the only writable destination; brain writes are a separate tool path |
| Secret never in supervisor log | Vault writes use the existing `atomicWriteFile` + sealed envelope; logs reference credential_name only |
| Operator approval required | No time-based auto-fulfill; explicit PROVIDE button |
| Audit catches fabricated possession | `vault.has(name)` is the source of truth |
| Audit catches fabricated request | Request ledger is the source of truth |
| Cross-Agent overwrite impossible | Tool only writes to calling Agent's own vault |
| Cross-Agent request forgery impossible | Tool dispatch sets the request record's `agent` field from the calling loop's identity (not from tool args); the audit verifier checks the request ledger's `agent` matches the Agent making the claim. No Agent can fabricate a request that appears to come from a different Agent. |
| Pub-stream prompt impossible | Surface check refuses dispatch from non-chat tasks |
| Loop spam impossible | 15 / hour rate cap with global override |

## Implementation order

1. **Schemas + storage** ... `CredentialRequest` Zod schema, request store module, rate-cap state file. Pure data layer; full unit tests.
2. **Runtime tool** ... `request_credential` definition + dispatch handler that writes the request record, transitions state, blocks the loop.
3. **HTTP endpoints** ... `fulfill` / `decline` / `list` routes; auth + permission checks (operator must own the request's chat).
4. **WS event broadcast** ... wire `credential_request.created/fulfilled/declined/expired` into the existing WS dispatch.
5. **Chat-thread system message** ... insert the `credential_request_v1` envelope as a system-role message in the chat thread on dispatch (mirrors how the AuditCard envelope is inserted).
6. **Web component** ... `CredentialRequestCard` mirrors `AuditCard` in apps/web/src/chat/. Renders the prompt, handles paste + submit + decline, transitions to confirmation state on resolution.
7. **Timeout sweeper** ... background tick (every 30s, or scheduled) that scans pending requests, marks expired ones, broadcasts `expired` event.
8. **Audit verifier** ... new `credential_request` claim category + verifier function in `verifiers.ts`.
9. **System prompt rule** ... brief addition explaining when to use `request_credential` (when a needed credential isn't in the Agent's tool/vault scope and a 1:1 chat exists with the operator).
10. **End-to-end demo** ... hobby asks for a credential mid-task, operator pastes, Agent uses it for the next tool call, audit verifies possession.

## Open follow-ups (out of v1 scope)

1. **Async-operator timeout hole.** The 5-minute timeout is correct for the keyboard-attended happy path. If the operator is in a meeting / at lunch / asleep, the Agent can churn through re-issue → expire → re-issue → rate-cap before the operator returns home. Two possible mitigations, neither in v1: (a) `wait_for_response_ms` parameter on `request_credential` so an Agent that knows the operator is async can request a longer window (Agent-side adaptation); (b) the operator UI surfaces recently-expired requests with a "still need this?" resurrection affordance, so the operator can revive a stale request without forcing the Agent to re-issue (operator-side adaptation). Leaning (b) ... keeps the Agent-facing surface narrow and the operator-facing surface adaptive. Worth picking the answer before this becomes a recurring complaint.
2. **File-shaped (`kind: file`) materialization.** Depends on the `mcp:` frontmatter extension shipping (separate decision; queued task #8). **v1 accepts `kind: file` as a UI hint only**: the operator gets a textarea widget, and the pasted contents are stored as a regular vault credential string (same path as `value` / `secret`). Spawn-time materialization to a managed temp file ships in v1.x alongside the `mcp:` frontmatter extension. Until then, an MCP server that wants a file path can read the vault value directly (most can) or operators can fall back to the install-time wizard for file-shaped envs.
3. **Re-prompt and stale-prompt detection.** If the Agent issues a `request_credential` for a `credential_name` that's already `pending`, the UI surfaces a single re-prompt indicator on the existing card rather than rendering two cards. For a recently-expired request of the same name (within ~30 minutes), the new card shows "you let this expire 12 minutes ago" inline rather than a fresh prompt ... this is the answer to the "snooze button" UX question without adding a `snoozed` state to the state machine. The terminal-state rule stands: the stale-expired record stays expired forever; the "resurrect" affordance from follow-up #1(b) creates a new `CredentialRequest` record with the same `credential_name` / `label` / `help` / `kind` / `reason`, and the UI collapses the linked pair into one visual card with continuity. Low priority on its own; the rate cap already discourages spam.
4. **Cross-chat visibility.** A request issued in one chat thread shows up in that thread only. If the operator is in a different chat with the same Agent, they don't see the prompt unless they switch threads. Possible enhancement: notification-tier surfacing for high-priority requests.
5. **Bulk request.** A skill that needs N credentials could batch them into one card rather than N. Probably not worth it for v1; the existing install wizard handles bulk-known-at-install-time.
6. **Vault reset on decline.** If the operator declines, should we clear any pre-existing credential at that name? Default no ... declining the request shouldn't remove an existing value. The Agent gets `{status: 'declined'}` and can decide what to do.
7. **Audit telemetry dashboard hook.** Per-Agent counts of (requested, fulfilled, declined, expired) over time. Useful for operator sense-making. Belongs alongside the budget / audit telemetry work already queued.

## Provenance

Decision drafted 2026-05-14 evening following the OpenPub install round-trip, which surfaced a class of leak surfaces (stderr logs treating values as paths, MCP server env-error messages echoing pasted contents, etc.) alongside the multi-iteration substrate hardening from the same session. Doug's design call established the four constraints (5min, 15/hr, own-vault-only, 1:1 chat); this doc locks them in writing.

Operator review delivered 2026-05-15. No blockers; seven sharpening points folded in:

1. Async-operator timeout hole named as a known UX hole in §"Open follow-ups" with two mitigation paths sketched.
2. Rate-cap rejection now returns structured `decline_reason: 'rate_capped'` and emits an operator notification at `important` tier; configuration location named (settings + identity override).
3. Pub-stream surface restriction lifted from quiet design constraint to a load-bearing security property in §"The bar" (bullet 4).
4. New §"Supervisor + cost interactions" section covers cost-cap clock pause, supervisor restart re-load, agent-crash sweep, and agent-archive sweep.
5. `kind: file` deferral clarified: v1 stores as regular vault credential; spawn-time materialization ships in v1.x with the `mcp:` extension.
6. "Snooze button" UX folded into expanded re-prompt-detection follow-up (stale-expired cards show "you let this expire N minutes ago" with optional one-click resurrect) rather than adding a `snoozed` state to the state machine.
7. Cross-Agent request forgery property added to §"Security properties summary" naming the mechanism (agent field set from calling loop's identity, not tool args).

Plus one copy edit on this Provenance section to neutralize the key-leak phrasing for public readers.

Implementation cleared to begin. The substrate is independent of any in-flight skill or tool ... it lands as its own PR with the order in §"Implementation order" above.
