---
title: "Decision: request_credential Substrate"
type: decision
status: proposed
tags: [decision, credentials, security, agent-tool, secrets, ux]
created: 2026-05-14
updated: 2026-05-14
linked_docs:
  - "[[02-architecture]]"
  - "[[03-epic-map]]"
  - "[[2026-05-14-skill-ingest-substrate]]"
  - "[[2026-05-14-claim-vs-evidence-audit]]"
canonical_path: wiki/decisions/2026-05-14-request-credential-substrate.md
---

# Decision: `request_credential` Substrate

**Status:** Proposed. Implementation queued behind operator review.

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

Three structural properties this substrate must guarantee:

1. **The secret value never enters the Agent's loop context.** Not in tool args, not in tool results, not in narration, not in any post-fulfillment LLM call.
2. **The secret value never transits the LLM provider.** Browser → runtime HTTP → vault. The model API never sees it.
3. **The Agent cannot fabricate possession.** If the Agent narrates "I have the GitHub token," the audit substrate can verify that claim against (a) the request ledger and (b) `vault.has(name)`. False claims are caught by the existing audit pipeline with no new substrate work.

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
  decline_reason: string   # operator's text (when declined; optional)
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
  "decline_reason": null
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
credential_request.declined   { agent, request_id, declined_at, reason? }
credential_request.expired    { agent, request_id, expired_at }
```

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

1. **File-shaped (`kind: file`) materialization.** Depends on the `mcp:` frontmatter extension shipping (separate decision; queued task #8). The credential lands in vault as content; the MCP transport materializes it at spawn time. The `request_credential` substrate handles the input UX; the use-at-MCP-spawn part lives in the other substrate.
2. **Re-prompt detection.** If the Agent issues a `request_credential` for a `credential_name` that's already pending, surface as "re-prompt" in the UI rather than two cards. Low priority — the rate cap already discourages spam.
3. **Cross-chat visibility.** A request issued in one chat thread shows up in that thread only. If the operator is in a different chat with the same Agent, they don't see the prompt unless they switch threads. Possible enhancement: notification-tier surfacing for high-priority requests.
4. **Bulk request.** A skill that needs N credentials could batch them into one card rather than N. Probably not worth it for v1; the existing install wizard handles bulk-known-at-install-time.
5. **Vault reset on decline.** If the operator declines, should we clear any pre-existing credential at that name? Default no — declining the request shouldn't remove an existing value. The Agent gets `{status: 'declined'}` and can decide what to do.
6. **Audit telemetry dashboard hook.** Per-Agent counts of (requested, fulfilled, declined, expired) over time. Useful for operator sense-making. Belongs alongside the budget / audit telemetry work already queued.

## Provenance

Decision drafted 2026-05-14 evening following the OpenPub install round-trip + key-leak incident + multi-iteration substrate hardening. Doug's design call established the four constraints (5min, 15/hr, own-vault-only, 1:1 chat); this doc locks them in writing.

Implementation queued for next session. Review window: operator reads the doc, signals approval or pushback, then build commences. The substrate is independent of any in-flight skill or tool ... it lands as its own PR with the order in §"Implementation order" above.
