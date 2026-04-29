---
title: 2200 Design System
type: design-system-index
status: v0.3 locked
created: 2026-04-29
updated: 2026-04-29
linked_docs:
  - "[[../decisions/2026-04-29-theme-aware-from-v1]]"
  - "[[../conventions/design-language]]"
  - "[[../epics/15-web-app]]"
canonical_path: wiki/design-system/README.md
---

# 2200 Design System

**Version 0.3** ... locked deliverable from Claude Design (Opus). This is the engineering reference for Epic 15 (Web app) and Epic 16 (Mobile app).

The visual deliverable (1.7MB single-file HTML walkthrough of all screens + variants + docs) lives outside the wiki at `~/Library/CloudStorage/Dropbox/Business/2200/hobby/design-system-archive/2200-v0.3-standalone.html`. Open it in any modern browser for the full visual context.

## What's here

| File | Role |
|---|---|
| [[tokens]] (`tokens.json`) | Canonical token source. CSS variables generated from this file. |
| [[component-contract]] | API contract for every primitive. Engineers expose components with these props and these allowed values. |
| [[decision-log]] | V1/V2/V3 picks per screen with one-line rationale. |
| [[open-questions]] | What v0.3 deliberately skipped. Backlog for the next iteration. |
| [[2200-design-brief]] | The brief sent to Claude Design (Opus) at the start. |
| [[2200-design-brief-themes-addendum]] | Architecture addendum adding theme-aware-from-v1 requirements. |
| [[claude-design-package-readme]] | The original handoff README from Claude Design. Preserves their voice; describes the full package including the JSX prototype source bundled into the standalone HTML. |
| `themes/default-dark.json` | Canonical dark theme manifest. |
| `themes/default-light.json` | Default light theme manifest. |
| `themes/terminal-stub.json` | Stub demonstrating the manifest contract for future custom themes. Not visually QA'd. |

## How engineers should use this

**Start with `component-contract.md`.** It names every primitive and the allowed prop shapes.

**Then `tokens.json`.** Treat it as canonical. Either run it through Style Dictionary or write a small generator that emits a `tokens.css` with `--<category>-<role>[-<variant>]` custom properties. Never reference oklch values directly in a component ... always go through a token.

**Theme switching is one class swap on a root element** (`theme-dark` ↔ `theme-light`). Components do not branch on theme.

**The agent-color hash function** in the contract (`agentColorClass(id)`) is load-bearing. Mirror it verbatim in production. Determinism matters across services.

## Status of v0.3

Picks are locked for the seven screens (Fleet, Agent, Inbox, Onboarding, Pub, Budget, Command Palette). See `decision-log.md` for the rationale. Some V1/V2 alternates remain selectable in the prototype but are not the v0.3 production target.

## What is intentionally not done

Mobile (375px), tablet (1024), iconography, motion spec beyond the running pulse, modal/toast/tooltip primitives, accessibility audit, error-message copy library, settings/empty-tenant flows. See `open-questions.md` for the full list. These are backlog for design v0.4, not implementation blockers.

## Where the engineering work lives

- **Epic 15 spec** at [[../epics/15-web-app]] (drafted 2026-04-29)
- **Runtime ↔ frontend API contract** at [[../conventions/runtime-api]]
- **Theme manifest format** at [[../conventions/theme-format]]
- **Implementation** in `code/2200/apps/web/` (when scaffolded)

## Provenance

Authored by Claude Design (Opus) on 2026-04-29 in response to the design brief at `2200-design-brief.md` plus the architectural addendum at `2200-design-brief-themes-addendum.md`. The brief was issued after the [[../decisions/2026-04-29-theme-aware-from-v1]] decision locked the theme-aware-from-v1 architecture.
