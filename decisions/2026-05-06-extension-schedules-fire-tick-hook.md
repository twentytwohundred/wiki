---
title: "Extension schedules fire a tick hook"
type: decision
status: accepted
date: 2026-05-06
tags: [epic-12, extensions, schedules, hooks]
linked_docs:
  - "[[../epics/12-extensions-framework]]"
  - "[[../epics/06-scheduler]]"
canonical_path: wiki/decisions/2026-05-06-extension-schedules-fire-tick-hook.md
---

# Decision: Extension schedules fire a tick hook

## Context

Epic 12's Extension manifest declares `schedules[]`: a list of cron-style triggers the Extension wants to register. Phase A read the field; Phase B Phase 2 must give it semantics ... what fires when a schedule's cron expression matches the wall clock?

The Phase B substrate (PR #115) shipped lifecycle hooks for `install`, `uninstall`, and `update`. The manifest currently has no place for "fire X on this cron." Three reasonable paths:

1. **Synthetic task on a manifest-named primary Agent.** The Extension declares an `agent` field; on schedule fire, the runtime enqueues a synthetic task on that Agent. This makes Extensions "an Agent's helper" by design.
2. **Broadcast synthetic task to every Agent.** The Extension fires the same prompt across the fleet on each tick.
3. **Tick hook.** Add `hooks.tick?: string` to the manifest schema (non-breaking optional field). On schedule fire, the runtime runs the tick hook with the same capability-derived env as install/uninstall/update plus an `EXTENSION_SCHEDULE_ID` indicating which schedule fired. The Extension's hook decides what to do (write Brain notes, emit notifications, call its own tools, etc).

## Decision

**Option 3: tick hook.**

## Why

- **Extensions are platform-level, not Agent-bound.** Phase B substrate already established that Extensions live in `<home>/extensions/<name>/` and have their own state at `<home>/state/extensions/<name>/`, independent of any Agent. Forcing schedules to target a primary Agent re-couples Extensions to one Agent, which is the wrong default for a platform-level capability bundle.
- **Consistency with the existing hook contract.** The Phase B substrate already enforces capability-derived env, captured stdio, 30s timeout, and the in-process v1 isolation per `wiki/prior-art-analysis.md` §Epic 12. Adding `tick` as a fourth `HookKind` extends the same contract instead of introducing a new firing model.
- **Voice (Epic 13) needs this shape.** The flagship Extension's call windows / health checks / auto-redial behavior is per-Extension state mutation, not per-Agent task dispatch. A tick hook handles it cleanly; a primary-Agent synthetic task would force Voice through an Agent's task queue for actions Voice owns end-to-end.
- **Non-breaking.** `hooks.tick?: string` is an optional field. Existing manifests without it install fine; the runtime simply doesn't fire schedules they declared (warned at install time when `schedules` is non-empty without a tick hook).
- **Future-proof.** A future Extension that genuinely wants to enqueue an Agent task can do so from inside the tick hook (via a CLI call or supervisor RPC), but the runtime doesn't bake "schedules == Agent tasks" into the platform.

## Implementation notes

- Manifest schema: add optional `tick` to `hooks` ... no `schema_version` bump (additive).
- Schedule storage: `<home>/state/extensions/<name>/schedules/<schedule_id>.json` ... mirrors per-Agent schedule layout.
- `Scheduler` service (Epic 6) extended to scan both per-Agent schedules AND per-Extension schedules. Job key: `extension:<name>:<schedule_id>` per the Epic 12 spec.
- On schedule fire, the Scheduler runs the tick hook with the standard `HookExecArgs` shape from `src/runtime/extensions/hooks.ts` plus `EXTENSION_SCHEDULE_ID=<id>`. Hook failure is logged + counted but does NOT disable the schedule (operator intervention required to disable a misbehaving Extension's schedule).
- Install orchestrator: when manifest has `schedules[]` non-empty, the `schedule` permission must be granted. When `hooks.tick` is missing in that case, the install warns but proceeds (operator may want to declare schedules for later use). When `hooks.tick` is present and a tick fire would not work (e.g., script doesn't exist), the runtime surfaces the error in the scheduler log on each fire.
- Uninstall: delete the per-Extension schedule files. Scheduler reload picks up the removal.
- Update: reconcile manifest schedules vs. existing on-disk ... add new, remove removed, update existing. Don't reset `last_fired_at` for unchanged ids.

## Alternatives considered

- **Manifest-named primary Agent (Option 1).** Rejected: re-couples Extensions to Agents and complicates multi-Agent Extensions (which the Epic 12 spec explicitly anticipates).
- **Broadcast to every Agent (Option 2).** Rejected: surprising default, hard to reason about, easy to spam the fleet.
- **Advisory only / Extension wires its own firing.** Rejected: forces every Extension author to reinvent cron + persistence + recovery semantics that the Scheduler already solves correctly.

## Out of scope (separate decisions)

- **Tool registration semantics.** The Extension manifest's `tools[]` field is structurally present but its v1 meaning ("tools the Extension brings" vs. "tools the Extension depends on") is not yet locked. Tool registration is deferred to a follow-up sub-PR that pairs with the MCP-by-Extension contract design.

## References

- [[../epics/12-extensions-framework]] § Phase B
- [[../epics/06-scheduler]]
- [[../prior-art-analysis]] § Epic 12 (in-process v1 with permission kernel chokepoint)
- Source: `src/runtime/extensions/{types,install,hooks}.ts`, `src/runtime/scheduler/service.ts`
