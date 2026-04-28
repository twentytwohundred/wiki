---
title: "Decision: Skills as a First-Class Object"
type: decision
status: locked
tags: [decision, skills, extensions, object-model, runtime]
created: 2026-04-25
updated: 2026-04-25
linked_docs:
  - "[[02-architecture]]"
  - "[[03-epic-map]]"
  - "[[prior-art-analysis]]"
  - "[[prior-art-source-findings]]"
  - "[[2026-04-24-skill-compatibility-pipeline]]"
  - "[[2026-04-25-mcp-native]]"
  - "[[2026-04-25-tool-baseline]]"
canonical_path: wiki/decisions/2026-04-25-skills-first-class.md
---

# Decision: Skills as a First-Class Object

## Context

Earlier in the project, [[2026-04-24-skill-compatibility-pipeline]] folded Skills into Extensions, treating Skills as "Extensions of type Skill" wrapped through the take-and-normalize pipeline at install. That was the right call given what was known at the time, which was largely the public Skill spec rather than the actual host implementation.

The v0.3 source reading (see [[prior-art-source-findings]] Target 2) showed that OpenClaw treats Skills as their own primitive with their own runtime model:

- Skills are stateless and declarative; Extensions are stateful and packaged.
- Skills compose against the baseline tool set ([[2026-04-25-tool-baseline]]); Extensions can bring their own tools, state, schedules, and UI surface.
- Skills install and uninstall cleanly with no migration step; Extensions have a lifecycle.
- The user mental model differs: Skills are "more recipes", Extensions are "more apps".

The folding-into-Extensions framing flattened those distinctions and made Epic 11 (Skills ingestion) read like a degenerate case of Epic 12 (Extensions). It also made Skills look like a packaging detail rather than an object on the model worth treating as such.

## Decision

**Skill becomes a first-class object in 2200's object model**, alongside Agent, Project, Task, Pub, Notification, Tool, Schedule, and Brain.

A Skill has:

- A **name**, unique within the instance.
- A **description**, the one-line purpose surfaced to Agents and users.
- A **set of instructions**, the markdown body the Agent follows when invoked.
- A **tool dependency list**, declaring which baseline tools (or named MCP servers) it relies on.
- A **scope**, the Agents that have it available.
- A **provenance**, where it came from (local author, GitHub repo, ecosystem index) and which normalizations the take-and-normalize pipeline applied at install.
- A **version**, semver-like for the Skill's own lifecycle.

**Extensions are higher-level packaging that can include Skills.** An Extension can ship one or more Skills as part of its installation footprint, plus state, schedules, multi-Agent coordination, UI surface, and tool integrations. A user installing the Email Triage Extension might receive a "draft a triage rule" Skill as one of its bundled artifacts, and Agents in that user's instance can invoke that Skill directly.

**Epic 11 (Skills ingestion) is its own epic.** It produces Skill objects, not Extensions. The take-and-normalize pipeline ([[2026-04-24-skill-compatibility-pipeline]]) operates on first-class Skills.

**Epic 12 (Extensions framework) is for the higher-level packaging.** Extensions remain the v1 marketplace surface for things that need state, schedule, lifecycle hooks, or UI.

## Refinement of the earlier decision

[[2026-04-24-skill-compatibility-pipeline]] is not edited. It captured the thinking at that point, when Skills-as-Extension-wrappers was the working assumption. The pipeline's five phases (parse, validate, normalize, notify, install) all still apply, but they install a first-class Skill object rather than wrap it as a minimal Extension.

The change to that pipeline:

| Phase | Earlier framing | Refined framing |
|---|---|---|
| Parse | Read SKILL.md | Read SKILL.md |
| Validate | Check against Skill spec | Check against Skill spec |
| Normalize | Apply known-good fixes | Apply known-good fixes |
| Notify | Surface changes to user | Surface changes to user |
| Install | "Wrap as minimal Extension" | "Register as first-class Skill object" |

Everything upstream of install is unchanged. Install becomes simpler, not more complex.

## Consequences

### What gets better

1. **The object model reflects the user mental model.** Skills are recipes, Extensions are apps. Treating them as separate objects matches how users will think about them and how the ecosystem already separates them.
2. **Epic 11 has its own scope without being a degenerate Epic 12.** Skills ingestion ships earlier and independently. It does not block on the Extensions framework being complete.
3. **Skill compatibility with the broader ecosystem stays clean.** A SKILL.md from the open-source ecosystem maps to a Skill object in 2200 with no Extension wrapper layer between. The take-and-normalize pipeline is the only translation, and it only fires when the source isn't already conforming.
4. **Extensions can compose Skills.** An Extension that wants to ship a Skill as part of its install does so explicitly, by declaring `bundled_skills:` in its manifest. The Skill remains a first-class object the user can see, edit, and disable independently of the Extension that installed it.
5. **Permission model is cleaner.** Skills declare tool dependencies against the baseline; Extensions declare full capability scopes. The two scopes don't have to be unified.

### What could get worse

1. **Two object types where there used to be one.** More surface area in the runtime, the API, the UI. Acceptable cost given the user-mental-model alignment.
2. **The relationship between a Skill and the Extension that bundled it needs lifecycle rules.** When the Extension is uninstalled, what happens to the bundled Skill? Default: removed unless the user explicitly forked it into a local Skill. Locked in Epic 12 spec.
3. **Source-of-truth question for installed Skills.** The Skill object has a record in 2200's state; the SKILL.md file has the original content. If the user edits the SKILL.md directly on disk, does the runtime reread it? Yes; SKILL.md on disk is the source of truth, and the registered object reflects the latest file content. Same Brain-as-files discipline as [[2026-04-24-brain-is-files-not-database]].
4. **Architecture doc has a new object to document.** [[02-architecture]] gets a Skill section in the object model.

## Implementation guidance

### Architecture doc

Add Skill to the object model in [[02-architecture]]. Position it between Tool and Schedule (since Skills compose against tools and Skills can be triggered by Agent loop events, similar to schedules in spirit but not identical in mechanism).

### Epic 11

Update Epic 11 scope to reflect:

- Output is a registered Skill object, not a wrapped Extension.
- The take-and-normalize pipeline still runs in full.
- Skills declare tool dependencies that map onto the baseline ([[2026-04-25-tool-baseline]]) or onto MCP servers ([[2026-04-25-mcp-native]]).
- The "upgrade to Extension" path mentioned in the original Epic 11 scope means: when a user wants stateful behavior or scheduling, they package the Skill into an Extension. The Skill remains; the Extension wraps additional capability.

### Epic 12

Update Epic 12 scope to reflect:

- Extensions can declare `bundled_skills:` in their manifest.
- Bundled Skills are installed as first-class Skill objects when the Extension installs.
- Lifecycle: Extension uninstall removes its bundled Skills unless the user has forked them.

### Object model carry-forward

Roster, Brain, and related primitives that summarize an Agent's capabilities now include Skills as a separately-tracked dimension. An Agent's Roster entry might list "tools: filesystem, shell, web; skills: triage-email, format-meeting-notes". Locked separately when those primitives' epics get spec'd.

## License posture

Skill objects we author internally carry 2200's license (Elastic License v2). Skills imported from external sources retain their authors' licensing; the Skill record stores the upstream license string and 2200 surfaces it to the user. AGPL-licensed Skills are flagged at install ([[feedback_track_licensing]]) because their viral terms can affect the surrounding instance.

## References

- Refinement of [[2026-04-24-skill-compatibility-pipeline]] (which is not edited; the original captured earlier thinking)
- Triggered by [[prior-art-source-findings]] Target 2 (OpenClaw Skills runtime model)
- Synthesized in [[prior-art-analysis]] Section 8 Epic 11
- Pairs with [[2026-04-25-tool-baseline]] (Skills declare baseline tool deps)
- Pairs with [[2026-04-25-mcp-native]] (Skills can declare MCP-server deps)
- Affects [[02-architecture]] (Skill becomes object in the model)
- Affects [[03-epic-map]] Epics 11 and 12

## Format provenance

Decision recorded by Hobby and Doug, 2026-04-25, in Doug's inbox reply locking three architecture choices from v0.3 prior-art analysis. Doug's instruction was explicit: do not edit the original Skill compatibility pipeline record; write a follow-up that captures the refinement.

---

*Decision recorded by Doug and Hobby, 2026-04-25.*
