---
title: "Decision: Runtime Upgrade Shape (Epic + Convention)"
type: decision
status: locked
tags: [decision, runtime, upgrade, epic, convention]
created: 2026-04-24
updated: 2026-04-24
linked_docs:
  - "[[upgrade-readiness]]"
  - "[[prior-art-analysis]]"
  - "[[03-epic-map]]"
  - "[[2026-04-24-cost-behavior-shape]]"
canonical_path: wiki/decisions/2026-04-24-runtime-upgrade-shape.md
---

# Decision: Runtime Upgrade Shape (Epic + Convention)

## Context

[[prior-art-analysis]] v0.1 flagged that the original epic map has no answer for what happens when 2200 itself upgrades. When v1.1 ships and a user is running v1.0, every running Agent, every in-flight task, every Brain note, every Identity file, every installed Extension, and every stored credential must survive the upgrade. The cost of retrofitting upgrade-readiness later (after eighteen epics worth of design choices) is large.

Doug's instinct: it deserves an epic, but the substance can't wait for a late-numbered epic to ship. Build it in from day 1.

## Decision

Split the runtime upgrade work into two artifacts:

1. **A convention: [[upgrade-readiness]].** Captures seven disciplines every epic must respect from day 1: schema versioning, state-on-disk discipline, graceful Agent restart, Extension version compatibility, credential indirection, idempotent task handling, versioned internal APIs. Required reading before any epic spec is drafted. Each epic spec must include an "Upgrade-readiness" section addressing applicable disciplines.

2. **A new epic on the map: Runtime Upgrade.** The user-facing mechanism: update notification, in-flight task handling at the moment of upgrade, rollback UX, the actual update commands, self-host vs managed cadence. Lands between current Epic 17 (managed service) and current Epic 18 (dogfooding). Final numbering during the epic-map walkthrough.

The framing that holds it together: **upgrade is a degenerate case of migration.** Epic 5 (Migration from other Agent systems) builds the portable primitives. Upgrade is the same primitives applied to a narrower case (system-initiated, recurring, same box).

## Consequences

### What gets better

1. **No retrofit at v1.1.** The disciplines are in place from day 1. v1.1 ships and the existing artifacts are read correctly.
2. **Visible roadmap honesty.** The Runtime Upgrade epic exists on the map. Users see we've thought about it.
3. **Migration and upgrade share substrate.** Epic 5's portable handoff format, Identity portability, Brain-as-files all do double duty.
4. **Each epic spec is more rigorous.** The required "Upgrade-readiness" section forces explicit thinking about how this epic's artifacts evolve over time.

### What could get worse

1. **More work per epic.** Every epic spec is longer because of the upgrade-readiness section. Acceptable cost; the alternative is retrofit.
2. **Discipline can drift.** Without enforcement, the upgrade-readiness section could become checkbox theater. Mitigation: Doug reviews epic specs and pushes back on hand-wavy upgrade-readiness sections.
3. **The future epic depends on disciplines being honored.** If Epic 8 ships without Brain schema versioning, the Runtime Upgrade epic can't fix that retroactively without painful migrators. Enforcement happens at epic spec review, not at upgrade time.

## Implementation guidance for the epic map

| Epic | Applies these disciplines |
|------|--------------------------|
| Epic 2 (Agent runtime) | Schema versioning, state-on-disk, graceful Agent restart, idempotent task handling |
| Epic 5 (Migration) | Schema versioning (handoff format), state-on-disk |
| Epic 8 (Brain) | Schema versioning (notes, index), state-on-disk |
| Epic 9 (Tools) | SecretRef credential indirection, idempotent task handling, versioned internal APIs |
| Epic 11 (Skills ingestion) | Extension/Skill version compatibility (manifests) |
| Epic 12 (Extensions framework) | All seven disciplines (Extensions cross every boundary) |
| Epic 15 (Web app) | Versioned internal APIs |
| Epic 16 (Mobile app) | Versioned internal APIs |

Each epic spec must include a section titled "Upgrade-readiness" that addresses the applicable disciplines from the table above and explains how the epic's artifacts honor them.

The Runtime Upgrade epic itself is the user-facing mechanism. Its scope: update notification, in-flight task handling, rollback UX, the actual update commands, self-host vs managed cadence. Does not duplicate the disciplines listed above; assumes they've been honored.

## References

- Triggered by [[prior-art-analysis]] v0.1, "eight changes to the epic map" section
- Convention: [[upgrade-readiness]]
- Migration foundation: [[03-epic-map]] Epic 5
- Sibling decision from same session: [[2026-04-24-cost-behavior-shape]]

## Format provenance

Decision recorded by Hobby and Doug during their second working session, 2026-04-24. The shape was clear-cut: Doug locked it in one turn after Hobby proposed the epic + convention split. Doug's framing: "It does deserve an epic, but we can also build it all in from day-1 and plan for it from the jump."

This is the second of three meaty epic-map changes from the prior-art analysis. Cost behavior was the first ([[2026-04-24-cost-behavior-shape]]); provider-plugin SDK split is the third.

---

*Decision recorded by Doug and Hobby, 2026-04-24.*
