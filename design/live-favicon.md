# 2200 — Live Favicon Brief

For the engineers wiring the live favicon into the 2200 web app.

The favicon is a **status light**. It reflects the live state of the user's fleet, so they can glance at any browser tab — pinned, in another window, behind other apps — and know whether 2200 needs them.

The mechanism is already proven on the placeholder home page (`2200 Home.html`). This document explains how to take that same code, wire it to real fleet state, and ship it as part of the app shell.

---

## 1. States

There are exactly four. Do not add a fifth without designer sign-off.

| State  | Color (hex)  | Means                              | When to use it                                                                  |
| ------ | ------------ | ---------------------------------- | ------------------------------------------------------------------------------- |
| `ok`   | `#22c97a`    | All good                           | All known agents reporting; no inbox items requiring attention.                 |
| `warn` | `#e3a847`    | Resting / waiting                  | At least one agent idle, paused, or rate-limited. Nothing actionable.           |
| `err`  | `#e35d4d`    | Needs you                          | Any agent in an error state, OR `inboxCount > 0` (something awaits the human).  |
| `off`  | `#7a8089`    | Disconnected                       | WebSocket / API connection to runtime is down. Higher priority than any other state. |

The resolution function is intentionally tiny:

```ts
type FleetSnapshot = {
  connected: boolean;
  errorCount: number;     // agents in an error state
  inboxCount: number;     // user-facing items waiting on you
  idleCount:  number;     // agents idle / resting / paused
};

type FaviconState = 'ok' | 'warn' | 'err' | 'off';

export function faviconStateFor(f: FleetSnapshot): FaviconState {
  if (!f.connected)        return 'off';
  if (f.errorCount > 0)    return 'err';
  if (f.inboxCount > 0)    return 'err';
  if (f.idleCount > 0)     return 'warn';
  return 'ok';
}
```

`off` is sticky in the sense that it overrides everything — if we can't reach the runtime, we don't lie to the user about its state.

---

## 2. How to render it

A single 32×32 `<canvas>`, redrawn every animation frame, exported as a data URL, written into `<link rel="icon">`. The full source is in `2200 Home.html` (`<script>` near the bottom — ~50 lines). Lift it verbatim into the app shell.

Two performance details worth keeping:

- **Frame budget.** Update the favicon every ~42 ms (~24 fps). Faster is wasteful; slower looks jittery. The canvas itself is cheap — the cost is `toDataURL` + `link.href = …`.
- **Visibility gating.** When `document.visibilityState === 'hidden'` for more than a second, drop to ~4 fps. This keeps battery use sane when the user has the tab in the background — the place the favicon matters most. Resume full rate on `visibilitychange`.

---

## 3. Counter chip

When `inboxCount > 0`, the icon shows a small red chip in the upper-right with the count (capped at `9+`). This is documented and live-toggleable in `2200 Live Favicon.html`. Rules:

- Chip appears only when `state === 'err'` AND the err is because of inbox (not agent errors).
- At 16px the chip omits the digit and just signals "there's something" via its presence.
- At 32px+ the digit renders in JetBrains Mono 700, slightly smaller than the chip diameter.

If you want to ship without the counter for v1, do — the colour alone carries the signal.

---

## 4. Where the state comes from

The favicon doesn't subscribe directly to anything. It reads from whatever store already holds the current `FleetSnapshot`.

Suggested wiring (adapt to whatever state library we land on):

```ts
// in the app shell, exactly once on boot
import { startLiveFavicon } from '@/components/LiveFavicon';
import { fleetStore }       from '@/stores/fleet';

startLiveFavicon({
  // Called whenever the store changes. Returns the current FaviconState.
  // The component handles its own RAF loop; the subscription only flips colour.
  subscribe: (onChange) => fleetStore.subscribe(
    () => onChange(faviconStateFor(fleetStore.snapshot()))
  ),
  // Optional — used for the counter chip
  inboxCount: () => fleetStore.snapshot().inboxCount,
});
```

The component owns the canvas + the animation loop. The store owns the truth. No coupling beyond the subscription callback.

---

## 5. Reduced motion

Honor `prefers-reduced-motion: reduce`:

- No breathing animation. Render a single static frame whenever state changes.
- No counter chip pulse. The chip stays a flat colour.

The placeholder page already does this correctly — copy that branch.

---

## 6. Reduced power / battery saver

If the page is in a background tab AND `navigator.getBattery?.()` reports low battery (`< 0.2`) AND no `inboxCount`, hold the last-drawn frame instead of redrawing. State changes still update; only the breathing animation pauses.

This is a nice-to-have for v1.5 — fine to skip on first ship.

---

## 7. Browser support

| Browser          | Works?                                | Notes |
| ---              | ---                                   | --- |
| Chrome / Edge    | Yes                                   | Tested. |
| Safari (macOS)   | Yes                                   | Tested. |
| Safari (iOS)     | Partial — favicon updates work, but iOS only shows the favicon in the URL bar pull-down, not on the tab strip. Acceptable. |
| Firefox          | Yes                                   | Also supports animated SVG favicons natively, but we use the canvas method for consistency. |

There are no known failure modes. If `toDataURL` throws (extremely rare, only with tainted canvases — which can't happen here), the icon falls back to the `<link rel="apple-touch-icon">` PNG already on the page.

---

## 8. Accessibility

- The favicon is decorative. It is **not** the only place we surface fleet state — the in-app sidebar, header, and inbox are the real surfaces. The favicon is a redundant ambient cue.
- The `<link rel="icon">` itself has no ARIA semantics; that's fine.
- The status badge text on the homepage ("In development. Coming soon.") uses `aria-live="polite"` and `role="status"` so screen readers announce changes when we update it.

---

## 9. Acceptance criteria

- [ ] Favicon visibly pulses when the page is open and the fleet is in `ok` state.
- [ ] Switching an agent into an error state changes the favicon to red within ≤ 1 s.
- [ ] Closing the WebSocket changes the favicon to slate within ≤ 2 s.
- [ ] With `prefers-reduced-motion: reduce`, the favicon does not animate.
- [ ] In a backgrounded tab, the favicon still updates colour on state changes but does so without continuous animation work.
- [ ] No console errors, no memory growth over 60 minutes of running.

---

## 10. Open questions

These are not blockers — log them and ship without if needed.

- Should the favicon flash briefly on transition from `ok` → `err`, as an attention grab? (e.g. three pulses then settle.) Designer's instinct: yes, but subtle.
- Should the `off` state carry a separate icon shape (not just colour) so it survives screenshots and screenshare compression? Worth exploring.
- Should we offer a user preference to disable the live favicon entirely, in case it's too distracting? Probably — file it under `/settings/notifications`.

Send any of these to Doug for a design call before implementing.

— Doug
