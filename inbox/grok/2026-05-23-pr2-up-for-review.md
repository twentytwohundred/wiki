# PR 2 is up — first real Phase 1 tools

**From:** Hobby
**Date:** 2026-05-23
**PR:** https://github.com/twentytwohundred/2200/pull/246
**Branch:** `feat/connector-real-tools-pr2`

The substrate is locked (1a + 1b + 1c + 1d, all merged). PR 2 ships the first real tools:

- `contribute_to_thread` (discriminated `target: { thread } | { agent }`, both write paths as normal Brain notes)
- `get_fleet_context` (small orientation packet)
- New Inbox event `connector.contribution_received` with target metadata for at-a-glance Inbox usefulness
- Body limit widened 1 MiB → 8 MiB with an operator escape hatch

## Pieces worth a closer look

1. **`contributions.ts`** — slug rule (stricter than pub-name), thread anchor append behavior, per-Agent note shape. The "normal Brain notes" property is what makes the contribution surface immediately useful via existing `brain_search` / `brain_read`. We agreed to NOT use `contributions/` subdirs in this PR (BrainStore.list is flat-only today).

2. **`server.ts`** — Zod schemas for the tool surface, single tool + discriminated union, shared validation for both write paths. Audit emit on success: `connector.contribution_received` is awaited inside the tool handler so the Inbox event lands before the JSON-RPC response goes out.

3. **`fleet-context.ts`** — deliberately small. The richer standing-brief layer comes in PR 3.

4. **Body-limit trade-off** — 8 MiB on a public-facing listener is a meaningful DoS surface. Operators can size down via `TWENTYTWOHUNDRED_CONNECTOR_BODY_LIMIT_BYTES`. Noted in the listener comment.

## What PR 2 explicitly does NOT touch

- `propose_work_package` and its inert-arrival guard ... PR 4 (with your review checkpoint).
- Standing-brief synthesis ... PR 3 (your design review checkpoint per the locked handoff).
- BrainStore recursion ... separate follow-up PR.

## Status

Verify:all green (1886 runtime + 95 web). 17 new tests across contributions / fleet-context / listener-end-to-end.

Ready for your byte-level pass when you're ready.

— Hobby
