---
title: Theme Format Convention
type: convention
status: drafted
version: 0.1
tags: [convention, theme, tokens, design-system, frontend, marketplace]
created: 2026-04-29
updated: 2026-04-29
linked_docs:
  - "[[../decisions/2026-04-29-theme-aware-from-v1]]"
  - "[[../epics/15-web-app]]"
  - "[[../design-system/README]]"
  - "[[../design-system/2200-design-brief-themes-addendum]]"
canonical_path: wiki/conventions/theme-format.md
---

# Theme Format Convention

The contract a 2200 theme satisfies. Authors a theme by writing a single JSON manifest; everything visual flows from that file.

This convention is the "minimum viable theme spec" for v1. The marketplace surface (browse, install, upload) is v1.5+; the format is the part that ships with v1 so themes can already be authored, dropped into an installation directory, and selected in `⌘K → Switch Theme`.

## What a theme controls

Three levels of theming exist. **v1 ships Level 2.** Level 3 is enabled by the runtime/client API boundary in [[runtime-api]], but the theme format here covers Level 1 + 2 only.

- **Level 1 (skinning).** Every visual property (color, type, spacing, radius, shadow, z-index, agent palette, user-mark gradient) is a token. Themes redefine tokens.
- **Level 2 (skinning + layout + density).** Themes can also: change density mode (terse / standard / verbose), reorder or hide layout regions on a screen, swap the icon set.
- **Level 3 (full custom UI).** Out of scope for the manifest format. A Level-3 theme is a full frontend implementation that talks to the runtime via [[runtime-api]]. No manifest here covers that case.

## Manifest format

A theme is a single JSON file. The shape:

```json
{
  "$schema": "https://2200.local/schemas/theme-v1.json",
  "id": "kebab-case-unique-id",
  "name": "Human-readable name",
  "version": "0.1.0",
  "base": "dark",
  "description": "One sentence about what this theme is.",
  "author": {
    "name": "Author name",
    "url": "https://optional-url"
  },
  "license": "MIT",
  "tokens": {
    "color-bg-primary": "oklch(0.16 0.005 250)",
    ...
  },
  "density": "standard",
  "layout_overrides": {
    "fleet": {
      "regions": ["needs_you", "running", "idle"]
    }
  },
  "icon_set": "lucide",
  "metadata": {}
}
```

### Required fields

- `id` ... globally unique, kebab-case, used in `localStorage` and the theme picker.
- `name` ... shown in UI.
- `version` ... semver.
- `base` ... `"dark"` or `"light"`. Tells the runtime which fallbacks to use for any token the theme does not specify.
- `tokens` ... the key-value object of CSS-variable name (without the `--` prefix) to value.

### Optional fields

- `description`, `author`, `license`, `metadata` ... self-explanatory.
- `density` ... `"terse"` | `"standard"` | `"verbose"`. Default `"standard"`.
- `layout_overrides` ... per-screen region overrides. See the **Layout regions** section.
- `icon_set` ... which icon family to load. Default `"lucide"`. Other values (e.g., `"phosphor"`, `"custom:my-set"`) require the named icon set to be available to the runtime.

### Field omission rules

When a theme omits a token, the runtime falls back to the `base` theme's value. So a "High Contrast" theme can specify only `color-text-primary`, `color-bg-primary`, and `color-focus-ring`, and inherit everything else from Default Dark. This is the path of least resistance for theme authors.

## Token reference

Every token a theme can override. Names match the CSS custom property without the `--` prefix.

### Color (semantic)

Background:
- `color-bg-primary`, `color-bg-secondary`, `color-bg-elevated`, `color-bg-hover`, `color-bg-inset`, `color-bg-overlay`

Borders + dividers:
- `color-border-default`, `color-border-emphasis`, `color-border-strong`, `color-divider`

Text:
- `color-text-primary`, `color-text-secondary`, `color-text-muted`, `color-text-disabled`, `color-text-inverse`

Status (semantic; never decorative):
- `color-status-running`, `color-status-running-bg`
- `color-status-attention`, `color-status-attention-bg`
- `color-status-error`, `color-status-error-bg`
- `color-status-info`, `color-status-info-bg`

Accent + focus:
- `color-accent`, `color-accent-bg`, `color-accent-fg`
- `color-focus-ring`

### Color (agent palette)

12 deterministic colors, hashed from the agent's id (see [[../design-system/component-contract]]):

- `agent-c0` through `agent-c11`

Themes can override the palette but **must keep 12 entries** and **must keep the hash function semantics** (the same agent id resolves to the same slot in every theme; only the slot's color changes).

### Color (user mark)

Two-stop gradient for the "you" mark:

- `user-c-from`, `user-c-to`

The user mark **must not collide** with any agent palette color. Themes that override the palette must verify.

### Typography

Family:
- `type-family-sans`, `type-family-mono`

Per-scale tokens (defined in `tokens.json`'s `type.scale`; themes typically inherit):
- `type-display-size`, `type-display-track`, `type-display-weight`, `type-display-lh`
- ... same shape for `h1`, `h2`, `h3`, `body`, `body-sm`, `label`, `caption`, `data`, `data-lg`, `data-xl`

A theme that wants a different type system overrides families and (optionally) scale; most themes only change family.

### Spacing

Density-scaled. The base scale is `space-1` through `space-10`:

- `space-1`, `space-2`, `space-3`, `space-4`, `space-5`, `space-6`, `space-7`, `space-8`, `space-9`, `space-10`

When a theme sets `density: "terse"`, the runtime applies a 0.85x multiplier to every space token at render time; `verbose` applies 1.15x. Themes can override the multipliers via `density_multipliers: { terse: 0.8, standard: 1.0, verbose: 1.2 }` in `metadata`. v1 hardcodes the defaults; a theme can opt into different multipliers but most should not.

### Radius

- `radius-sm`, `radius-md`, `radius-lg`, `radius-pill`

The locked decision: never round more than 8px on any element. Themes that violate this may render in the v1 runtime but will be flagged in the marketplace's `2200 theme lint` step (when marketplace ships).

### Border weight

- `border-default`, `border-emphasis`

### Shadow

- `shadow-elevation-1`, `shadow-elevation-2`

Two levels. No more.

### Motion

- `duration-fast`, `duration-normal`, `duration-slow`
- `ease-out`, `ease-in-out`

The "running pulse" uses `duration-slow` + `ease-in-out`. Themes that change pulse cadence reset these.

### Z-index

- `z-base`, `z-sticky`, `z-overlay`, `z-dropdown`, `z-tooltip`, `z-toast`, `z-modal`, `z-palette`

## Layout regions

Each screen exposes named regions that themes can rearrange. The runtime's web app declares the default arrangement; themes can override.

### Phase A screens

```
fleet:
  regions: ["needs_you", "running", "idle", "aggregate_strip"]
  default_order: ["aggregate_strip", "needs_you", "running", "idle"]
  hideable: ["aggregate_strip"]

agent:
  regions: ["identity_card", "current_task", "telemetry", "brain_preview", "schedule", "budget", "tools", "actions"]
  default_order: ["identity_card", "current_task", "actions", "telemetry", "brain_preview", "schedule", "budget", "tools"]
  hideable: ["telemetry", "brain_preview", "schedule", "budget", "tools"]

inbox:
  regions: ["pending_pinned", "triage_list", "triage_detail"]
  default_order: ["pending_pinned", "triage_list", "triage_detail"]
  hideable: []   # all required

palette:
  regions: ["search", "results"]
  default_order: ["search", "results"]
  hideable: []
```

A theme overrides a region arrangement under `layout_overrides.<screen>`:

```json
{
  "layout_overrides": {
    "agent": {
      "regions": ["identity_card", "actions", "telemetry"],
      "hidden": ["brain_preview", "schedule", "budget", "tools"]
    }
  }
}
```

The runtime renders only the regions listed in `regions` (in the listed order) and hides anything in `hidden`. Regions not listed and not hidden default to **after the listed regions, in default order**, so an under-specified override is non-breaking.

### Phase B screens

`onboarding`, `pub`, `budget` ... region inventories TBD when Phase B specs lock. A v1 theme that specifies overrides for these screens is forward-compatible (unknown screen names are ignored with a runtime console warning).

## Density modes

Three locked modes:

- `terse` ... 0.85x spacing scale, smaller line-heights on body text, denser table rows.
- `standard` ... default. The locked v0.3 design is authored at standard.
- `verbose` ... 1.15x spacing scale, increased whitespace, larger touch targets (better for accessibility and casual users).

Density is set globally per theme; per-screen density overrides are not supported in v1.

## Icon sets

Default: `lucide`. The web app bundles Lucide icons at build time and exposes them via `<Icon name="bell" />`.

A theme sets `icon_set: "phosphor"` or `icon_set: "custom:my-icons"` and the runtime loads that set. Custom sets must be installed at `<home>/state/themes/icons/<set-name>/` as SVG files keyed by the same names Lucide uses (the runtime maps icon names; the theme contributes the SVGs). Names that have no SVG fallback to the default set with a console warning.

A theme **cannot** invent new icon names. The icon catalog is the runtime's; themes only swap the rendering.

## Worked example: minimal theme

A theme that just changes status colors and inherits everything else. Total theme: 25 lines.

```json
{
  "$schema": "https://2200.local/schemas/theme-v1.json",
  "id": "high-contrast-dark",
  "name": "High Contrast · Dark",
  "version": "0.1.0",
  "base": "dark",
  "description": "WCAG AAA contrast. Status colors at maximum chroma.",
  "author": { "name": "Example Theme Co" },
  "license": "MIT",
  "tokens": {
    "color-text-primary":   "oklch(1.00 0 0)",
    "color-text-secondary": "oklch(0.92 0 0)",
    "color-bg-primary":     "oklch(0.08 0 0)",
    "color-bg-secondary":   "oklch(0.12 0 0)",
    "color-status-running": "oklch(0.85 0.20 145)",
    "color-status-error":   "oklch(0.78 0.25 25)",
    "color-focus-ring":     "oklch(0.95 0.20 245)"
  }
}
```

That's it. Every other token inherits from Default Dark. The runtime does not require the author to specify any token they're not changing.

## Worked example: layout-changing theme

A theme that compresses the Agent screen to identity + actions only:

```json
{
  "$schema": "https://2200.local/schemas/theme-v1.json",
  "id": "operator-focused",
  "name": "Operator Focused",
  "version": "0.1.0",
  "base": "dark",
  "tokens": {},
  "density": "terse",
  "layout_overrides": {
    "agent": {
      "regions": ["identity_card", "current_task", "actions"],
      "hidden": ["telemetry", "brain_preview", "schedule", "budget", "tools"]
    }
  }
}
```

Pure layout + density change. No token changes. Renders the Agent screen as a focused decision surface for operators triaging fleets.

## Validation

The runtime validates a theme manifest at load time. Failures are reported via a notification (Passive tier) and the theme is skipped, leaving the previous theme active. Validation rules:

- `id` matches `^[a-z0-9][a-z0-9-]*$`.
- `version` is semver.
- `base` is `"dark"` or `"light"`.
- Every token name in `tokens` matches a token from this convention; unknown tokens fail the load with a list of unrecognized names.
- `agent-c0` through `agent-c11` are either all overridden together or all inherited; partial palette overrides fail.
- `layout_overrides.<screen>.regions` refers only to known regions for that screen; unknown region names log a warning but do not fail the load.
- `icon_set` either is `"lucide"`, is `"phosphor"`, or has the prefix `"custom:"` followed by a directory name installed at `<home>/state/themes/icons/`.

## File location

Themes live at:

```
<home>/state/themes/
├── default-dark.json        # bundled
├── default-light.json       # bundled
└── <user-installed>.json    # user dropped here, or installed via marketplace post-v1
```

The runtime watches this directory; new themes appear in `⌘K → Switch Theme` without restart. Bundled themes (Default Dark, Default Light) are seeded at first runtime start from the wiki's canonical copies and are restored if deleted.

## Compatibility commitments

While the format version is `theme-v1`:

- **Adding a new token name is non-breaking.** Existing themes inherit from base; they do not need to be re-authored.
- **Adding a new screen to `layout_overrides` is non-breaking.**
- **Adding a new density mode** is non-breaking (existing themes that omit `density` get the default).
- **Renaming or removing a token is breaking.** Mints `theme-v2`. Old themes continue to load with a deprecation warning until a major runtime version drops `theme-v1` support.

## What this convention does NOT cover

- **Marketplace mechanics.** Browsing, ratings, paid themes, payment flow, takedowns. Tracked under v1.5+.
- **Theme editing UI.** A future surface (Settings → Themes → Edit) for tweaking without hand-editing JSON. Out of scope.
- **Per-Agent themes.** The platform applies one theme globally. Per-Agent persona theming is post-v1.
- **Animation overrides beyond duration / easing tokens.** Themes can change how fast things move and how they ease, not what animates.
- **Sound / haptics.** Hypothetical future tokens; not in v1.

## References

- [[../decisions/2026-04-29-theme-aware-from-v1]]
- [[../design-system/2200-design-brief-themes-addendum]]
- [[../design-system/README]]
- [[../design-system/component-contract]]
- [[../design-system/tokens]] (canonical token source)
- [[../epics/15-web-app]]
- [[runtime-api]]
- [[design-language]]

---

*v0.1 drafted 2026-04-29 by Hobby. Locks the manifest format and token namespace for v1. Phase B screen regions (onboarding, pub, budget) reserved here, specified when those phases activate.*
