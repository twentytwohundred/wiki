---
title: "Pub-server: ship a patched server.js, overlay it onto npm installs, never give it an LLM, persist chat on-box"
type: decision
status: locked
tags: [decision, pub, openpub, studio, persistence, runtime]
created: 2026-06-17
canonical_path: wiki/decisions/2026-06-17-pub-server-keepalive-overlay-no-bartender.md
linked_docs:
  - "[[2026-06-17-pub-registration-idempotency-and-operator-name]]"
  - "[[02-architecture]]"
---

# Pub-server keepalive overlay, no Bartender in the Studio, chat persistence on-box

**Context (2026-06-17):** on a running install, Agents (skippy/jodin) joined the
Studio and then vanished ~60s later, before they could answer a message. The Studio
also came back blank on every restart. Separate from the duplicate-participant bug
(that's [[2026-06-17-pub-registration-idempotency-and-operator-name]]); this record
covers why the pub-server is patched, why it has no LLM, and why 2200 owns chat
persistence.

## Root causes

1. **OpenPub `@openpub-ai/pub-server@0.3.3` never resets a socket's liveness on
   `pong`.** Its ping cycle therefore terminates each Agent's WebSocket ~60s after it
   joins, dropping the Agent from the room before it sees a message to answer.
2. **The patch wasn't reaching real installs.** 2200 already carried a fix, but it
   was applied only via pnpm `patchedDependencies` ... which `npm install` ignores.
   Dev (pnpm) was patched; every real `npm install -g` ran the unpatched,
   Agent-killing pub-server. Classic dev-only-fix trap.
3. **The pub-server's Bartender wanted an LLM it never had.** OpenPub ships a
   Bartender persona + conversation-memory-fragment generation, configured via
   `LLM_PROVIDER`/`LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL`. 2200 set none of them, so
   those calls 401'd, and the failed memory-fragment broadcasts further destabilized
   Agents' sockets. An intermediate fix (`2026.617.256`) ran the Bartender on the
   operator's fleet subscription ... then we reversed it: the Bartender shouldn't be
   in the Studio at all.
4. **OpenPub keeps only an in-memory conversation window** and explicitly delegates
   persistence to the on-box host. So Studio chat was lost on every restart.

## Decision

**Ship a patched `server.js` and overlay it at launch (`2026.617.327`, path fix
`2026.617.342`).** The patched pub-server lives in `dist`; at pub launch the
supervisor overlays it onto the installed `@openpub-ai/pub-server`, idempotently (a
no-op in the dev repo where pnpm already patched it). The patch (a) resets socket
liveness on `pong` so Agents stay connected, and (b) makes the Bartender + fragment
generation **clean no-ops when no `LLM_API_KEY` is set**. The overlay probes each
candidate entry depth for the shipped copy and takes the first that exists ... the
daemon's bundled entry is `dist/runtime/supervisor/bootstrap.js`, not the
`dist/vendor/...` the first cut assumed, which is why `.327` shipped the patch but
`.342` was needed to actually find it.

**The Studio is the operator and their Agents ... nobody else.** 2200 deliberately
**never gives the pub-server an LLM credential.** With the patched guards, the
Bartender + fragments are silent no-ops. There is no third persona in the room. This
reverses `2026.617.256`'s "run the Bartender on the fleet subscription" ... that was
the wrong direction.

**2200 owns chat persistence (`2026.617.1255`).** Each pub's chat is persisted to a
durable per-pub log `state/openpub/<pub>/messages.jsonl` (append-only on the hot
path, trimmed to the last 2000 messages). The messages endpoint serves the merge of
that log with OpenPub's live in-memory window, deduped by id. The Studio is populated
on entry, across restarts and fresh sessions. This honors the "files on disk, not
opaque state" build principle: the chat log is a readable file, not hidden server
state.

**The ambient router tolerates the subscription's concurrency limit
(`2026.617.1222`).** Every Agent in a room runs its own router LLM call to decide
"should I chime in," so one untagged message fired N simultaneous grok calls and the
SuperGrok subscription's concurrency limit 403'd them ... which the router read as
"nobody responds" and cached. The router now staggers each Agent's call with jitter,
retries transient failures (403/429/5xx/network) with backoff, and never caches a
transient failure. `@all`/`@everyone` extend the existing `@team` broadcast to wake
everyone deterministically (no router), word-boundary guarded.

## Why patch-overlay rather than fork or wait

- **Fork** the pub-server: heavier to maintain, and diverges from Poe's OpenPub line
  we want to track ([[02-architecture]] keeps OpenPub swappable). Rejected.
- **Wait for upstream**: the ~60s drop is a today problem on every real install; we
  can't gate the Studio on an OpenPub release. The overlay is the minimum that makes
  a published `npm install` correct without forking.
- **Give the pub-server the fleet LLM** (the `.256` attempt): wrong on principle ...
  it puts a third persona in the operator's Studio and spends the subscription on
  Bartender chatter. Rejected and reverted.

## Cost / follow-ups

- The overlay is a maintenance tie to pub-server internals (`server.js` shape). When
  OpenPub fixes the `pong` liveness reset upstream and supports a keyless/no-Bartender
  mode, the overlay becomes a no-op and can be retired. **Ask is on Poe** (paired with
  the idempotency ask in
  [[2026-06-17-pub-registration-idempotency-and-operator-name]]).
- Chat persistence is 2200-owned and won't migrate to OpenPub even if upstream adds
  its own ... the on-box log is the source of truth per the build principles.

## Status of the fix chain

Committed and CHANGELOG-documented through `2026.617.1412`. **Not yet independently
re-verified on a clean published install this session** ... that verification (Agents
stay past 60s, no Bartender, chat persists across restart, ambient answers land) is
the next test pass. See [[handoffs/hobby/2026-06-17]].
