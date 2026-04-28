---
title: Brain Format Convention
type: convention
status: active
tags: [convention, format, wiki, brain, obsidian]
created: 2026-04-24
updated: 2026-04-24
linked_docs:
  - "[[01-vision]]"
  - "[[02-architecture]]"
  - "[[handoff-format]]"
canonical_path: wiki/conventions/brain-format.md
---

# Brain Format Convention

This wiki is structured as an Obsidian-compatible knowledge vault. The format is the same one we plan to use for the Brain object in 2200's architecture. We dogfood it here on the spec docs that build 2200, before any code is written. If the format works for us, it works for Agents.

## Why this exists

Three reasons we do this from day one:

1. **Validates the Brain spec.** If we struggle to use the format for our own docs, the spec is wrong. Better to find that now than after Epic 8 ships.
2. **Trains the convention into Agents.** Every doc Hobby writes uses backlinks. By the time he's writing Epic 8 (Brain), he's been using the pattern for weeks.
3. **Navigable history.** Six months from now, opening this vault in Obsidian shows the actual graph of decisions, epics, and dependencies. Searching from a single doc surfaces every related doc without grep.

## Rules

### Every doc has frontmatter

```yaml
---
title: Human-readable title
type: [vision | architecture | epic | decision | convention | handoff | inbox | reference]
status: [draft | active | locked | superseded | parked]
tags: [list, of, relevant, tags]
created: YYYY-MM-DD
updated: YYYY-MM-DD
linked_docs:
  - "[[doc-name-1]]"
  - "[[doc-name-2]]"
canonical_path: wiki/path/to/file.md
---
```

Notes on fields:

- **type**: what kind of doc this is. Used for filtering and tooling. New types can be added; check the linked list for current options.
- **status**: `draft` (in progress), `active` (current source of truth), `locked` (don't edit without a new decision record), `superseded` (replaced by a newer doc, link to it), `parked` (idea captured for future, not pursuing now).
- **tags**: free-form, but use existing tags before inventing new ones. Common tags: `vision`, `architecture`, `runtime`, `protocol`, `ux`, `infrastructure`, `agents`, `extensions`, `model-layer`, `convention`, `decision`, `dogfooding`.
- **created** and **updated**: dates only, ISO format.
- **linked_docs**: explicit list of other docs in the wiki this one references. Adds them to the graph view in Obsidian. Use the `[[doc-name]]` form (without `.md`).
- **canonical_path**: where this doc lives once the wiki is fully restructured. Useful during the Phase 1 flat-file period before the nested layout is real.

### Inline backlinks use Obsidian syntax

When a doc references another doc, link it inline:

> Per the [[02-architecture]] doc, every Agent has a Brain.

Not:

> Per the architecture doc, every Agent has a Brain.

Backlinks are not just for citation. They build the graph. Obsidian's graph view shows them. CoWork and other tooling can traverse them. Future-Hobby's Brain implementation will use them.

### Backlinks point to canonical names, not paths

Use `[[02-architecture]]` not `[[wiki/02-architecture.md]]`. Obsidian resolves names to paths automatically. This means files can be moved without breaking links, as long as names stay unique.

If two docs would have the same name (e.g. multiple `handoff.md` files), include enough qualifier in the filename to disambiguate (`handoff-2026-04-24-hobby.md`).

### Decision records have a specific shape

Every decision record has Context, Decision, Consequences (with what-gets-better and what-could-get-worse sub-sections), Implementation guidance, References, and Format provenance sections. Tags include `decision`. Filename is `YYYY-MM-DD-short-name.md`. The records in `wiki/decisions/` are the running examples.

### Epic specs have a specific shape

Every epic spec has Scope, Includes, Done When, Depends On, Notes, and an Upgrade-readiness section (per [[upgrade-readiness]]). The epic map ([[03-epic-map]]) summarizes; the per-epic spec at `wiki/epics/NN-name.md` details. The records in `wiki/epics/` are the running examples.

### Handoffs have their own format

See [[handoff-format]] for the full spec. Handoffs are chronological artifacts and do not need to be retrofitted with backlinks beyond their canonical references.

### Inbox messages are minimal

Inbox messages are short, transient, and don't need full Brain-format frontmatter. Filename convention: `YYYY-MM-DD-HHMMSS-from-[sender]-re-[short-topic].md`. Body contains a short greeting line, the message, and a sign-off. They live under `wiki/inbox/[recipient]/` and may be moved to `wiki/inbox/[recipient]/archive/` once handled.

## What does NOT need retrofitting

- **Handoff docs.** They're chronological. Past handoffs do not need backlinks added retroactively.
- **Inbox messages.** Same reason. They're transient communication, not durable knowledge.
- **Arrival messages.** Same.

## What DOES need retrofitting

When this convention is applied to existing docs, these get the full treatment:

- All vision, architecture, epic-map, and seed-team docs
- All decision records
- All convention docs
- All epic detail specs (when they exist)
- The README

## Tooling

### Phase 1 (now)

Manual. Every new doc gets the format from the start. Existing docs get retrofitted by Doug or CoWork in a focused session.

### Phase 2 (eventual)

A simple script that:
- Validates frontmatter on every doc
- Detects unlinked references (a doc is mentioned by name but not in `linked_docs`)
- Detects orphan docs (no other doc links to it)
- Generates a graph view as a static artifact for the README

This is not a Hobby task. CoWork or a small Skill can do it.

## Status of this convention

This is v0.1. Will evolve as we use it. Updates require a decision record explaining what changed and why. Don't update silently.

---

*Convention authored 2026-04-24. Living doc, expect revisions as the wiki grows.*
