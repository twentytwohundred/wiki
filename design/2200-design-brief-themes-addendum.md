---
title: 2200 Design Brief — Themes Addendum
type: design-brief-addendum
status: v0.1
audience: Claude Design (Opus)
created: 2026-04-29
parent: 2200-design-brief.md
---

# Addendum: Theme Architecture

## Why this addendum exists

After the initial brief, a strategic decision was made: 2200 will ship as a theme-aware runtime from v1. The default Dark and Light themes you are designing are the first two themes in what becomes a theme ecosystem. Three themes ship at launch (Default Dark, Default Light, one additional theme TBD). Beyond that, third-party theme developers extend the ecosystem.

This is the WordPress/Shopify pattern applied to Agent runtimes. Same runtime, radically different feel depending on theme. It is a differentiator OpenClaw and other Agent platforms do not currently offer.

This addendum does not change the visual direction in the parent brief. The default themes you produce should still be premium, opinionated, and not look AI-designed. The addendum changes the architecture underneath the design so themes are possible later without retrofitting.

## What "theme-aware" means at v1

Three levels of theming exist conceptually. v1 ships level 2.

**Level 1 (skinning).** CSS variables for colors, typography, spacing, radius. Themes change the palette and type but nothing else.

**Level 2 (skinning + layout). v1 target.** CSS variables plus declarative layout overrides. Themes can rearrange dense vs. spacious views, default landing screens, notification placement, information density. Components stay the same; arrangement and density change.

**Level 3 (full custom UI).** Themes are full frontends talking to the runtime via API. Not in v1, but the architecture must not preclude it.

The design system must produce tokens and components that work at level 2 from day one. Level 3 is enabled by keeping the runtime/frontend boundary clean (frontend talks to runtime via documented API; frontend is not the runtime's view layer).

## Architectural requirements for theme readiness

These are non-negotiable for the design system output:

**1. All visual values live in CSS variables.** Color, typography, spacing, radius, shadow, z-index. No hardcoded values in components. Every component reads from `var(--token-name)`. The default Dark and Light themes are CSS variable sets, not custom code.

**2. Token namespacing.** Tokens follow a strict namespace pattern so themes can override at the right level of granularity. Suggested namespacing:
- `--color-bg-primary`, `--color-bg-secondary`, `--color-bg-elevated`
- `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`
- `--color-status-running`, `--color-status-blocked`, `--color-status-errored`, `--color-status-attention`
- `--color-accent-primary`, `--color-accent-secondary`
- `--font-mono`, `--font-sans`
- `--font-size-xs/sm/base/lg/xl/2xl/3xl`
- `--space-1/2/3/4/6/8/12/16/24`
- `--radius-sm/md/lg`

The exact naming is yours; the principle is semantic naming so themes override meaning, not pixels.

**3. Layout primitives are arrangeable, not hardcoded.** Fleet view, Agent detail, notification inbox, etc. should be composed of regions that themes can rearrange. A "dense" theme might pack the fleet view into a 12-column grid; a "calm" theme might use 2-column with more whitespace per Agent. The component is the same; the layout tokens differ.

This means the design output should specify regions and their default arrangement, not lock screens into pixel-perfect layouts. Each region is a slot that themes can resize, reorder, or change density on.

**4. Density tokens.** Information density is theme-controllable. The design system should support at least three density modes: terse, standard, verbose. The default theme picks one (likely standard for both Dark and Light); other themes can choose differently. Spacing tokens scale by density mode.

**5. Component variants over component branching.** When a component has multiple visual styles (e.g., a card can be flat, elevated, or bordered), express this as theme-controllable variants on the same component, not as separate components. Themes choose which variant is the default.

**6. Iconography as a separate layer.** Default themes use a single icon set (Lucide or similar). Themes can swap icon sets. Icon size, weight, and color are token-driven.

**7. The frontend is API-driven.** The design assumes a clean runtime/frontend boundary. Frontend renders what the API returns; frontend does not embed runtime logic. This makes Level 3 (full custom UI) possible later without rearchitecture.

## What the design output should produce

In addition to the deliverables in the parent brief, produce:

**1. A theme spec document.** Two to three pages explaining what is themable, what is not, and how a third-party developer would author a new theme. This is the document a theme-marketplace developer reads to ship their first theme. Should include:
- Token reference (every token, what it controls, valid value types)
- Layout region reference (every layout primitive, what regions it has, what themes can do with them)
- Density mode reference
- Theme manifest format (JSON or TOML, what fields a theme declares)
- Worked example: a simple "High Contrast" theme as a code sample showing how minimal a theme can be

**2. The default themes as theme files.** Default Dark and Default Light should be expressed as theme manifests, not as hardcoded CSS. This proves the architecture works and gives third-party developers a reference implementation.

**3. A third theme to demonstrate range.** Suggested options: a high-density "Operations" theme that leans into the Bloomberg-terminal density, a soft "Calm" theme that increases whitespace and uses warmer neutrals, or a "Steampunk" theme with brass-on-charcoal as a visual identity. The third theme exists to prove the system can produce radically different feels from the same components, not just color swaps.

## What this does NOT change

- The premium aesthetic bar from the parent brief
- The "fleet operations, not chat" opinion
- The reference points (Linear, Stripe, Bloomberg, Raycast, Things 3)
- The references to avoid (Anthropic, OpenAI, Gemini, generic AI dashboards)
- The six core screens
- The component primitives needed
- JetBrains Mono + sans-serif typography pairing as the default
- Color as semantic signal in default themes

The default themes you design should still feel premium and opinionated. They are the bar third-party theme developers will measure against.

## Strategic note for the design

This decision turns 2200 from a single-experience runtime into an extensible visual platform. The marketplace economics matter: theme developers who cannot or will not build runtimes can still build for 2200, sell themes, and contribute to the ecosystem. The runtime stays open source; themes can be free or paid; 2200 takes a small platform cut on paid themes when the marketplace ships.

This is also a content flywheel. "Look at this beautiful 2200 theme" is shareable in a way "look at this beautiful Anthropic Claude.ai" is not, because Claude.ai and other closed AI platforms cannot be themed. 2200 gets a steady stream of visual content from the community that incumbents cannot match.

The architecture decision today (theme-aware from v1) costs essentially nothing if done now and is expensive to retrofit later. Get it right at the design system level. Three themes ship; the ecosystem figures out the rest.
