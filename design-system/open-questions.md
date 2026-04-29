# 2200 — Open questions

**Version 0.3.** What we knowingly skipped, deferred, or punted. This is the backlog for the next iteration — read it as "things your team should not assume are resolved."

---

## Surface coverage

- **Mobile (375px) wires.** Everything in v0.3 is 1440-only. Fleet, Inbox, and ⌘K all need bespoke mobile treatments — they don't compress cleanly. Open question: is mobile a read-only "what's happening?" view, or a full triage-capable companion?
- **Tablet / 1024.** Untested. Side-by-side panes won't fit; the variant strip needs a dropdown.
- **Empty-tenant onboarding.** First-run state when the user has zero agents and zero data. The Onboarding screen covers *adding an agent*, not *arriving at the product*.
- **Settings / preferences.** No screen for account, billing, integrations, or API keys.
- **Search results page.** ⌘K covers spotlight-style search; we don't have a dedicated full-page search.
- **Agent edit / archive flow.** We show the dossier and identity card, not the editor.

## Component depth

- **Hover, focus, disabled, loading-button states** beyond what's in the Components page. The Components tab demonstrates them on representative primitives but not on every variant combination.
- **Tooltip and popover** primitives. Several screens imply tooltips (sparkline data, mono ID hovers); none are designed.
- **Toast / notification** treatment. No spec.
- **Modal / dialog** spec. We use cards as faux-modals in a few places; haven't designed the real overlay.
- **Form patterns**: validation, inline errors, required markers, multi-select, date pickers. Not in scope for v0.3.

## Motion

- **Motion spec.** Only the running pulse is documented. Open: should `attention` pulse too? Probably not, but worth a stance. Also: enter/exit transitions for inbox items, pub messages, and the cmd-K palette.
- **Reduced-motion** behavior. We respect the system but haven't documented the alternates.

## Iconography

- **No real icon set.** Placeholders are mono characters (`◫`, `○`, `⌘`, `md`, `$`). Worth a deliberate choice: ship without icons, ship with Phosphor / Lucide, or commission custom. Affects perceived polish more than any other single decision.

## Theming

- **Terminal theme is a stub.** The manifest schema is real; the values aren't QA'd. Specifically: text contrast on `bg-primary` needs validating, and `focus-ring` may collide with `status-info`.
- **High-contrast / accessibility theme.** Not started. WCAG AAA pass for the Default themes hasn't been audited either.
- **User custom themes.** The manifest contract supports them; no UI for upload/management.

## Content

- **Real microcopy review.** The strings in the prototype are illustrative. Voice review by whoever owns brand should happen before any of this becomes shippable.
- **Error message copy library.** We have an `ErrorState` shape; we don't have the canonical copy for the dozen errors users will actually hit.
- **Date / time formatting standard.** We mix relative ("14m") and absolute ("14:32") inconsistently. Pick a rule.
- **Currency / locale.** Hardcoded USD. No locale strategy.

## Data and behavior

- **Fleet > 25 agents.** Mission Control's "needs you / working / idle" stops scaling around 30 agents. Open: pagination, virtualization, or aggregation.
- **Pub with > 6 members.** The roster masthead breaks. We didn't design for it.
- **Live updates.** When an agent transitions running → idle while the user is on Fleet, what animates? We have no answer.
- **Stale data.** No "last refreshed" affordance, no offline indicator beyond an error state.
- **Pagination / sorting / filtering** on Fleet, Inbox, Budget. Not designed.

## Accessibility

- **Keyboard nav for non-Inbox screens.** We rely on `j/k` in Inbox triage. Fleet, Pub, Budget should have analogous patterns; we haven't specified them.
- **Screen reader behavior.** Components are functional but `aria-live`, `role`, and `aria-labelledby` aren't documented.
- **Focus management** during modal/overlay transitions. Not designed because the modals aren't designed.
- **Color-only signaling.** Status pills include both color *and* uppercase label, so this is mostly fine — but progress bars are color-only.

## Engineering open questions

- **Agent id stability.** The 12-color hash assumes ids never change. Production needs to enforce that or accept color drift on rename.
- **Token generation pipeline.** `tokens.json` is canonical; whether the team wants Style Dictionary, a custom script, or to consume the JSON directly is undecided.
- **JSX in `src/v3/` is illustrative.** Not production code. Engineering should treat the component contract as the spec, not the JSX.
- **The Inbox triage keyboard layer** is documented in the prototype but not in the contract doc — it should be added before implementation begins.

## Things we deliberately deferred

These are *not* mistakes; they were out of scope for v0.3 and we want to flag them so they don't get reinvented:

- A dedicated "agent home" view for each agent (would compete with Pub).
- Calendar integration UI (covered conceptually by Juno, the calendar agent — but no calendar viewer screen).
- A 2D canvas for the Pub (we considered this and ruled it out as too unconstrained).
- Comparison views across agents (e.g., side-by-side telemetry). Cool, premature.

---

## Recommended next iteration

If we had one more sprint, in order:

1. **Mobile** — at minimum, Fleet read-only and Inbox triage. These are the on-call screens.
2. **Iconography decision** — picking and applying changes the perceived fidelity more than any other change.
3. **Motion spec** — keeps the design's restraint from getting eroded by per-engineer choices.
4. **Modal / toast / tooltip primitives** — every screen will need them.
5. **Accessibility audit + keyboard map for the remaining screens.**

Anything below that line is a v1 problem, not a v0.4 problem.
