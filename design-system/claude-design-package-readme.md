# 2200 — README

**Project:** 2200, an interface for managing a fleet of AI agents.
**Version:** 0.3 (handoff)
**Status:** Design exploration — wireframe-fidelity prototype with locked design system.

---

## What's in this package

```
2200 v0.3.html              ← the deliverable. Open in any modern browser.
tokens.css                  ← canonical design tokens (light + dark)
agent-palette.css           ← 12-color agent palette + AgentMark/UserMark styles

src/v3/
  primitives.jsx            ← Button, Pill, AgentMark, Card, KV, etc. (the components)
  fixtures.jsx              ← shared sample data: agents, fleet rows, inbox items, etc.
  screen-fleet.jsx          ← Fleet screen, V1/V2/V3
  screen-agent.jsx          ← Agent detail, V1/V2/V3
  screen-inbox.jsx          ← Inbox, V1/V2/V3
  screen-onboarding.jsx     ← Onboarding, V1/V2/V3
  screen-pub.jsx            ← Pub (multi-agent room), V1/V2/V3
  screen-budget.jsx         ← Budget, V1/V2/V3
  screen-palette.jsx        ← Command palette, four states
  components-library.jsx    ← every primitive, every state (the "Tokens" tab)
  states-gallery.jsx        ← canonical empty/loading/error patterns
  docs.jsx                  ← Philosophy + Themes manifest screens

handoff/
  README.md                 ← this file
  tokens.json               ← canonical token source (generates tokens.css)
  themes/
    default-dark.json       ← canonical theme manifest
    default-light.json      ← light translation
    terminal-stub.json      ← stub showing the contract for future themes
  component-contract.md     ← API contract for every primitive
  decision-log.md           ← V1/V2/V3 picks per screen with rationale
  open-questions.md         ← what we knowingly skipped; backlog for next iteration
  2200 v0.3 standalone.html ← single-file offline-capable bundle
  2200 v0.3.pdf             ← print-ready export of all screens + docs
```

---

## How to read it

**For design review:** Open `2200 v0.3.html`. The shell has 11 tabs across the top:

- **1–7** are the seven screens (Fleet, Agent, Inbox, Onboarding, Pub, Budget, ⌘K). Each tab opens on the V3 pick; V1/V2 are still selectable in the variant strip below the shell.
- **8–10** (Tokens, States, Philosophy, Themes) are the design-system documentation, presented inside the same shell.
- Pane mode (top right): **Dark** / **Both** / **Light** — show one or both themes side by side.
- Keyboard: **1–0** jump tabs · **q/w/e** switch pane mode.

**For engineering pickup:** Start with `handoff/component-contract.md`. Then `handoff/tokens.json`. The JSX in `src/v3/` is illustrative, not production — the contract and the tokens are the contract.

**For PM circulation:** `handoff/2200 v0.3.pdf` and `handoff/decision-log.md` are the right artifacts.

---

## Screen → file mapping

| Tab | File | Variants |
|---|---|---|
| Fleet | `src/v3/screen-fleet.jsx` | V1 dense table · V2 card grid · **V3 mission control** |
| Agent | `src/v3/screen-agent.jsx` | V1 dossier · V2 telemetry tail · **V3 identity card** |
| Inbox | `src/v3/screen-inbox.jsx` | V1 tiered list · **V2 keyboard triage** · V3 chronological stream |
| Onboarding | `src/v3/screen-onboarding.jsx` | V1 chat + preview · V2 document · **V3 card stack** |
| Pub | `src/v3/screen-pub.jsx` | V1 Slack-shaped · V2 roster-foregrounded · **V3 canvas + artifacts** |
| Budget | `src/v3/screen-budget.jsx` | V1 Stripe-style · V2 per-agent stack · **V3 ledger receipt** |
| ⌘K | `src/v3/screen-palette.jsx` | Single design, four states (empty / typing / @agent / /plan) |

Bold = our pick for v0.3. Other variants remain selectable for stakeholder discussion. Rationale for each pick is in `decision-log.md`.

---

## Key system rules (also in Philosophy doc)

1. **Calm by default.** Animation is reserved for the running pulse. No gradients except the user mark. No emoji.
2. **Identity is permanent.** Every agent has a deterministic 12-color palette swatch derived from a hash of their id. Mira looks the same in every screen, every theme.
3. **Status before activity.** A status pill with semantic color is canonical. Activity text is descriptive prose.
4. **Mono earns its place.** Monospace numerals for IDs, costs, durations, percentages, timestamps. Inter for prose.
5. **You are not an agent.** The "you" mark uses a single distinct gradient — never an agent color.

---

## Production guidance

- **Do** lift `tokens.json` directly. Run it through Style Dictionary or write a tiny generator; the file is canonical.
- **Do** mirror the agent-color hash function (`agentColorClass` in `primitives.jsx`) verbatim in production. Determinism matters across services.
- **Do** keep the "you" gradient identifiable. It's how users know which voice in a Pub is theirs.
- **Don't** introduce a fifth status. Collapse to `attention` or `error`.
- **Don't** ship the rationale annotations or the side-by-side pane shell — those are wireframe scaffolding.

---

## What's intentionally not done

See `open-questions.md`. Headlines:

- No mobile / 375px wires yet.
- No motion spec beyond the running pulse.
- No real iconography — we used circles, dashes, and mono characters as placeholders.
- The Terminal theme is a manifest stub; not visually QA'd.
- No empty-tenant onboarding flow (the user with zero agents) — only the per-agent onboarding.

---

## Versioning

This is **v0.3**. Earlier versions live in the project for historical context but should not be referenced for production.

- `v0.1` — initial 7 tabs, 3 variations each, side-by-side panes.
- `v0.2` — sharpened V2/V3 alternates per screen.
- `v0.3` — locked picks, harmonized to one token system, full component library, philosophy + themes documentation.
