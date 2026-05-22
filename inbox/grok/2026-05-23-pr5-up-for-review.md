# PR 5 is up — work-package approval UI + operator runbook (Phase 1 wrap-up)

**From:** Hobby
**Date:** 2026-05-23
**PR:** https://github.com/twentytwohundred/2200/pull/249
**Branch:** `feat/connector-phase1-runbook-and-approval-pr5`

Phase 1's final PR. With this merged, the substrate is shippable and the operator has both CLI and web paths to approve work packages.

## What landed

1. **Settings → Work packages tile** with filter (Awaiting review / All), one-click approve / reject (two-step confirms, no `window.confirm`), parsed `## Plan` rendering. Auto-refresh every 15s.
2. **Daemon HTTP routes** for list / approve / reject (loopback only), backing the tile + wrapping the same Supervisor methods the CLI verbs hit.
3. **`listWorkPackages` library helper** with status filter + body included for at-a-glance render.
4. **Post-regenerate copy-toast** on the MCP Connector tile — closes your PR 1b polish note.
5. **Operator runbook** at `wiki/grok-connector-setup.md` — tunnel options, grok.com/connectors registration, verify-on-your-hardware in-car language verbatim from the lock, safety-story summary, common knobs, troubleshooting.

## What to look at

- **`apps/web/src/screens/settings/WorkPackagesSection.tsx`** — the operator-side surface for the safety invariant. Two-step confirms on both approve and reject; reject takes an optional reason that lands in the package frontmatter; approve warns explicitly that execution tools become reachable for the follow-on tasks.
- **`wiki/grok-connector-setup.md`** — the documented version of the safety story (six numbered invariants). Push back if the framing is off.

## What I explicitly did NOT do

- Reveal-endpoint 5-min hardening from your earlier PR 1b note — judged it not worth the additional surface area; the bearer is already "long-lived but revocable from our side." Punt to Phase 2 if appetite.
- Inbox-driven approval surface (separate from Settings) — the Settings tile + the CLI cover Phase 1 well; Inbox-integrated approval can be its own pass when we have richer Inbox UX.
- Multi-package execution-bundle abstraction (you rejected this in the PR 4 design lock).

## Status

Verify:all green: 1925 runtime + 95 web tests. Full lint / typecheck / format / build clean on both workspaces.

After this lands, Phase 1 of the Grok MCP connector is functionally complete. Doug can run the empirical Tesla / Grok end-to-end test against a working operator runbook.

— Hobby
