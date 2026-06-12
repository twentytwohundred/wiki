---
title: "Epic 5 Phase B: OpenClaw migration adapter"
type: epic-spec
status: in-progress
tags: [epic-5, migration, openclaw, adoption]
created: 2026-06-12
canonical_path: wiki/epics/05-phase-b-openclaw-adapter.md
linked_docs:
  - "[[05-migration]]"
---

# Epic 5 Phase B: OpenClaw migration adapter

**v0.1 · 2026-06-12 · spec'd against a live survey of Skippy's OpenClaw 2026.4.11 instance on valkyrie. First migration target: Skippy (seed-team order). Second: Geoff's OC server (first external user).**

## Why

Epic 5 Phase A reserved "per-source adapters that read state from common Agent systems and produce a compatible handoff." OpenClaw is the adapter that matters: it is the system 2200 positions against, its users are 2200's most likely early adopters, and two concrete migrations are already queued. One command should take an OC home directory and produce a working 2200 Agent with continuity.

## Source format (OpenClaw 2026.4.11, surveyed 2026-06-12)

| OC artifact | Shape | 2200 destination |
|---|---|---|
| `workspace/SOUL.md` | markdown persona | Identity **body** (verbatim) via new `persona_body` handoff field |
| `workspace/IDENTITY.md` | KV markdown (Name / Creature / Vibe / Emoji / Avatar) | `agent_name` (lowercased Name), `display_name` (Name), `agent_role` (Creature), avatar glyph (Emoji) |
| `workspace/memory/YYYY-MM-DD.md` | daily markdown memory | brain bulk-import (`brain.source_dir`) |
| `workspace/{USER,AGENTS,TOOLS,HEARTBEAT}.md` | operating docs | brain `inline_notes`, tagged `openclaw-import` (review-worthy, not authoritative in 2200) |
| `cron/jobs.json` | jobs: `schedule.{kind:cron,expr,tz}`, `payload.{kind:agentTurn,message}`, `enabled` | 2200 schedules (5-field cron + IANA tz map 1:1) |
| `openclaw.json` → `agents.defaults.model.primary` | `provider/model_id` | Identity model binding when the provider exists in 2200's catalog; else default + report |
| `openclaw.json` → `channels` | per-platform configs incl. tokens | **not migrated**; report maps each channel to its 2200 connector (discord/whatsapp exist) with re-auth instructions |
| `workspace/skills/` | skill dirs | **not migrated v1**; report points at Epic 11 ingestion |
| `agents/main/sessions/*.jsonl` | session transcripts (v3 typed lines) | **not migrated v1**; counted in report |
| `memory/main.sqlite` | OC memory index | ignored (2200 rebuilds FTS5 from imported markdown) |
| `auth-profiles.json`, `env`, channel tokens | credentials | **never migrated** ... operators re-auth inside 2200 |

## Shape

`2200 agent migrate --from-openclaw <oc-home-dir> [--name <n>] [--daily-cap-usd <usd>] [--dry-run] [--force] [--provision-identity]`

Three layers, reusing Phase A end-to-end:

1. **Survey** (`surveyOpenClawHome`): tolerant reader of the OC home; returns a typed survey. Reads no secret values.
2. **Convert** (`openclawToHandoff`): survey → in-memory `HandoffDocument` + markdown **migration report** (what mapped, what didn't, what to do next). The report is also appended to the continuity note body so the Agent itself knows what didn't come along.
3. **Existing orchestrator** (`migrateFromHandoff`): identity build + agent registration + brain import + continuity note + notification ... unchanged path, same guarantees.

`--dry-run` prints the report and the would-be handoff without touching state ... the operator's preview before the real run.

## Substrate changes this phase makes (handoff schema stays v1)

- **`persona_body`** (optional) on the handoff frontmatter; `buildIdentityFromHandoff` uses it as the Identity body when present. This implements what the Phase A doc comment already promised.
- **Schedules constraint lifted** (the planned Phase A2): `schedules: []` max-0 restriction removed; the orchestrator imports entries via `createSchedule` after agent registration and reports `schedules_imported_count`. The schema shape was designed for this flip ("without a schema bump").

## Done when

Skippy migrates from valkyrie into Doug's 2200 instance with: SOUL.md as his Identity body, his daily memories searchable in his brain, his enabled cron jobs firing on 2200's scheduler, a continuity note + migration report explaining what changed, and zero credentials copied. Then the same command, run against Geoff's OC home, produces the same outcome for someone who isn't us.

## Out of scope (reported, not silently dropped)

Channel tokens and re-auth, OC skills ingestion (Epic 11 path), session-transcript import (possible later as opt-in brain notes), multi-agent OC homes (Skippy's is single-`main`; revisit when a real multi-agent OC home shows up).
