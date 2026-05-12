---
title: "Theme-aware runtime from v1"
type: decision
status: superseded
superseded_by: "[[2026-05-12-themes-deferred-to-v15]]"
superseded_on: 2026-05-12
date: 2026-04-29
tags: [decision, design, themes, frontend, marketplace, v1-scope]
linked_docs:
  - "[[01-vision]]"
  - "[[03-epic-map]]"
  - "[[design-language]]"
canonical_path: wiki/decisions/2026-04-29-theme-aware-from-v1.md
---

# Theme-aware runtime from v1

> **Superseded 2026-05-12** by [[2026-05-12-themes-deferred-to-v15]]. Themes are now deferred to v1.5+ in full. The original content of this decision is preserved below as historical context.

## Context

Doug landed a strategic decision on 2026-04-29: 2200 ships theme-aware from v1. Same runtime, different visual experiences depending on theme. The decision was communicated via [[../inbox/hobby/themes-inbox-note-for-hobby]] and a brief addendum sent to Claude Design (Opus) lives at [[../design/2200-design-brief-themes-addendum]].

The default Dark and Light themes Claude Design is producing are now the first two themes in what becomes a theme ecosystem. Three themes ship at launch (Default Dark, Default Light, one additional TBD). Beyond that, third-party theme developers extend the ecosystem.

This is the WordPress / Shopify pattern applied to Agent runtimes ... a positioning move against closed AI platforms (Anthropic Claude.ai, OpenAI ChatGPT, Google Gemini) which cannot be themed. Themes become content (shareable on social), become marketplace (revenue), become community (theme developers extend the ecosystem), and become differentiation.

## Decision

**Theme-aware architecture is a v1 requirement. The marketplace is v1.5+.**

Three concrete commitments:

1. **All visual values live in CSS variables.** No hardcoded colors, fonts, spacing, radius, shadow, z-index in components. Every component reads from `var(--token-name)`. The default Dark and Light themes are CSS variable sets.

2. **Layout primitives are arrangeable, not hardcoded.** Fleet view, Agent detail, notification inbox, etc. are composed of regions that themes can rearrange (level-2 theming per the addendum). Density modes (terse / standard / verbose) are theme-controllable.

3. **The frontend talks to the runtime via a documented API.** The frontend renders what the API returns; the frontend does NOT embed runtime logic. Runtime types are not imported into frontend code; runtime functions are not called from the frontend. This makes Level 3 theming (full custom UI) possible later without rebuilding.

The marketplace surface (in-app theme browser, installer, upload mechanism, paid themes, payment processing) is explicitly out of v1.

## Consequences

### Affects

- **Epic 15 (Web app).** When implemented, the design system this consumes is theme-aware (Claude Design is producing it that way). Implementation must faithfully follow the token-driven architecture; no hardcoded values bypassing tokens.
- **Epic 16 (Mobile app).** Same constraint. Native iOS and Android (or React Native) theme stories follow from the architecture.
- **Whatever API surface lives between the runtime and the v1 web/mobile clients.** Has to be a clean, documented public contract. No leaking supervisor types into client code.

### Does not affect

- **Epic 5 (Migration tooling).** Already shipped today; no UI surface.
- **Epic 9 (Tool system).** Already shipped Phase A today; substrate is API/CLI-first.
- **Anything currently on `main`.** The runtime, supervisor, Identity loader, brain, scheduler, notifications, etc. are all theme-agnostic by virtue of not yet having a UI.

### What I (Hobby) watch for

When Epic 15 (Web app) build starts, watch for these architectural drifts:

- A component containing a literal color, font, spacing value (anything hardcoded that should be a token).
- A component importing supervisor / runtime types directly instead of consuming an API response shape.
- A "frontend helper" that calls a runtime function instead of an API endpoint.
- Layout regions baked into pixel-perfect screens (the design output should describe regions with default arrangements; themes rearrange).
- Iconography baked into components (icon set should be a swappable layer).

Any of these is a flag. Surface to Doug if I find one before fixing.

## Implementation guidance

When Epic 15/16 specs are written:

1. The "API surface" is its own load-bearing artifact ... probably an HTTP-or-similar contract spec lives in `wiki/conventions/runtime-api.md` or similar before the web app PR stack starts.
2. The default themes ship as theme manifests, not as hardcoded CSS, per the addendum.
3. A theme spec doc (~2-3 pages) ships alongside the runtime explaining the token reference, layout primitives, density modes, manifest format, and a worked "minimal theme" example. The doc lives in `wiki/conventions/theme-format.md` or similar.

## References

- Doug's inbox note: [[../inbox/hobby/themes-inbox-note-for-hobby]] (2026-04-29)
- Design brief addendum (sent to Claude Design): [[../design/2200-design-brief-themes-addendum]]
- Parent design brief: produced by Claude Design (Opus); lands separately when ready
- Related conventions: [[design-language]] (existing UI/UX convention; remains valid, augmented by the token discipline)
- Related strategy: [[../strategy/2200-operating-thesis]] (themes-as-extensibility fits the open-infrastructure thesis)
