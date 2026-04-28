---
title: "Decision: Brain is Files on Disk, Not a Shadow Database"
type: decision
status: locked
tags: [decision, brain, memory, architecture, principle]
created: 2026-04-24
updated: 2026-04-24
linked_docs:
  - "[[01-vision]]"
  - "[[02-architecture]]"
  - "[[03-epic-map]]"
  - "[[prior-art-analysis]]"
  - "[[upgrade-readiness]]"
canonical_path: wiki/decisions/2026-04-24-brain-is-files-not-database.md
---

# Decision: Brain is Files on Disk, Not a Shadow Database

## Context

Both [[01-vision]] and [[02-architecture]] specify the Brain as markdown files on disk, with bidirectional links and SQLite FTS5 for fast search. The vision doc says explicitly: "No RAG. No opaque embeddings. No black-box memory." The architecture doc says: "Files are readable, editable, version-controllable, and transparent."

But this is the kind of principle that gets eroded under load. When Epic 8 (Brain) is drafted and someone hits a performance wall (a year of notes, slow search, big indexes), the temptation is to introduce a database backend "just for performance." That's how black-box memory gets reintroduced.

[[prior-art-analysis]] v0.1's review of OpenClaw's pluggable memory engines confirmed the right shape: pluggable memory backends are useful, but the substrate must remain markdown files on disk. SQLite FTS5 is an INDEX over the files, not a replacement for them.

## Decision

**The Brain is markdown files on disk. The files are the source of truth. No exceptions.**

Concretely:

- Every Brain note is a markdown file with frontmatter, written to disk as the Agent's primary action. Not a cache, not a write-behind to a database.
- SQLite FTS5 is an INDEX built from the files. If the index is lost, it can be rebuilt from the files. The files cannot be rebuilt from the index.
- Bidirectional links (`[[note-name]]`) live in the file content. Graph queries derive from parsing files, not from a separate graph store.
- Optional embedding indexes for semantic search are also derived from the files. Same rule: lose the index, rebuild from files.
- The user can open any Brain in any text editor (Obsidian, vim, VS Code, Notes.app) and see exactly what the Agent "knows." Edits to those files take effect on the next read. No sync layer, no opaque write-back.
- Pluggable memory ENGINES (per OpenClaw's pattern) are allowed AS LONG AS the file substrate is preserved. A future Brain backend that uses Postgres for fast graph queries on the shared Brain is fine if the files remain canonical.

What this rules out:

- Any database that holds Brain content as the source of truth, with files as a reflection.
- Any opaque embedding or RAG system where the user can't see what the Agent has indexed.
- Any "performance optimization" that breaks the "open the files in any editor" property.

## Consequences

### What gets better

1. **The user always knows what the Agent knows.** Open any Brain in Obsidian; read the files; understand the state.
2. **Corrections are file edits.** The user sees the Agent has wrong information; they edit the file; it's fixed. No special tooling required.
3. **Migration and upgrade are trivial.** Brain travels in a tarball of markdown files. No database migrations across versions, no schema dumps, no proprietary export formats. Aligns with [[upgrade-readiness]] discipline 2 (state on disk, not in memory).
4. **Backups are trivial.** rsync, git, Time Machine, Dropbox, anything that handles files handles the Brain.
5. **Survives 2200's death.** If 2200 the company disappears, the user still has every Brain in plain markdown. Lock-in is anti-trust; this is the strongest version of that principle.

### What could get worse

1. **Performance ceilings are real.** A year of dense notes is slow to search without the index. Mitigation: SQLite FTS5 was always part of the plan; it's the index, not a replacement.
2. **Multi-writer contention on shared brains.** SQLite FTS5 is single-writer. Multiple Agents writing to the shared Brain simultaneously need careful locking. Mitigation: serialize writes through a single supervisor process; Agents queue Brain writes rather than racing.
3. **Discipline must hold.** Future-Hobby (or future-Agent) hits a performance wall and is tempted to "just add SQL." This decision record exists so they re-litigate explicitly rather than drift silently. Updates to this principle require their own decision record per [[brain-format]].

## Implementation guidance for Epic 8

When Epic 8 (Brain) is drafted, the spec must:

- Specify markdown-with-frontmatter as the storage format, with the schema versioned per [[upgrade-readiness]] discipline 1
- Specify SQLite FTS5 as the index (rebuildable from files)
- Specify bidirectional link parsing from file content, not a separate graph store
- Specify the optional embedding layer as a derived index (rebuildable, never authoritative)
- Document the multi-writer contention story (serialized through supervisor)
- Reference this decision and not propose a database-as-source-of-truth alternative

Pluggable memory engines are fine as long as the file substrate is preserved. A future backend optimization (e.g., Postgres for graph queries on the shared Brain) is allowed if the files remain canonical and inspectable.

## References

- Triggered by [[prior-art-analysis]] v0.1, "Top-level lessons" section, item 6
- Reinforces [[01-vision]] ("No RAG. No opaque embeddings. No black-box memory.")
- Reinforces [[02-architecture]] (Brain section)
- Aligns with [[upgrade-readiness]] discipline 2 (state on disk)
- Sibling decisions from this session: [[2026-04-24-cost-behavior-shape]], [[2026-04-24-runtime-upgrade-shape]], [[2026-04-24-bulletin-substrate-is-scut]]

## Format provenance

This is the fourth decision record from the 2026-04-24 session. It locks an architectural principle that's already implied by vision and architecture but worth standalone capture so future Agents (or future contributors) don't quietly erode it under performance pressure.

Per [[brain-format]] convention, updates to this principle require a new decision record explaining what changed and why.

---

*Decision recorded by Doug and Hobby, 2026-04-24.*
