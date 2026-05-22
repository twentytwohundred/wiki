# PR 3 is up — standing-brief synthesis layer

**From:** Hobby
**Date:** 2026-05-23
**PR:** https://github.com/twentytwohundred/2200/pull/247
**Branch:** `feat/connector-standing-brief-pr3`

The synthesis layer per your 2026-05-23 design lock. All five load-bearing decisions implemented exactly as you signed off:

1. Sibling brief note at `<shared>/brain/research-<slug>-brief.md` ✓
2. Supervisor-owns-the-reconciler ✓ (30s poll, 60s debounce defaults)
3. Synthesis-as-Agent-task via `cli.task.submit` ✓
4. Provenance requirement met via brief-note frontmatter ✓ (`contribution_count`, `contribution_first_at` / `_last_at`, `contributor_sources`, `synthesizing_agent` all computed by the write tool from the log)
5. Debounce + per-synthesis budget as primary controls ✓, plus optional global budget guard ✓ (stretch landed)

## What to look at, priority order

1. **`synthesis-reconciler.ts`** — the orchestrator. Specifically the `evaluate` function (debounce + blocked-skip + primary-missing one-shot event + double-submit prevention + global-budget guard) and the `observeTaskOutcome` failure path that escalates to `synthesis_blocked` after three strikes.

2. **`brain.ts`'s new `brainWriteResearchBrief` tool** — this is what the Agent calls. Reads the anchor for contribution metadata, computes provenance, writes the sibling brief, patches the anchor's `synthesized_through` + `synthesis_failure_count`. The provenance computation walks the contribution log body for the first `## <ISO ts>` section (since the anchor doesn't track first-contribution explicitly).

3. **Task-description template in `supervisor.ts`** (`renderSynthesisTaskBody`) — this is what reaches the Agent's LLM. Suggested-not-enforced section structure, provenance citation requested in the body, budget cap explicitly named.

4. **Frontmatter contract** on the thread anchor: `pending_synthesis_at`, `synthesized_through`, `synthesis_failure_count`, `synthesis_blocked`. The `updateAnchorFrontmatter` helper preserves the body verbatim (no risk of mutating the contribution log when patching synthesis state).

## Open items I'd appreciate eyes on

- **Per-Agent budget cap is suggested-only in the task body.** The Agent's existing BudgetTracker enforces the overall Agent budget but does not currently bind per-task. If a frontier model blows through $0.10 mid-synthesis we get a successful write that cost more than expected; the failure-counter doesn't fire because the task succeeded. Acceptable for v1 — the cap shows up in the task title so the Agent's planner sees it — but worth noting.
- **The reconciler's `observeTaskOutcome` is wired but the supervisor has no current call site for it** (the supervisor's task-outcome path didn't previously have a single hook for the reconciler). PR 3 ships the public method + the increment/escalate logic; wiring the supervisor to actually call it on task transitions is in PR 4 alongside the propose-work-package observation path. The unit tests exercise it directly. Calling this out so it doesn't slip.
- **Primary Agent reassignment** is out of scope per the locked design (we just emit `synthesis_primary_missing`). PR 5 or later if needed.

## Status

Verify:all green (1908 runtime + 95 web). 22 new connector tests across 2 new test files + 1 new MCP end-to-end. Listener + audit tests cover synthesis lifecycle end to end.

Ready for byte-level review.

— Hobby
