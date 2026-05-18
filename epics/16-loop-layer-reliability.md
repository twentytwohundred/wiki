---
title: "Epic 16: The loop as recovery engine"
type: epic
status: next-active (after Phase F end-to-end demo)
version: 0.2
tags: [epic, agent-loop, reliability, tool-dispatch, recovery-engine, hermes-borrow]
created: 2026-05-18
updated: 2026-05-18
linked_docs:
  - "[[03-epic-map]]"
  - "[[14-phase-f-capability-catalog]]"
  - "[[../decisions/2026-05-18-hermes-deep-dive]]"
  - "[[../decisions/2026-05-18-hardline-below-yolo]]"
  - "[[../decisions/2026-05-18-capability-security-model]]"
  - "[[../decisions/2026-05-18-heuristics-vs-boundaries]]"
canonical_path: wiki/epics/16-loop-layer-reliability.md
---

# Epic 16: The loop as recovery engine

**Status:** Next-active after Phase F end-to-end demo (gmail seed Capability driving a complete onboarding flow). Activation trigger unchanged from v0.1 of this epic.

## Purpose

2200's agent loop currently fails fast and surfaces to operator. That's correct when failure is signal. It's wrong when failure is dumb-model noise.

As Agents run longer autonomous sessions, operator-surface-on-every-failure becomes incompatible with the 8-hour autonomous work claim ([[../research/2026-05-14-external-architecture-review]] elevator). An Agent that wakes the operator every 20 minutes because the model emitted a tool call in the wrong wrapper format is not autonomous.

This epic adopts the operating principle Hermes Agent demonstrates in production ([[../decisions/2026-05-18-hermes-deep-dive]] §1): **the loop is a recovery engine** that absorbs recoverable model failures (tool-name typos, malformed JSON, length-limit hits, role-alternation breakage, format-wrapper mismatches) without bouncing to the operator. Operator-surfacing remains the correct behavior for irrecoverable failures and for ambiguous failures that require real judgment. The shift is in *which class* of failures the loop owns vs surfaces.

The principle, not the patch list, is the deliverable. New failure modes added to this epic as Wave 2 once Wave 1 is in production.

## Wave 1 (the first cut)

Seven items. Each is a small-to-medium PR's worth of work. None depend on each other; can ship in any order once the epic activates. Wave 1 closes the classes of failure we have *already observed in the field*.

### 1. Recognize alternative tool-call wrapper formats (FIELD-LEVEL PROOF)

When the model emits a tool call in a non-canonical wrapper (e.g. Hermes/Llama-style `<tool_call>...</tool_call>` XML tags with `"name"` key instead of the runtime's expected ```tool fenced block with `"tool"` key), the current textual fallback parser does not recognize it, the loop treats the output as final text, and the task ends silently with the "tool call" preserved as outcome.summary text but never dispatched.

**Field incident:** 2026-05-18 Joe onboarding test. Doug posted `"Hey @team. Check in please."` in Studio. All 5 Agents woke via the new @team wake rule. David (Qwen 3 30B on the GB10) emitted:

```
<tool_call>
{"name": "pub_react", "args": {"pub_name": "studio", "message_id": "...", "emoji": "✅"}, ...}
</tool_call>
```

Loop saw no `tool_calls` field, treated as final text, ended task silent at iterations=4. From Doug's perspective: David "didn't respond." Audit log: *"no factual claims extracted from the final reply."* The tool call David intended never fired.

**The fix:** extend the textual fallback parser in `src/runtime/agent/loop.ts` to recognize the alternative wrapper. Specifically: any of `<tool_call>{...}</tool_call>`, ```tool {...} ``` (existing), ```json {...} ``` (when only JSON-shaped content matches a registered tool name), all accepting either `"tool"` or `"name"` as the dispatch key.

**Why:** the loop's job is to extract the tool call the model *meant* to emit, regardless of wrapper. This is the canonical case of recoverable failure ... the model did its job correctly; the runtime failed to parse the output.

**Files:** `src/runtime/agent/loop.ts` (textual extractor function), `tests/runtime/agent/loop-textual-extractor.test.ts` (new).

### 2. Tool-name fuzzy repair

When the model emits a tool call for a tool that doesn't exist (`read_files` when the registry has `read_file`), the dispatcher fuzzy-matches against `valid_tool_names`, auto-corrects to the closest match (Levenshtein distance ≤2, plus singular/plural normalization), logs a one-line WARN, and proceeds.

**Why:** cheap win on a recurring failure mode. The model gets back a successful tool result instead of an error; the loop continues without round-tripping for clarification. Hermes shipped this in `conversation_loop.py:3037` and it covers a meaningful fraction of cheap-tier model tool-call errors.

**Files:** `src/runtime/loop/tool-dispatch.ts` (or current dispatch entry point), `tests/runtime/loop/tool-dispatch.test.ts`.

**Out of scope:** semantic disambiguation (when two tools are equidistant from the misspelling, refuse rather than guess).

### 3. Invalid-JSON-args retry with synthetic tool-error injection

When the model emits a tool call with malformed JSON in `arguments`, the dispatcher retries up to 3 times (re-prompting with the parser error). If still bad after retries, the dispatcher injects a **synthetic tool-error result as a tool-role message** ... not as a user-role correction ... so role alternation stays valid and the model can recover within the same conversation context without breaking the prefix cache.

Distinguishes JSON-broken (recoverable) from output-truncated (signals the model hit a length limit; different recovery path).

**Why:** preserves prompt-cache integrity ([[../decisions/2026-05-18-cache-as-invariant]]). Today 2200's broken-tool-call path kicks back to the operator; this fix lets the model self-recover. Hermes shipped at `conversation_loop.py:3087-3173`.

**Files:** `src/runtime/loop/tool-dispatch.ts`, `src/runtime/loop/error-recovery.ts`, tests.

### 4. Tool-call circuit breaker

When the same tool fails N consecutive times in a single loop (default `N=8`), the loop halts with a structured error rather than allowing the model to keep retrying indefinitely. Prevents the budget-bleed-without-progress failure mode where a cheap-tier model retries the same broken tool 40 times until the cost cap kicks in.

Counter resets when a different tool call succeeds (so the model can recover by trying something else).

**Why:** budget protection independent of the existing cost cap. The cost cap catches "Agent burned through $25"; this catches "Agent burned through $5 calling the same broken `fs_write` 8 times" before it becomes $25. Hermes ships at `agent/tool_guardrails.py`.

**Files:** `src/runtime/loop/guardrails.ts`, tests.

### 5. Smart approvals via auxiliary LLM

For dangerous-command approval (the curated regex list that catches `chmod 777`, `curl | sh`, etc.), add an `approvals.mode=smart` option that calls a cheap-tier auxiliary LLM with the command + context and asks "APPROVE | DENY | ESCALATE." `APPROVE` proceeds silently; `DENY` refuses; `ESCALATE` routes to the operator-facing approval flow.

Inspired by OpenAI Codex Smart Approvals. The aux LLM call is cheap, fast, and reduces approval fatigue without lowering the floor ([[../decisions/2026-05-18-hardline-below-yolo]] is still enforced unconditionally).

**Why:** post-Phase-F, the operator's approval surface count grows (every Capability that touches shell, every cron trigger, every walkthrough that runs scripted setup). Approval fatigue is the realistic failure mode. Smart approvals is the layered-config fix Hermes uses; pattern translates directly.

**Note:** there's an open scoping question about whether smart-approvals is plumbing (this epic) or product-surface (named feature of the 8-hour autonomous claim). See [[../research/2026-05-18-smart-approvals-scoping]]; if Doug locks "product-surface," this item moves out to its own epic.

**Files:** `src/runtime/approval/smart-approvals.ts`, `src/runtime/approval/aux-llm.ts`, tests.

**Out of scope:** ML-driven approval (full classifier). The smart mode uses an existing cheap-tier LLM as a guardrail, not a trained classifier.

### 6. `_PROVIDER_ENV_BLOCKLIST` runtime enforcement

[[14-phase-f-capability-catalog]] §1 lands the schema-level blocklist (Capability frontmatter cannot declare a blocked env var as `auth.env_var`). This item is the **runtime** half: when a Capability's code (or skill, or plugin, or MCP server) reads from process env, the blocked env vars are filtered out of the child's environment before spawn. Hermes calls this subprocess credential scrubbing; same mechanism.

**Why:** the schema check at load is necessary but not sufficient. A malicious or buggy Capability that reads `process.env.ANTHROPIC_API_KEY` directly (without declaring it in its `auth`) gets a blank string instead of the host credential. Closes the corresponding M3 enforcement work from [[../decisions/2026-05-18-capability-security-model]].

**Files:** `src/runtime/capability/start.ts` (or current spawn-equivalent), `src/runtime/mcp/launch.ts`, tests.

### 7. Skills Guard regex pattern set

Passive scanner that runs over any skill / Capability walkthrough / MCP server config / Capability acquisition prose at install time, flagging suspicious patterns:

- `curl <url> | sh` and variants
- `cat ~/.ssh/...`, `cat ~/.aws/...`, `cat ~/.gnupg/...`, `cat ~/.kube/...`, `cat ~/.docker/...`
- `base64` adjacent to env var dereferences (`echo $TOKEN | base64`)
- References to `~/.2200/credentials/`, `~/.2200/vault/`, the daemon socket, OpenPub auth, etc.
- Recursive permission changes scoped to credential paths

Verdict: `safe | caution | dangerous`. Trust-aware install policy:
- `first-party` Capabilities: full trust, scanner runs but findings are advisory.
- `local` Capabilities (operator-authored under `~/.2200/catalog/capabilities/`): `caution` allowed without prompt, `dangerous` requires operator confirmation.
- External-publisher Capabilities (post External-Publisher Epic): `caution` requires prompt, `dangerous` requires `--force`.

**Honest framing per [[../decisions/2026-05-18-heuristics-vs-boundaries]]:** this is a heuristic, not a structural boundary. An adversarial Capability author who reads the patterns can write around them. Skills Guard is value because it lifts the floor on the common case, not because it stops a determined attacker.

**Why:** cheap insurance even with first-party-only Phase F. Catches the obvious before publisher signing exists. Hermes pattern set in `tools/skills_guard.py`.

**Files:** `src/runtime/capability/guard.ts`, `src/runtime/capability/guard-patterns.ts`, tests.

## Wave 2 lens

Wave 2 is not pre-populated. The lens is: **new failure modes get added to this epic as they're observed in production.** Each Wave-2 item starts as a field incident with reproducible failure trace, lands an entry here, gets sequenced into a wave, and ships.

The discipline matters: a loop-layer reliability epic that doesn't grow with real production failures becomes a list of speculative protections. Hermes's loop has 4,000 lines of defensive engineering because each line earned its place by absorbing a real failure mode. 2200 follows the same discipline ... patches earn their place by reference to a field incident.

When Wave 2 starts (post-Wave-1 ship), the epic's purpose statement holds: same operating principle, new failure modes.

## Why this is its own epic vs Phase F

Phase F builds the Capability Catalog substrate: schema, loader, suggestion logic, preview integration, post-spawn walkthrough. All of that lives in `src/runtime/onboarding/`.

This epic touches the agent-loop layer: dispatch, retry, approval, spawn-time process env, install-time content scanning. Different code paths, different test surfaces, different reviewers. Bundling them into Phase F would double Phase F's surface area without adding cohesion. Better as a focused follow-on epic with its own scope.

The one exception: Item 6's substrate-level provider-env blocklist is split across the two epics ... the schema-level rejection (refuse a Capability that *declares* a blocked env var) ships in Phase F; the runtime enforcement (refuse a Capability that *reads* a blocked env var from process env) ships here. The split is intentional ... schema-level is part of the Capability substrate; runtime-level is part of the launch substrate.

## What this is NOT

- Not a refactor of the agent loop. The 2026-05-14 Grok external review ([[../research/2026-05-14-external-architecture-review]] §2) flagged the 2001-line `AgentLoop` as the velocity cliff; that loop decomposition is its own epic, not this one. This epic adds defensive primitives without touching the loop's structure.
- Not a sandbox. [[../decisions/2026-05-18-capability-security-model]] M7 (sandbox boundaries) belongs to the External-Publisher Epic. This epic adds the regex / scanner / blocklist / circuit-breaker layer that lives *above* sandbox.
- Not a complete reliability story. Streaming tool results, true server-side streaming, native provider tool-calling shapes ... all distinct work.

## Sequence

When this epic activates (post-Phase-F end-to-end demo), order:

1. **Item 1 (wrapper formats)** first. It's the field-level proof item; David's silence repeats every wake until we ship it. Closing one observed incident is the right opening commit.
2. **Item 2 (fuzzy tool-name repair)** alongside. Same dispatch-layer surface; ships in parallel.
3. **Item 4 (circuit breaker)** alongside. Independent; ships in parallel.
4. **Item 3 (JSON-args retry with synthetic injection)**. Touches loop-state-machine; do after item 1 lands so the textual-parser surface is well-understood first.
5. **Item 6 (provider-env runtime enforcement)**. Touches the launch substrate; coordinates with the supervisor.
6. **Item 7 (Skills Guard)**. Pure data + scanner; can ship anywhere.
7. **Item 5 (smart approvals)**. Last because it depends on the operator-approval-flow having matured through real Capability usage; want operator feedback on what would be ergonomic before adding the smart layer. Also pending Doug's scoping decision on plumbing vs product-surface.

## Open follow-ups (deferred from Hermes deep dive)

Items that came up in the Hermes deep dive but did NOT make this epic; flagged for future epic-map decisions:

- Honcho-style dialectic user modeling (external memory provider integration).
- Trajectory compression for training-data prep (post-hoc tool, separate from runtime context compression).
- Per-platform notification-toggle granularity.
- Three-tier system prompt stable/context/volatile cache discipline as a Doctor check.

These are distinct value props, not loop-layer reliability. Each warrants its own epic when prioritized.

## Provenance

**v0.1 (2026-05-18 morning):** Items extracted from the Hermes Agent v0.14.0 deep dive ([[../decisions/2026-05-18-hermes-deep-dive]] §6a). Doug approved the parked-backlog framing; three items folded into Phase F, remaining six captured here as "miscellaneous reliability patches."

**v0.2 (2026-05-18 afternoon):** Doug + Guppi reframed during the Hermes-findings synthesis. The epic is no longer "miscellaneous patches" ... it's the implementation of an operating principle (loop-as-recovery-engine) load-bearing for the 8-hour autonomous work claim. Status promoted from backlog → next-active-after-Phase-F-demo. Field-level proof (David silence on 2026-05-18 @team check-in) added as Wave-1 item 1. Wave 2 lens established (production-observed failure modes earn entries here).

— Hobby
</parameter>
</invoke>