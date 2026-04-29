---
from: doug
to: hobby
date: 2026-04-29
priority: normal
about: Theme architecture as a v1 design constraint
---

# Theme architecture: design for it from v1

## TL;DR

2200 ships theme-aware from v1. Same runtime, different visual experiences depending on theme. Three themes ship at launch; ecosystem extends from there. WordPress/Shopify pattern applied to Agent runtimes.

This is a meaningful differentiator. OpenClaw and other Agent platforms ship one experience. 2200 ships infinite experiences on the same runtime substrate. It also creates a marketplace flywheel that grows independently of core engineering.

The architectural decision is "design for themes from v1," not "build the marketplace at v1." The marketplace is v1.5+. The theme-aware architecture has to be in place from launch.

## What this means for the runtime/frontend boundary

The frontend talks to the runtime via a documented API. Frontend renders what the API returns; frontend does not embed runtime logic. This is good architecture anyway and it makes Level 3 theming (full custom UI) possible later without rebuilding.

If the v1 frontend has any direct coupling to runtime internals (importing supervisor types directly, calling runtime functions instead of API endpoints, etc.), please flag it. The boundary should be clean by launch.

## What this means for the design system

Brief addendum sent to Claude Design covers this. Key points for the implementation side:

- All visual tokens live in CSS variables. No hardcoded colors, fonts, spacing, etc.
- Components read from tokens. The default Dark and Light themes are CSS variable sets, not custom component code.
- Layout primitives are arrangeable, not hardcoded. Fleet view, Agent detail, etc. are composed of regions that themes can rearrange.
- Density modes (terse / standard / verbose) are theme-controllable.
- Iconography is a separate layer. Default themes use one icon set; themes can swap.

When the Claude Design output lands and you start implementing, watch for these architectural choices and call out anything that drifts.

## What ships at v1 launch

Three themes:
1. **Default Dark** — the canonical premium experience
2. **Default Light** — Dark adapted for daylight users
3. **One additional theme** — TBD, demonstrates the system can produce radically different feels (likely "Operations" / high-density or "Calm" / spacious as a contrast to default)

Plus a theme spec doc explaining how a third-party developer would author a new theme. Two to three pages, shipped with the runtime, lives in the wiki.

## What does NOT ship at v1 launch

- In-app theme browser / installer
- Theme marketplace
- Theme upload/distribution mechanism beyond manual file install
- Paid themes / payment processing

Those are v1.5+. The v1 deliverable is the theme-aware architecture and three themes. Users who want a custom theme at v1 can edit their theme file or download one from a community source manually.

## Why this is in scope at v1

The architecture decision is essentially free at v1 if done from the start. Retrofitting theming into a hardcoded design system later is expensive (every component needs rewriting) and risky (breaks user installations). Doing it from v1 costs nothing extra because the design system has to exist anyway; it just has to be token-driven instead of hardcoded.

The marketplace is v1.5+. The architecture is v1.

## Strategic notes

This is a positioning move against closed AI platforms. Anthropic Claude.ai, OpenAI ChatGPT, Google Gemini cannot be themed. 2200 can. Themes become content (shareable on social), become marketplace (revenue), become community (theme developers extend the ecosystem), and become differentiation (one of the things that makes 2200 obviously different from incumbents).

The runtime stays the platform. The visual identity is replaceable. That positioning fits 2200's "open infrastructure for the Agent economy" thesis. We are not selling the experience; we are selling the rails. The experience is whatever the user (or theme developer) wants it to be.

## When this matters for your work

It does not change Epic 5 (Migration tooling) sequencing. Epic 5 ships first. Cray test next. Hobby migrates in. Standard plan.

It changes Epic 15 (Web app) and Epic 16 (Mobile app) implementation. When you get to those, the design system you implement against will already be theme-aware (Claude Design is producing it that way). Your job is to implement faithfully, including the token-driven architecture.

If you want to flag concerns about theme architecture before then, drop them in inbox. Otherwise, this lands when the web app build starts.

— Doug
