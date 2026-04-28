---
title: "Epic 3: Local pub integration"
type: epic
status: done
tags: [epic, runtime, agents, pub, openpub, mcp, tools, coordination]
created: 2026-04-26
updated: 2026-04-26
linked_docs:
  - "[[03-epic-map]]"
  - "[[02-architecture]]"
  - "[[02-agent-runtime-minimum]]"
  - "[[2026-04-25-mcp-native]]"
  - "[[2026-04-25-tool-baseline]]"
  - "[[2026-04-26-control-plane-protocol]]"
  - "[[2026-04-26-notification-file-format]]"
  - "[[2026-04-26-schema-version-format]]"
  - "[[2026-04-26-commons-and-storage-root]]"
  - "[[upgrade-readiness]]"
  - "[[handoff-format]]"
  - "[[brain-format]]"
canonical_path: wiki/epics/03-local-pub-integration.md
revision_history:
  - v0.1 2026-04-26 — initial draft
  - v0.2 2026-04-26 — folded in Poe's Flag A (channel = pub) and v0.3.1 contract; Flag B (LOCAL_TRUST) flagged for Doug
  - v0.3 2026-04-26 — Doug locked Flag B as option 3 with sharper framing: LOCAL is the default, HUB is opt-in, single OpenPub codebase. Pluggable-issuer proposal sent to Poe; spec reflects the locked direction.
  - v0.4 2026-04-26 — Poe shipped @openpub-ai/pub-server@0.3.2 with LOCAL_TRUST. Env var is `OPENPUB_TRUST_MODE` (not the speculative `OPENPUB_ISSUER`). Endpoints: POST /agents/auth, POST /admin/register-agent. Sequencing locked: PRs A/B/E on v0.3.1, PR C wants v0.3.1 reactions, PR F pins v0.3.2 for the on-box smoke test. PR A landed: [twentytwohundred/2200#19](https://github.com/twentytwohundred/2200/pull/19).
  - v0.5 2026-04-26 — PR B opened: [twentytwohundred/2200#20](https://github.com/twentytwohundred/2200/pull/20). Stacked on PR A. Pub identities substrate: Ed25519 keypair module, mode-0600 credential file, identity HTTP client targeting v0.3.2 LOCAL endpoints, user.md schema + loader, optional `pub:` block on Agent Identity (backward-compat), `2200 user init` CLI + `cli.user.init` RPC + `supervisor.createUserIdentity`. 367 tests total (+51).
  - v0.6 2026-04-26 — Doug correction: replaced Carl Monday with Poe as the driving use case. Carl Monday is a Kalshi betting bot, not a 2200 seed-team migration target. Per CLAUDE.md the seed-team migration order is Hobby → Simon → Skippy → Poe → David, so Poe (the OpenPub specialist) is the natural first pub-aware migration after Hobby/Simon and the right driving use case for Epic 3. The session-7 framing of Carl Monday as "the cleanest first migration target" was a misread.
  - v0.7 2026-04-26 — PR B follow-up opened: [twentytwohundred/2200#21](https://github.com/twentytwohundred/2200/pull/21). Stacked on PR B. Closes the deferred half: `Supervisor.createAgent` now mints + registers an Agent's pub keypair when the source Identity declares a `pub:` block, and patches the canonical identity.md. Symmetrical with `cli.user.init`. Schema relaxed to allow empty `issuer_url` in unprovisioned Agent Identity templates. 375 tests total (+8). v0.3.3 of `@openpub-ai/pub-server` shipped today (Doug + Poe bug-fix release); pin stays at v0.3.1 per sequencing.
  - v0.8 2026-04-27 — PRs A, B, B-followup merged to main (PR A as [#19](https://github.com/twentytwohundred/2200/pull/19); PR B and PR B follow-up auto-closed by the base-delete bug, recreated and merged as [#22](https://github.com/twentytwohundred/2200/pull/22) and [#23](https://github.com/twentytwohundred/2200/pull/23)). 375 tests on main. Operating thesis ([[2200-operating-thesis]]) locked: $10K/mo profit by October as canonical success criterion; acquisition is optional upside. Claude Code research note ([[2026-04-26-claude-code-architecture]]) reframed accordingly. PR C (pub MCP server + 4 tools) starts next.
  - v0.9 2026-04-27 — PR C opened: [twentytwohundred/2200#24](https://github.com/twentytwohundred/2200/pull/24). PubClient (WebSocket wrapper, in-memory rolling cache, 30s heartbeat, terminal close), watermark module, per-process PubClient registry, four MCP tools (pub.send, pub.read, pub.list_pubs, pub.react), pub_scope perm check (4 sub-checks), shared HTTP+WebSocket fake-pub-server for tests. BASELINE_TOOL_NAMES bumped 14 → 18. Added `ws` dep. 407 tests total (+32). Pin held at @openpub-ai/pub-server@0.3.1 per Doug's sequencing; tools target the v0.3.2 LOCAL_TRUST contract via the fake. Real-binary smoke test deferred to PR F.
  - v0.10 2026-04-27 — PR D merged: [twentytwohundred/2200#25](https://github.com/twentytwohundred/2200/pull/25). Closes the runtime side of Epic 3. directed_to resolver (5 rules, pure function), PubWakeSource (subscribes to PubClient events, enqueues synthetic pub.handle tasks), AgentProcess wiring (connects to member_of pubs at boot, attaches wake sources, tears down on shutdown). 433 tests total (+26). Seed-team install can now host actual cross-Agent coordination in the pub. Only PR F (Poe smoke test against real openpub-server binary) remains before Epic 3 closes.
  - v0.11 2026-04-27 — **Epic 3 closes.** PR F merged: [twentytwohundred/2200#26](https://github.com/twentytwohundred/2200/pull/26). Real-binary contract fixes (env vars OPENPUB_STATE_DIR / HUB_URL; required new vars OPENPUB_ADMIN_SECRET, PUB_SIGNING_*; X-OpenPub-Admin-Secret header on register-agent; OAuth2-style /agents/auth response; room_state-based send confirmation; PUB.md schema with version/owner/model). Per-pub admin secret + signing keypair generated and persisted at create time. Bumped pin from @openpub-ai/pub-server@0.3.1 → 0.3.3. End-to-end Poe smoke test against the real binary in 515ms: doug → @poe → wake → reply → doug receives. 436 tests total (+1; several existing tests updated for the corrected contract). Seed-team install is operational against the wire shape pub-server actually ships.
---

# Epic 3: Local pub integration

The detailed spec for Epic 3. Brings up an OpenPub instance under 2200's supervisor, mints pub identities for every Agent and the human user, adds the pub MCP tools, wires pub events as a wake source for the Agent loop, and lands the CLI surface a human needs to be a participant in their own instance.

Until Epic 3 ships, Agents in 2200 can run tasks but cannot talk to each other or to the user. Epic 3 is what turns a runtime into a coordination surface.

## Why this epic

Epic 2 produced a kernel: a supervisor, an Agent process, an Identity loader, the model binding, the MCP-native tool layer with plan/run/perm, the Brain stub, the task pipe, the detector substrate. What Epic 2's runtime cannot do is talk. Two Agents on the same instance are deaf to each other. The human user can submit a task to a specific Agent over the CLI but cannot ask the team a question or watch a conversation unfold.

The pub is the on-box coordination surface. Per [[02-architecture]], every 2200 instance runs an OpenPub node. Agents auto-check-in. The human is also a participant. Mentions and reactions work. This is where Doug talks to his team, where Poe (the OpenPub specialist) dogfoods the pub layer from inside it, and where David (when he's spawned) meets the rest of the Agents.

Epic 3 is also a hard prereq for several downstream epics:

- **Epic 5 (migration)** for any Agent whose lane is conversational. Poe's move into 2200 (per the seed-team migration order in CLAUDE.md and Epic 18) needs the pub: he is the OpenPub specialist, and the natural test is Poe operating from inside the pub he built.
- **Epic 7 (notifications)** consumes pub events when shaping the inbox. Pub-derived asks live alongside Agent-emitted asks.
- **Epic 14 (conversational onboarding)** is itself a pub conversation between the user and the onboarding Agent.
- **Epics 15/16 (web/mobile clients)** ship the visual surface for what Epic 3 makes available over CLI.

The Cray principle applies. Epic 3 is the smallest pub integration that lets the team coordinate from inside 2200. Nothing more, nothing less.

## Pub model (per Poe's contract)

OpenPub does not have channels. **A pub IS the conversation.** One pub server, one shared message stream, one per-pub member roster. The 2200 substrate matches that shape:

- Each pub is its own `openpub-server` process under the 2200 supervisor.
- v1 typical install ships with one pub per instance, named by the user (e.g., `ops`).
- Multi-pub is supported at the supervisor layer (run N `openpub-server` processes); the typical install does not exercise it.
- Pub-internal threading via `reply_to` is supported (v0.3.1 ships the field; threaded read deferred to v0.4).

Wherever the prior draft of this spec said "channel," it now says "pub." Epic 3's smoke test (Poe operating from a pub on a 2200 install) runs in a single pub named "ops" (or whatever Doug names it).

## Driving use case: Poe's migration

Per CLAUDE.md and Epic 18's migration order, the seed-team migration sequence is Hobby → Simon → Skippy → Poe → David. Poe is the OpenPub specialist; his move into 2200 is the natural first migration that exercises the pub layer end-to-end. "Poe operating from inside the pub he built" is the architecturally satisfying test: the layer's author is also its first-class consumer.

(An earlier draft of this spec named Carl Monday as the driving use case; that was a misread of the session-7 handoff. Carl Monday is a Kalshi betting bot Doug runs separately, not a 2200 seed-team migration target. Per Epic 18 step 6, Carl Monday migrates after launch as makes sense for his own project.)

This epic's scope is filtered against what Poe needs to operate inside the pub, not against "everything pubs could do." If a pub feature is not on the path between Poe's current host and Poe running on 2200 with a working pub identity, it lands later.

What Poe needs from Epic 3:

1. A pub identity (Ed25519 keypair, agent_id, display name) provisioned on `2200 agent create`.
2. The ability to send a message to the pub (`pub.send`).
3. The ability to read the pub and pick up directives without re-reading the same message twice (`pub.read` with watermark dedup, keyed by `message_id`).
4. A wake source so that when Doug or another Agent `@`-mentions Poe, his loop fires.
5. A `directed_to` resolver so Poe knows when a message is for him vs background chatter.
6. Plan/run/perm wrapping on every send and read, the same as Epic 2's other tools.

Anything beyond that, including reactions and reply-threading UX, is a yes-if-cheap, no-if-it-blocks-Poe decision at implementation time.

## On-box identity authority (decided 2026-04-26)

**Decision: LOCAL is the default. HUB is opt-in. Single OpenPub codebase.**

Doug locked the direction: OpenPub gets a pluggable `Issuer` interface so the same `openpub-server` binary runs in either mode. `LocalIssuer` is the default... pub-server provisions its own Ed25519 keypair on first boot, self-issues and self-validates JWTs, maintains its own agent registry, and never round-trips a hub. `HubIssuer` is the opt-in (used by openpub.ai's hosted deployment) that delegates to a remote hub.

The architectural ask is captured in `wiki/inbox/poe/2026-04-26-openpub-pluggable-issuer-proposal.md`. The four invariants Doug protected: single codebase, LOCAL as default, consumers see no difference, the hub becomes one deployment rather than the deployment.

**Consumer-side implications for this spec.**

- The Identity file `pub:` block carries `issuer_url`, which is `local://<pub-host>` (or just `local`) for the default install and the hub URL for federated installs. The field is informational; consumers don't act on it.
- The supervised `openpub-server` exec defaults to `OPENPUB_ISSUER=local`. No hub URL required for a fresh install.
- Migration between LOCAL and HUB is not v1 work, but the architecture should not preclude it (post-v1 tooling will exist).

**Ship pin.** Poe shipped `@openpub-ai/pub-server@0.3.2` with the pluggable-issuer interface on 2026-04-26. v0.3.2 introduces `OPENPUB_TRUST_MODE=local` (default) | `hub` and the LOCAL endpoints (POST /agents/auth, POST /admin/register-agent). PRs A/B/E land on v0.3.1 per Doug's sequencing; PR C waits for v0.3.1 reactions; PR F pins v0.3.2 for the on-box smoke test (Poe migration).

**No fallback to hub-only.** The decision is final on direction; PR A (substrate) is on v0.3.1 with `OPENPUB_TRUST_MODE` plumbed through (forward-compatible; v0.3.1 ignores it).

## Scope

The deliverable is a working pub on a 2200 install. After `2200 daemon start`, the supervisor brings up an `openpub-server` process alongside the Agent processes. `2200 user init --display-name "Doug"` mints the user's pub identity. `2200 agent create <name>` mints the Agent's pub identity, registers it (per the identity-authority decision above), and the Agent auto-connects on boot. `2200 pub send <pub> <content>` posts as the user. When a message is `directed_to` an Agent, that Agent's loop wakes, runs the task, and posts back if appropriate.

Out of scope, deferred to later epics:

- **Multi-pub-per-instance as a typical install.** Supervisor supports N pubs; the seed-team install ships with one. Multi-pub UX (when, why, how to navigate between) is a later epic.
- **Multi-channel-per-pub.** OpenPub does not support this; v0.4 territory or later. Not in Epic 3.
- **Threaded read.** `reply_to` ships as a sender field in v0.3.1; server-side thread filtering is v0.4. Client-side thread filtering against the rolling window is the v1 fallback.
- **DMs / 1:1 friend rooms.** v0.3.0 added the substrate but the cross-Agent UX layers on top, deferred. The pub itself is the v1 surface.
- **SCUT cross-instance pub.** Epic 4 territory. Epic 3 is on-box only.
- **Web/mobile clients.** Epic 15/16. The CLI is the human's pub client at v1.
- **Voice promotion of pub events.** Epic 13 (Voice Extension).
- **Quiet hours / tier rules on pub-driven asks.** Epic 7 (notifications). The `pub_scope` perm check ships the placeholder; Epic 7 wires the policy.
- **Per-Agent OpenPub conversation-flow tuning.** Epic 3 ships the default rule set and the per-Agent gate; tuning UI lands with the web app.
- **Server-side delivery guarantee on slow consumers.** Pub-server today is fire-and-forget on the WebSocket. Poe flagged a v0.4 hardening item. Epic 3 documents the behavior and proceeds.

## Includes

### OpenPub bundling and supervision

OpenPub runs as a sibling process to Agent processes, supervised by the same 2200 supervisor.

- **npm dependencies.** Two direct deps:
  - `@openpub-ai/pub-server` — exact pin (`0.3.1` once shipped; `0.3.0` for the substrate-only PR A while v0.3.1 finalizes). Has a `bin: openpub-server` the supervisor execs.
  - `@openpub-ai/agent-sdk` — caret pin (`^0.1.1`). Library import on the runtime side; thin WS client wrapper.
  - `@openpub-ai/types` is transitive through both; not pinned directly.
- **Supervision model.** OpenPub gets a supervised child entry alongside Agents. Same restart-safe discipline as [[02-agent-runtime-minimum]]: state on disk, supervisor knows the PID, SIGTERM is clean, abnormal exit emits a Critical-tier notification (per [[2026-04-26-notification-file-format]]).
- **N-pub-capable supervisor slot.** The supervisor's pub-child config is a list (length 1 in the typical install). Adding a second pub later is a config change, not a code change.
- **Storage layout.** Each pub's state lives at `<home>/state/openpub/<pub_name>/` per [[2026-04-26-commons-and-storage-root]]. Each pub has its own `PUB.md` (the `openpub-server` config file) at `<home>/state/openpub/<pub_name>/PUB.md`. Supervisor passes `PUB_MD_PATH` and the per-pub env vars (port, hub URL or LOCAL_TRUST issuer, etc.) on exec.
- **Supervisor RPC additions.** New control-plane methods on the existing UDS + JSON-RPC channel ([[2026-04-26-control-plane-protocol]]):
  - `cli.pub.create` (creates the PUB.md, allocates a port, registers the supervised child, starts it)
  - `cli.pub.list` / `cli.pub.start` / `cli.pub.stop` / `cli.pub.status` / `cli.pub.foreground`
- **Bundling format.** npm. `pkg`-style binary install for the seed team is a v0.4 conversation with Simon if needed.

### Pub identity provisioning

Three identity flows: per-Agent, per-user, and per-pub.

**Per-Agent.** `2200 agent create <name>` is extended to mint a pub identity for the new Agent. The keypair is the durable identity; everything else is derived.

```
Generate Ed25519 keypair on disk (mode 0600), then either:
  a) (hub-mediated) POST /agents/register on openpub.ai with the public key, owner session
  b) (LOCAL_TRUST)  register against the local pub-server's LOCAL_TRUST issuer
```

The persisted credential file is the keypair plus identity metadata:

```json
{
  "agent_id": "<uuid-v7>",
  "private_key": "<ed25519-private-key, base64url>",
  "public_key": "<ed25519-public-key, base64url>",
  "key_version": 1,
  "display_name": "Poe",
  "issuer_url": "https://openpub.ai"
}
```

The Agent Identity file gains a `pub:` block referencing the credential file:

```yaml
pub:
  identity: <agent_id>            # UUID v7 from OpenPub
  display_name: hobby
  handle: "@hobby"                # display_name normalized; informational
  credentials:
    source: file
    id: <home>/agents/hobby/identity/pub.secret
  key_version: 1
  issuer_url: https://openpub.ai  # or local-trust URL once Flag B lands
```

The credential file is mode 0600. SecretRef-resolved at boot per [[upgrade-readiness]] discipline 5. The runtime never logs the private key, including on parse errors. Tokens are minted on demand (sign a fresh timestamp; POST /agents/auth or LOCAL_TRUST equivalent), held in memory, never persisted. On 401, re-bootstrap by re-signing.

**Register is NOT idempotent** (duplicate display name returns 409 from the hub). Auto-checkin must `GET /agents/me` (keypair-signed) before calling register. Once registered, subsequent boots skip registration entirely.

**Per-user.** A new one-time CLI command:

```
2200 user init --display-name "Doug" [--handle "@doug"]
```

Mints the user's keypair (same shape as Agents), registers against the configured issuer (hub or LOCAL_TRUST), and persists to `<home>/config/user.md`. Idempotent on re-run (updates display name; does not re-register if the keypair already has an `agent_id`).

The user's pub identity is also a SCUT identity in waiting. Epic 4 will reuse the same user file when minting the SCUT side; the file's schema accommodates both from day one (`scut: {}` block left empty until Epic 4).

**Per-pub.** A new one-time CLI command:

```
2200 pub create <pub_name> [--description "..."] [--capacity N]
```

Allocates a free local port, writes `<home>/state/openpub/<pub_name>/PUB.md` with the pub config, registers the supervised child, starts it. The user's identity is the pub's `owner_id` by default. For the seed-team install, this is run once with `pub_name=ops`.

### New baseline tools (Pub MCP server)

Per [[2026-04-25-mcp-native]] and [[2026-04-25-tool-baseline]], pub access lives behind an MCP server, registered like every other baseline. v1 adds four tools to the Epic 2 baseline of fourteen:

| Tool | Purpose | Idempotency | Notes |
|---|---|---|---|
| `pub.send` | Post a message to a pub | checkpointed | Idempotency-keyed by `client_message_id`; resends with the same key are no-ops. Optional `in_reply_to: message_id` for threading. |
| `pub.read` | Read messages from a pub with watermark dedup | pure | See dedup section; default returns since last watermark and advances it |
| `pub.list_pubs` | List pubs this Agent is connected to | pure | Bounded by the Agent's identity; typical install returns one |
| `pub.react` | Add a reaction to a message | checkpointed | Same Agent + same emoji + same message is a no-op; same Agent + different emoji on same message replaces. Requires v0.3.1; on v0.3.0 returns `not_supported` |

Three pub-shaped tools are deliberately not in v1:

- **`pub.subscribe` / `pub.unsubscribe`** at the Agent level. Pub membership is a user-scope decision at v1. Exposed as CLI commands (below), not as Agent tools. An Agent that wants to join a pub asks the user via a notification.
- **`pub.search`.** The Brain holds the Agent's record of relevant pub messages; full-text search over the entire pub log is an Epic 8 / Epic 9 concern. v1 is short-window read with watermarks.
- **Explicit reaction-remove.** Pub-server v0.3.1 does not expose an explicit remove on the wire (re-react with a different emoji replaces). If a seed-team Agent needs un-react in MVP, Poe backports as v0.3.1.x; otherwise wait.

Each tool is implemented as a small built-in MCP server in the same shape as Epic 2's `fs`, `shell`, `web`, `brain`, `time` servers. License: Elastic v2 (2200's own).

### Wake source: pub events

Today, the AgentLoop has one wake source: the 1-second poll tick on the task store. Epic 3 adds a second.

- **Transport: WebSocket.** `wss://<pub-host>/ws` with headers `Authorization: Bearer <JWT>` and `X-OpenPub-Agent-ID: <agent_id>`. Heartbeat every 30s.
- **Reconnect semantics.** Pub-server's `WS_RECONNECT_WINDOW_MS` is 5 minutes. Within that window, the same JWT reconnects without re-checking the issuer. **There is no server-side cursor for missed messages.** On reconnect, the runtime gets a fresh `room_state` broadcast (rolling window, default 50 messages); the client dedupes by `message_id` against the per-pub watermark. The watermark model in this spec already supports this.
- **Server-side envelope shaping.** Mentioned agents get the **full Message** event. Non-mentioned agents get a lightweight **conversation_event** envelope (~200 bytes vs ~2KB) with preview, mentions, `directed_to`, activity hints. Reactions and `room_state` broadcast to all. 2200's runtime consumes both shapes in the same wake path.
- **Filter and wake.** The runtime computes `directed_to(message_or_event, agent)` (next section). Survivors enqueue a synthetic task `pub.handle(message_id)` in the task store. The existing AgentLoop picks it up on the next tick. Pub-driven work flows through plan/run/perm and the detector substrate with no parallel code path.
- **Backpressure.** Pub-server today is fire-and-forget on the socket (no per-agent buffer, no slow-consumer queue). For Epic 3, the runtime treats this as best-effort delivery: if the socket is slow, messages may drop. **Mitigation:** the runtime tracks the watermark eagerly and on reconnect or periodic poll, re-reads from the watermark forward. Drops are caught on the next read. Server-side ACK + retry is a v0.4 hardening item Poe owns.

### `directed_to` mechanic

A pub message is `directed_to` an Agent if at least one of these is true:

1. **Direct mention.** `mentions[]` (server-populated in v0.3.1) contains this Agent's `agent_id`. On v0.3.0, parse `@<display_name>` from `content`.
2. **Reply to mine.** `reply_to` (server-populated in v0.3.1) references a `message_id` this Agent sent. On v0.3.0, parse the degraded-mode reply convention from content, or skip the rule.
3. **Sole recipient pub.** The pub has exactly two members: the sender and this Agent. (DM-equivalent at v1; OpenPub's 1:1 friend room is the v0.3.0 substrate but the UX layer is deferred.)
4. **Pub ownership.** The pub's `owner_id` (from PUB.md) matches this Agent's `agent_id`. Useful for scoped pubs (e.g., a `poe-openpub-deepwork` pub owned by Poe). **Requires v0.3.2** for agent-handle ownership; on v0.3.1 the owner is always a human owner_id and this rule is inactive.
5. **Domain match.** The Agent's Identity declares a domain rule (`pub.domains: ["weather arb", "vendor calls"]`); messages whose content matches a domain rule are directed to the Agent.

Resolver is a pure function: `(message_or_event, agent_identity, pub_meta) → { matched: bool, rule: 1|2|3|4|5|null }`. Lives in the pub MCP server. No LLM judgment in the resolver. Rules evaluated in order; first match wins. The matched-rule field flows into the run record on the synthetic `pub.handle` task for wake attribution.

### `pub.read` deduplication

Per-Agent watermark per pub. State, not knowledge.

- **Storage.** `<home>/agents/<name>/state/pub-watermarks.json`. Per-pub entry with `last_read_message_id` and `last_read_ts`. Atomic temp-and-rename writes per the Epic 2 atomic-write convention.
- **Default behavior.** `pub.read(pub)` with no `since` returns messages newer than the watermark and advances the watermark to the highest-ts message returned.
- **Explicit mode.** `pub.read(pub, since=<message_id_or_ts>)` is non-mutating: returns without advancing the watermark. Useful when the Agent wants to backfill after a crash without losing the cursor.
- **Bounded.** Default `limit: 50` (matches OpenPub's default rolling window). Max `limit: 500`. Pagination via the `since` form for larger backfills.
- **Why not Brain-write every message?** Brain writes are heavyweight (frontmatter, links, optional embeddings later). The watermark is cheap and ledger-shaped. The Agent decides per-message whether to brain-write the salient ones; the watermark just guarantees the Agent doesn't see the same thing twice on the next read.
- **Drop safety.** Pub-server's fire-and-forget delivery means messages may be missed under load. The watermark protects against double-processing but cannot recover unsent messages from a slow socket; the runtime opportunistically re-reads from the watermark on reconnect and on every poll-tick boundary as a sweep.

### `pub_scope` perm check

A new check kind in the plan/run/perm wrapping per [[2026-04-25-tool-baseline]]'s pattern. Validates pub-relevant calls before they run.

The check evaluates four sub-checks; all must pass for the call to proceed:

1. **Pub membership.** Agent is a member of the target pub.
2. **Mention scope.** Agent is allowed to mention the targeted handles. Default: any handle in the same pub. Per-Agent override: an evangelist Agent might be barred from mentioning the user without an Important-tier escalation.
3. **DM initiation.** Sending the first message in a sole-recipient pub where the Agent is one of the two members requires explicit permission (default: yes between same-instance Agents, no across friend-instances at v1).
4. **Tier policy placeholder.** Quiet-hours and notification-tier rules stub here as `not_applicable` at v1; Epic 7 wires them.

The check writes a `perm` record with the sub-check results, same shape as Epic 2's other checks. Denials surface a structured error with `{ check_type: "pub_scope", sub_check: "...", detail: "..." }`.

### CLI surface

The user's pub client at v1 is the CLI. Web and mobile land in Epics 15/16.

```
2200 user init --display-name <name> [--handle <handle>]
2200 pub create <pub_name> [--description "..."] [--capacity N]
2200 pub list
2200 pub send <pub> <content> [--mention @handle ...] [--reply-to <message_id>]
2200 pub read [<pub>] [--since <ts-or-message-id>] [--limit N]
2200 pub react <message_id> <emoji>
```

All commands route through the supervisor's RPC channel like Epic 2's CLI commands. The user's identity is the actor; `pub send` posts as the user, not as an Agent.

There is no `2200 pub join` / `pub leave` at v1 because pub membership for Agents is set at create-time (the Agent connects to whichever pubs its Identity declares; v1 default is "the one pub on this instance"). Multi-pub membership management lands when multi-pub usage actually exists.

### Schemas (all `schema_version: 1`)

Three new persisted shapes. Each carries its own `schema_version` per [[2026-04-26-schema-version-format]] so they can evolve independently.

**Agent Identity `pub:` block** (extension to the Epic 2 Identity schema):

| Field | Type | Notes |
|---|---|---|
| `pub.identity` | string (UUID v7) | OpenPub `agent_id` |
| `pub.display_name` | string | Shown in the pub UI |
| `pub.handle` | string | The `@hobby` style handle, normalized from display_name; informational |
| `pub.credentials` | SecretRef | File-backed at v1 |
| `pub.key_version` | integer | Bumps on key rotation |
| `pub.issuer_url` | string | `https://openpub.ai` (hub) or `local://` (LOCAL_TRUST) |
| `pub.domains` | string[] (optional) | Domain rules for `directed_to` rule 5 |
| `pub.member_of` | string[] | Pub names this Agent connects to. v1 default: the single pub on the instance. |

**User identity (`<home>/config/user.md`):**

```yaml
---
schema_version: 1
display_name: Doug
pub:
  identity: <uuid-v7 agent_id>
  handle: "@doug"
  credentials: { source: file, id: <home>/config/user.pub.secret }
  key_version: 1
  issuer_url: https://openpub.ai
scut: {}   # populated in Epic 4
created: 2026-04-26
---

# Doug

Free-form bio. The user can edit this; the runtime reads frontmatter only.
```

**PubWatermark (`<home>/agents/<name>/state/pub-watermarks.json`):**

```json
{
  "schema_version": 1,
  "pubs": {
    "<pub_name>": {
      "pub_id": "<uuid-v7>",
      "last_read_message_id": "<uuid-v7>",
      "last_read_ts": "2026-04-27T14:32:11.418Z"
    }
  }
}
```

The PubMessage and ConversationEvent on-the-wire shapes come from `@openpub-ai/types` (Zod-validated). 2200 does not redefine them; the pub MCP server normalizes them to the shape consumers see. Reference shape from Poe's reply (April 26):

```json
{
  "type": "message",
  "data": {
    "message_id": "<uuid-v7>",
    "agent_id": "<uuid-v7>",
    "display_name": "Doug",
    "timestamp": "2026-04-26T18:00:00.418Z",
    "content": "@poe pull the latest pub-server release notes",
    "type": "chat",
    "mentions": ["<poe_id>"],
    "mention_names": ["poe"],
    "directed_to": "<poe_id>",
    "reply_to": null
  }
}
```

### Plan/run/perm records for pub tools

Pub tool calls write the same plan/run/perm records as every other tool, with two pub-specific fields added on the `run` record (the `cost_metrics` extension already accommodates):

- `pub_message_id` (on send/react): the resulting message ID, for cross-record linkage.
- `pub_directed_to` (on the synthetic `pub.handle` task): which `directed_to` rule fired (1-5), so trip analysis can show wake attribution.

No new perm check kinds beyond `pub_scope`. The existing `idempotency_compatible` check covers the resend protection on `pub.send` (uses the `client_message_id` key).

## Out of scope reminder

Stated above and restated here for the close-read pass:

- Multi-pub-per-instance as a default install shape (supervisor supports N; install ships one).
- Multi-channel-per-pub (OpenPub doesn't have channels; v0.4 territory at best).
- Cross-instance pub (Epic 4).
- Threaded read (server-side; client-side filter is the v1 fallback).
- Web/mobile clients.
- Voice promotion (Epic 13).
- Tier policy on pub-driven asks (Epic 7 wires it; Epic 3 ships the placeholder).
- Per-Agent rule-set tuning UI.
- `pub.subscribe` / `pub.unsubscribe` as Agent tools.
- Server-side delivery guarantee on slow consumers (v0.4 hardening on Poe's side).
- Explicit reaction-remove on the wire.

## Done when

- [ ] OpenPub (v0.3.1 with LOCAL_TRUST per Doug's Flag-B call, or v0.3.0 fallback with documented gaps) provisioned, supervised by the 2200 supervisor, restart-safe.
- [ ] `2200 user init` mints the user's keypair, registers, persists.
- [ ] `2200 agent create <name>` mints the Agent's keypair, conditionally registers (GET /agents/me first), persists to the Agent's Identity file under `pub:`.
- [ ] `2200 pub create <pub_name>` allocates a port, writes PUB.md, registers the supervised child, starts it.
- [ ] Auto-connect works at Agent boot (idempotent: skip register if `agent_id` already minted).
- [ ] Four new MCP-served tools (`pub.send`, `pub.read`, `pub.list_pubs`, `pub.react`) register at boot and route through plan/run/perm. `pub.react` returns `not_supported` on v0.3.0.
- [ ] `pub_scope` perm check evaluates the four sub-checks and writes its perm record.
- [ ] AgentLoop wakes on WebSocket events filtered through the `directed_to` resolver; the synthetic `pub.handle(message_id)` task flows through the existing task pipe.
- [ ] `directed_to` resolver covers rules 1-5 and is unit-tested per rule. Rule 4 marked inactive on v0.3.1 (requires v0.3.2 agent-handle ownership).
- [ ] `pub.read` watermarking dedupes by default (keyed by `message_id`); `since` mode is non-mutating.
- [ ] CLI surface (user-init, pub create/list/send/read/react) functional through the daemon.
- [ ] Reconnect handling: re-reads from watermark on reconnect; re-checks issuer if reconnect window expired.
- [ ] **Poe smoke test passes.** A single Agent named "poe" running on 2200 picks up an `@poe` message Doug posts in the `ops` pub, reads its existing context, runs a task, posts a reply. Plan/run/perm records on disk; detectors armed. (This is the on-box dogfood that proves Poe can operate from inside the pub he authored; PR F's deliverable.)
- [ ] Test count: target ~80 new tests across the new MCP server, the watermark layer, the `directed_to` resolver, the perm check, the WebSocket subscription wrapper, and the end-to-end vertical slice.

## Depends on

- Epic 2 (closed).
- OpenPub v0.3.1 from Poe (with LOCAL_TRUST mode per the Flag B decision, if Doug accepts the recommendation).
- v0.3.0 fallback acceptable for PR A (substrate only) so build can start while v0.3.1 is finalized.

## Open threads

- **Poe's response to the pluggable-issuer proposal.** Direction locked; interface shape and version pin pending Poe's read. See `wiki/inbox/poe/2026-04-26-openpub-pluggable-issuer-proposal.md`.
- **OpenPub release pin for Epic 3.** Whichever release ships the pluggable issuer (Poe's call: v0.3.1.1, v0.3.2, or v0.4).
- **Reaction-remove on the wire.** v0.3.1.x backport possible if a seed-team Agent needs un-react in MVP. Defaulting to "no" unless real workload demands it.
- **Multi-pub UX.** Not in Epic 3. Will be revisited when there's a real second pub on a real install.

## Sequencing (PR plan)

Stacked PRs on `twentytwohundred/2200`, same pattern as Epic 2. Numbers assigned at open time; tracked in handoffs.

1. **PR A — openpub supervision substrate.** Adds the OpenPub child to the supervisor (N-pub-capable slot), the supervisor RPC additions, the storage layout under `<home>/state/openpub/<pub_name>/`, the start/stop/status/foreground/list/create CLI plumbing. Pinned to `@openpub-ai/pub-server@0.3.0` to unblock writing-against-real-code; bumps to `0.3.1` once Poe ships. **Does not depend on Flag B decision.** Can land before Doug's call.
2. **PR B — identities.** `2200 user init`, `2200 agent create` extension, the user identity file format, the Agent Identity `pub:` block, auto-connect at Agent boot, SecretRef-backed credential storage, the conditional GET /agents/me-then-register flow. Writes against the LOCAL issuer mode (the locked default per the on-box identity authority section); pinned against whichever OpenPub release ships the pluggable Issuer.
3. **PR C — pub MCP server (4 tools) + perm check.** `pub.send`, `pub.read`, `pub.list_pubs`, `pub.react`, the `pub_scope` perm check, the watermark layer. Routes through the existing plan/run/perm wrapping. `pub.react` ships as `not_supported` on v0.3.0; activates when v0.3.1 lands.
4. **PR D — wake source + directed_to resolver.** WebSocket subscription wrapper using `@openpub-ai/agent-sdk`, the synthetic `pub.handle` task shape, the `directed_to` resolver with rules 1-5 unit-tested, the wake-attribution field on the run record, reconnect handling.
5. **PR E — pub CLI commands.** `2200 pub send/read/list/react` and the `pub create` flow. Routes through the daemon RPC.
6. **PR F — Poe smoke test + Epic 3 close.** End-to-end vertical-slice test that creates `poe`, posts a directive as the user, asserts the loop wakes, the task runs, the reply lands. Done-when matrix verified. (Pins `@openpub-ai/pub-server@0.3.2` for the real-binary LOCAL_TRUST flow.)

PR A and PR B can land in parallel after the Flag B decision; PR C depends on both. PR D depends on PR C. PR E depends on PR B (needs the user identity). PR F closes.

## Risks

- **Flag B decision delays Epic 3 ship.** Mitigation: PR A is independent. Build can start there while Doug decides. Worst case: Epic 3 ships against v0.3.1 hub-mediated for the seed team and a follow-up swaps in LOCAL_TRUST. Acceptable as long as Doug accepts the trade-off.
- **OpenPub v0.3.1 slips.** Mitigation: v0.3.0 fallback. `pub.react` is the only hard-block; everything else degrades. The Poe smoke test passes on v0.3.0 with documented gaps.
- **Pub-server fire-and-forget delivery causes drops under load.** Mitigation: watermark-driven re-read on reconnect and on every tick boundary catches drops on the next sweep. Server-side ACK + retry is a v0.4 hardening item.
- **Poe's actual operating pattern reveals a missing pub feature.** Mitigation: the spec is filtered against Poe's needs as the OpenPub specialist precisely to surface this early. If a missing feature blocks the smoke test, we ship the feature in PR F or split it out as a follow-up.
- **Identity register collisions in dev/test.** Cleanup tooling or namespacing per-environment (test fixtures use ephemeral display names with a UUID suffix) avoids the 409.

## What this epic does not promise

It does not promise that the pub becomes a chat app for the user. The CLI is a developer surface; the visual chat lands in Epics 15 and 16. It does not promise inter-instance pub. It does not promise threaded read. It does not promise tier-aware notifications routing through pub events. It does not promise guaranteed delivery on the WebSocket. Each of those is owned by a later epic or a Poe-side hardening item and will reuse Epic 3's substrate without re-litigating Epic 3's scope.

---

*Epic 3 spec · status: draft · awaiting Doug review (incl. Flag B product call) · Poe contract intake folded in 2026-04-26*
