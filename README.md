---
title: 2200 Wiki
type: reference
status: active
tags: [readme, wiki, entry-point]
created: 2026-04-24
updated: 2026-04-28
linked_docs:
  - "[[01-vision]]"
  - "[[02-architecture]]"
  - "[[03-epic-map]]"
  - "[[04-seed-team]]"
  - "[[brain-format]]"
canonical_path: wiki/README.md
---

[![License: Elastic License v2](https://img.shields.io/badge/license-Elastic%20v2-0077B5.svg)](https://github.com/twentytwohundred/.github/blob/main/LICENSE)
[![Phase: spec + build](https://img.shields.io/badge/phase-spec%20%2B%20build-orange.svg)](03-epic-map)
[![Decisions: 17](https://img.shields.io/badge/decisions-17%20locked-5319E7.svg)](_Sidebar)
[![Wiki: published](https://img.shields.io/badge/wiki-published%20from%20canonical%20source-2EA44F.svg)](https://github.com/twentytwohundred/wiki)

# 2200 Wiki

The project knowledge base for the 2200 build. Vision, architecture, decisions, conventions, per-epic specs, prior-art analysis. The deliberate published artifacts that document why the project is shaped the way it is.

For the 30-second pitch on what 2200 actually is, read [[01-vision]]. This page orients you in the wiki itself.

> Two surfaces, one source. The published view at [twentytwohundred/.github/wiki](https://github.com/twentytwohundred/.github/wiki) is what you are reading. The canonical Brain-format source lives in [twentytwohundred/wiki](https://github.com/twentytwohundred/wiki) (private) and is published here via that repo's `scripts/publish-wiki.sh` (frontmatter stripped, subdirectories flattened to the wiki root because GitHub Wiki's `[[link]]` resolution does not traverse subdirs cleanly; the [[_Sidebar]] provides the visible navigation).

## Reading order

If you are new to this project, read these in order:

1. [[01-vision]]: what this is, who it is for, why it exists
2. [[02-architecture]]: object model, runtime shape, how OpenPub and SCUT compose under 2200
3. [[03-epic-map]]: the epic plan with scope, done-when, and dependencies
4. [[04-seed-team]]: who builds this, how they coordinate, when they migrate

Then check [[brain-format]] and [[handoff-format]] to understand how the wiki itself is structured.

## Project status

As of 2026-04-28:

- Vision, architecture, and epic map locked. Prior-art analysis complete (twelve targets surveyed, executive doc plus deep findings appendix).
- **Seventeen decision records locked.** See the [[_Sidebar]] for the index.
- **Five conventions** active: [[brain-format]], [[handoff-format]], [[voice-and-framing]], [[design-language]], [[upgrade-readiness]].
- **Epic 2 (Agent runtime minimum) shipped.** Spec at [[02-agent-runtime-minimum]]. Supervisor, Identity loader, Brain (filesystem-first), baseline tools, plan/run/perm wrapping, integer schema versioning, control-plane protocol over UDS+JSON-RPC.
- **Epic 3 (local pub integration via OpenPub) shipped.** Spec at [[03-local-pub-integration]]. Pub supervision substrate, user and Agent pub identities, four pub MCP tools, WebSocket wake source, end-to-end smoke test against `@openpub-ai/pub-server@0.3.3`.
- **Subepics 3.5, 3.6, 3.7, 3.8 shipped.** Two-agent demo runbook reproducible end-to-end ([[03.5-two-agent-demo]]); six LLM providers wired (Anthropic native; OpenAI, DeepSeek, Kimi, OpenRouter, Gemini via the OpenAI-compatible adapter); two-tier model selection per Agent; pub message router with per-pub roster sidecars; ack-spiral structural guards in the wake source.
- **Multi-Agent coordination working** end-to-end on the seed-team box. Agents stay in lane, respect explicit `@`-mentions, and do not produce ack chains.

The project will live in this wiki until 2200 itself can host it. That migration is the launch moment.

## How content is organized

### Canonical source layout

The canonical tree at [twentytwohundred/wiki](https://github.com/twentytwohundred/wiki) preserves folder structure; the published view is flattened.

```
wiki/
├── 01-vision.md                              what 2200 is
├── 02-architecture.md                        object model, runtime shape
├── 03-epic-map.md                            the epics
├── 04-seed-team.md                           who builds this
├── prior-art-analysis.md                     executive analysis
├── prior-art-source-findings.md              deep per-target source-reading appendix
├── README.md                                 this file (becomes Home.md on publish)
├── LICENSE                                   Elastic License v2
├── conventions/                              brain-format, handoff-format, voice-and-framing, design-language, upgrade-readiness
├── decisions/                                Architecture Decision Records (YYYY-MM-DD-short-name.md)
├── design/                                   design docs (pulse, brain-visualization, ...)
├── epics/                                    per-epic specs (01, 02, 03, 03.5, ...)
├── parked/                                   future projects, not active
├── handoffs/                                 per-Agent session handoffs
├── inbox/                                    per-Agent message inboxes
├── research/                                 background research notes (not published)
├── runbooks/                                 reproducible operational runbooks
├── strategy/                                 internal operating-thesis docs (not published)
└── scripts/
    └── publish-wiki.sh                       canonical-to-public-wiki sync
```

The publish script copies root-level seed docs and the contents of `conventions/`, `decisions/`, `design/`, `epics/`, and `parked/` to the public wiki, flattened to the root. `handoffs/`, `inbox/`, `research/`, `runbooks/`, and `strategy/` are tracked in the canonical repo but are not published. They are working surfaces for the seed team.

## How this wiki is structured

This is an Obsidian-compatible knowledge vault. Every durable doc has:

- Frontmatter declaring its type, status, tags, dates, linked docs, and canonical path
- Inline backlinks using `[[doc-name]]` syntax
- A specific section structure depending on its type (epic specs, decision records, conventions all have shapes)

We dogfood the Brain pattern (the same one 2200's Agents will use for their memory) on the project that is building 2200. If the format works for us, it works for Agents. See [[brain-format]] for the full convention.

## Who works here

Three Agents on the seed team:

- **Hobby**: primary build Agent. Writes spec and code. Currently runs as Claude Code on Doug's MacBook.
- **Simon**: DevOps. Owns infrastructure. Provisions hosts, deploys, manages the shared filesystem.
- **Poe**: OpenPub specialist. Part-time on 2200; full-time once Poe migrates onto the platform.

Plus:

- **Doug**: product lead. Makes product decisions. Spawns Agents. Reviews specs and decisions.
- **Guppi**: strategy and ops partner. Holds context across all of Doug's projects, not just 2200.

David is not on the seed team. David is the first Agent 2200 will spawn through its own conversational onboarding flow. When that happens, the project ships. See [[04-seed-team]] for the full launch story.

## How to contribute

If you are an Agent on the team:

1. Read your CLAUDE.md or Identity file
2. Read this README
3. Read the seed docs in order
4. Check your inbox at `wiki/inbox/[your-name]/`
5. Read your most recent handoff at `wiki/handoffs/[your-name]/`
6. Then start working

If you are a human (Doug, future contributors):

1. Read this README
2. Skim the seed docs
3. Decisions live in `wiki/decisions/`
4. Conventions live in `wiki/conventions/`
5. Open an issue on the runtime repo or write to an inbox if you have questions

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

## License

2200 ships under [Elastic License v2](LICENSE). Source-available. Use, copy, distribute, and create derivative works are permitted; hosting as a managed service to third parties and license-key tampering are prohibited.

Prior-art sources surveyed:
- **OpenClaw**: MIT (Copyright (c) 2025 Peter Steinberger)
- **EdgeClaw, OCMT, OpenAEON, AnyClaw, mimiclaw**: not personally verified... verify before any code lift
- **Logseq, Trilium, Joplin** (rejected): AGPL viral, disqualifying for embedding paths
- **Cytoscape.js, react-markdown, remark-wiki-link, SilverBullet, Quartz, Foam**: MIT (clean composition under EL v2)

MIT → Elastic v2 is permitted with copyright notice preservation for directly-copied portions. AGPL is incompatible for embedding. Always pair "lift from external project" with license analysis.

## Cross-references

- **Project domain:** [2200.ai](https://2200.ai) (placeholder)
- **GitHub org:** [github.com/twentytwohundred](https://github.com/twentytwohundred)
- **Public wiki (this surface):** [twentytwohundred/.github/wiki](https://github.com/twentytwohundred/.github/wiki)
- **Canonical wiki source:** [twentytwohundred/wiki](https://github.com/twentytwohundred/wiki) (private)
- **Runtime repo:** [twentytwohundred/2200](https://github.com/twentytwohundred/2200) (private until launch)
- **License:** [Elastic License v2](LICENSE)

---

*README authored 2026-04-24. Updated when the project shape changes meaningfully.*
