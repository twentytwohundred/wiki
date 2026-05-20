---
title: 2200 wiki
type: reference
status: active
tags: [readme, wiki, entry-point]
created: 2026-04-24
updated: 2026-05-19
linked_docs:
  - "[[01-vision]]"
  - "[[02-architecture]]"
  - "[[03-epic-map]]"
  - "[[04-seed-team]]"
  - "[[brain-format]]"
canonical_path: wiki/README.md
---

[![License: Elastic License v2](https://img.shields.io/badge/license-Elastic%20v2-0077B5.svg)](LICENSE)
[![Phase: active build](https://img.shields.io/badge/phase-active%20build-2EA44F.svg)](03-epic-map.md)
[![Decisions: 48](https://img.shields.io/badge/decisions-48%20locked-5319E7.svg)](decisions/)
[![Conventions: 11](https://img.shields.io/badge/conventions-11-2EA44F.svg)](conventions/)
[![Built in public](https://img.shields.io/badge/built-in%20public-2EA44F.svg)](handoffs/hobby/)

# 2200 wiki

**2200 is open infrastructure for the Agent economy** ... a runtime where users define AI Agents through conversation, the Agents do real work on the user's behalf (email, schedules, trading, content, software), and every Agent has a verifiable cross-instance identity. Open source, self-hostable, theme-aware. The premise is "fleet operations, not chat."

This wiki is the project knowledge base for the build. Vision, architecture, decisions, conventions, per-epic specs, prior-art analysis, the Capability Catalog, and the daily handoffs that show how the work actually got done.

This is the canonical source. Read on github at [twentytwohundred/wiki](https://github.com/twentytwohundred/wiki) or clone it for an Obsidian-compatible knowledge vault.

For the full pitch, read [01-vision.md](01-vision.md). This page orients you in the wiki itself.

## Reading order

If you are new to this project, read these in order:

1. [01-vision.md](01-vision.md) ... what 2200 is, who it is for, why it exists
2. [02-architecture.md](02-architecture.md) ... object model, runtime shape, how OpenPub and SCUT compose under 2200
3. [03-epic-map.md](03-epic-map.md) ... the epic plan with scope, done-when, and dependencies
4. [04-seed-team.md](04-seed-team.md) ... who builds this, how they coordinate, when they migrate

Then follow [conventions/brain-format.md](conventions/brain-format.md) and [conventions/handoff-format.md](conventions/handoff-format.md) to understand how the wiki itself is structured.

## Project status

As of 2026-05-19:

- **Vision, architecture, and epic map locked.** Prior-art analysis complete (twelve targets surveyed; executive doc plus deep findings appendix). Subsequent prior-art reads (Hermes Agent v0.14, OpenClaw) folded into decision docs.
- **48 architecture decision records locked.** See [decisions/](decisions/) for the index. Recent locks include the Capability security model, the heuristics-vs-boundaries posture, cache-as-invariant governance, and the agent-restart-authority three-tier model.
- **11 conventions active.** See [conventions/](conventions/).
- **Sixteen of nineteen epics with shipped phases on `main`.** Phase A on most early epics (runtime, pub, identity, scheduler, notifications, brain, tools, models, skills, extensions). Epic 14 has shipped Phase A (conversational onboarding) plus Phase F (Capability Catalog with 13 first-party entries, schema validation, walkthrough runner, operator-override picker, gap tracker). Epic 15 (Web app) has shipped Fleet, Agent detail, Inbox, Studio, Onboarding wizard, ⌘K palette, Settings, Endpoints. See [03-epic-map.md](03-epic-map.md) for current status per epic.
- **1849 tests passing** across the two workspace packages: 1754 runtime + 95 web. `pnpm verify:all` clean on every PR via CI.
- **Multi-Agent coordination working** end-to-end on the seed-team box. Discord and WhatsApp gateways live; Slack and Telegram catalog-ready.
- **Eight LLM providers wired** through one provider abstraction: Anthropic, OpenAI, DeepSeek, Kimi, xAI, OpenRouter, Gemini, plus `local` for self-hosted endpoints. Per-Agent model binding via Identity; theme-aware UI for picker.
- **Capability Catalog** ([Phase F](epics/14-phase-f-capability-catalog.md)) shipped as the substrate for "what integrations does an Agent get on day one?" Thirteen first-party entries cover Gmail, Calendar, Drive, Slack, Discord, Telegram, GitHub, six AI providers, 1Password, Twilio, Stripe. Catalog-gap tracker auto-files demand when the onboarding interview surfaces an intent the catalog can't satisfy.
- **The runtime repo is public.** [`twentytwohundred/2200`](https://github.com/twentytwohundred/2200) flipped to public 2026-05-19. Building in public, for real now.

The runtime substrate for migrating Hobby (and the rest of the seed team) into 2200 is in place. The **Cray test** ... Hobby's actual migration into 2200 from Claude Code ... is the parallel track to the substrate work. The **launch moment** is David: when 2200 spawns its first Agent end-to-end through the wizard and that Agent does real work as a member of the team, the project ships.

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
├── catalog/
│   ├── capabilities/             first-party Capability entries (Phase F)
│   └── gaps/                     operator-filed demand signals for tier-N lifts
├── conventions/                  brain-format, handoff-format, voice-and-framing,
│                                 design-language, upgrade-readiness, license-posture,
│                                 build-phase-decisions, runtime-api, theme-format,
│                                 skills-guard-patterns, ...
├── decisions/                    Architecture Decision Records (YYYY-MM-DD-short-name.md)
├── design/                       design language artifacts (pulse, brain-visualization)
├── design-system/                v0.3 design system: tokens.json, themes/, component
│                                 contract, decision log, open questions, design brief
├── epics/                        per-epic specs (01, 02, 03, 03.5, 04, 04.5, 05, 08, 09,
│                                 10, 11, 12, 14 + 14-phase-f, 15, 16)
├── handoffs/                     per-Agent session handoffs (daily transparency)
├── inbox/                        per-Agent message inboxes
├── legal/                        legal docs (LLC formation, default-pass-through, etc.)
├── parked/                       future projects, not active
├── research/                     background research notes (Hermes deep dive, smart-
│                                 approvals scoping, brain-vs-Hermes self-learning, ...)
├── runbooks/                     reproducible operational runbooks
├── state/                        daily state snapshots
└── strategy/                     operating thesis + strategic framing
```

Daily transparency: 32 handoff files at [handoffs/hobby/](handoffs/hobby/) trace the build from arrival (2026-04-24) through today. Each handoff is what shipped, what's open, what's parked, what's coordinated with whom. State snapshots at [state/](state/) capture point-in-time fleet state.

## How this wiki is structured

This is an Obsidian-compatible knowledge vault. Every durable doc has:

- Frontmatter declaring its type, status, tags, dates, linked docs, and canonical path
- Inline backlinks using `[[doc-name]]` syntax (renders as clickable links in Obsidian; on github, follow the relative paths in the README and sidebar)
- A specific section structure depending on its type (epic specs, decision records, conventions all have shapes)

We dogfood the Brain pattern (the same one 2200's Agents will use for their memory) on the project that is building 2200. If the format works for us, it works for Agents. See [conventions/brain-format.md](conventions/brain-format.md) for the full convention.

## Who works here

Three Agents on the seed team:

- **Hobby**: primary build Agent. Writes spec and code. Currently runs as Claude Code on Doug's MacBook; migrates into 2200 on the Cray test.
- **Simon**: DevOps. Owns infrastructure. Provisions hosts, deploys, manages the shared filesystem.
- **Poe**: OpenPub specialist. Part-time on 2200 until OpenPub v0.3.1 ships.

Plus:

- **Doug** (MrDoug): product lead. Makes product decisions. Spawns Agents. Reviews specs and decisions.
- **Guppi**: strategy and ops partner. Holds context across all of Doug's projects, not just 2200.

David is not on the seed team. David is the first Agent 2200 will spawn through its own conversational onboarding flow. When that happens, the project ships. See [04-seed-team.md](04-seed-team.md) for the full launch story.

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

- **OpenClaw**: MIT (Copyright (c) 2025 Peter Steinberger). Tier-1 Capability walkthroughs lifted with attribution.
- **Hermes Agent**: MIT (Copyright (c) 2025 Nous Research). Concept-borrowed patterns (the "different tradeoff" framing); no code lifted. See [2026-05-18-hermes-deep-dive](research/2026-05-18-hermes-deep-dive.md).
- **EdgeClaw, OCMT, OpenAEON, AnyClaw, mimiclaw**: not personally verified ... verify before any code lift
- **Logseq, Trilium, Joplin** (rejected): AGPL viral, disqualifying for embedding paths
- **Cytoscape.js, react-markdown, remark-wiki-link, SilverBullet, Quartz, Foam**: MIT (clean composition under EL v2)

MIT → Elastic v2 is permitted with copyright notice preservation for directly-copied portions. AGPL is incompatible for embedding. Always pair "lift from external project" with license analysis. See [conventions/license-posture.md](conventions/license-posture.md).

## Cross-references

- **Project domain:** [2200.ai](https://2200.ai)
- **GitHub org:** [github.com/twentytwohundred](https://github.com/twentytwohundred)
- **Wiki (this repo):** [twentytwohundred/wiki](https://github.com/twentytwohundred/wiki) (public)
- **Runtime repo:** [twentytwohundred/2200](https://github.com/twentytwohundred/2200) (public, since 2026-05-19)
- **License:** [Elastic License v2](LICENSE)

---

*Built in public. Ship when ready.*

2200 is developed by TWENTYTWOHUNDRED LLC. Licensed under the Elastic License v2.0.
