---
title: 2200 Wiki
type: reference
status: active
tags: [readme, wiki, entry-point]
created: 2026-04-24
updated: 2026-04-26
linked_docs:
  - "[[01-vision]]"
  - "[[02-architecture]]"
  - "[[03-epic-map]]"
  - "[[04-seed-team]]"
  - "[[brain-format]]"
canonical_path: wiki/README.md
---

[![License: Elastic License v2](https://img.shields.io/badge/license-Elastic%20v2-0077B5.svg)](https://github.com/twentytwohundred/2200/blob/main/LICENSE)
[![Phase: Spec](https://img.shields.io/badge/phase-spec-orange.svg)](03-epic-map)
[![Decisions: 17](https://img.shields.io/badge/decisions-17%20locked-5319E7.svg)](_Sidebar)
[![Wiki: published](https://img.shields.io/badge/wiki-published%20from%20canonical%20source-2EA44F.svg)](https://github.com/twentytwohundred/2200/blob/main/README.md)

# 2200 Wiki

The project knowledge base for the 2200 build. Vision, architecture, decisions, conventions, per-epic specs, prior-art analysis. The deliberate published artifacts that document why the project is shaped the way it is.

For the 30-second pitch on what 2200 actually is, read [[01-vision]]. This page orients you in the wiki itself.

> This wiki is published from a canonical local Brain-format vault on the seed team's machines via [`scripts/publish-wiki.sh`](https://github.com/twentytwohundred/2200/blob/main/README.md). Frontmatter is stripped on publish; the source files keep their Obsidian-compatible metadata. Working surfaces (handoffs, inbox messages between Agents and the product lead) are kept local and never pushed.

## Reading order

If you're new to this project, read these in order:

1. [[01-vision]]: what this is, who it's for, why it exists
2. [[02-architecture]]: object model, runtime shape, how OpenPub and SCUT compose under 2200
3. [[03-epic-map]]: 19 epics with scope, done-when, dependencies
4. [[04-seed-team]]: who builds this, how they coordinate, when they migrate

Then check [[brain-format]] and [[handoff-format]] to understand how the wiki itself is structured.

## How content is organized

The canonical local source preserves folder structure. The published wiki is flattened to root because GitHub Wiki's `[[link]]` resolution does not traverse subdirectories cleanly; the [[_Sidebar]] (visible navigation) provides the structure.

### Canonical source layout (local Brain-format vault)

```
wiki/
├── README.md                              (becomes Home.md on publish)
├── 01-vision.md                           (what 2200 is)
├── 02-architecture.md                     (object model, runtime shape)
├── 03-epic-map.md                         (the 19 epics)
├── 04-seed-team.md                        (who builds this)
├── prior-art-analysis.md                  (executive analysis at v0.3)
├── prior-art-source-findings.md           (deep per-target source-reading appendix)
├── parked/
│   └── parked-reputation-protocol.md      (future project, not active)
├── conventions/
│   ├── brain-format.md
│   ├── handoff-format.md
│   ├── voice-and-framing.md
│   ├── design-language.md
│   └── upgrade-readiness.md
├── design/
│   ├── pulse.md                           (Agent activity status indicator)
│   └── brain-visualization.md             (parking doc; build-with-libraries direction)
├── decisions/
│   ├── 2026-04-24-hobby-as-primary-agent.md
│   ├── 2026-04-24-baseline-model-tier.md
│   ├── 2026-04-24-skill-compatibility-pipeline.md
│   ├── 2026-04-24-cost-behavior-shape.md
│   ├── 2026-04-24-runtime-upgrade-shape.md
│   ├── 2026-04-24-bulletin-substrate-is-scut.md
│   ├── 2026-04-24-brain-is-files-not-database.md
│   ├── 2026-04-25-mcp-native.md
│   ├── 2026-04-25-tool-baseline.md
│   └── 2026-04-25-skills-first-class.md
├── epics/
│   ├── 01-seed-team-coordination.md
│   └── 02-agent-runtime-minimum.md        (draft, awaiting product-lead review)
├── scripts/
│   └── publish-wiki.sh                    (canonical-source-to-GitHub-Wiki sync)
├── handoffs/                              (local-only; gitignored)
│   └── hobby/                             (session handoffs)
└── inbox/                                 (local-only; gitignored)
    ├── doug/
    ├── hobby/
    ├── simon/
    ├── poe/
    └── garfield/                          (cross-project: SCUT)
```

`handoffs/` and `inbox/` are working surfaces. They never leave the local machine. The deliberate published artifacts (vision, architecture, epic map, decisions, conventions, epic specs, prior-art docs, design docs) carry the project's audit trail and are what readers see when they land on this wiki.

## How this wiki is structured

This is an Obsidian-compatible knowledge vault. Every durable doc has:

- Frontmatter declaring its type, status, tags, dates, linked docs, and canonical path
- Inline backlinks using `[[doc-name]]` syntax
- A specific section structure depending on its type (epic specs, decision records, conventions all have shapes)

We dogfood the Brain pattern (the same one 2200's Agents will use for their memory) on the project that's building 2200. If the format works for us, it works for Agents. See [[brain-format]] for the full convention.

## Who works here

Three Agents on the seed team:

- **Hobby**: primary build Agent. Writes spec and code. Runs as Claude Code on Doug's MacBook.
- **Simon**: DevOps. Owns infrastructure. Provisions hosts, deploys, manages the shared filesystem.
- **Poe**: OpenPub specialist. Part-time on 2200 until OpenPub v0.3.1 ships.

Plus:

- **Doug**: product lead. Makes product decisions. Spawns Agents. Reviews specs and decisions.
- **Guppi**: strategy and ops partner. Holds context across all of Doug's projects, not just 2200.

David is not on the seed team. David is the first Agent 2200 will spawn through its own conversational onboarding flow. When that happens, the project ships. See [[04-seed-team]] for the full launch story.

## How to contribute

If you're an Agent on the team:

1. Read your CLAUDE.md or Identity file
2. Read this README
3. Read the seed docs in order
4. Check your inbox at `wiki/inbox/[your-name]/`
5. Read your most recent handoff at `wiki/handoffs/[your-name]/`
6. Then start working

If you're a human (Doug, future contributors):

1. Read this README
2. Skim the seed docs
3. Decisions live in `wiki/decisions/`
4. Conventions live in `wiki/conventions/`
5. Open an issue or write to an inbox if you have questions

## Conventions at a glance

- All durable docs use the [[brain-format]] convention
- Handoffs use the [[handoff-format]] convention
- Product copy and any external-facing writing follows the [[voice-and-framing]] convention
- UI/UX decisions follow the [[design-language]] convention (familiar analog, high-tech polish)
- Every epic spec includes an "Upgrade-readiness" section per the [[upgrade-readiness]] convention
- Decision records have Context, Decision, Consequences, References sections
- Epic specs have Scope, Includes, Done When, Depends On, Notes sections
- Use ellipses, not em-dashes (titles excepted)
- Agent is a proper noun, always capitalized

## Project status

As of 2026-04-26 (early session 5):

- Vision (v0.4), architecture (v0.4 with Skill object + MCP-native), and epic map (v0.5) locked
- Prior-art analysis at v0.3, both docs reviewed by Doug. Three architecture choices locked from the analysis: MCP-native runtime, tool baseline + plan/run/perm wrapping, Skills as first-class object
- **Ten decision records locked** (seven from sessions 1-3 plus three from session 4: `2026-04-25-mcp-native`, `2026-04-25-tool-baseline`, `2026-04-25-skills-first-class`)
- **Epic 2 spec drafted** at `wiki/epics/02-agent-runtime-minimum.md`, awaiting Doug review
- Two conventions (design-language, upgrade-readiness); Pulse design parked at v0.1
- Brain visualization parking doc with build-with-libraries direction (Cytoscape.js + react-markdown + remark-wiki-link), awaiting Doug confirmation to spawn decision record
- 19 epics scoped, none yet building
- Project home and wiki at [`github.com/twentytwohundred/2200`](https://github.com/twentytwohundred/2200) (private). Repo scaffolding (LICENSE, README, AGENTS.md, SECURITY.md, CONTRIBUTING.md, CHANGELOG.md, THIRD_PARTY_NOTICES.md, .github/ templates) is in place. Runtime code lands in this repo's `main` branch at Epic 2 build start
- Phase 2 shared mount being scoped by Simon
- Walkthrough of remaining ten prior-art findings against Epic 2 deferred to next session per the product lead's sequencing

The project will live in this wiki until 2200 itself can host it. That migration is the launch moment.

## License

2200 ships under **Elastic License v2**. Prior-art sources surveyed:
- **OpenClaw**: MIT (Copyright (c) 2025 Peter Steinberger)
- **EdgeClaw, OCMT, OpenAEON, AnyClaw, mimiclaw**: not personally verified — verify before any code lift
- **Logseq, Trilium, Joplin** (rejected): AGPL viral, disqualifying for embedding paths
- **Cytoscape.js, react-markdown, remark-wiki-link, SilverBullet, Quartz, Foam**: MIT (clean composition under EL v2)

MIT → Elastic v2 is permitted with copyright notice preservation for directly-copied portions. AGPL is incompatible for embedding. Always pair "lift from external project" with license analysis. See agent feedback memory `feedback_track_licensing` for the standing rule.

## Cross-references

- **Project domain:** [2200.ai](https://2200.ai) (placeholder)
- **GitHub org:** [github.com/twentytwohundred](https://github.com/twentytwohundred)
- **Project home and runtime repo:** [github.com/twentytwohundred/2200](https://github.com/twentytwohundred/2200)
- **This wiki:** [github.com/twentytwohundred/2200/wiki](https://github.com/twentytwohundred/2200/wiki)
- **License:** [Elastic License v2](https://github.com/twentytwohundred/2200/blob/main/LICENSE)

---

*README authored 2026-04-24. Updated when the project shape changes meaningfully.*
