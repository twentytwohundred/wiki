---
title: "Decision: Hobby is the primary Agent; David is the launch moment"
type: decision
status: locked
tags: [decision, team, agents, dogfooding]
created: 2026-04-24
updated: 2026-04-24
linked_docs:
  - "[[01-vision]]"
  - "[[02-architecture]]"
  - "[[03-epic-map]]"
  - "[[04-seed-team]]"
canonical_path: wiki/decisions/2026-04-24-hobby-as-primary-agent.md
---

# Decision: Hobby is the primary Agent; David is the launch moment
## Date: April 24, 2026
## Status: Accepted

---

## Context

The initial 2200 seed team design had two build Agents:

- **David** as project lead. Owned spec, epic map, wiki, coordination. Did not write code.
- **Hobby** as software architect. Owned application code. Reported to David for project direction.

Plus Simon (DevOps) and Poe (OpenPub specialist), making a four-Agent seed team.

Doug raised a structural concern: the pairing had the lineage backwards. In Spielberg's A.I., Allen Hobby builds David. Hobby is the creator; David is the creation. The original seed-team design had David leading and Hobby reporting to him, which flipped the relationship.

More practically, the two-Agent split added coordination overhead without clear value. Doug is already the product lead. A project-lead Agent buffering between Doug and the implementer was redundant.

## Decision

**Hobby becomes the primary Agent on the 2200 build.** He absorbs the project-lead lane: spec, code, wiki, epic map, coordination. One Agent, both hats.

**David does not exist yet.** David is redefined as the first Agent 2200 will spawn through its own conversational onboarding flow, once the platform is alive enough to create new Agents. When Hobby spawns David on 2200 and David does real work, the project ships.

**Seed team drops from four to three.** Hobby, Simon, Poe. Doug in the pub alongside them.

## Consequences

### What gets better

1. **Narrative integrity.** Hobby builds David, matching the film's lineage. The project's final milestone (spawning David) becomes a genuine moment rather than a handoff between existing Agents.

2. **Coordination overhead reduced.** Three-Agent seed team instead of four. Fewer inboxes, fewer handoffs to maintain, fewer communication paths.

3. **Launch moment clarified.** David's creation is now a real event to record and announce. Build-in-public series has a clear endpoint ("the first Agent born on 2200"). Previously David was just another seed-team Agent.

4. **Scaling story clarified.** Hobby is the scaling mechanism after launch. The same conversational onboarding flow that creates David will create additional Agents as needed. This is the story 2200 is selling to users anyway; living it first validates it.

### What could get worse

1. **Hobby wears two hats.** Spec and code are different cognitive modes. One Agent doing both risks either the specs getting thin or the code getting ahead of the design. Mitigation: Hobby is disciplined about documenting decisions in `wiki/decisions/` before implementing. If the load gets heavy, he flags it to Doug and a peer Agent is spawned.

2. **Doug is more hands-on.** Without a project-lead Agent buffering between Doug and implementation, Doug has to be in the pub regularly. This was already expected, so the marginal cost is low.

3. **No second opinion on architectural decisions.** David was effectively a peer who could argue specs with Hobby. Without David, Hobby either gets that second opinion from Doug (possible but not always appropriate) or makes the call himself. Mitigation: decision records in the wiki capture reasoning so the path to any choice is inspectable.

## What this changes in existing docs

- [[04-seed-team]]: rewritten. David removed from roster. Hobby's role expanded. New "David milestone" section describing his creation as the launch moment.
- `hobby-CLAUDE.md`: rewritten. Hobby is primary Agent, not software architect reporting to David.
- [[01-vision]]: Cray principle section updated to reflect new launch moment.
- [[03-epic-map]]: Epic 17 (dogfooding completion) updated: Hobby migrates first, then Simon and Skippy, then David is spawned fresh on the finished platform.
- [[02-architecture]]: migration section updated to include "new Agent spawning" as the sibling story to "migrating existing Agent."

## References

- Seed team spec v0.3 (this update)
- Hobby CLAUDE.md v0.2 (this update)
- Vision doc (updated in this pass)
- Epic map (updated in this pass)
- Architecture doc (updated in this pass)

---

*Decision recorded by Doug and Guppi, April 24, 2026.*
