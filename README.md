---
title: 2200 wiki
type: reference
status: active
tags: [readme, wiki, entry-point]
created: 2026-04-24
updated: 2026-04-29
linked_docs:
  - "[[01-vision]]"
  - "[[02-architecture]]"
  - "[[03-epic-map]]"
  - "[[04-seed-team]]"
  - "[[brain-format]]"
canonical_path: wiki/README.md
---

[![License: Elastic License v2](https://img.shields.io/badge/license-Elastic%20v2-0077B5.svg)](LICENSE)
[![Phase: spec + build](https://img.shields.io/badge/phase-spec%20%2B%20build-orange.svg)](03-epic-map.md)
[![Decisions: 17](https://img.shields.io/badge/decisions-17%20locked-5319E7.svg)](decisions/)
[![Conventions: 7](https://img.shields.io/badge/conventions-7-2EA44F.svg)](conventions/)
[![Built in public](https://img.shields.io/badge/built-in%20public-2EA44F.svg)](handoffs/hobby/)

# 2200 wiki

The project knowledge base for the 2200 build. Vision, architecture, decisions, conventions, per-epic specs, prior-art analysis, and the daily handoffs that show how the work actually got done.

This is the canonical source. Read on github at [twentytwohundred/wiki](https://github.com/twentytwohundred/wiki) or clone it for an Obsidian-compatible knowledge vault.

For the 30-second pitch, read [01-vision.md](01-vision.md). This page orients you in the wiki itself.

## Reading order

If you are new to this project, read these in order:

1. [01-vision.md](01-vision.md) ... what 2200 is, who it is for, why it exists
2. [02-architecture.md](02-architecture.md) ... object model, runtime shape, how OpenPub and SCUT compose under 2200
3. [03-epic-map.md](03-epic-map.md) ... the epic plan with scope, done-when, and dependencies
4. [04-seed-team.md](04-seed-team.md) ... who builds this, how they coordinate, when they migrate

Then follow [conventions/brain-format.md](conventions/brain-format.md) and [conventions/handoff-format.md](conventions/handoff-format.md) to understand how the wiki itself is structured.

## Project status

As of 2026-04-29:

- Vision, architecture, and epic map locked. Prior-art analysis complete (twelve targets surveyed; executive doc plus deep findings appendix).
- **Seventeen decision records locked.** See [decisions/](decisions/) for the index.
- **Seven conventions** active: see [conventions/](conventions/).
- **Epics shipped on `main`:** 2 (Agent runtime minimum), 3 + 3.5 + 3.6 + 3.7 + 3.8 (local pub integration via OpenPub), 4 Phase A v0.4 (SCUT identity at spawn), 4.5 (cost caps and usage telemetry), 6 (scheduler), 7 Phase A (notifications + ask), 8 Phase A (Agent brain).
- **741 tests / 60 files / lint+typecheck+build clean** as of `main@273dfc3`.
- **Multi-Agent coordination working** end-to-end on the seed-team box.

The runtime substrate for migrating Hobby (and the rest of the seed team) into 2200 is in place. Epic 5 (Migration tooling) is the next major milestone ... after that, the Cray test begins.

## What's where

The canonical tree preserves folder structure. Everything published; nothing flattened.

```
wiki/
├── 01-vision.md                  what 2200 is
├── 02-architecture.md            object model, runtime shape
├── 03-epic-map.md                the epics
├── 04-seed-team.md               who builds this
├── prior-art-analysis.md         executive prior-art analysis
├── prior-art-source-findings.md  deep per-target source-reading appendix
├── README.md                     this file
├── LICENSE                       Elastic License v2
├── conventions/                  brain-format, handoff-format, voice-and-framing,
│                                 design-language, upgrade-readiness, license-posture,
│                                 build-phase-decisions
├── decisions/                    Architecture Decision Records (YYYY-MM-DD-short-name.md)
├── design/                       design docs (pulse, brain-visualization, ...)
├── epics/                        per-epic specs (01, 02, 03, 03.5, 04, 04.5, 08, ...)
├── handoffs/                     per-Agent session handoffs (daily transparency)
├── inbox/                        per-Agent message inboxes
├── parked/                       future projects, not active
├── research/                     background research notes
├── runbooks/                     reproducible operational runbooks
├── state/                        daily state snapshots
└── strategy/                     operating thesis + strategic framing
```

## How this wiki is structured

This is an Obsidian-compatible knowledge vault. Every durable doc has:

- Frontmatter declaring its type, status, tags, dates, linked docs, and canonical path
- Inline backlinks using `[[doc-name]]` syntax (renders as clickable links in Obsidian; on github, follow the relative paths in the README and sidebar)
- A specific section structure depending on its type (epic specs, decision records, conventions all have shapes)

We dogfood the Brain pattern (the same one 2200's Agents will use for their memory) on the project that is building 2200. If the format works for us, it works for Agents. See [conventions/brain-format.md](conventions/brain-format.md) for the full convention.

## Who works here

Three Agents on the seed team:

- **Hobby**: primary build Agent. Writes spec and code. Currently runs as Claude Code on Doug's MacBook.
- **Simon**: DevOps. Owns infrastructure. Provisions hosts, deploys, manages the shared filesystem.
- **Poe**: OpenPub specialist. Part-time on 2200; full-time once Poe migrates onto the platform.

Plus:

- **Doug**: product lead. Makes product decisions. Spawns Agents. Reviews specs and decisions.
- **Guppi**: strategy and ops partner. Holds context across all of Doug's projects, not just 2200.

David is not on the seed team. David is the first Agent 2200 will spawn through its own conversational onboarding flow. When that happens, the project ships. See [04-seed-team.md](04-seed-team.md) for the full launch story.

Daily transparency: each working day's handoff lives at [handoffs/hobby/](handoffs/hobby/). State snapshots at [state/](state/). The work is visible.

## Conventions at a glance

- All durable docs use the [brain-format](conventions/brain-format.md) convention
- Handoffs use the [handoff-format](conventions/handoff-format.md) convention
- Product copy and any external-facing writing follows the [voice-and-framing](conventions/voice-and-framing.md) convention
- UI/UX decisions follow the [design-language](conventions/design-language.md) convention (familiar analog, high-tech polish)
- Every epic spec includes an "Upgrade-readiness" section per the [upgrade-readiness](conventions/upgrade-readiness.md) convention
- Decision records have Context, Decision, Consequences, References sections
- Epic specs have Scope, Includes, Done When, Depends On, Notes sections
- Use ellipses, not em-dashes (titles excepted)
- Agent is a proper noun, always capitalized

## License

2200 ships under [Elastic License v2](LICENSE). Source-available. Use, copy, distribute, and create derivative works are permitted; hosting as a managed service to third parties and license-key tampering are prohibited.

Prior-art sources surveyed:
- **OpenClaw**: MIT (Copyright (c) 2025 Peter Steinberger)
- **EdgeClaw, OCMT, OpenAEON, AnyClaw, mimiclaw**: not personally verified ... verify before any code lift
- **Logseq, Trilium, Joplin** (rejected): AGPL viral, disqualifying for embedding paths
- **Cytoscape.js, react-markdown, remark-wiki-link, SilverBullet, Quartz, Foam**: MIT (clean composition under EL v2)

MIT → Elastic v2 is permitted with copyright notice preservation for directly-copied portions. AGPL is incompatible for embedding. Always pair "lift from external project" with license analysis. See [conventions/license-posture.md](conventions/license-posture.md).

## Cross-references

- **Project domain:** [2200.ai](https://2200.ai)
- **GitHub org:** [github.com/twentytwohundred](https://github.com/twentytwohundred)
- **Wiki (this repo):** [twentytwohundred/wiki](https://github.com/twentytwohundred/wiki) (public)
- **Runtime repo:** [twentytwohundred/2200](https://github.com/twentytwohundred/2200) (private until launch)
- **License:** [Elastic License v2](LICENSE)

---

*Built in public. Ship when ready.*
