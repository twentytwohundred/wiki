---
title: "Epic 16: Loop-layer reliability"
type: epic
status: parked (backlog; next major after Phase F lands)
version: 0.1
tags: [epic, agent-loop, reliability, tool-dispatch, approval, hermes-borrow]
created: 2026-05-18
updated: 2026-05-18
linked_docs:
  - "[[03-epic-map]]"
  - "[[14-phase-f-capability-catalog]]"
  - "[[../decisions/2026-05-18-hermes-deep-dive]]"
  - "[[../decisions/2026-05-18-hardline-below-yolo]]"
  - "[[../decisions/2026-05-18-capability-security-model]]"
canonical_path: wiki/epics/16-loop-layer-reliability.md
---

# Epic 16: Loop-layer reliability

**Status:** Parked. Next major epic after Phase F lands. Do not begin until Phase F's substrate is committed and the gmail seed Capability has driven the first real onboarding end-to-end.

**Numbering note:** Filed at `16-` because `15-` was already taken by [[15-web-app]]. The intended number was 15 per Doug's note; flagging for renumber if the epic map prefers a different slot (13, 6, and 7 are open gaps).

## What this is

A collection of loop / dispatcher / approval-layer reliability patterns observed in Hermes Agent ([[../decisions/2026-05-18-hermes-deep-dive]]) that are worth borrowing into 2200 ... but that do NOT belong in Phase F because they live in the agent-loop layer, not in the onboarding / Capability substrate.

Six discrete items. Each is a small-to-medium PR's worth of work. None depend on each other; can ship in any order once the epic activates.

## Items

### 1. Tool-name fuzzy repair

When the model emits a tool call for a tool that doesn't exist (`read_files` when the registry has `read_file`), the dispatcher fuzzy-matches against `valid_tool_names`, auto-corrects to the closest match (Levenshtein distance ≤2, plus singular/plural normalization), logs a one-line WARN, and proceeds.

**Why:** cheap win on a recurring failure mode. The model gets back a successful tool result instead of an error; the loop continues without round-tripping for clarification. Hermes shipped this in `conversation_loop.py:3037` and it covers a meaningful fraction of the cheap-tier model's tool-call errors.

**Files:** `src/runtime/loop/tool-dispatch.ts` (the dispatch entry point), `tests/runtime/loop/tool-dispatch.test.ts`.

**Out of scope:** semantic disambiguation (when two tools are equidistant from the misspelling, refuse rather than guess).

### 2. Invalid-JSON-args retry with synthetic tool-error injection

When the model emits a tool call with malformed JSON in `arguments`, the dispatcher retries up to 3 times (re-prompting with the parser error). If still bad after retries, the dispatcher injects a **synthetic tool-error result as a tool-role message** ... not as a user-role correction ... so role alternation stays valid and the model can recover within the same conversation context without breaking the prefix cache.

Distinguishes JSON-broken (recoverable) from output-truncated (signals the model hit a length limit; different recovery path).

**Why:** preserves prompt-cache integrity. Today 2200's broken-tool-call path kicks back to the operator; this fix lets the model self-recover. Hermes shipped at `conversation_loop.py:3087-3173`.

**Files:** `src/runtime/loop/tool-dispatch.ts`, `src/runtime/loop/error-recovery.ts`, tests.

### 3. Tool-call circuit breaker

When the same tool fails N consecutive times in a single loop (default `N=8`), the loop halts with a structured error rather than allowing the model to keep retrying indefinitely. Prevents the budget-bleed-without-progress failure mode where a cheap-tier model retries the same broken tool 40 times until the cost cap kicks in.

Counter resets when a different tool call succeeds (so the model can recover by trying something else).

**Why:** budget protection independent of the existing cost cap. The cost cap catches "Agent burned through $25"; this catches "Agent burned through $5 calling the same broken `fs_write` 8 times" before it becomes $25. Hermes ships at `agent/tool_guardrails.py`.

**Files:** `src/runtime/loop/guardrails.ts`, tests.

### 4. Smart approvals via auxiliary LLM

For dangerous-command approval (the curated regex list that catches `chmod 777`, `curl | sh`, etc.), add an `approvals.mode=smart` option that calls a cheap-tier auxiliary LLM with the command + context and asks "APPROVE | DENY | ESCALATE." `APPROVE` proceeds silently; `DENY` refuses; `ESCALATE` routes to the operator-facing approval flow.

Inspired by OpenAI Codex Smart Approvals. The aux LLM call is cheap, fast, and reduces approval fatigue without lowering the floor ([[../decisions/2026-05-18-hardline-below-yolo]] is still enforced unconditionally).

**Why:** post-Phase-F, the operator's approval surface count grows (every Capability that touches shell, every cron trigger, every walkthrough that runs scripted setup). Approval fatigue is the realistic failure mode. Smart approvals is the layered-config fix Hermes uses; pattern translates directly.

**Files:** `src/runtime/approval/smart-approvals.ts`, `src/runtime/approval/aux-llm.ts`, tests.

**Out of scope:** ML-driven approval (full classifier). The smart mode uses an existing cheap-tier LLM as a guardrail, not a trained classifier.

### 5. `_PROVIDER_ENV_BLOCKLIST` runtime enforcement

[[14-phase-f-capability-catalog]] §1 lands the schema-level blocklist (Capability frontmatter cannot declare a blocked env var as `auth.env_var`). This item is the **runtime** half: when a Capability's code (or skill, or plugin, or MCP server) reads from process env, the blocked env vars are filtered out of the child's environment before spawn. Hermes calls this subprocess credential scrubbing; same mechanism.

**Why:** the schema check at load is necessary but not sufficient. A malicious or buggy Capability that reads `process.env.ANTHROPIC_API_KEY` directly (without declaring it in its `auth`) gets a blank string instead of the host credential. Closes the corresponding M3 enforcement work from [[../decisions/2026-05-18-capability-security-model]].

**Files:** `src/runtime/capability/spawn.ts`, `src/runtime/mcp/spawn.ts`, tests.

### 6. Skills Guard regex pattern set

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

**Why:** cheap insurance even with first-party-only Phase F. Catches the obvious before publisher signing exists. Hermes pattern set in `tools/skills_guard.py`.

**Files:** `src/runtime/capability/guard.ts`, `src/runtime/capability/guard-patterns.ts`, tests.

## Why this is its own epic vs Phase F

Phase F builds the Capability Catalog substrate: schema, loader, suggestion logic, preview integration, post-spawn walkthrough. All of that lives in `src/runtime/onboarding/`.

This epic touches the agent-loop layer: dispatch, retry, approval, spawn-time process env, install-time content scanning. Different code paths, different test surfaces, different reviewers. Bundling them into Phase F would double Phase F's surface area without adding cohesion. Better as a focused follow-on epic with its own scope.

The one exception: §1's substrate-level provider-env blocklist is split across the two epics ... the schema-level rejection (refuse a Capability that *declares* a blocked env var) ships in Phase F; the runtime enforcement (refuse a Capability that *reads* a blocked env var from process env) ships here. The split is intentional ... schema-level is part of the Capability substrate; runtime-level is part of the spawn substrate.

## What this is NOT

- Not a refactor of the agent loop. The 2026-05-14 Grok external review ([[../research/2026-05-14-external-architecture-review]] §2) flagged the 2001-line `AgentLoop` as the velocity cliff; that loop decomposition is its own epic, not this one. This epic adds defensive primitives without touching the loop's structure.
- Not a sandbox. [[../decisions/2026-05-18-capability-security-model]] M7 (sandbox boundaries) belongs to the External-Publisher Epic. This epic adds the regex / scanner / blocklist / circuit-breaker layer that lives *above* sandbox.
- Not a complete reliability story. Streaming tool results, true server-side streaming, native provider tool-calling shapes ... all distinct work.

## Sequence

When this epic activates (post-Phase-F), order:

1. Tool-name fuzzy repair (§1). Smallest, lowest risk; warm-up.
2. Tool-call circuit breaker (§3). Independent; ship in parallel.
3. Invalid-JSON-args retry with synthetic injection (§2). Touches loop-state-machine; do after §1 lands so the fuzzy-repair path is well-understood first.
4. `_PROVIDER_ENV_BLOCKLIST` runtime enforcement (§5). Touches spawn substrate; coordinates with the supervisor.
5. Skills Guard regex pattern set (§6). Pure data + scanner; can ship anywhere.
6. Smart approvals via auxiliary LLM (§4). Last because it depends on the operator-approval-flow having matured through real Capability usage; want operator feedback on what would be ergonomic before adding the smart layer.

## Open follow-ups (deferred from Hermes deep dive)

Items that came up in the Hermes deep dive but did NOT make this epic; flagged for future epic-map decisions:

- Honcho-style dialectic user modeling (external memory provider integration).
- Trajectory compression for training-data prep (post-hoc tool, separate from runtime context compression).
- Per-platform notification-toggle granularity.
- Three-tier system prompt stable/context/volatile cache discipline as a Doctor check.

These are distinct value props, not loop-layer reliability. Each warrants its own epic when prioritized.

## Provenance

Items extracted from the 2026-05-18 Hermes Agent v0.14.0 deep dive ([[../decisions/2026-05-18-hermes-deep-dive]] §6a). Doug approved the parked-backlog framing on 2026-05-18 ... three items (description hardline, substrate-level blocklist, walkthrough tool-error sanitization) folded into Phase F; remaining items captured here.

Status: parked. Activation trigger: Phase F end-to-end demo (capability-schema.ts + Zod + gmail seed + preview integration + walkthrough runner) is operator-validated.

— Hobby
