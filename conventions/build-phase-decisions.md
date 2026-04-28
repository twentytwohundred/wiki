---
title: Build-Phase Decisions Convention
type: convention
status: active
tags: [convention, decisions, posture, build-phase]
created: 2026-04-28
updated: 2026-04-28
linked_docs:
  - "[[brain-format]]"
  - "[[handoff-format]]"
canonical_path: wiki/conventions/build-phase-decisions.md
---

# Build-Phase Decisions Convention

How decisions get made during the seed-team build phase. The short version: the build Agent decides, lands the work, and tells the product lead. This is the default. Specific categories of decisions break the default and require an explicit flag.

## Why this is a convention

Doug, the product lead, makes product decisions. Hobby (and other build Agents) make implementation decisions. The boundary is the difference between "what 2200 does and who it is for" (Doug's lane) and "how 2200 does it" (the build Agent's lane).

If every implementation decision required an explicit flag, the build would slow to chat speed. If no decisions ever surfaced, the product would drift away from what Doug intends. The convention draws the line so the build moves fast on the inside and stays accountable on the outside.

## The rule

> During the build phase, default to deciding on implementation calls and reporting in the handoff rather than flagging each one. Reserve flags for decisions that affect product shape, public contract, cost, discovered work, or seed-team scaling.

### Decide and tell

Most decisions during the build phase fall into this bucket. The build Agent picks the reasonable answer, lands the work, and documents the choice. Documentation channels:

- **Decision records** in `wiki/decisions/` for load-bearing calls (anything a future contributor or future Agent would need to understand to keep building).
- **Handoffs** in `wiki/handoffs/[agent]/` for everything else, including the chain of small choices that don't individually warrant a decision record.
- **PR descriptions** for work-specific reasoning that lives with the code.

Examples that fall into decide-and-tell:

- Library selection inside an epic where the choice doesn't change the public surface.
- Internal refactors that don't change public APIs, CLI commands, or persisted formats.
- Test structure, code style, naming, file organization.
- Implementation order within an already-approved epic spec.
- Schema versioning bumps and migration shape.
- Toolchain picks (within the documented stack).

### Flag to the product lead

Specific categories break the default. The build Agent flags these to Doug rather than deciding unilaterally:

| Category | Examples |
|----------|----------|
| **Product shape** | What 2200 does, who it is for, what the user sees, what features ship. |
| **Public contract** | External API, CLI shape, SOUL/Identity format, migration path, anything other systems will couple to. |
| **Cost** | Architectural choices with meaningful dollar implications (database choice that doubles hosting cost, model choice that triples token burn). |
| **Discovered work** | Anything found during build that isn't in the epic map. Doug decides whether it becomes a new epic, a scope addition, or a defer. |
| **Seed-team scaling** | Whether to spawn a peer Agent (another builder, a separate spec writer, a dedicated UI Agent). The build Agent proposes; Doug decides. |

When flagging, lead with the recommendation and the main alternative considered. Doug should not have to think from scratch.

## How to apply

When you are about to make a decision during the build phase, ask:

1. Does this fall into one of the five flag categories above?
   - **Yes:** flag it to Doug. Lead with your recommendation. Pause until you get a call.
   - **No:** decide. Land the work. Document.
2. Is this a load-bearing call (something a future contributor or future Agent needs to understand)?
   - **Yes:** write a decision record in `wiki/decisions/`. Use the standard format (Context, Decision, Consequences, Implementation guidance, References). Include a Format provenance line that notes "build-phase decide-and-tell" if relevant.
   - **No:** capture in the handoff, the PR description, or both.
3. Did anything about this decision suggest the rule itself needs an update? If so, propose the change in your next handoff.

## Cross-references

- [[handoff-format]] — where most decide-and-tell entries land.
- [[brain-format]] — frontmatter and structure for decision records.
- The Identity files for Hobby and other build Agents codify this rule per-Agent; this convention is the project-wide statement.

---

*Convention authored 2026-04-28. Promoted from a personal-memory rule that several Hobby sessions had been informally citing as `[[feedback_decide_and_tell_in_build_phase]]`. The rule has been the active working norm since the project started; this doc captures it for future contributors and future Agents joining the build. Updates require a decision record.*
