---
title: "Decision: Prompt-cache integrity is a 2200 design invariant"
type: decision
status: locked
tags: [decision, performance, caching, system-prompt, governance]
created: 2026-05-18
updated: 2026-05-18
linked_docs:
  - "[[02-architecture]]"
  - "[[2026-05-18-hermes-deep-dive]]"
canonical_path: wiki/decisions/2026-05-18-cache-as-invariant.md
---

# Decision: Prompt-cache integrity is a 2200 design invariant

**Status:** Locked. Governance, not engineering. Applies to every code change touching the system-prompt path or session-scoped state from this date forward.

## Context

Prompt-cache hit rate is the primary cost lever on a fleet runtime. At one Agent × one session, cache cost is a footnote. At **N Agents × M sessions per operator × K turns per session** (the 2200 target shape), it compounds linearly into the dominant runtime cost. Hermes Agent (Nous Research) treats *"Prompt Caching Must Not Break"* as a non-negotiable in its operating manual ([[2026-05-18-hermes-deep-dive]] §1 and §2). 2200 adopts the same posture as a design rule, not a nice-to-have.

## The rules

1. **Cache-control on the system prompt is non-negotiable.** Any PR touching the system-prompt builder, the cache-control application path (`apply_anthropic_cache_control` and equivalents), or any code that mutates the system-prompt string mid-session must include a *cache impact* paragraph in the PR description. The reviewer's first question is: "does this break the prefix?"

2. **Mutating slash commands default to next-session activation.** Commands that change identity, persona, memory snapshot, or context-file selection take effect on the *next* session by default. In-session mutation requires an explicit `--now` flag the operator types deliberately, knowing it nukes the prefix. Default is the cache-preserving choice; override is the operator's call.

3. **`apply_anthropic_cache_control` is load-bearing convention, not implementation detail.** The path is documented in [[02-architecture]] § "Context management" and referenced anywhere a system prompt or large context block flows through. Renaming, restructuring, or moving the path requires a follow-on update to this decision doc.

4. **Compounding rationale is explicit.** A change that breaks the prefix once is small. The same change merged into the runtime breaks the prefix for every Agent on every session ... a multiplicative cost in dollars AND in the latency hit of a fresh prefix-build on every turn. Quiet regressions here are expensive.

## Precedent

Hermes Agent's `AGENTS.md` ~861-873: *"Prompt Caching Must Not Break."* Same framing; adopted with attribution.

## Out of scope

This decision does not prescribe a specific cache provider, key shape, or breakpoint placement. Those are implementation calls that follow the rule. The rule is: when in doubt, preserve the prefix.

## Provenance

Adopted 2026-05-18 from the Hermes Agent deep dive ([[2026-05-18-hermes-deep-dive]]). Doug + Guppi locked the framing as governance during the post-deep-dive synthesis. This is a fast-win doc filed before the heavier strategy work in the same package.

— Hobby
</parameter>
</invoke>