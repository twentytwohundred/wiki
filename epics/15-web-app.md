---
title: "Epic 15: Web app"
type: epic
status: drafted
version: 0.1
tags: [epic, web, frontend, theme, api, ux]
created: 2026-04-29
updated: 2026-04-29
linked_docs:
  - "[[03-epic-map]]"
  - "[[01-vision]]"
  - "[[02-architecture]]"
  - "[[../decisions/2026-04-29-theme-aware-from-v1]]"
  - "[[../design-system/README]]"
  - "[[../conventions/runtime-api]]"
  - "[[../conventions/theme-format]]"
canonical_path: wiki/epics/15-web-app.md
---

# Epic 15: Web app

A browser-based UI for managing a fleet of Agents. Power users live here; normal users open it once or twice a day. The runtime stays headless ... the web app talks to it over a documented HTTP+WebSocket API. No runtime types are imported into frontend code; no frontend helpers call runtime functions directly.

This is the first surface that exercises the theme-aware-from-v1 architecture for real (see [[../decisions/2026-04-29-theme-aware-from-v1]]). All visual values resolve through CSS variables. Theme switch is one class swap on the root element. Layout regions are arrangeable. Iconography is a swappable layer.

## Phasing

Phased so each phase ships a usable surface end-to-end.

### Phase A ... daily-driver fleet operations

**Scope.** Four screens that cover the 80% of daily use:

1. **Fleet** (Mission Control variant per [[../design-system/decision-log]]). Triage hierarchy: needs-you on top, working in the middle, idle compressed.
2. **Agent detail** (Identity Card variant). Mandate / voice / budget hero; telemetry one click away.
3. **Inbox** (Keyboard Triage variant). Single-ask triage with j/k + 1-4 + e.
4. **Command palette ⌘K** (single design, four states). Navigate, send tasks, search brain, switch theme.

Plus the substrate underneath all four: token system, theme provider, primitives library (Pill, Button, Input, AgentMark, UserMark, Card, KV, SectionHeader, PageHeader, Sparkline, ProgressBar, EmptyState/LoadingState/ErrorState), routing, API client, WebSocket live-signal subscription, auth.

**Done when.**
- The CLI user can run `2200 web start`, get a URL, open it in a browser, and see their fleet live.
- Fleet, Agent detail, Inbox, and ⌘K work against the runtime via the documented API ... no runtime types or functions imported into the web bundle.
- Theme switch (Default Dark ↔ Default Light) is one class swap with no flicker.
- An Agent transitioning running → idle in the runtime causes the Fleet view's status pill to update without a page refresh (WebSocket push).
- Inbox triage from the keyboard works for a `notification.ask` that came from any Agent.
- ⌘K can navigate to any Agent, open notifications, switch theme.
- Tests + lint + typecheck + build clean. Component snapshot tests for every primitive. Integration tests for each screen against a stub runtime API.

### Phase B ... onboarding, pub, budget

The remaining three core screens:

5. **Onboarding** (Card Stack variant). Web variant of `2200 agent spawn`; lifts Epic 14's interview/identity/tools/schedule pipeline. Phase B's first PR makes those modules UI-agnostic ... no `console.log`, no stdin reads inside generators.
6. **Pub** (Canvas + Artifacts variant). Multi-Agent room with artifact-first treatment.
7. **Budget** (Ledger Receipt variant). Cost transparency. Includes the V1 Stripe-style operational view alongside V3, per the decision-log note that V3 alone won't survive contact with a finance team.

### Phase C ... operational depth

Settings (inline where they apply, plus a settings home), tool-connection UI for Epic 9 mcp_servers, schedule editor (Epic 6), brain browser (Epic 8). Each picks up an existing CLI surface and gives it a screen.

### Phase D ... mobile

Tracked under Epic 16. Same API, same theme manifests; different presentation surface.

## Stack

Locked picks:

- **Vite 5+** ... build tool. ESM-native, fast HMR, no opinionated framework.
- **React 18+** ... view layer. Hooks-first; no class components.
- **TypeScript** ... shared vocabulary with the runtime.
- **Raw CSS variables, no Tailwind, no CSS-in-JS.** The component contract enforces "call sites pick semantics, not styles." A utility CSS framework reintroduces styles at call sites; CSS-in-JS leaks tokens into TypeScript. Components author CSS Modules (`.module.css`) that resolve through `var(--token-name)`. This is the discipline the theme-aware decision is asking for.
- **React Router 6+** ... routing.
- **TanStack Query (formerly React Query)** ... server-state, cache, refetch, retry. The runtime is the source of truth; Query handles staleness.
- **Native `WebSocket`** ... no library. Browser-built-in is enough for the live-signal channel.
- **Recharts** ... sparklines, time-series (Budget). Tokens-driven via `currentColor` / explicit token color props.
- **Vitest + React Testing Library** ... unit + component tests.
- **Playwright** ... E2E against a stub runtime in CI.
- **ESLint + Prettier** ... standard, matches the runtime side.

**Not used:**
- **shadcn/ui.** Pushes Tailwind. Conflicts with the contract. We pattern-lift from shadcn's primitive shapes (the sensible defaults of how a Button or Dialog should behave) but write against tokens, not Tailwind classes.
- **Material UI / Chakra / Mantine.** Heavy, opinionated, theme stories conflict with ours.
- **Storybook.** Useful but heavy. The component-library page (the "Tokens" tab from the v0.3 prototype) is rebuilt natively in `/dev/components` as a route. Cheaper.

## Architecture

### Where things live

```
code/2200/apps/web/
├── package.json                  # vite, react, tanstack-query, etc.
├── vite.config.ts
├── index.html
├── src/
│   ├── main.tsx                  # bootstrap (React root, theme class, router)
│   ├── lib/
│   │   ├── api.ts                # typed HTTP client (fetch + zod-validated responses)
│   │   ├── ws.ts                 # WebSocket live-signal subscription
│   │   └── auth.ts               # token storage + header injection
│   ├── tokens/
│   │   ├── tokens.css            # generated from wiki/design-system/tokens.json
│   │   ├── theme-default-dark.css   # generated from default-dark.json
│   │   ├── theme-default-light.css  # generated from default-light.json
│   │   └── generate.ts           # tokens.json → CSS at build time
│   ├── primitives/
│   │   ├── Pill.tsx              # + .module.css
│   │   ├── Button.tsx
│   │   ├── AgentMark.tsx         # mirrors agentColorClass(id) hash from contract
│   │   ├── ...                   # one file + module.css per primitive
│   ├── screens/
│   │   ├── fleet/
│   │   │   ├── FleetScreen.tsx
│   │   │   └── FleetScreen.module.css
│   │   ├── agent/
│   │   ├── inbox/
│   │   └── palette/              # ⌘K
│   ├── ws/
│   │   └── useAgentStatus.ts     # subscribe to runtime events, push into Query cache
│   ├── theme/
│   │   ├── ThemeProvider.tsx     # className swap on <html>
│   │   └── useTheme.ts
│   └── icons/                    # swappable icon layer (Lucide initially)
└── tests/
    ├── primitives/               # component snapshot + interaction tests
    ├── screens/                  # screen integration tests against stub runtime
    └── e2e/                      # Playwright
```

The token CSS is generated at build time from the canonical JSON in `wiki/design-system/tokens.json`. The generator copies the JSON in (or reads it via a configured path) and emits CSS custom properties under `:root`, `.theme-dark`, `.theme-light`. Adding a new theme is one new JSON file in the canonical themes directory plus a regenerate.

### Boundary discipline

These rules enforce the runtime/client boundary called out in [[../02-architecture]] (Runtime / client boundary section) and [[../decisions/2026-04-29-theme-aware-from-v1]]:

1. **Frontend imports nothing from `code/2200/src/`.** ESLint rule (no-restricted-imports) blocks `../../src/*` and `@runtime/*` patterns.
2. **API responses are typed independently** in `apps/web/src/lib/api.ts`. The runtime publishes its API types via the OpenAPI/JSON schema spec in [[../conventions/runtime-api]]; the frontend regenerates its TS types from that schema. Two separate type universes that share a schema, not source.
3. **No frontend helper calls a runtime function.** Frontend talks to the runtime over HTTP + WS only. ESLint rule blocks process-spawning and filesystem access from frontend code.
4. **Layout regions are declarative.** Each screen file exports a default region arrangement; themes can override via the theme manifest (Level 2 theming per [[../design-system/2200-design-brief-themes-addendum]]).
5. **Iconography is a swappable layer.** Icons resolve through `<Icon name="bell" />`; the icon set is loaded at theme-init and replaceable in a theme manifest.

When any of these is violated by accident, the lint or build step fails. The discipline is mechanical, not aspirational.

### Auth (Phase A)

Local-install only at v1. The CLI generates a token on first `2200 web start` and prints it; the browser stores it in `localStorage` and sends it as `Authorization: Bearer <token>`. Managed service auth (per-user accounts, sessions, SSO) is Epic 17.

Phase A also accepts `?token=<value>` once on the URL to bootstrap the localStorage entry, then strips the query string. This makes the "click the URL the CLI printed" flow work.

### Theme switching

A `<ThemeProvider>` at the React root manages the active theme. The provider:

- Reads the user's preference from localStorage (`2200.theme = 'default-dark' | 'default-light'`).
- Falls back to `prefers-color-scheme` if no preference set.
- Applies the theme by setting `<html class="theme-dark">` (or `theme-light`).
- Exposes `useTheme()` for components that need to know the active theme (Recharts color-resolution, etc).

Theme switch is a single class change. No re-render of the tree; no flicker; no flash of unstyled content. The CSS handles every visual change through `var(--token-name)`.

## Includes

### Token generator

A small build-time script (`apps/web/src/tokens/generate.ts`) that reads `wiki/design-system/tokens.json` and emits:

- `tokens.css` ... base layer with `:root { --type-*: ...; --space-*: ...; }` etc.
- `theme-default-dark.css` ... `.theme-dark { --color-*: ...; --shadow-*: ...; }`
- `theme-default-light.css` ... `.theme-light { --color-*: ...; --shadow-*: ...; }`
- `agent-palette.css` ... `.agent-c0 { --agent-color: oklch(0.66 0.13 25); } ... .agent-c11 { ... }`
- `user-mark.css` ... `--user-c-from / --user-c-to` for the gradient

The generator runs as part of `vite build` and `vite dev`. Editing `tokens.json` triggers HMR.

### API client

A thin wrapper around `fetch`:

- Reads the auth token from auth.ts and injects `Authorization: Bearer <token>`.
- Validates responses with Zod schemas matching the [[../conventions/runtime-api]] spec.
- Returns typed promises; throws structured errors (`ApiError` with status, code, message).
- TanStack Query consumes the wrapper for caching/staleness/retry.

### WebSocket subscription

A separate connection at `/api/v1/ws` (same auth token in header during the upgrade). Pushes runtime events:

- `agent.status_changed { agent, oldStatus, newStatus }`
- `task.started / task.finished / task.errored { agent, taskId, ... }`
- `notification.created / notification.answered / notification.dismissed { ... }`
- `budget.threshold_crossed { agent, percentage }`
- `pub.message { pubId, sender, body, ... }` (Phase B)

A custom React hook (`useLiveSignal`) consumes events and pushes them into the TanStack Query cache (invalidating affected queries). The Fleet view's running pulse, the Inbox's pending-count badge, and the Agent detail's "current task" line all stay live without polling.

### Primitives library

Every primitive in [[../design-system/component-contract]] gets implemented in `apps/web/src/primitives/`. Each is:

- A React component with the props from the contract (no extras).
- A sibling `.module.css` file resolving through tokens.
- Snapshot + interaction tests in `tests/primitives/`.

The agent-color hash function (`agentColorClass`) is implemented in `AgentMark.tsx` and verified against the contract spec in tests. A test fixture pins specific (id, expectedClass) pairs so the hash never silently drifts.

### Screens (Phase A)

Each screen is a route. Each screen consumes one or more API endpoints and one or more live-signal events. Each screen is structured as:

```
screens/<name>/
├── <Name>Screen.tsx      # composition; layout regions
├── <Name>Screen.module.css
├── regions/              # individual region components (themable arrangement)
└── hooks/                # screen-specific data hooks
```

The "regions" subdir is what makes Level-2 theming work. A theme can declare a region order or visibility override in its manifest; the Screen file reads that manifest and renders regions accordingly.

### CLI surface

```
2200 web start [--port <p>] [--bind <addr>]   # default port 2200, bind 127.0.0.1
2200 web stop
2200 web status                                # is it running, what URL, what token
2200 web token rotate                          # invalidates the current token, prints a new one
```

Phase A binds to `127.0.0.1` only. Public reachability is Epic 19.

## Out of scope (Phase A)

- Onboarding, Pub, Budget screens (Phase B).
- Tool-connection UI for Epic 9 mcp_servers (Phase C).
- Schedule editor, brain browser (Phase C).
- Settings (Phase C).
- Multi-tenant auth (Epic 17).
- Public reachability, mobile push (Epic 19, Epic 16).
- Mobile-aware layouts at 375px (Phase D / Epic 16).
- Tablet (1024px) layouts (deferred; design open question).
- Marketplace / theme browser / theme uploader (v1.5+).
- A third theme beyond Default Dark and Default Light (deferred per session call 2026-04-29).

## Open questions

These are decisions the spec lock leaves to implementation, not blockers:

1. **Lucide vs Phosphor vs custom for the icon set.** v0.3 design used mono-character placeholders. Lucide is the safe pick (large set, well-licensed). Locking to Lucide unless a stronger pick surfaces during implementation.
2. **TanStack Router vs React Router.** Default is React Router for ecosystem reasons; revisit if state-shape mismatch surfaces.
3. **Whether the token generator runs from a wiki path or copies into the code repo.** Default: read directly from `wiki/design-system/tokens.json` via a relative path at build time. The wiki is Dropbox-synced so the path resolves on Doug's machine; CI clones the wiki repo as a sibling. If that fragility shows, copy the JSON into `apps/web/src/tokens/source/` with a "do not edit" header and a git pre-commit hook to keep it in sync.

## Files

```
code/2200/apps/web/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── public/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── routes.tsx
│   ├── lib/{api,ws,auth,errors}.ts
│   ├── tokens/{tokens.css,theme-default-dark.css,theme-default-light.css,generate.ts}
│   ├── primitives/{Pill,Button,Input,AgentMark,UserMark,Card,KV,SectionHeader,PageHeader,Sparkline,ProgressBar,EmptyState,LoadingState,ErrorState}.tsx + .module.css
│   ├── theme/{ThemeProvider,useTheme}.tsx
│   ├── icons/{Icon.tsx,lucide-set.ts}
│   ├── ws/{useLiveSignal,events}.ts
│   ├── screens/fleet/...
│   ├── screens/agent/...
│   ├── screens/inbox/...
│   ├── screens/palette/...
│   └── dev/components-page.tsx       # /dev/components route showing every primitive
└── tests/...

code/2200/src/
├── http/                              # new: HTTP server hosting the API
│   ├── server.ts
│   ├── routes/
│   │   ├── agents.ts
│   │   ├── tasks.ts
│   │   ├── notifications.ts
│   │   ├── brain.ts
│   │   ├── budget.ts
│   │   └── ws.ts
│   ├── auth.ts
│   └── errors.ts
└── cli/web.ts                         # new: 2200 web start/stop/status/token rotate
```

The HTTP server is hosted by the supervisor process. The web app is served as static files from `apps/web/dist/` after `vite build`.

## Done when

The Phase A done-when criteria above, plus:

- `2200 web start` works.
- The four screens cover the daily-driver use cases.
- A user with three running Agents can: see all of them in Fleet, click one to see its detail, see notifications come in via push, triage them with j/k, switch from Dark to Light without flicker, hit ⌘K and navigate by keyboard.
- The theme manifest format (per [[../conventions/theme-format]]) is exercised by both Default Dark and Default Light.
- A drift test in CI catches any hardcoded color/font/spacing in component CSS.
- The runtime API spec (per [[../conventions/runtime-api]]) is published as JSON Schema; the frontend types are generated from it.

## Depends on

- Epic 2 (runtime substrate, Identity, Supervisor) ... shipped.
- Epic 3 (pub) ... shipped (Phase B uses pub data).
- Epic 6 (scheduler) ... shipped (Agent detail surfaces schedules).
- Epic 7A (notifications) ... shipped (Inbox surface).
- Epic 8A (brain) ... shipped (Agent detail surfaces brain notes).
- Epic 9A (tool system) ... shipped (Agent detail surfaces tools).
- [[../decisions/2026-04-29-theme-aware-from-v1]]
- [[../design-system/README]]
- [[../conventions/runtime-api]] (drafted alongside this spec)
- [[../conventions/theme-format]] (drafted alongside this spec)

## References

- Design system v0.3: [[../design-system/README]]
- Component contract: [[../design-system/component-contract]]
- Decision log: [[../design-system/decision-log]]
- Open questions: [[../design-system/open-questions]]
- Tokens (canonical): [[../design-system/tokens]]
- Default Dark theme: `wiki/design-system/themes/default-dark.json`
- Default Light theme: `wiki/design-system/themes/default-light.json`
- Theme-aware decision: [[../decisions/2026-04-29-theme-aware-from-v1]]
- Architecture (Runtime/client boundary): [[../02-architecture]]
- Design language convention: [[../conventions/design-language]]

---

*v0.1 drafted 2026-04-29 by Hobby. Phasing locked. Stack picks locked. Open questions explicitly named. Substrate work (API convention + theme convention) drafts alongside this spec.*
