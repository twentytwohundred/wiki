---
title: Retire the idempotency_compatible perm check
type: decision
status: locked
date: 2026-05-09
tags: [decision, perm, dispatcher, idempotency, simplification]
linked_docs:
  - "[[../epics/09-tool-system]]"
  - "[[../handoffs/hobby/2026-05-09]]"
canonical_path: wiki/decisions/2026-05-09-idempotency-perm-retired.md
---

# Retire the idempotency_compatible perm check

## Context

The dispatcher's perm matrix included an `idempotency_compatible`
check that enforced this matrix:

```
pure         task -> pure tools only
checkpointed task -> pure or checkpointed tools
destructive  task -> any tool
```

Every tool definition declared an `idempotency` category
(`pure` / `checkpointed` / `destructive`); every task carried one
too. The check denied a tool call when the task's category
couldn't admit the tool's.

The original intent was restart-safety: if a task was classified
`pure`, its calls had to be safely re-executable, so the matrix
prevented `pure` tasks from calling `destructive` tools.

## What went wrong

Session 13 (2026-05-08) the operator asked an Agent in chat to
add a schedule via `schedule.add`. Chat tasks defaulted to
`checkpointed`. `schedule.add` was `destructive`. The matrix
denied the call. The Agent reported back to the operator:
"the runtime won't let me run this tool from this task category."
The fix was to bump chat-task default to `destructive` so the
matrix admitted any tool ... a workaround that proved the rule
wrong, not the default.

The reviewer's diagnosis on 2026-05-09: "If a tool requires
permission, that's an authorization problem, not an idempotency
problem." The matrix was conflating two concerns:

- **Authorization**: which tools is this Agent allowed to call?
  Already handled by `tool_in_set` against `allowedToolNames`.
- **Restart safety**: if a task gets re-executed, does its tool
  call sequence remain safe? No automatic task-restart based on
  idempotency category has ever been implemented; the matrix was
  protecting a behavior that doesn't exist.

The matrix was blocking real work to protect against a hypothetical
scenario.

## Decision

Retire the `idempotency_compatible` check. Keep the `idempotency`
field on tool definitions and tasks ... it's still useful as
metadata (telemetry, future restart logic, audit). But it no longer
gates calls.

Surfaces affected:

- `src/runtime/tools/perm/evaluator.ts` ... `idempotencyCompatible`
  removed from `ACTIVE_CHECKS`. Listed in `INACTIVE_PLACEHOLDERS`
  with a `not_applicable` outcome and the retirement note in
  `detail`, so historical perm records still parse.
- `src/runtime/tools/perm/checks/idempotency-compatible.ts` ...
  the implementation file stays around (un-imported); future
  reactivation would just re-add it to `ACTIVE_CHECKS`.

The chat-task and orientation-task `idempotency: 'destructive'`
defaults set as a workaround in earlier session 13 commits could
technically be relaxed now, but I'm leaving them as the honest
classification: chat input is implicit destructive authorization;
orientation includes `brain_write_shared` and `chat_send`.

## Why not just keep the matrix

Three reasons:

1. **It's blocking real, intended work.** The matrix denied calls
   the operator explicitly authorized (a chat-message direct ask
   for a destructive tool). Defaulting EVERY chat-task to
   `destructive` makes the field meaningless.
2. **It was protecting non-existent behavior.** No code in the
   runtime restarts a task based on its idempotency category. The
   safety the matrix was guarding was never implemented.
3. **Tasks can already restrict their tool surface explicitly.**
   The dispatcher takes `allowedToolNames`. A task that wants to
   restrict the tool surface for a specific run can declare an
   explicit allow list ... ACL, not category matrix. More
   predictable than a 3x3 matrix that mixes authorization with
   restart-safety.

## Trade-offs

- **Future restart logic loses a hint.** When we eventually want
  task-restart behavior (e.g., crash recovery), we'll need to
  reason about which tool calls are safe to re-run. The
  `idempotency` metadata on each tool is still there for that.
  We just won't gate calls during normal execution on it.
- **Older perm records that show `idempotency_compatible: fail`
  remain on disk** for any operator who ran 2200 before this
  change. They're history; the dispatcher no longer produces new
  failures of that shape.

## Consequences

### Immediate

- Chat-originated tasks can call any tool the Agent has been
  granted, regardless of the chat-task's idempotency
  classification.
- One fewer perm check in the dispatch path. Tiny perf win;
  larger conceptual win.

### Future

- Tasks that genuinely need to restrict their tool surface
  (research-only mode, planning-only mode) declare an explicit
  `allowedToolNames` rather than relying on a category matrix.
- If task-restart logic ever lands, it'll consume the
  `idempotency` field as metadata to decide which tool calls
  must be re-executed vs skipped on resume.

## Implementation pointers

- `src/runtime/tools/perm/evaluator.ts` ... ACTIVE_CHECKS list,
  INACTIVE_PLACEHOLDERS list.
- `src/runtime/tools/dispatcher.ts` ... no changes needed; the
  perm matrix dropping out is transparent at dispatch time.

## Provenance

Antigravity codebase review on 2026-05-09 (item #4, "The Perm
Matrix & Idempotency System"). Implementation in PR #182. Locked.
