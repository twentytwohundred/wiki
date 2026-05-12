---
title: "Themes deferred to v1.5+"
type: decision
status: locked
date: 2026-05-12
supersedes: "[[2026-04-29-theme-aware-from-v1]]"
tags: [decision, design, themes, scope, v1]
linked_docs:
  - "[[01-vision]]"
  - "[[03-epic-map]]"
canonical_path: wiki/decisions/2026-05-12-themes-deferred-to-v15.md
---

# Themes deferred to v1.5+

## Context

The 2026-04-29 decision committed v1 to a theme-aware runtime: CSS variables for all visual values, region-composable layout primitives, frontend/runtime via documented API only. The marketplace was already v1.5+. The runtime-side commitment was driven by avoiding a future refactor when themes ship.

Six weeks of operation have clarified that the Apple-style v1 scope (the 2026-05-12 locked seven-capability frame, authored by Doug with Guppi) does not include themes. The Web UX surfaces the seven capabilities pragmatically with one good look. Carrying the theme-aware-from-v1 commitment costs build cycles (every UI component requires CSS-variable-only styling) and decision overhead (every visual question becomes a theme-architecture question) without earning back the cost in v1.

## Decision

**Theme work is deferred to v1.5+ in full.**

Concretely:

1. **The Web UX is built pragmatically.** CSS Modules + hand-picked colors are fine. Components don't have to source every visual value from a CSS variable. New code can use Tailwind or component-local CSS as appropriate.
2. **The runtime/frontend separation stays.** Frontend does not import runtime types; runtime functions are not called from frontend. This is good practice independent of themes.
3. **The existing ThemeProvider / ThemeSwitcher code (`apps/web/src/theme/`) is deferred in place.** It compiles, it's wired into the app root, it doesn't actively do anything in v1. It's a starting point for v1.5 theme work.
4. **Default Dark and Default Light are the only "themes" in v1.** They are CSS files, not a theme system. The Web UX has a dark/light toggle but does not load themes dynamically.
5. **Layout regions, density modes, level-2 / level-3 theming**: all v1.5+.

The marketplace remains v1.5+ as previously decided.

## Consequences

### Removed from v1 scope

- The CSS-variable-only commitment.
- The layout-primitives-must-be-arrangeable commitment.
- Theme system architecture work.
- Themes marketplace UI and infrastructure.

### Stays in v1 scope

- Runtime/frontend boundary discipline (no shared types or function calls).
- A dark/light toggle on the Web UX (operator preference).
- The `theme/` directory exists; not load-bearing.

### Re-entry path

When v1.5+ work begins on themes:

1. Recommit to the CSS-variable migration (likely a multi-week refactor).
2. Recommit to region-composable layout (additional refactor).
3. Build the marketplace surfaces (in-app browser, installer).
4. Open the theme-developer SDK.

## Status

Locked, 2026-05-12. The 2026-04-29 decision is marked superseded.
