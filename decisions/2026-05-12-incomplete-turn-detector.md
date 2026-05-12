---
title: "Incomplete-turn detection + retry inside AgentLoop"
type: decision
status: proposed
date: 2026-05-12
tags: [decision, runtime, agent-loop, reliability, hallucination, v1-scope]
linked_docs:
  - "[[../handoffs/hobby/2026-05-12]]"
  - "[[2026-05-11-platform-integration-pattern]]"
  - "[[../research/2026-04-26-claude-code-architecture]]"
canonical_path: wiki/decisions/2026-05-12-incomplete-turn-detector.md
---

# Incomplete-turn detection + retry inside AgentLoop

## Context

Yesterday's session 17 surfaced the same failure pattern from multiple angles:

- **19:24 Studio coordination.** Three Agents talked for 10 minutes about Spotify auth. "Hobby" produced a Python file that architecturally cannot work. Simon cited a refresh-tick log line he had not read. Nobody chat_sent the operator despite work being blocked on him.
- **Earlier in the day, TRL pipeline.** Grok-Jodin's destructive task fired one LLM call, zero tool calls, and produced an 821-token success narrative claiming playlists were created. None of it happened. (This one already gets caught by `auditNarratedCompletion`, post-hoc.)
- **The 13:58 brain log.** Claimed a "successful run" written while every Spotify write tool was failing.

Three shapes of the same root cause: the model can finish a turn with confident prose that does not match what tools actually returned (or that there were no tools at all). The session-17 handoff named this for what it is ... "we'll need a loop-level audit (Option 2): detect past-tense narration without tool calls and force a chat_send."

We have layered system-prompt rules to address it ... `system-prompt.ts` now ships three load-bearing rules around verify-before-asserting and chat-on-action-items. They reduce the frequency. They do not eliminate it. Yesterday's 19:24 conversation happened *after* the rules landed.

**Architectural prior art (concept only).** OpenClaw (the leaked Claude Code source mirrored at `code/2200-reference/openclaw/`) solves this with a structural in-loop check, not just prompt rules. Their `src/agents/pi-embedded-runner/run/incomplete-turn.ts` resolves three failure shapes per turn ... planning-only, reasoning-only, empty-response ... returns either an instruction string or null, and the runner injects the instruction into the next iteration's prompt and continues. Retry budgets are per-shape, between 1 and 2.

The convergence is the signal: a productionised platform with millions of seat-hours converges on loop-level enforcement *plus* system-prompt rules. We have only the prompt half. This decision adds the loop half.

**Hard constraint:** OpenClaw is under leaked-source legal exposure. No code-lift. Pattern only. Every line of 2200's implementation must be ours, written from the structural understanding of what the resolvers detect and how they slot into the loop.

## What we already have

2200's `AgentLoop` (`src/runtime/agent/loop.ts`) ships three partial mechanisms today:

1. **`emptyResponseNudges`** (loop.ts:776). When the model produces no text and no tool calls, the loop injects a single tool-role message asking for a final answer, then continues. Budget: 1. After that, the loop terminates with "agent terminated with empty response after nudge."

2. **`pubWakeNudges`** (loop.ts:755). When a pub-wake task ends with text-only (no `pub_send` / `pub_react`), the loop injects a wake-nudge prompting the missing tool call. Budget: 1.

3. **`auditNarratedCompletion`** (`src/runtime/agent/audit/narrated-completion.ts`). Post-task. Fires only when a `destructive` task completes with zero successful tool calls. Surfaces a Tier-2 notification. Does not retry.

What's missing:

- A planning-only retry. The model produces visible text that describes work *it will do* without doing it ... and the loop currently treats text + zero tool calls as a clean termination if the text isn't empty (loop.ts:746-774). Yesterday's 19:24 failure rides right through this path.
- A missed-chat_send retry. We have the pub-wake equivalent. We don't have the chat-wake one. If Doug chats Jodin "what's the status," Jodin can do internal work and end the turn without ever calling chat_send back. Loop sees text → calls it done → operator gets nothing.
- A larger retry budget on the empty-response nudge. One shot is too few when frontier models can produce two consecutive empty turns under load.

## Decision

Add a new module `src/runtime/agent/incomplete-turn.ts` that exposes one new resolver plus shared retry-budget constants. Wire it into `AgentLoop.run()` at the "no tool calls" branch (loop.ts:745). The resolver returns either an instruction string or null. The loop tracks per-shape retry budgets, increments on retry, and surfaces a structured failure when exhausted. Adjacent budget bumps on the two existing nudges land in the same PR.

### Scope refinement vs. the original spec

The original spec proposed three resolvers (planning-only, missed-chat_send, extended-empty-response). On deeper read of the chat-task flow (`server.ts:2520-2555`), chat tasks already auto-route their final answer to the chat log on every terminal state ... done OR errored. A `resolveMissedChatSendRetry` would either no-op (because the auto-route delivers) or fire on cases that overlap with planning-only / empty-response. The remaining failure mode it would catch ... "agent's final answer is technically non-empty but doesn't actually address the operator's question" ... is the partial-hallucination class we already named out-of-scope.

Dropped from v1: `resolveMissedChatSendRetry`. The chat-side improvement Doug cares about will come from planning-only catching the "I'll check and report back" pattern (which IS the v1 case) plus the budget bumps below.

### The new resolver

**`resolvePlanningOnlyRetry()`** — Detects the "I'll do X next" pattern that doesn't get done. Inputs: visible assistant text, the last user message (for the actionable-prompt gate), and whether prior iterations in this task ran any tool calls successfully (the cumulative side-effects guard, mirroring OC's `replayMetadata.hadPotentialSideEffects`). Pattern detection: a "promise" regex (`i'll`, `i will`, `let me`, `i'm going to`, etc.) without a "completion" regex (`done`, `finished`, `implemented`, etc.), or a structured "Plan:" heading with bullets and promises. Instruction: "The previous turn described work without performing it. Do not restate the plan. Take the first concrete tool action now. If a real blocker prevents action, state the blocker in one sentence."

### Budget bumps on existing nudges

Same PR, surgical:

- `emptyResponseNudges`: 1 → 3
- `pubWakeNudges`: 1 → 3

These are not new resolvers ... they're already-in-place mechanisms with a single-shot budget that's too tight. Bumping to 3 brings them into parity with the new planning-only budget.

### Retry budget

3 per resolver, per task. Doug's "2-3 should be enough." 3 gives margin. Budget resets when the task ends. If all three resolvers' budgets are exhausted on the same task, the loop terminates the task as `failed` with a structured reason (`incomplete_turn_retries_exhausted`) and `auditNarratedCompletion` will still see the events as it does today.

### Guard conditions

All three resolvers return null on any of:

- Task aborted, hit max iterations, or hit a detector trip
- Any tool dispatch returned a structured error this turn (don't retry on top of broken tools)
- Any mutating tool fired this turn (mutation already happened; retrying would risk double-execution)
- The agent already sent an outbound message this task (`chat_send` for chat-wake, `pub_send` / `pub_react` for pub-wake)
- Deterministic approval prompt pending (waiting for operator)

The mutating-tool signal: we already classify tools by side-effect class (`destructive` / `mutating` / `pure`). The resolver consumes the list of tool calls made this turn and asks "did any of these mutate." This is sourced from the same `is-mutating-tool` registry we already maintain.

### Where it lives

- **Detector module:** `src/runtime/agent/incomplete-turn.ts`. Resolvers, instruction constants, retry-budget constants, type defs.
- **Tests:** `tests/runtime/agent/incomplete-turn.test.ts` (unit) + `tests/runtime/agent/incomplete-turn-integration.test.ts` (loop-level).
- **AgentLoop integration:** loop.ts:745 (the "no tool calls" branch). Three new local state vars (`planningOnlyRetryAttempts`, `missedChatSendRetryAttempts`, replace `emptyResponseNudges` with `emptyResponseRetryAttempts` for consistency). Resolver call after each iteration, retry-with-instruction shape mirrors what `pubWakeNudges` does today (push assistant turn into history, push a tool-role message with the instruction, `continue`).

### What stays unchanged

- `auditNarratedCompletion` stays. It's a different layer ... post-task verification on destructive tasks. The new resolvers operate inside the loop; the audit operates on the event stream after the loop returns done. They complement.
- `pubWakeNudges` stays. We could later subsume it into the new module, but for v1 we leave existing code in place and add alongside. (Simplicity first; surgical changes; don't refactor what isn't broken.)
- System-prompt rules stay. They reduce frequency; the new detector handles what the rules don't.

## What this catches / what this does not

### Catches

- **Pure planning-only.** "I'll check the logs and report back" with zero tools fired. Caught by `resolvePlanningOnlyRetry`.
- **Missed chat_send.** Chat-wake task, operator asked a question, agent did internal work and ended the turn without calling `chat_send`. Caught by `resolveMissedChatSendRetry`.
- **Empty response.** No text and no tool calls. Already caught today; this PR raises the retry budget from 1 to 3.

### Does NOT catch

- **Partial hallucination.** Called some tools, narrated more completion than happened. Example: yesterday's 19:24 Studio conversation ... Jodin pub_sent two specs while narrating that the duplication was acknowledged; Simon pub_sent a refresh-tick citation he hadn't actually read. Both guards (`mutating-tool fired` AND `completion-regex match`) independently disqualify this from planning-only retry. **Intentional.** The shape of fix is "compare the claimed actions in visible text against the tool-call list" ... semantic mapping, not regex. That's a v1.x feature, not a v1 patch on this detector.
- **Wrong-tool hallucination.** "I read X" but actually read Y, or "the dashboard shows Z" when no dashboard tool fired. Same root cause as partial hallucination ... needs claim-vs-evidence matching, not pattern detection.
- **Pure-task answer hallucination.** A Q&A task that fabricates an answer from training-data instead of tools. `auditNarratedCompletion` skips pure tasks by design (they're allowed to be silent). The new detector doesn't address them either.

`auditNarratedCompletion` (post-task) catches the extreme version of partial hallucination ... destructive task with *zero* successful tool calls, like the TRL pipeline run earlier yesterday. It does NOT catch the partial-but-not-zero case. Both gaps are real and named.

## Scope ... in / out

### In scope

- Three resolvers + retry mechanism described above
- Unit tests on each resolver (no provider calls; pure functions over inputs)
- One integration test that reproduces the planning-only pattern (mock provider returns "I'll check the logs and report back" → loop calls provider second time with the instruction appended → mock provider returns a tool call this time → loop proceeds)
- One integration test for missed-chat-send (chat-wake task, operator says "what's the status?", first iteration returns text-only, second iteration after instruction injection calls `chat_send`)
- Decision-doc reference comment at the top of the new module (no English explanation in the file itself; comments are limited to non-obvious why-this-line)

### Out of scope

- **No AgentLoop refactor.** Item 7 in the session-17 handoff explicitly defers the 1500-line refactor to v1.x. The detector is called from `AgentLoop`, not inlined.
- **No reasoning-only retry.** OC's third resolver handles thinking-block-leak. Our supported models (Grok-4.3, DeepSeek-reasoner) emit reasoning differently or in-line. Add later if needed.
- **No ACK-execution fast path.** OC has a separate "user said 'do it'" fast-path. Nice but not load-bearing. Defer.
- **No single-action-then-narrative subcategory.** OC's planning-only has a refinement that catches "ran one read-only tool, then narrated the rest." Defer until we see it in production.
- **No YOLO-style success prediction.** Out of epic.
- **No code-lift from OpenClaw.** Pattern only. Our own regexes. Our own instruction strings. Reviewer should confirm at PR time.

## Open questions and how they resolve

1. **Where do the instruction strings live ... the new module or system-prompt builder?** Answer: in the new module, as exported constants. OC keeps them with the resolvers because they tune together. Operators-via-config knob can come later if needed.

2. **Provider gating?** OC gates planning-only to "strict-agentic supported provider/models." We don't have that classification today. For v1, enable the detector for all providers. If we observe a model that legitimately narrates more (e.g., a chat-class fallback model), we'll add a per-provider opt-out then.

3. **What does the loop return when all retries exhausted?** A `failed` LoopResult with kind `incomplete_turn_retries_exhausted` and a detail string naming which resolver(s) tripped. Doug sees this in the inbox as a Tier-2 notification (same surface as detector trips). Worse than today's "task done with weird summary," better than today's "task done and operator never knew."

4. **Does this need a follow-up model / provider switch?** No. The existing `followup_model_id` mechanism (iteration 2+ uses the reasoner-class model) already applies to retries since retries increment `this.iteration`. The detector just adds more iterations within the same task; the model-binding logic for iteration N is unchanged.

## Test plan

Unit (vitest):
- `resolvePlanningOnlyRetry()` returns instruction when text matches promise pattern and no tool calls fired
- Returns null when text matches completion regex (`done`, `finished`)
- Returns null when at least one mutating tool fired
- Returns null when last user message wasn't actionable
- Returns null when all stop-condition guards trip (one test per guard)
- `resolveMissedChatSendRetry()` returns instruction for chat-wake actionable user message with no chat_send fired
- Returns null when chat_send was already called
- Returns null for non-chat wake sources

Integration (vitest, mock provider):
- Planning-only: mock returns "I'll check the logs and report back" → loop iterates 2nd time with instruction appended → mock returns a `read_file` tool call → loop completes normally. Verify: 2 model calls, 1 successful tool call, no audit flag.
- Missed chat_send: chat-wake task with prompt "what's the status?" → mock returns text-only first iteration → 2nd iteration with instruction → mock returns `chat_send` call → loop completes. Verify: 2 model calls, chat_send fired exactly once.
- Retry exhaustion: mock returns planning-only text three times in a row → loop terminates with `failed` and reason `incomplete_turn_retries_exhausted`. Verify: 3 retries attempted, structured failure surfaced, audit-flag list includes the exhaustion reason.

Manual / live (after merge):
- Reproduce yesterday's 19:20 pub conversation pattern with the live fleet. Watch whether the planning-only retry fires when Jodin / Simon / Hobby narrate work without doing it.
- Doug's morning playbook for Capability 1, 3, 5 (from session-17 handoff) re-runs against this code path. Particularly Capability 3 (delegated task with expected chat_send back).

## Risks and what we'll watch

- **Over-firing.** The planning-only regex catches future-tense action verbs. False positives possible on legitimate planning *interleaved with* real tool work. Mitigated by the "mutating-tool fired" guard and the actionable-prompt gate. Watch frequency in the events log after merge.
- **Retry compounding.** 3 retries × 3 resolvers = up to 9 extra iterations per task. The existing `maxIterations` ceiling still binds (default 20). Cost cap also binds. Worst case is a noisy task that hits the ceiling instead of completing cleanly ... visible to operator, not silent.
- **Interaction with `followup_model_id`.** Retries iterate, which means iteration 2+ uses `followup_model_id` when set. For chat-class → reasoner-class identities, the retry runs on the more expensive model. That's correct behavior (we want the smarter model to act, not the chatty one to keep narrating), and it's bounded by the cost cap.
- **The "did some, claimed more" partial hallucination** (called out in `narrated-completion.ts`) is still uncaught by this detector. A turn that calls one tool and narrates three is hard to detect with regex. The audit catches the worst version (destructive task with zero successful calls). A richer pattern-match against tool-output vs. visible-text claims is post-v1.

## Implementation order

1. Module `src/runtime/agent/incomplete-turn.ts` with type defs, constants, and the three resolvers.
2. Unit tests for resolvers.
3. AgentLoop integration (loop.ts:745 branch + iteration-end hook).
4. Integration tests (planning-only, missed-chat-send, exhaustion).
5. Update `pubWakeNudges` retry budget from 1 → 3 to match (adjacent, surgical, in this same PR).
6. Manual smoke against the running fleet.

PR target: same `feat/platform-passthrough-tools` branch as the v1 merge candidate (#193), since this is a v1-essential reliability fix and merging it separately would split the v1 story.

## Dependencies / blockers

None. All inputs to the resolvers already exist on `AgentLoop`'s local state or on the `task` record:

- Tool-call list per iteration: `parsed.calls` (loop.ts:738)
- Assistant text: `response.text`
- Mutating-tool classification: existing `idempotency` typing on tool registry
- Last user message actionable: derive from `task.frontmatter.wake_source` + `task.body`
- Already-sent-outbound signal: track `chat_send` / `pub_send` calls in `runOneCall` post-hook (already done for pub via `this.pubToolCallsThisTask`; mirror for chat)
