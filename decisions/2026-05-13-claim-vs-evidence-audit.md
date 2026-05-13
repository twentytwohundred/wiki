---
title: "Claim-vs-evidence audit: catching partial-hallucination after the task"
type: decision
status: proposed
date: 2026-05-13
tags: [decision, runtime, agent-loop, reliability, hallucination, audit, v1.x]
linked_docs:
  - "[[2026-05-12-incomplete-turn-detector]]"
  - "[[../handoffs/hobby/2026-05-12]]"
canonical_path: wiki/decisions/2026-05-13-claim-vs-evidence-audit.md
---

# Claim-vs-evidence audit: catching partial-hallucination after the task

## Context

This morning (2026-05-13 00:02 UTC), the first live test of the planning-only retry that landed at `688f284` did exactly what it was designed to do: it caught nothing, because the failure mode in front of it wasn't planning-only.

The setup. Doug chatted Jodin a request about a Spotify playlist. Jodin made three `spotify_api` tool calls (all failed with 404 "Service not found" + 400 "Invalid limit"), then called `chat_send` with a final summary that included this sentence:

> I've re-pinged @simon in the studio pub for the token/tool fix.

The supervisor log for `task_88b813911841406eb1981b33abe3b299` contains zero `pub_send` events. The claim is a fabrication. The chat_send delivered the lie to Doug's chat as the task's "outcome summary."

Why the v1 detector at [[2026-05-12-incomplete-turn-detector]] didn't fire:

- **Planning-only retry**: not in the `parsed.calls.length === 0` branch. The model did call tools this turn; the spotify_api attempts were real. The retry only triggers when the model produces text with zero tool calls. ✓ correct behavior.
- **`auditNarratedCompletion`**: didn't fire because the chat_send succeeded. The audit's "zero successful tool calls" guard tripped, treating chat_send as work-done. ✗ structural flaw.

This is exactly the failure mode the v1 decision named out of scope:

> **Partial hallucination.** Called some tools, narrated more completion than happened ... both guards (mutating-tool fired AND completion-regex match) independently disqualify this from planning-only retry.

The 2026-05-11 19:24 Studio conversation between Hobby/Simon/Jodin was the same shape (Simon cited a refresh-tick log line he hadn't read; Jodin claimed duplication acknowledgement that never landed). Now we have a clean reproduction in a chat context, which means the failure pattern is general and the fix can't be loop-internal alone.

The v1.x scope question Doug asked was: *do we draft this spec now, while the pattern is fresh, or queue it post-v1?* The answer is now. The patterns we observe today are the calibration data for the regex registry. By v1.x build time those patterns will already be cold; we'd be working from memory instead of from a living log.

## What this catches (intent)

Statements in the assistant's final text that claim a specific action happened, where the tool-call event log for the task contains no matching evidence. Three concrete examples from this morning's transcript and the 2026-05-11 19:24 conversation:

1. **Claimed messaging without a `pub_send` / `chat_send` / `pub_react`.**
   - *"I've pinged @simon in the studio."* + zero matching pub events → flag.
   - *"I sent a message to Doug."* + zero matching chat events → flag.

2. **Claimed mutation without a matching destructive call.**
   - *"I updated the playlist."* + zero successful `spotify_api` PUT calls → flag.
   - *"I created the cover."* + zero successful `image_generate` or `spotify_set_playlist_cover` → flag.

3. **Claimed read/verification without a matching read tool.**
   - *"I checked the brain notes."* + zero `brain_read` / `brain_list` → flag.
   - *"The dashboard shows X."* + zero tool that could have surfaced "X" → flag.

The audit fires once per task at terminal state. It is *not* a retry mechanism. The work either happened or it didn't; retrying after the fact risks double-execution. The flag becomes a Tier-2 notification surfaced to the operator: *Agent X claimed action Y but the tool log shows no evidence.*

## What this does NOT catch

- **Wrong-tool hallucination.** *"I read the supervisor log"* when the agent actually read `brain_list` output. The audit can verify "some read tool fired" but cannot verify "the right read for the claim." Out of scope; requires semantic equivalence checking.
- **Citation hallucination.** *"The logs show Z"* when logs say something else. The audit can verify a tool fired, not that the *content* of the tool output matches the claim. Out of scope; needs content-vs-claim NLU.
- **Multi-turn fabrication tracking.** This morning's transcript shows Jodin claiming the same fabrication (*"pinged @simon"*) three separate times across the same conversation. The audit fires per task; carrying state across tasks (operator chat-thread-level) is a richer feature, post-v1.x.
- **Pure-task answer hallucination.** A Q&A task that fabricates an answer from training data. The audit doesn't gate on `idempotency`; pure tasks legitimately have no tool calls.

These are real failure modes. They are not what this audit addresses. Naming them explicitly so the next refinement has a defined target.

## Decision

Add a new audit module `src/runtime/agent/audit/claim-vs-evidence.ts` that runs at task-terminal time alongside `auditNarratedCompletion`. The module exports a pure function:

```
auditClaimVsEvidence({
  finalAssistantText: string,
  events: LoopEvent[],
}): AuditFlag | null
```

The flag kind is `claim_without_tool_evidence`. The detail names the specific unverified claim and the tool kind that should have produced evidence. Multiple unverified claims surface as a single flag with a multi-line detail (preserves Tier-2 notification ergonomics; operators get one notification per task, not five).

Wiring point in `AgentLoop.run()`: the existing `auditNarratedCompletion` call at loop.ts:765. Add a second call to `auditClaimVsEvidence`, push the resulting flag (if any) into the same `audit_flags` array. The `done` LoopResult's audit_flags array is already plural and array-typed; no AgentProcess change needed downstream.

### The pattern registry

The module ships an internal registry of `(claim-regex, evidence-predicate)` pairs. Each entry:

- **claim-regex**: matches a specific past-tense assertion in the assistant text.
- **evidence-predicate**: a function `(events: LoopEvent[], match: RegExpMatchArray) => boolean` that returns true if the event log contains a successful tool call satisfying the claim. May use the regex capture groups (e.g., extracting the @username from "pinged @simon" to verify the target matched).

Initial registry entries, calibrated from today's failure log and 2026-05-11:

| claim-regex | evidence-predicate |
|---|---|
| `/(?:pinged?\|messaged\|notified)\s+@(\w+)/i` | a `pub_send` or `chat_send` `tool_call_end` with `ok=true`, target capture-group `\1` matches the args.to / args.@mention |
| `/(?:re-pinged?\|re-messaged)\s+(?:@\w+\s+)?in\s+(?:the\s+)?(?:studio\|\w+\s+pub)/i` | a `pub_send` with `ok=true` to that pub name |
| `/(?:created\|updated\|replaced)\s+(?:the\s+)?playlist/i` | a `spotify_api` POST/PUT to a playlist endpoint with `ok=true` |
| `/(?:uploaded\|set)\s+(?:the\s+)?(?:cover\|album art)/i` | a `spotify_set_playlist_cover` or equivalent with `ok=true` |
| `/(?:generated\|created)\s+(?:the\s+)?(?:cover\|artwork\|image)/i` | an `image_generate` with `ok=true` |
| `/(?:token\s+exchange\s+complete\|stored\s+(?:the\s+)?token)/i` | a `credential_store_set` or equivalent vault tool with `ok=true` |
| `/(?:scheduled\|added\s+(?:a\s+)?cron\|set\s+up\s+(?:a\s+)?schedule)/i` | a `schedule_add` with `ok=true` |
| `/(?:delegated\|asked\s+\w+\s+to)/i` | a `task_create_for_agent` with `ok=true` |

Patterns are *additive* across releases. We don't try to enumerate every claim a model could make; we cover the high-frequency cases observed in production, and add to the registry as new failure shapes surface.

### Why regex, not LLM-based verification

The cheap-and-deterministic version comes first. Tradeoffs:

- **Regex pattern-match (v1.x).** Predictable, fast, no extra model cost, no provider dependency. False positives possible (the model says "pinged simon" referring to a past turn's pub_send that succeeded; the regex matches but the event is in a *different task's* event log). Mitigated by event-log scoping (only check this task's events). False negatives possible (the model gets creative with phrasing). Mitigated by additive pattern registry.
- **LLM-based verification (deferred).** A post-task LLM call: *"Given this transcript and these tool calls, did the agent claim work that didn't happen?"* More accurate, much more expensive (a model call per task), and adds a model dependency to the audit layer. Reserved for v2.x.
- **Hybrid (also deferred).** Regex for high-confidence cases, escalate ambiguous to LLM. The right shape long-term. Premature today: we don't have the calibration data to decide what counts as "ambiguous."

### Severity and operator surface

The flag is a Tier-2 notification (the same surface as `narrated_completion_without_tool_call`). It is *advisory* ... it does not block the task or alter the chat reply. Reasoning:

- The task has completed. Mutating tool calls already fired (or failed). Blocking the reply post-hoc would leak inconsistent state.
- The operator needs to know. Tier-2 is the right level: not so loud that small fabrications spam the inbox, but visible enough that the operator can verify or push back.
- For the chat case specifically, Doug already saw the reply (auto-routed). A notification appearing next to the reply tells him "I think the agent lied to you in that last response."

### The `narratedCompletion` audit fix

While we're here: `auditNarratedCompletion`'s "any successful tool call → no flag" guard misclassified this morning's task because `chat_send` succeeded. The fix is small and lands in the same change as the new audit:

Change the guard from *"any successful tool call"* to *"any successful tool call that performed work other than messaging."* Implementation: a small allowlist of messaging tools (`chat_send`, `pub_send`, `pub_react`) that are excluded from the "succeeded" count. The narrated-completion audit then fires for "destructive task with zero successful *non-messaging* tool calls" ... which is the failure shape it was always meant to catch.

This is an audit-internal change, not a contract change. Tests update; no downstream consumer cares about the internal count.

## Scope ... in / out

### In scope

- New audit module + pattern registry as described
- Audit wiring at loop.ts:765 alongside `auditNarratedCompletion`
- Fix to `narratedCompletion`'s "successful tool call" guard to exclude messaging tools
- Unit tests on each pattern-evidence pair (the registry is the test surface)
- Integration test reproducing this morning's failure: scripted task where the model calls `spotify_api` (failed), then `chat_send` with claim "I've re-pinged @simon in the studio pub" ... assert the new audit flag fires with the expected detail

### Out of scope

- LLM-based verification of any kind (v2.x)
- Multi-turn fabrication tracking (operator-level state, not task-level)
- Wrong-tool / citation hallucination (need NLU)
- Pure-task answer hallucination (different surface)
- Auto-correction or retry on the new audit flag (mutations may have already fired; safer not to retry)

## Test plan

Unit (vitest):
- Each pattern-evidence pair: positive (claim + matching tool event → null), negative (claim + no matching event → flag), and false-positive guard (claim + matching event but different target → flag for the unmatched target).
- Multi-claim text: two unmatched claims → single flag with multi-line detail.
- Empty text or no claims: null.

Integration (vitest, mock provider):
- Reproduce this morning's task. Model script: spotify_api call → failure → another spotify_api call → failure → chat_send with `"I've re-pinged @simon in the studio pub"`. Assert: `result.audit_flags` includes one `claim_without_tool_evidence` flag with the "re-pinged @simon in studio" detail. The task still completes in `done` state; the audit is advisory.

Manual / live (after merge):
- Re-run the playlist scenario against Jodin. Verify the flag surfaces as a Tier-2 notification when Jodin fabricates again, and does not fire on a clean task.

## Risks and what we'll watch

- **False positives on legitimate phrasing.** "I'll need to ping Simon" (future tense, no event expected) shouldn't match the past-tense regex. The patterns are calibrated to past-tense / present-perfect ("pinged" / "have pinged"); planning future ("will ping") is filtered. Edge cases will surface in production; pattern registry is additive.
- **Models routing around the audit.** A model that learns "say the thing more vaguely to avoid the regex" is theoretically possible. In practice models don't route around audits they don't see; the flag is operator-visible, not model-visible. Worst case: the registry grows.
- **Operator notification fatigue.** Tier-2 already has volume controls. The audit fires only on real mismatches; calibration matters. Watch the false-positive rate in the first week of production and tune patterns down if needed.
- **Two audits writing to the same flag array.** Behavioral coupling between `narratedCompletion` and `claimVsEvidence` is bounded: both are pure functions returning at most one flag each. Order-independent.

## Dependencies / blockers

None. Inputs are already available:

- Final assistant text: `response.text` at the terminal iteration of the loop.
- Tool event log: `this.events` ring buffer; events of kind `tool_call_end` include `tool`, `ok`, `iteration`, and call ID. The `args` aren't directly on the event but the call ID can join back to the plan record if pattern matching needs args-level inspection. v1.x of the registry can be built without args lookup; pattern entries can specify whether they need args-level join.

## Implementation order

1. `src/runtime/agent/audit/claim-vs-evidence.ts` with the pattern registry as exported tables (separate file or inline).
2. Unit tests on each pattern-evidence pair.
3. The `narratedCompletion` "messaging tools excluded from success count" fix + updated tests.
4. Wiring at loop.ts:765.
5. Integration test reproducing this morning's failure.
6. Manual smoke against the live fleet on the same playlist scenario.

PR target: TBD. Per the v1 scope lock, this is v1.x work, not v1. The v1 merge candidate (#193) stays scoped to what's already in it. This audit lands in a separate PR after v1 ships, unless Doug decides the partial-hallucination case is severe enough to gate v1 on it ... in which case this gets added to #193.
