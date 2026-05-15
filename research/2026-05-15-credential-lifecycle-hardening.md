---
title: "Credential request lifecycle hardening (2026-05-15)"
type: research-note
status: active
tags: [credential, request_credential, hardening, runtime-guard, prompt-rules, misuse-detection]
created: 2026-05-15
updated: 2026-05-15
linked_docs:
  - "[[2026-05-14-request-credential-substrate]]"
  - "[[2026-05-15-hobby-handoff]]"
canonical_path: wiki/research/2026-05-15-credential-lifecycle-hardening.md
---

# Credential request lifecycle hardening (2026-05-15)

**Context:** Post-acceptance testing of the `request_credential` substrate (PR #200 + follow-on commits on `feat/request-credential-substrate`) exposed additional failure modes beyond the simultaneous parallel-call creation race.

This note is the paper trail for the hardening work. It captures the observed failures, root causes, the exact scoped changes being made, success criteria, and what is deliberately left for later. Written so Hobby (or any future primary) can resume cleanly.

## Observed failure (2026-05-15 live test)

User prompt to simon:
> "Ask me for fuzzy-bannana API credentials, and then report back when you have them and have verified they're on disk."

Timeline:
- Simon emits `credential_request` for `fuzzy-bannana-api`. Operator pastes fake value #1. Card shows fulfilled.
- Simon immediately emits a second `credential_request` for the **same** name. Operator pastes fake value #2. Second card fulfilled.
- After the second fulfillment, simon continues emitting `credential_request` (multiple times), `credential_has`, `time_sleep`, and a `chat_send` complaining "I asked you for the `fuzzy-bannana-api`…".
- Then full shell/fs/brain death spiral:
  - `shell_run` with `find /home/simon/vault`, `find / -name "fuzzy*"`, `ls -laR /`, `find /home -maxdepth 3`, etc.
  - `fs_list /project`, `fs_list /home`, `brain_search "vault credential storage location"`.
- Never produces a clean final assistant reply confirming the credential is present and verified on disk.
- The agent never uses the sanctioned consumption path (`http_request` with `bearer_credential`).

Result: operator had to provide the credential twice; the task never terminated cleanly; the agent fell back to raw filesystem exploration of internal vault paths.

This is the exact anti-pattern the substrate and prompt rules were supposed to prevent.

## Root causes

1. **No runtime boundary against re-asking after success.** The model can (and did) emit `credential_request` for a name that had already been fulfilled earlier in the same task. The existing guards (`already_in_vault`, `concurrent_request_pending`, in-memory Map, new lockfile at create) only protect *pending* duplicates. They do not protect "I already succeeded for this name in this task."

2. **Post-fulfill contract is entirely prompt-dependent.** Rule #8 ("after fulfilled: call `credential_has`, then final reply") is advisory. When the model gets confused or the next model response drifts, there is no automatic guidance and no enforcement. The agent is left to "remember" the correct sequence across turns.

3. **Consumption primitive (`http_request`) is not sticky.** The model has no strong internal model that `http_request` (or MCP env injection) is the *only* sanctioned way to consume a vault credential. When stuck, it falls back to the universal hammer (`shell_run` + `fs_*`) and starts hunting for the physical secret file on disk (`/home/agents/simon/vault`, etc.). This leaks implementation details that the agent should never need to know.

4. **The "tools beat notes / do not shell-thrash for secrets" rule (rule #7 + rule #8) is not strong enough** when the agent is in a confused state. The failure mode is identical to the OpenPub canary incident that produced rule #7, just with credentials instead of MCP servers.

The simultaneous parallel-call bug (fixed earlier the same day with the lockfile) was a creation-time race. The fuzzy-bannana failure is a *lifecycle* and *use-path* problem.

## Scoped hardening plan (what we are doing in this session)

Four tightly coupled changes. Nothing more.

### Change 1 — Runtime re-ask guard (highest leverage)
- In `doCredentialRequest`, before the surface check, query the `CredentialRequestStore` for any record with the same `agent` + `credential_name` that is in `fulfilled` state and was created for the current task (via `chat_id` / `task_id` linkage already present on the record).
- If one exists, immediately return `declined` with a new `decline_reason: 'already_fulfilled_in_this_task'`.
- This prevents the model from ever getting a second successful `credential_request` for the same name in the same task, even if it ignores the prompt.

Location: `src/runtime/tools/baseline/credential.ts`

### Change 2 — Automatic post-fulfillment guidance message
- In the HTTP fulfill path (`POST /api/v1/credential-requests/:id/fulfill` in `http/server.ts`), after the record transitions to `fulfilled` and the chat system message has been appended, automatically append a second, high-priority system message (or a structured `kind: 'credential_guidance'`) that contains the exact required next steps:
  > "credential `fuzzy-bannana-api` is now fulfilled and sealed. Your required next actions in this task: (1) call `credential_has` for `fuzzy-bannana-api` to verify, (2) produce a final assistant reply to the original user request confirming you have the credential and it is verified on disk. Do not call `credential_request` again for this name. Use `http_request` with `bearer_credential` for any subsequent HTTP use."
- This removes the "model must remember the sequence" burden.

Location: `src/runtime/http/server.ts` (fulfill handler) + reuse of `chats.appendMessage` + the existing `agent.chatMessage` RPC for WS push.

### Change 3 — Strengthened prompt rules + explicit happy-path example
- Update system prompt rule #8 (credential flow) to be far more prescriptive.
- Add rule #9: "http_request is the canonical consumption primitive for vault credentials. `shell_run`, `fs_read`, `fs_list`, or `brain_search` that hunt for 'vault', 'credential', or secret files after a `credential_request` are forbidden and will be treated as a planning failure."
- Include a full 6-turn happy-path example transcript in the prompt (user request → credential_has check → credential_request → fulfilled (injected guidance) → credential_has verify → final clean reply).

Location: wherever the load-bearing system prompt is assembled (`src/runtime/agent/loop.ts` or a dedicated prompt builder). Add the example as a literal block.

### Change 4 — Lightweight "vault hunting" corrective nudge
- In the `AgentLoop`, after processing a batch of tool results, if the agent has recently (same task) performed a `credential_request` (fulfilled or not) **and** then emits `shell_run`, `fs_*`, or `brain_search` whose arguments contain "vault", "credential", ".age", or look like secret discovery, inject a single corrective tool message:
  > "Stop. Do not explore the filesystem or brain for credential storage locations. Call `credential_has` for the name you requested, then use `http_request` with `bearer_credential` (or the appropriate MCP skill) to consume it. The vault is opaque."
- This is a cheap pattern-match nudge, not a full new detector subsystem.

Location: `src/runtime/agent/loop.ts` (after tool batch) + small helper.

## Success criteria for this session

Live test with the exact "fuzzy-bannana" prompt on simon must produce:
- Exactly one `credential_request` (operator provides once).
- One `credential_has` after fulfillment.
- One clean final assistant reply: "I have the fuzzy-bannana API credentials. They are verified present in my vault via `credential_has` and ready for use via `http_request`."
- Zero additional `credential_request` calls.
- Zero `shell_run` / `fs_*` / `brain_search` attempts to locate the vault or secret files.
- No silent termination.

All existing tests (including the in-process dedup test) must remain green.

## What is deliberately out of scope for this session (to keep the change bounded)

- A full first-class "credential misuse detector" with severity routing and inbox notifications (that can wait for the loop decomposition epic).
- Any change to `http_request` itself or its redaction logic.
- Changes to how Agents discover or list available credentials beyond `credential_has`.
- Touching the scheduler, pub, or other baseline tools.
- New schema fields on TaskRecord or Identity (we stay within existing structures + the CredentialRequestStore).
- Any work on the operator-side "rotate / manage keys" UI.

If the four changes above + the live test pass, we stop. Further hardening can be proposed in a follow-up note after Hobby resumes.

## Paper-trail notes for Hobby

- The lockfile claim added earlier on 2026-05-15 (before this note) lives in `doCredentialRequest` right before `store.create`. It is the creation-time backstop.
- All four new changes are additive guards + guidance. None remove existing behavior.
- The prompt example should be treated as load-bearing (like the existing rule #6 refusal language and rule #7 tools-beat-notes language).
- If the model still misbehaves after these changes, the next lever is "make the post-fulfill guidance a synthetic tool result that the loop itself injects" rather than another prompt iteration.

This note + the updated main decision doc (`2026-05-14-request-credential-substrate.md` with a "Post-acceptance lifecycle hardening" addendum) + the 2026-05-15 handoff together give a complete picture of the state when this work began.

## Architectural pivot (2026-05-15) — TaskBlocker subsystem

After the "slow-bottle-breaker" and "slow-screwdriver" runs exposed that the Agent could still emit new tool calls (including additional `credential_request` calls) while an earlier `credential_request` was still pending with the operator, we made the following decision:

**We are moving from layered defensive guards + prompt reinforcement to a first-class `TaskBlocker` / human-gate mechanism.**

### Rationale
- The current "tool promise stays pending + guidance messages" approach is insufficient. The `AgentLoop` (already flagged in the external review as a 2000-line velocity cliff carrying 10+ responsibilities) does not treat long-running human-gated operations as true task-level blockers.
- Continuing to add more guards, more guidance messages, and more prompt rules is papering over the problem and will not scale to the 8-hour autonomous work target or future human-in-the-loop needs (voice confirmation, multi-operator approvals, external system waits, etc.).
- A proper blocker abstraction is the portable, composable foundation that actually matches the original contract in the `request_credential` decision doc ("the tool is blocking… the loop transitions to `blocked_on_user`").

### Design direction (agreed with operator)
- Introduce a small `TaskBlocker` registry (initially attached to the task or the per-Agent loop instance).
- Tools that represent human or external gates (`credential_request`, later `notification_ask`, etc.) register a `TaskBlocker` on dispatch. The blocker carries an ID, a resolver, timeout, and metadata.
- The `AgentLoop` (and `AgentProcess` state machine) checks for active blockers **before** allowing a new model completion or new tool dispatch.
- The blocker is resolved from the tool’s `waitForResolution` path (or from HTTP fulfill/decline handlers, or the sweeper).
- Once all blockers for a task clear, the loop may continue.

This change also serves as a forcing function and extraction point for the long-planned `AgentLoop` decomposition. Blocker management becomes its own small, testable module rather than continuing to accrete inside the god object.

### Scope for this cycle (to stay controlled)
- Minimal viable `TaskBlocker` for `credential_request` only.
- The existing runtime guards (`already_fulfilled_in_this_task`, lockfile at creation, concurrent pending check) and guidance messages remain as defense-in-depth.
- No immediate full loop refactor — we add the blocker check at the right choke point(s) in the existing loop first.
- Later (post this hardening) we can extract the blocker logic cleanly as part of the decomposition epic.

This decision was made live with the operator on 2026-05-15 after reviewing the accumulated failure modes. It prioritizes a longer-term, portable solution over another round of incremental patches.

Paper trail for Hobby: The iterative guard/guidance work (documented above) was necessary to reach this diagnosis. We are now doing the structural fix the external architecture review and Guppi both flagged as necessary.

## Final implementation (2026-05-15, after batch-dispatch diagnosis)

After the "slow-bottle-breaker" and "slow-screwdriver" runs continued to show the re-ask even after the initial TaskBlocker work, we did a deeper diagnosis of the `AgentLoop` dispatch path.

**Root cause identified:**

The loop's `for (const call of parsed.calls)` (in `run()`) dispatches *all* tool calls from a single model response before re-checking blockers or task state. When the model emitted `credential_has` + `credential_request` in the same response, the has could "satisfy" the blocker, and the bad request would still execute in the same batch.

**Fixes landed (structural, not more guards):**

1. **Loop batch-dispatch fix** (`src/runtime/agent/loop.ts`):
   - After every `runOneCall` inside the `for (const call of parsed.calls)` loop, we now check `if (this.blockers.hasActive())` and immediately return `{ kind: 'blocked_on_user' }`, dropping any remaining tool calls in that batch.
   - This prevents the model from emitting a verification call + a new request in the same response.

2. **Permanent refusal at the tool level** (`src/runtime/tools/baseline/credential.ts`):
   - Added a unified guard: if any request record for this agent + normalized `credential_name` has a non-null `fulfilled_at` (or is in fulfilled state), the tool refuses with `decline_reason: 'credential_protocol_complete'` and appends strong guidance.
   - Also checks for any active human_gate blocker for the name.
   - This makes re-asking after success impossible at the tool level, using the store as the durable source of truth. Name normalization (lowercase + trim) was added for robustness.

3. **Direct store check in the loop for pending requests** (`src/runtime/agent/loop.ts`):
   - Added a direct `CredentialRequestStore.list({ agent, state: 'pending' })` right before every model call.
   - If any `credential_request` for the Agent is still pending, the loop returns `blocked_on_user`.
   - This stops "while pasting" tool spam independently of the blocker registry wiring.

4. **Shared TaskBlockerRegistry wiring** (`src/runtime/agent/process.ts`):
   - One `TaskBlockerRegistry` instance is now created in `AgentProcess` and passed to both the `AgentLoop` and the baseline tool factory (`getBlockerRegistry`).
   - Tools and the loop now talk to the exact same registry instance.

5. **`credential_has` ensures the 'awaiting final reply' blocker** (`credential.ts`):
   - After a successful post-fulfill `credential_has` for a name that has a fulfilled request record, the tool now ensures a blocker in `verification_complete_awaiting_final_reply` state exists for that name (creating one if none is found).
   - This guarantees the loop stays blocked until the Agent produces a final assistant message, regardless of previous blocker ID or exact name string.

6. **Frontend Hybrid UX** (`CredentialRequestCard.tsx` + CSS):
   - Security language added to the input form: "This value is sealed directly into the Agent’s encrypted vault. The Agent will never see it."
   - Clean "Provided" state shown immediately after the operator clicks Provide (instead of raw tool chips).
   - The Agent is still forced by the TaskBlocker to produce the final confirmation in chat.

7. **Strong guidance after post-fulfill `credential_has`**:
   - Immediately after the successful has, a very directive guidance message is appended: "You have now successfully verified that 'X' is in your vault. Your *very next action* must be to produce a final assistant reply... Do not call any more tools."

**Current state (as of end of session 2026-05-15):**

- Re-asking after success is structurally prevented (tool-level permanent refusal + loop batch fix).
- "While pasting" tool spam is stopped (direct pending check in the loop + TaskBlocker).
- Input is always masked (`type="password"` on credential_request cards).
- The Agent is forced to do the post-fulfill `credential_has`.
- The Agent is blocked from doing bad things (re-asking, shell hunting) until it produces a final assistant message.
- The card shows security language and a clean "Provided" state.
- Remaining gap: the Agent still does not reliably produce the final confirmation message after the `credential_has` without a human nudge. The blocker prevents bad behavior, but the model is not yet treating the successful verification + guidance as an automatic trigger to speak.

**Next session priorities:**

- Make the `verification_complete_awaiting_final_reply` state even stricter (Agent can only produce a final assistant message — no tool calls allowed until it speaks).
- Wire the card to show "Verified by Agent" when the post-fulfill `credential_has` succeeds.
- Add the unit test for the batch-dispatch fix.
- Strengthen the guidance after the has if the model still needs a nudge in some cases.
- Push the `feat/request-credential-substrate` branch when ready.

All changes are on `feat/request-credential-substrate`. The decision record (`2026-05-15-taskblocker-subsystem.md`) and this research note constitute the full paper trail for the entire effort.

---

*Written 2026-05-15 during the hardening session (final update at end of session). All changes made with full build + fleet restart + live re-test. The structural foundation is solid; the last 25% is making the final confirmation message happen reliably without a nudge.*

---

## Evening update — TaskBlocker kind split (the actual fix for the silent stall)

After Doug + Grok strengthened the prompts and the post-`credential_has` guidance without closing the gap, fresh Hobby came in and identified the architectural contradiction: the post-`credential_has` blocker (kind `human_gate`, metadata.status `verification_complete_awaiting_final_reply`) was checked at the top of every loop iteration. The loop bailed with `blocked_on_user` before the model was ever called, so the model never had the chance to produce the final reply. Adding more prompt force could not fix this ... the very call we needed was structurally blocked.

### What changed

Intent-named tiering on `TaskBlocker.kind` (chosen over behavior-named `blocks: 'all' | 'tools_only'` per operator preference: the reader at the registration site sees *why*, not *how*):

- `human_gate`: "we are waiting on a human or external party." Top-of-loop check returns `blocked_on_user`; no model call, no tool dispatch.
- `awaiting_completion`: "the agent owes a final assistant reply now." Top-of-loop check is *permissive* (model gets called); for-loop mid-batch check breaks if the model emits a tool while in this state; an incomplete-turn-style nudge with `DEFAULT_INCOMPLETE_TURN_RETRY_BUDGET` cap is appended to history; budget exhaustion throws a structured error so the operator sees the failure.

`credential_request` no longer re-registers a blocker on fulfilled. It resolves the original `human_gate` and trusts the prompt + the audit pass for the "call `credential_has` next" step. `credential_has` registers the `awaiting_completion` blocker on a successful post-fulfill verification ... that is the only place that flips the agent into "speak now" mode.

### Why this design (and what we abandoned)

Doug's mid-session refinement: reuse the existing incomplete-turn detector machinery (`pubWakeNudges` / `planningOnlyRetries` / `emptyResponseNudges` budget pattern) for the drop-tools-and-re-prompt path, with explicit retry budget and exhaustion-as-throw rather than silent stall. That pattern was already in the codebase and battle-tested ... no need to invent a parallel one.

We deliberately abandoned the earlier "fulfilled_pending_verification" sub-state. It conflated "we want the agent to call `credential_has`" (a model decision the prompt covers) with "we want the agent to speak" (the load-bearing post-verification step). One blocker, one intent.

### Coverage

- `tests/runtime/agent/blockers.test.ts` covers the registry's load-bearing property: `hasActive('human_gate')` and `hasActive('awaiting_completion')` are distinct; same-id re-registration flips the kind.
- `tests/runtime/agent/loop.test.ts` adds four cases: blocker resolves on text-only reply, model is *not* gated when only awaiting_completion is active, model *is* gated when human_gate is active, budget exhaustion throws.

### Live test status

Passing. After three live tests on simon:

1. **lonely-bannana-api**: errored due to a zombie agent process from prior sessions running pre-fix code. The "agent already running" path on `agent start` accepted the zombie's registration; the new daemon thought it had simon when actually it had a stale one. `pkill -TERM -f agent/bootstrap.js` + clean daemon restart + per-agent start cleared 19 zombies and gave a 3-process fleet on the new dist. Worth a separate Simon-side ticket on the daemon's process discipline.
2. **smart-bannana-api**: full credential lifecycle correctly executed and the agent's final reply was in `task.outcome.summary`, but the reply never reached the chat thread. Root cause was the chat watcher's idempotency check (`watchAndAppendChatThreadReply` in `src/runtime/http/server.ts`) matching the system-role envelope card and the post-fulfill guidance messages (both carry the same `task_id` as the assistant reply would), causing it to bail before appending. One-line fix: restrict the "already appended" check to `role === 'assistant'`. Same fix applied to the legacy single-chat watcher.
3. **dumb-bannana-api**: clean end-to-end. probe credential_has → credential_request → paste → post-fulfill credential_has → unprompted final assistant reply with set_at timestamp. No nudge, no loop, no shell hunting.

Polish follow-up (not blocking): the post-fulfill and post-`credential_has` system-role guidance messages are now visible in the chat thread above the assistant reply. They were scaffolding; the UI should either hide them or the runtime should stop persisting them to chat once the prompt and blocker enforcement are sufficient.