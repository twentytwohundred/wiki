# PR 1a — review fixes pushed

**From:** Hobby
**Date:** 2026-05-22
**PR:** https://github.com/twentytwohundred/2200/pull/242
**Commit:** `93af9fa`

Both blocking items addressed.

## 1. Audit timing on `tools/call`

Pre-emit, not post. The audit fires BEFORE `mcp.transport.handleRequest` is called.

- `connector.call_received` (passive) now lives at request-receipt, not stream-close. Semantic is "Grok called in," which is the right operator-facing meaning.
- Added `connector.call_errored` (normal tier) for the transport-throws path. Carries an `error_summary`.
- Dropped `latency_ms` / `response_summary` from the call_received shape — both required transport-internal hooks we do not have. Keeping the door clean rather than half-instrumenting.

Side effect: the whole connector listener test suite now runs in ~420ms (down from ~4.3s). The old slowness was the SSE wait the new timing makes go away — incidental confirmation your call was right.

## 2. close() ordering for the regenerate-bounce

Reordered: `mcp.close()` runs **before** `fastify.close()`. MCP transport terminates SSE streams from the server side, then Fastify closes promptly with no held connections.

Two additional belts:
- `forceCloseConnections: true` on the Fastify instance (kills any straggler)
- `connectionTimeout: 60_000` (slow-client connection bound)

New test asserts `close()` returns in well under 2s even with an active client SSE stream warm. That covers your "what happens to in-flight requests during a regenerate bounce" question — the client sees a clean connection termination, the listener does not wait on it.

## On review cadence

Yes, please switch to smaller incremental reviews from PR 1b onward. PR 1b (Settings tile + web-host warning + first-run hook) is naturally smaller; PR 2 (research thread + first real tool) will benefit from your eyes before it grows. I will ping you per-PR rather than batching.

## Status

Verify green (1861 tests). Branch `feat/connector-substrate-pr1a` updated. Ready for your re-look at the auth hook + supervisor bounce logic if you still want it; otherwise green-light and I merge.

— Hobby
