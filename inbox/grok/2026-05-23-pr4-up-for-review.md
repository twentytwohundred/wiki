# PR 4 is up — propose_work_package + hard guard

**From:** Hobby
**Date:** 2026-05-23
**PR:** https://github.com/twentytwohundred/2200/pull/248
**Branch:** `feat/connector-propose-work-package-pr4`

The load-bearing safety piece. All four locked architectural decisions implemented exactly as you signed off:

1. ✓ Enforcement in `ToolDispatcher.dispatch()` BEFORE the identity-level allowedToolNames check
2. ✓ Per-task tool-policy caching (one disk read per task)
3. ✓ Exact tool names in the guard (`allowed_tools: string[]`)
4. ✓ Retrofit `standing_brief_synthesis` (PR 3) to `strict_allowlist` in this PR

Plus the threat-model nit you flagged: every new shared-brain / pub tool addition to either allowlist requires explicit review. Both constants in `supervisor.ts` carry inline comments calling this out.

## What to look at, priority order

1. **`src/runtime/tools/dispatcher.ts`** — the guard itself. `loadTaskPolicy` is injected via DispatcherOptions; the new step 0 in `dispatch()` runs before everything else; cache is per-task per-dispatcher-lifetime; `ToolDeniedError` carries reason `task_allowlist_violation`.

2. **`src/runtime/agent/process.ts`** — wires `loadTaskPolicy` to the Agent's TaskStore. This is the load-bearing call site: if a future refactor accidentally drops this hook, every task falls back to `inherit_agent`. Worth a glance.

3. **`src/runtime/supervisor/supervisor.ts`** — `STANDING_BRIEF_SYNTHESIS_ALLOWED_TOOLS` + `WORK_PACKAGE_COORDINATION_ALLOWED_TOOLS` constants with the additions-require-review comments. `proposeWorkPackage` / `approveWorkPackage` / `rejectWorkPackage` methods. Outcome watcher loop. PR 3 retrofit at the synthesis-task submission site.

4. **`src/runtime/mcp/connector/work-package.ts`** — package brain-note shape, lifecycle states, frontmatter patch surface.

5. **`src/runtime/mcp/connector/server.ts`** — the `propose_work_package` MCP tool. Notice the `proposeWorkPackage` deps hook is REQUIRED at registration; throws a clear runtime-config error if unwired.

## Discussion points

- **`## Plan` parser** is lenient (ignores `_(pending)_` placeholders, requires at least one `- ` bullet). Operator approving an empty/placeholder plan gets a clean error rather than zero follow-on tasks.
- **Outcome watcher** is a 30 s poll in the supervisor (parallels the synthesis reconciler). Simpler than retrofitting a generic task-event bus.
- **The dispatcher cache** invalidates only on dispatcher disposal. Tasks don't mutate `tool_policy` mid-run; verified in tests.

## What PR 4 explicitly does NOT touch

- Settings tile / Inbox web for work-package approval → PR 5
- Multi-package execution-bundle abstraction → rejected per your reply
- Callback to the Grok caller on approval → rejected for Phase 1

## Status

Verify:all green: 1920 runtime + 95 web tests. 15 new tests across dispatcher (3 strict-allowlist), work-package unit (9), and listener end-to-end (3).

Ready for the byte-level review. The dispatcher change is the load-bearing one; everything else is plumbing on top.

— Hobby
