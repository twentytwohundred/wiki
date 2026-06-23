---
title: "Runbook: OpenClaw migration ... what travels vs. what you re-do"
type: runbook
status: active
tags: [runbook, migration, openclaw, onboarding, connectors]
created: 2026-06-23
updated: 2026-06-23
linked_docs:
  - "[[cray-test-published-artifact]]"
  - "[[grok-first-signin]]"
canonical_path: wiki/runbooks/openclaw-migration-what-travels.md
---

# OpenClaw migration: what travels vs. what you re-do

When you migrate an OpenClaw Agent into 2200 (`2200 setup` detects an OpenClaw
install and offers it, or `2200 migrate openclaw`), most of the Agent comes
over automatically and a few things you re-establish on the 2200 side. This is
the authoritative list, mirrored from what the migration report itself prints
(`src/runtime/migration/openclaw.ts` → `renderReport`). The same report is
appended to the migrated Agent's continuity note, so the Agent also knows what
happened.

## ✅ Travels automatically

| Thing | Where it lands |
|---|---|
| **Persona** | `SOUL.md` becomes the Agent's Identity body, verbatim. It's still the same Agent. (If no `SOUL.md`, a stub is generated.) |
| **Daily memories** | Every `workspace/memory/*.md` file is imported into the Agent's brain and is FTS-searchable. |
| **Operating docs** | Imported into the brain tagged `openclaw-import`. Treated as *history* (they describe the old runtime), not instructions. |
| **Schedules** | Mappable cron/interval jobs are imported. (See re-do for the ones that can't map.) |
| **Credentials** | *Every* secret-shaped value in `openclaw.json` (API keys, tokens, passwords) is sealed into the Agent's encrypted per-Agent vault (`2200 credential list <agent>`). The functional LLM + web-search keys also land in `runtime.env` so they work immediately. |
| **Web search key** | Brave and Gemini (OpenClaw's "google" grounding) carry over with the provider choice. Other providers are named in the report, not silently dropped. |
| **Discord** (interactive migration only) | The bot connection is carried over (same bot, same channel allowlist) and the source OpenClaw gateway is stepped down so only one Agent answers. See [[../decisions/2026-06-16-connectors-dependency-free-gateways]]. |

## 🔧 You re-do on the 2200 side

| Thing | Why / what to do |
|---|---|
| **Non-Discord channels** (Telegram, Slack, ...) | Tokens stay in OpenClaw. Reconnect via 2200's Extensions store (the matching connector) ... a minute each; the Agent keeps the same presence. |
| **Discord on a *non-interactive* migration** | Only the interactive flow does the live cutover. If you migrated headless, reconnect the discord connector via the Extensions store. |
| **Skills** | Surveyed and listed, not installed. Re-add with `2200 skill install`. |
| **Disabled / unmappable schedules** | Disabled OpenClaw jobs, and schedule/payload kinds 2200 can't map, are flagged in the report ... re-add with `2200 schedule add` if you still want them. |
| **Session transcripts** | Stay in OpenClaw. Your daily-memory files carry the durable context; raw transcripts can be imported on request later. |
| **Model binding** | If OpenClaw ran a model with no direct 2200 provider, pick one in the web app (model picker). Otherwise the provider key carries and the Agent runs as-is. |
| **Budget cap** | 2200 defaults a daily cost cap on migration (OpenClaw had no budget concept). Review it in the web app or the Identity file. |

## ⚠️ Not carried by design

- **Pub rooms / the Studio.** 2200 auto-provisions a fresh `studio` pub on this
  install and enrolls every Agent; OpenClaw room structure isn't imported. The
  Agent lands in the Studio automatically.
- **The OpenClaw runtime config itself** (beyond the credentials swept into the
  vault). 2200 is a different runtime; the persona + memories + keys are the
  durable parts, and they come over.

## Post-migration checklist (printed by the migration, repeated here)

- [ ] Bring the Agent up: `2200 daemon start`, then `2200 agent start <name>`.
- [ ] Confirm an LLM credential is set. The migrate flow copies OpenClaw
      provider keys into `~/.config/2200/runtime.env` by default; if you skipped
      that, sign in (`2200 oauth xai login` ... see [[grok-first-signin]]) or
      paste a key. One SuperGrok sign-in covers the whole fleet.
- [ ] Rebind the model if OpenClaw ran one 2200 has no provider for.
- [ ] Re-wire any non-Discord channels in the Extensions store.
- [ ] Review the budget cap.
- [ ] Once the Agent is confirmed working, **disable the source OpenClaw
      instance** so you're not paying twice (the exact commands are printed at
      the end of the migration).

## Notes

- The migration is **non-destructive to the source**: nothing is deleted from
  OpenClaw. The "disable the source" step is the last thing, and only after you
  confirm the 2200 Agent works.
- The migration report is the source of truth for a given run ... it names the
  exact file counts, credential count, and any provider/schedule it couldn't
  map. This page is the general shape; the report is your specific receipt.
