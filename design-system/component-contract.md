# 2200 — Component contract

**Version 0.3 · Last updated with v0.3 deliverable**

This is the API contract for every primitive in the design system. Engineers should expose components with these props and these allowed values. Visual treatment is defined in `tokens.css` + `agent-palette.css` and should not be overridden at the call site.

The principle: **call sites pick semantics, not styles.** A button is `variant="primary"`, never `background="#fff"`.

---

## Naming conventions

- **Components**: `PascalCase` (e.g. `AgentMark`, `Pill`).
- **Props**: `camelCase`. Boolean props are positive (`elevated`, not `notFlat`).
- **Variant values**: `kebab-case` strings from a closed set.
- **Sizes**: `sm | md | lg | xl`. `md` is always the default. Not all components support every size — see per-component tables.

---

## `Pill` — canonical status indicator

The single allowed treatment for status. Never invent a new one.

| prop | type | default | required | notes |
|---|---|---|---|---|
| `variant` | `'running' \| 'attention' \| 'error' \| 'info' \| 'idle' \| 'draft'` | `'idle'` | yes | Semantic. Maps to `--color-status-*` tokens. |
| `dot` | `boolean` | `true` | no | Show the leading dot. The `running` dot pulses; this is the only routine animation in the product. |
| `children` | `ReactNode` | — | yes | The label. Always uppercase, mono. Keep ≤ 12 chars. |

**Canonical labels by variant**: `RUNNING`, `NEEDS YOU`, `ERROR`, `INFO`, `IDLE`, `DRAFT`. Use these by default; deviate only when the surface adds meaning (e.g. `LIVE` on Pub).

---

## `Button`

| prop | type | default | notes |
|---|---|---|---|
| `variant` | `'default' \| 'primary' \| 'ghost' \| 'destructive'` | `'default'` | One primary per region. `destructive` only for irreversible. |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | `sm` for inline-row actions, `lg` for hero CTAs only. |
| `icon` | `boolean` | `false` | Square 28×28 (sm: 24×24). |
| `kbd` | `string` | — | Inline keyboard hint (e.g. `'↵'`, `'⌘ K'`). |
| `disabled` | `boolean` | `false` | |
| `onClick` | `() => void` | — | |

---

## `Input`

| prop | type | default | notes |
|---|---|---|---|
| `value` | `string` | `''` | Controlled. |
| `onChange` | `(e) => void` | — | |
| `placeholder` | `string` | — | |
| `disabled` | `boolean` | `false` | |
| `autoFocus` | `boolean` | `false` | Use sparingly. |
| `type` | `string` | `'text'` | Standard HTML. |

Focus ring is automatic — do not override.

---

## `AgentMark` — agent identity glyph

The **only** way to render an agent visually. Color is deterministic: the same agent id always produces the same swatch.

| prop | type | default | required | notes |
|---|---|---|---|---|
| `id` | `string` | — | yes | The agent's stable identifier. Drives color hash. |
| `name` | `string` | — | yes | Used for monogram fallback and tooltip. |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | no | 18 / 24 / 40 / 64 px. |
| `solid` | `boolean` | `false` | no | Hero treatment for identity surfaces (Onboarding, Agent identity card). |
| `state` | `'speaking' \| 'thinking' \| null` | `null` | no | Adds outer ring. Pub-only. |
| `children` | `ReactNode` | initials | no | Override monogram (rare; e.g. emoji policy escapes). |

**Hash function**: `agentColorClass(id) → 'agent-c' + (sumOfCharCodes × 31 mod 12)`. Implemented in `primitives.jsx`. Mirror this in the production codebase verbatim.

---

## `UserMark` — "you"

| prop | type | default | notes |
|---|---|---|---|
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | |
| `state` | `'speaking' \| 'thinking' \| null` | `null` | |
| `children` | `ReactNode` | `'YOU'` | |

**Rule**: `UserMark` uses a single distinct gradient defined in `--user-c-from` / `--user-c-to`. Never reuse an agent color for the user.

---

## `Card`

| prop | type | default | notes |
|---|---|---|---|
| `padding` | `number \| string` | `16` | px or any CSS length. |
| `flat` | `boolean` | `false` | Smaller radius (md vs lg). For dense lists. |
| `elevated` | `boolean` | `false` | Adds `--shadow-elevation-1`. Use rarely. |

Default radius `lg` (8px). Never round more than 8px in this product.

---

## `KV` — key/value row

The standard pattern for displaying labeled data (mandate, voice, schedule, budget, etc.).

| prop | type | default | notes |
|---|---|---|---|
| `k` | `string` | — | Uppercase label. Mono. |
| `v` | `ReactNode` | — | Value. Use `<span class="mono">` for numerics. |
| `kw` | `number` | `100` | Label column width in px. |

---

## `SectionHeader`

| prop | type | notes |
|---|---|---|
| `title` | `string` | Uppercase. Mono. Often includes a count: `RUNNING · 4`. |
| `action` | `ReactNode` | Optional right-aligned widget (button, status). |

---

## `PageHeader`

| prop | type | notes |
|---|---|---|
| `eyebrow` | `string` | Uppercase mono breadcrumb (e.g. `AGENT · TELEMETRY`). |
| `title` | `string` | h1 size. |
| `subtitle` | `string` | Optional supporting line. |
| `actions` | `ReactNode` | Right-aligned button cluster. |

---

## `Sparkline`

| prop | type | default | notes |
|---|---|---|---|
| `data` | `number[]` | — | Min 2 points. |
| `w` | `number` | `80` | Width in px. |
| `h` | `number` | `20` | Height in px. |
| `color` | `string` | `'currentColor'` | Pass a token: `var(--color-status-running)` etc. |

---

## `ProgressBar`

| prop | type | default | notes |
|---|---|---|---|
| `value` | `number` | `0` | |
| `max` | `number` | `100` | |
| `variant` | `'auto' \| 'running' \| 'attention' \| 'error' \| 'idle'` | `'auto'` | `auto` flips to attention at 75%, error at 90%. |
| `height` | `number` | `4` | px. |

---

## `EmptyState` / `LoadingState` / `ErrorState`

The three canonical "no content" treatments. See **States gallery** in the v0.3 deliverable for visual examples.

```
EmptyState   { icon, title, body, action }
LoadingState { rows }                    // skeleton list
ErrorState   { title, body, action }
```

Always use these. Do not roll your own "no results yet" UI per surface.

---

## What you should NOT build

- A "warning" pill that is a fifth status — collapse to `attention` or `error`.
- A button with a custom color — extend `variant` instead and add the variant to this contract.
- An agent marker that is not `AgentMark` — including initials in a circle, an emoji, or a colored square. Always `AgentMark`.
- A new shadow level — there are two (`elevation-1`, `elevation-2`) and they are sufficient.
- A new radius — there are three (`sm`, `md`, `lg`).

If you find yourself wanting one of these, that's a design conversation, not an implementation choice. File it against the `2200` design system label.

---

## Token contract

All visual properties resolve through CSS custom properties named `--<category>-<role>[-<variant>]`. The full set is in `tokens.json`. Never reference oklch values directly in a component — always go through a token.

Theme switching is one class swap on a root element (`theme-dark` ↔ `theme-light`). Components should not branch on theme.
