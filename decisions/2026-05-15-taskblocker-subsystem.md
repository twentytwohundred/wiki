---
title: "Decision: TaskBlocker subsystem for human-gated and long-running operations"
type: decision
status: accepted
tags: [decision, architecture, agent-loop, blocking, human-in-the-loop, credential-request]
created: 2026-05-15
updated: 2026-05-15
linked_docs:
  - "[[2026-05-14-request-credential-substrate]]"
  - "[[2026-05-15-credential-lifecycle-hardening]]"
  - "[[2026-04-24-hobby-as-primary-agent]]"
canonical_path: wiki/decisions/2026-05-15-taskblocker-subsystem.md
---

# Decision: TaskBlocker subsystem for human-gated and long-running operations

**Status:** Accepted 2026-05-15

## Context

During the `request_credential` substrate implementation and subsequent hardening work (see [[2026-05-15-credential-lifecycle-hardening]]), repeated failure modes emerged:

- The Agent would emit additional `credential_request` calls for the same name after an earlier request had already been fulfilled.
- While the operator was still in the middle of satisfying a `credential_request` (typing/pasting the value), the Agent would continue producing new tool calls (`credential_has`, more `credential_request`, etc.).
- The model would not reliably produce a final assistant reply after verification without an explicit human nudge.
- Guidance messages and runtime guards improved behavior but did not eliminate the root problem: the `AgentLoop` had no first-class concept of a task being **blocked** on a human or external gate.

The original `request_credential` decision document stated that the tool should be blocking and that the loop should transition to a `blocked_on_user` state. In practice, the implementation relied on the tool's promise remaining pending (`waitForResolution`) combined with prompt rules and defensive guards. This approach proved insufficient once the model began generating new output while a long-running human interaction was still open.

The 2000+ line `AgentLoop` was already identified (both in the external architecture review and by Guppi) as a velocity and complexity risk. Continuing to add more ad-hoc guards and prompt text inside that loop would only increase technical debt.

## Decision

We will introduce a first-class **`TaskBlocker`** subsystem.

- Any operation that should pause the Agent's ability to think and act (human confirmation, external system wait, etc.) registers a `TaskBlocker`.
- The `AgentLoop` (and `AgentProcess` state machine) will refuse to start a new model completion or dispatch new tool calls while any blocker is active for the current task.
- Blockers are resolved explicitly when the human or external event completes (fulfill, decline, timeout, crash, etc.).
- `credential_request` will be the first consumer of this mechanism.

This replaces the previous "defensive layering" approach as the primary mechanism, while keeping existing guards as defense-in-depth.

## Rationale

1. **Correctness over prompt compliance.** We cannot reliably make the model follow a strict multi-turn human-in-the-loop protocol through instructions alone. The runtime must enforce the pause.
2. **Portability and future-proofing.** The same abstraction will be usable by `notification_ask`, future voice confirmation flows, external approval systems, and any other long-running gate. Each new gate will not require new hacks in the loop.
3. **Supports loop decomposition.** The blocker registry and resolution logic become a clean, testable module (`agent/blockers.ts`) rather than continuing to accrete inside the `AgentLoop`. This is a natural first extraction point for the decomposition work that has been deferred.
4. **Observability and mental model.** It becomes obvious (to operators, future Agents including David, and debugging tools) when an Agent is blocked and why.
5. **Matches the original contract.** This fulfills the "the tool is blocking" language from the `request_credential` decision document in a real, enforceable way.

### Alternatives considered

- **More prompt engineering + guidance messages only**: Rejected. We have already iterated several times with diminishing returns. The model can always find a way to generate new tool calls while a previous long-running call is pending.
- **Per-tool "isBlocking" flag + special casing in the loop**: Rejected. This would still bury the logic and would not scale cleanly to multiple simultaneous blockers or different blocker types.
- **Full loop decomposition first**: Rejected for this cycle. We are doing the minimal structural addition that solves the immediate correctness problem while creating a clean seam for later decomposition.

## Scope (this cycle)

**In scope:**
- New `TaskBlocker` type and `TaskBlockerRegistry` (minimal API).
- Integration in `AgentLoop`: check for active blockers before new model calls and before processing new `parsed.calls`.
- Wiring inside `credential_request` (register on dispatch, resolve on `waitForResolution` completion).
- Resolution from the existing fulfill/decline HTTP paths and from the tool itself.
- Clearing blockers when a task ends.

**Explicitly out of scope (for now):**
- Full extraction of the blocker system as a standalone module (can happen during loop decomposition).
- Applying the mechanism to `notification_ask` or other existing tools.
- New schema on `TaskRecord` (we can start with an in-memory registry scoped to the loop instance for the task lifetime).
- Changes to the scheduler, pub, or control plane.
- New UI surfaces for viewing active blockers (future observability work).

Existing runtime guards (`already_fulfilled_in_this_task`, creation-time lockfile, concurrent pending check) and guidance messages remain in place as defense-in-depth.

## Implementation plan (high level)

1. Create `src/runtime/agent/blockers.ts` with `TaskBlocker` interface and `TaskBlockerRegistry`.
2. Add a `blockers` registry to the `AgentLoop` (or a small `TaskContext` it already manages).
3. Add a guard at the start of the main run loop / before model completion: if any blockers are active, skip new model output.
4. In `doCredentialRequest` (inside the tool), register a blocker when beginning the long-running wait.
5. Resolve the blocker when `waitForResolution` returns (fulfilled, declined, expired) or on agent crash / archive.
6. Wire resolution from the HTTP fulfill/decline handlers as a secondary path.
7. Update the wiki hardening document and this decision record with implementation notes after the first working version.

## Consequences

**Positive:**
- Correct blocking semantics for `credential_request`.
- A reusable primitive for all future human/external gates.
- Clearer path toward `AgentLoop` decomposition.
- Better mental model and observability.

**Negative / Trade-offs:**
- Small increase in surface area (new registry that must be managed per task).
- Requires care around task lifecycle (blockers must be cleared on task end to avoid leaks).
- Initial implementation will be somewhat coupled to the current loop structure until decomposition work begins.

## Paper trail

- Full context and failure modes that drove this decision are in `wiki/research/2026-05-15-credential-lifecycle-hardening.md`.
- The original intent ("the tool should be blocking") is in `wiki/decisions/2026-05-14-request-credential-substrate.md`.
- This decision record captures the pivot from incremental defense to structural solution.

---

*Decision made live with the operator on 2026-05-15 after reviewing the "slow-bottle-breaker" and "slow-screwdriver" failure modes. Implementation follows immediately after this record is committed.*