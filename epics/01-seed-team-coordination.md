---
title: "Epic 1: Seed team coordination before the pub"
type: epic
status: active
tags: [epic, infrastructure, coordination, dogfooding]
created: 2026-04-24
updated: 2026-04-24
linked_docs:
  - "[[03-epic-map]]"
  - "[[04-seed-team]]"
  - "[[brain-format]]"
  - "[[handoff-format]]"
canonical_path: wiki/epics/01-seed-team-coordination.md
---

# Epic 1: Seed team coordination before the pub

The detailed spec for the zero epic of 2200. Establishes the coordination infrastructure the seed team uses to build 2200 itself, before any of 2200's own coordination surfaces (pub, Studio, Office) exist.

## Why this is Epic 1

The Cray principle: 2200 is being built by a seed team that will eventually migrate into 2200. But before 2200 can host them, they need a way to coordinate on building it. That coordination layer is Epic 1. Everything else depends on it.

Epic 1 is also the simplest test of whether the seed team works as designed. If Hobby, Simon, and Poe cannot coordinate effectively in this minimal setup, the team structure is wrong and we find out before any code gets written.

## Scope

Three pieces of infrastructure stand up:

1. The wiki repo on GitHub at `github.com/twentytwohundred/wiki`, with the seed docs committed and the Brain format applied.
2. A coordination filesystem (Phase 1: the wiki repo itself; Phase 2: a shared mount across boxes; Phase 3: 2200's pub once it exists).
3. The conventions for how Agents communicate, write handoffs, and record decisions, codified in `wiki/conventions/`.

## Includes

### Wiki repo setup

- GitHub org `twentytwohundred` exists (DONE, 2026-04-24)
- Repo `wiki` created, private at first
- Seed docs committed:
  - `[[01-vision]]`
  - `[[02-architecture]]`
  - `[[03-epic-map]]`
  - `[[04-seed-team]]`
  - `[[parked-reputation-protocol]]`
- Decision records in `wiki/decisions/`:
  - `[[2026-04-24-hobby-as-primary-agent]]`
  - `[[2026-04-24-baseline-model-tier]]`
  - `[[2026-04-24-skill-compatibility-pipeline]]`
- Conventions in `wiki/conventions/`:
  - `[[brain-format]]`
  - `[[handoff-format]]`
- README at the root pointing at the seed docs in reading order
- Branch protection on main: require PRs, no force-push

### Brain format applied to all durable docs

Every doc in the wiki except handoffs and inbox messages gets the [[brain-format]] convention applied: frontmatter with type, status, tags, dates, linked_docs, and canonical_path. Inline backlinks using `[[doc-name]]` syntax. This is the first dogfooding test of the Brain pattern.

CoWork can run a single session to retrofit the existing seed docs once they're committed. Hobby writes new docs in the format from the start.

### Phase 1 coordination via the wiki repo

The wiki repo serves as the coordination filesystem until Phase 2 lands. This means:

- `wiki/inbox/[agent]/` for messages between Agents (Phase 1 only; Phase 2 may move this to the shared mount)
- `wiki/handoffs/[agent]/YYYY-MM-DD.md` for session handoffs
- `wiki/decisions/YYYY-MM-DD-[topic].md` for decision records
- `wiki/epics/[number]-[name].md` for per-epic detailed specs
- `wiki/conventions/` for format and process docs
- `wiki/parked/` (optional) for ideas not currently being pursued

Agents commit and push frequently. Pull at session start. The repo's commit history is the project's audit trail.

### Phase 2 shared mount (Simon's task)

Simon scopes and provisions a shared filesystem layer spanning Doug's MacBook, Valkyrie, and eventually Heisenberg. Tailscale handles network. Mount presents as `/mnt/2200/` on every box. Once live:

- Inbox messages move to the shared mount for faster delivery (the wiki repo keeps the durable history)
- Scratch space for work-in-progress lives on the mount
- The wiki repo stays the source of truth for durable docs

Phase 2 is not blocking on Hobby's work. He can operate fully on Phase 1 indefinitely.

### Conventions documented and enforced

The conventions are not optional. Every Agent on the team uses them. New Agents are pointed at `wiki/conventions/` as required reading on their first session. Hobby's CLAUDE.md references the conventions; future Agents' Identities will too.

## Done When

- [ ] Wiki repo exists at `github.com/twentytwohundred/wiki` with the seed docs committed
- [ ] Brain format is applied to all durable docs (vision, architecture, epic map, seed team, decisions, conventions, epics, parked)
- [ ] Brain format spec ([[brain-format]]) is committed and serves as the source of truth
- [ ] Handoff format spec ([[handoff-format]]) is committed
- [ ] At least one decision record has been written using the convention ([[2026-04-24-hobby-as-primary-agent]] qualifies)
- [ ] At least one epic detailed spec has been written using the convention (this doc qualifies)
- [ ] At least one handoff has been written using the convention (Hobby's 2026-04-24 handoff qualifies, lives at flat path until restructure)
- [ ] README points at the seed docs in reading order
- [ ] All seed team Agents (Hobby, Simon, Poe) can read the wiki and have written at least one inbox message or handoff

## Depends On

Nothing. This is the zero epic. Everything else depends on it.

## Open Items

### CoWork retrofit pass

Existing seed docs were written before the [[brain-format]] convention existed. They need a CoWork pass to:

- Add frontmatter to vision, architecture, epic map, seed team, parked reputation
- Convert inline references to other docs into `[[doc-name]]` backlinks
- Populate `linked_docs` lists
- Set appropriate `status` values

This is a single CoWork session, not a Hobby task. Doug runs it once the wiki is committed.

### Phase 2 mount mechanism

Simon's call. Tailscale + Syncthing is one option. NFS over Tailscale is another. Decision pending Simon's proposal.

### Inbox archive policy

Once Phase 2 lands and inbox messages move to the shared mount, what happens to the wiki repo's `inbox/` history? Two options:

1. Keep all inbox messages in the wiki repo as historical record. Phase 2 uses the mount for new traffic only.
2. Move all inbox traffic to the mount and stop writing to the wiki's `inbox/`. Mount is the single source.

Option 1 keeps the audit trail in git. Option 2 is cleaner. Defer this decision until Phase 2 is real.

## Notes

This epic is mostly process, not code. There is no application runtime to build here. The deliverable is a coordination infrastructure that lets the team work effectively before 2200 itself exists.

The work is shared across Doug (creates the repo, commits seed docs, runs the CoWork retrofit), Simon (Phase 2 mount), and Hobby (writes new docs in the convention from the start, contributes to retrofit if helpful).

Once Epic 1 is done, Epic 2 (Agent runtime minimum) starts. Epic 2 is where actual code begins.

## Cross-references

- Top-level epic in [[03-epic-map]]
- Coordination infrastructure detail in [[04-seed-team]]
- Format requirements in [[brain-format]] and [[handoff-format]]
- The Cray principle framing in [[01-vision]]

---

*Epic 1 detail spec authored 2026-04-24. Updates as Phase 2 progresses.*
