---
title: 2200 Pre-Public Punchlist — the road to 100%
type: reference
status: active
tags: [reference, punchlist, launch, final-push]
created: 2026-07-01
updated: 2026-07-01
linked_docs:
  - "[[03-epic-map]]"
  - "[[state/2026-07-01]]"
  - "[[handoffs/hobby/2026-07-01]]"
canonical_path: wiki/pre-public-punchlist.md
---

# 2200 Pre-Public Punchlist — the road to 100%

The living tracker for the final push to "ready to show the masses." Sourced from the
2026-07-01 four-agent QA sweep ([[handoffs/hobby/2026-07-01]]). Updated as items land.

**Definition of 100%:** a stranger can go `npm i -g @twentytwohundred/2200-cli` →
`2200 setup` → open the web app → onboard (SuperGrok / cloud key / local) → spawn an
Agent → chat with it in the Studio, with no dead-ends on that path, and no exposure
that matters on a shared network. That is the demo, and the first-external-user
experience.

**Status legend:** ⬜ not started · 🔵 in progress · ✅ done · ⏸️ blocked/deferred · 🔶 Doug's call

Security items are tracked here at **category level only** ... exploit detail lives with
Doug directly, never in this public wiki (see [[handoffs/hobby/2026-07-01]]).

---

## Tier 0 ... stranger-path blockers (the demo dies without these)

**All five fixed in PR #343** (branch `fix/stranger-path-blockers`). `pnpm verify:all` green: 2268 runtime + 111 web + chaos.

| # | Item | Status | Notes |
|---|---|---|---|
| 0.1 | **Fresh install never gets a Studio.** Trigger `ensureStudioPub` on Agent create/confirm, not just daemon boot. First Agent's seeded orientation post targets `studio` and fails too. | ✅ | Ensured in `migrateFromHandoff`'s `seedFirstTask` block (covers web-confirm + CLI-spawn + CLI-migrate); regression tests added. Verified by hand. |
| 0.2 | **Provider failure mid-interview is swallowed** → onboarding "succeeds" with a dead Agent. Reachability-check `local` on the web path; surface the real error. | ✅ | `/v1/models` probe at onboarding start for `local`; actionable 503 `llm_provider_unreachable`; injectable + tested. |
| 0.3 | **CLI-wizard API keys dead until a restart the wizard never performs.** Call the existing `restartDaemonForMigratedKeys`. | ✅ | Wizard returns key count; orchestrator restarts when > 0 (`restartDaemonForProviderKeys`, shared with OpenClaw path). |
| 0.4 | **Main chat screen silently eats failed sends + spins "Thinking…" forever** on Agent death. Error surface + `pendingTaskId` timeout. | ✅ | Inline error + Retry (re-sends exact args); spinner gives up on `errored_at` or a tool-activity-aware 90s backstop; real theme tokens. |
| 0.5 | **Name normalization throws unrecoverable 500s; no rename in preview.** Normalize-or-fallback + collision pre-check + surface the error. | ✅ | Non-throwing `deriveAgentName` ("2200" → "agent-2200"); collision → actionable 409 before any file write. Rename-in-preview UI still open (see 2.x follow-up). |

## Tier 1 ... security before strangers (transport edge; crypto/perms underneath are clean)

| # | Item | Status | Notes |
|---|---|---|---|
| 1.1 | **CRITICAL: default network-bind + bearer-transport posture.** Recommend loopback + Tailscale default, non-loopback explicit opt-in. | 🔶 | Install-contract change (Simon). Doug's call on posture. |
| 1.2 | Auth-coverage / token-scope drifts at the HTTP edge. | ⬜ | Detail with Doug. |
| 1.3 | OAuth discovery-metadata hardening item. | ⬜ | Detail with Doug. |
| 1.4 | Operator credential-at-rest item (rotate + tighten mode). | 🔶 | Doug's hands; no repo change. |

## Tier 2 ... shows on camera (not a hard block)

| # | Item | Status | Notes |
|---|---|---|---|
| 2.1 | Upgrade UI regresses to a stale button mid-restart. | ⬜ | `SystemUpdateSection.tsx:84` |
| 2.2 | `/dev/components` exposed in the Cmd-K palette. | ⬜ | one-line removal |
| 2.3 | Schedule delete is one-click (no confirm). | ⬜ | copy existing two-step confirm |
| 2.4 | Six CSS vars reference non-existent `--ds-danger/-error/-warning/-success` tokens → off-palette hex in Settings. | ⬜ | rename to real tokens |
| 2.5 | No runtime Node-version guard (npm-direct install on Node 18/20 dumps `ERR_DLOPEN_FAILED`). | ⬜ | 5-line guard atop `main.ts` |
| 2.6 | Onboarding: no back button, loses state on refresh. | ⬜ | at minimum persist session id + exit guard |
| 2.7 | Preview has no rename control, so the auto-derived name ships as-is ("Let's call it Mira" → `lets-call-it-mira`). | ⬜ | Surfaced by the 0.5 fix ... the 500 is gone, but an inline rename in the preview is the real UX close. |

## Tier 3 ... docs & hygiene

| # | Item | Status | Notes |
|---|---|---|---|
| 3.1 | Close the 06-22→06-25 release doc gap (handoff + state + epic map). | ✅ | 2026-07-01 |
| 3.2 | This punchlist doc. | ✅ | 2026-07-01 |
| 3.3 | Green the dependabot Prettier PR (#342). | ⬜ | `prettier --write`, 16 files |
| 3.4 | Consider dropping `*.map` from the npm tarball (ships full TS source). | ⬜ | `tsup` `sourcemap:false` for publish |

---

## Two calls that are Doug's

1. **Security posture** (item 1.1) ... loopback-default vs TLS vs keep-0.0.0.0-with-warning.
2. **Grok-first "2200-as-MCP-server for Tesla voice" surface does not exist yet** ...
   `src/runtime/mcp/` is tool-client only. A build, not a 5-day polish item; out of scope
   for the final push unless traded for polish.

---

## Done since 2026-06-18 (the eight releases this push builds on)

Full narrative in [[handoffs/hobby/2026-07-01]].

- `2026.622.2027` ... SuperGrok-only onboarding (one sign-in, no API key).
- `2026.623.1350` ... pub-server patch-overlay decision unit-tested (`planPubServerPatch`).
- `2026.623.1612` ... chaos-test flake fix (test-only).
- `2026.623.1638` ... Studio port adoption (kills HTTP 409-after-update).
- `2026.623.1702` ... detached daemon restart (remote `2200 update` survives SSH).
- `2026.623.1738` ... from-tarball install smoke gate in CI; chaos isolated.
- `2026.624.1204` ... `xai-subscription` bearer hot-read (fixes ~6h Agent-silence).
- `2026.625.1807` ... Settings → System restart-fleet button.
