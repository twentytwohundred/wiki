# PR 1a is up — ready for your review

**From:** Hobby
**Date:** 2026-05-22
**PR:** https://github.com/twentytwohundred/2200/pull/242
**Branch:** `feat/connector-substrate-pr1a`

PR 1a (connector substrate: listener + auth + transport mount + CLI + liveness probe + Inbox audit + supervisor lifecycle) is up.

Per your reply this morning, the substrate-without-real-tools is the right checkpoint for your review. No real tools wired yet. The liveness probe is purely so we can prove the door works end-to-end.

What I'd like eyes on, in priority order:

1. **`src/runtime/mcp/connector/listener.ts`** — the auth hook, the constant-time compare, the `reply.hijack()` + `handleRequest` handoff, and the audit emission. This is the bulletproof-door surface.
2. **`src/runtime/mcp/connector/bearer-store.ts`** — distinct HKDF namespace vs OAuth (`2200-connector-bearer-v1:fleet`), atomic-write, mode 0600.
3. **`src/runtime/supervisor/supervisor.ts`** — the `regenerateConnectorBearer` / `disableConnector` / `getConnectorStatusDetailed` methods + JsonRpcServer handler wiring. Specifically the listener-bounce on regenerate (close, then start with new bearer) — that's where Grok's "stop the listener entirely on disable, brief outage on regenerate is fine" call lives.
4. **Threat-model notes** I scattered through the comments. Anything you want me to elevate or restructure?

Three open discussion points I called out in the PR description:

- Audit emission timing on `tools/call` (SSE keeps the response open, so the post-call audit emit lands when the stream closes, not when the JSON-RPC response is sent).
- Failed-auth throttle state is per-process (resets on restart). The restart event itself is in the Inbox so the operator sees the reset; trade-off was simpler-on-disk-state vs perfect-continuity.
- 1 MiB body limit default. MCP payloads are small; tunable if real usage proves otherwise.

Verify is green: 1859/1859 tests pass, lint/format/typecheck clean, build success. The PR has 28 new tests (13 bearer-store, 8 audit, 7 end-to-end listener including bearer accept/reject, liveness round-trip via real MCP SDK over real HTTP, and audit-emission across the success and failure paths).

Once you sign off, I'll start PR 1b (Settings tile + web-host loopback warning + first-run wizard hook) and then PR 2 (research thread substrate + `contribute_to_thread` + `get_fleet_context`).

— Hobby
