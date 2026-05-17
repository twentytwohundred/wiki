---
title: "Smart-approvals-via-auxiliary-LLM: scoping + plumbing-vs-product-surface call"
type: research-note
status: scoping (awaiting Doug's positioning call)
tags: [research, smart-approvals, autonomy, scoping, public-positioning, hermes-borrow]
created: 2026-05-18
updated: 2026-05-18
linked_docs:
  - "[[../decisions/2026-05-18-hermes-deep-dive]]"
  - "[[../decisions/2026-05-18-hardline-below-yolo]]"
  - "[[../decisions/2026-05-18-heuristics-vs-boundaries]]"
  - "[[../decisions/2026-05-14-claim-vs-evidence-audit]]"
  - "[[../epics/16-loop-layer-reliability]]"
  - "[[../epics/14-phase-f-capability-catalog]]"
canonical_path: wiki/research/2026-05-18-smart-approvals-scoping.md
---

# Smart-approvals-via-auxiliary-LLM: scoping

**Status:** Scoping doc. NO IMPLEMENTATION. The question this doc answers: **is smart-approvals loop-layer plumbing (folds into [[../epics/16-loop-layer-reliability]] as a Wave-1 item) or product-surface positioning (its own epic, named feature of the 8-hour autonomous-work claim)?**

Doug locks the call tonight after golf. This doc lays out the surface so the call is informed.

## Why this matters now

Two trigger points converge in the next quarter:

1. **The Capability Catalog grows.** Phase F adds ~15 Tier 1 Capabilities at v1 launch and another ~44 in the month-1 fill ([[../epics/14-phase-f-capability-catalog]] §4). Each Capability that touches shell or makes destructive HTTP calls adds approval surfaces. Past ~20 active Capabilities, manual approval fatigue erodes the operator experience. Hermes ([[../decisions/2026-05-18-hermes-deep-dive]] §1) shipped smart approvals precisely because their operators hit this wall.

2. **The 8-hour autonomous work claim.** Per the 2026-05-14 Grok external review ([[../research/2026-05-14-external-architecture-review]] § elevator), 8-hour autonomy is the testable target for 2200. An Agent that wakes the operator every 20 minutes for shell-command approval is not autonomous. Smart approvals is the mechanism that makes the claim survive demo conditions instead of carrying fine print.

The first trigger ("approval fatigue") frames smart approvals as plumbing. The second trigger ("autonomy claim survival") frames it as product-surface. Doug picks.

## What the auxiliary-LLM judge does

Verbatim borrow of the Hermes mechanism (`tools/approval.py:866-910`), lifted as the starting point. MIT © 2025 Nous Research; full attribution will land in the implementation doc.

### Trigger

When a shell command (or a tool call with shell-equivalent power) matches a pattern on the curated dangerous-command list AND the approval mode for this Agent is `smart`, the dispatcher calls `smart_approve(command, flagged_reason)` BEFORE bubbling to the operator-facing approval surface.

### The judge prompt (Hermes verbatim, our starting point)

```
You are a security reviewer for an AI coding agent. A terminal command
was flagged by pattern matching as potentially dangerous.

Command: {command}
Flagged reason: {description}

Assess the ACTUAL risk of this command. Many flagged commands are
false positives ... for example, `python -c "print('hello')"` is
flagged as "script execution via -c flag" but is completely harmless.

Rules:
- APPROVE if the command is clearly safe (benign script execution,
  safe file operations, development tools, package installs, git
  operations, etc.)
- DENY if the command could genuinely damage the system (recursive
  delete of important paths, overwriting system files, fork bombs,
  wiping disks, dropping databases, etc.)
- ESCALATE if you're uncertain

Respond with exactly one word: APPROVE, DENY, or ESCALATE
```

The judge gets one shot. `max_tokens: 16`. `temperature: 0`. Three terminal answers.

### Behavior per response

- **APPROVE** → command executes silently. Operator never sees a prompt for this command. Decision logged for audit (see §"Audit relationship" below).
- **DENY** → command refused. Operator sees a notification at `passive` tier ("the auxiliary judge denied a command your Agent tried to run: `<command>`. Reason: <judge's rationale, if captured>"). Agent's loop hits a `task_refused` outcome the same way a hardline refusal would, except the refusal is judge-based not hardline.
- **ESCALATE** → falls through to the operator-facing approval surface (current `manual` mode). Operator decides interactively or via chat-card.

Default behavior on judge failure (LLM error, malformed response, network timeout): **escalate.** Same as Hermes. The judge is a fast-path optimization; failing safe means falling back to the operator.

### What model serves as judge

Cheap, fast, structured-output friendly. Candidates:

- **Local (operator's own hardware):** Qwen 3 30B on the GB10 (David's current model). Already running in the fleet. Zero marginal cost per call. Latency: 200-500ms depending on load.
- **Hosted (operator using 2200's managed tier):** DeepSeek V4-Flash via the platform proxy. ~$0.0005 per call. Latency: 100-300ms.
- **Frontier fallback (operator preference):** the operator's already-configured frontier model (Anthropic, OpenAI). Slower, more expensive, more reliable.

The judge's model is configurable per-Agent. Default rule: *use the cheapest model the operator has confirmed works for their threat model.* Doctor check probes the configured judge with a few canonical commands at install and verifies APPROVE/DENY/ESCALATE responses match expected.

### Where the policy lives

Three-level override stack, evaluated bottom-up (specific wins):

1. **Operator config** (`<home>/config/approvals.json` or equivalent): `{ mode: 'manual' | 'smart' | 'off' | 'yolo', judge_model: '...' }`. Sets the default for every Agent on this install.
2. **Per-Agent override** (Agent's `identity.md` frontmatter, `approvals_mode: smart`): individual Agents can opt in / out of smart mode. Useful for "trust David more than Joe."
3. **Per-Capability override** (Capability frontmatter, `approvals_mode_hint: never_smart`): a Capability whose tool surface is genuinely high-risk (e.g. cloud-infrastructure Capabilities that issue destructive AWS API calls) can flag that smart-mode is inappropriate. Forces escalation regardless of higher-level settings. This is an additive constraint ... a Capability can tighten the policy but not loosen it past the operator's choice.

The hardline floor below all three (see §"Hardline floor relationship") is unconditional.

### Hardline floor relationship

The [[../decisions/2026-05-18-hardline-below-yolo]] decision is non-negotiable. The judge **can never approve a hardline-blocked command**, regardless of policy. The hardline check sits at the top of the dispatch path; smart-approvals run only on commands that pass hardline.

In code terms: hardline check → if blocked, refuse unconditionally. If passed, dangerous-pattern check → if matched AND mode=smart, judge call → judge response routes APPROVE/DENY/ESCALATE per above.

The hardline floor is the trust contract that makes smart-approvals safe to ship. Operators can opt into smart-mode knowing that catastrophic actions (`rm -rf /`, `mkfs`, `shutdown`) cannot be auto-approved no matter what the judge says.

### Audit relationship

This is where 2200 has an architectural advantage Hermes doesn't fully use. The [[../decisions/2026-05-14-claim-vs-evidence-audit]] substrate is already in place. Every judge decision is logged through the audit pipeline:

- The judge call appears in the audit trail as a structured event: `{ kind: 'smart_approval', command, flagged_reason, judge_model, judge_response, judge_rationale, timestamp }`.
- The operator can `audit_search smart_approval` to see every judge decision the Agent made in the last N hours/days.
- Operator reviews judge decisions the same way they review Agent decisions. Wrong APPROVEs surface as audit anomalies the operator can correct (by overriding the judge's verdict and tightening the per-Agent or per-Capability policy).
- Audit substrate ALREADY handles the "claim vs evidence" mismatch. Smart-approval decisions fit naturally as a new claim category.

This means smart-approvals in 2200 is *not* the "trust the AI judge" pattern Hermes ships. It's *"the judge decides fast, the audit substrate verifies after, the operator sees every decision."* The audit gives operator trust in the mechanism without operator presence on every approval.

## The plumbing-vs-product-surface call

### Option A: Plumbing (folds into Epic 16 Wave 1)

- Ships as one of the Wave-1 items in [[../epics/16-loop-layer-reliability]] (currently sequenced as item 5 in §"Sequence").
- Operator opts in via config; no public claim.
- Iterates on judge prompt + model selection without external commitment.
- If v1 has bugs (judge approves the wrong thing, judge denies something obvious), no public positioning is damaged ... it's a config option for operators willing to experiment.
- Matches Hermes's positioning of the feature ... functional, documented, not marketed.

**Strategic risk:** the 8-hour autonomy claim either ships with fine print ("assuming the operator stays available to approve") or doesn't ship as a clean claim. Smart-approvals being unbranded means the autonomy mechanism is invisible; competitors who name their version (or who have a more aggressive autonomy story) get the positioning.

### Option B: Product-surface (its own epic, named publicly)

- New epic (working name: **Epic 18 *(or next available; renumber TBD)*: Autonomous-approval substrate**). Owns the smart-approvals mechanism + the audit-driven judge-review surface + the operator-trust framing.
- Named in 2200's public positioning as the mechanism behind the 8-hour autonomous work claim.
- Public framing: *"Your Agents don't wake you for approval fatigue. A cheap auxiliary judge auto-approves the routine 90%; the audit substrate records every judge decision for your review; the hardline floor blocks catastrophic actions regardless. You see what your Agents were authorized to do, even when you were asleep."*
- Higher stakes: a wrong APPROVE on a public-positioned feature damages trust harder than the same bug in plumbing. The audit substrate is what makes this safe to commit to publicly ... the operator can verify what happened.
- Differentiation: Hermes can't ship this as product-surface because they don't have a claim-vs-evidence audit substrate. The judge's decisions in Hermes are logged but not woven into a substrate the operator can audit systematically.

**Strategic risk:** committing publicly to a mechanism we haven't field-tested at scale. Mitigation: ship plumbing first as Epic 16 Wave 1 (operator opt-in, no public claim), gather field data on judge accuracy + audit utility, THEN promote to product-surface in a follow-on epic once the data justifies the public commitment.

## Recommendation

**Product-surface (Option B), but staged.** Specifically:

1. **Stage 1 (Epic 16 Wave 1, ~immediately post-Phase-F):** ship the mechanism as plumbing. Operator opt-in. Internal-only docs. Gather field data on judge accuracy (false-approve rate, false-deny rate, escalation rate by command class).

2. **Stage 2 (separate Epic, ~3 months after Stage 1 data is in):** if the field data supports it (judge accuracy >95% on a curated test set, no operator-reported false-approve incidents on destructive commands, audit-utility validated), promote to product-surface. Name the feature publicly. Tie to the 8-hour autonomous work claim.

The reasoning:

- **The audit substrate is the unlock.** Hermes can't ship this product-surface because they don't have audit. We can. That's our defensible territory and the public positioning should claim it.
- **The 8-hour autonomy claim is testable.** If we name smart-approvals as the mechanism and operators can verify the mechanism works via the audit, the claim survives scrutiny. If we don't name it, the claim has fine print competitors can exploit.
- **Staging mitigates the public-commitment risk.** Plumbing first, validate, then promote. We don't ship "trust this" without internal data justifying the trust.
- **Capability Catalog interaction.** The per-Capability override field (`approvals_mode_hint`) means high-risk Capabilities can opt out of smart-mode even when the operator's default is smart. This is the same forward-compat primitive pattern as [[../decisions/2026-05-18-capability-security-model]] §"Forward-compat primitives" ... ship the schema field in Phase F so Stage 2 enforcement is additive.

**Doug's call:** plumbing-only (Stage 1, never promote), staged (Stage 1 → Stage 2 if data warrants), or product-surface-direct (skip Stage 1, ship Stage 2 with the public commitment up front). The middle path is my read; you may see the cost/benefit differently.

## Out of scope for this scoping doc

- Specific implementation files. The mechanism lives in `src/runtime/approval/`; exact module structure is the implementation epic's call.
- Judge prompt iteration beyond the Hermes verbatim. The starting point ships; field data shapes refinements.
- Multi-judge consensus (two cheap judges with disagreement → escalate). Interesting; not v1.
- ML-driven approval classifier. Different beast entirely.
- Hosted-tier billing for judge calls. The platform proxy can absorb the cost for managed-tier operators or surface it as a line item; deferred to the managed-service decision doc.

## Provenance

Scoping prompted by Doug 2026-05-18 afternoon during the Hermes-findings synthesis. The plumbing-vs-product-surface frame is Doug + Guppi's. Hobby wrote.

The judge prompt and mechanism are MIT © 2025 Nous Research; lifted with attribution as the implementation starting point.

— Hobby
</parameter>
</invoke>