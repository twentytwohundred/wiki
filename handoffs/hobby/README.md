---
title: Hobby's handoffs
type: index
status: active
tags: [index, handoffs, hobby]
created: 2026-04-29
canonical_path: wiki/handoffs/hobby/README.md
---

# Hobby's handoffs ... index

Daily session handoffs from Hobby (the primary build Agent on 2200). The format is documented at [[../../conventions/handoff-format]]. This index gives a one-line orientation per day; click in for detail.

The first action of every new session is to read the most recent handoff. That session ends by writing a new one. The wiki is public; this stream is the build-in-public artifact.

## 2026

### April

| Date | File | What happened |
|---|---|---|
| 2026-04-24 (s1) | [[2026-04-24]] | Onboarding day. Read all wiki seed docs. Surveyed OpenClaw + Perplexity Computer prior art. Drafted `prior-art-analysis.md` v0.1 with eight proposed epic-map changes. Strategic-framing checkpoint before going deeper. |
| 2026-04-24 (s2) | [[2026-04-24-2]] | Four decision records locked: cost-behavior-shape, runtime-upgrade-shape, bulletin-substrate-is-scut, brain-is-files-not-database. Two new conventions. |
| 2026-04-25 | [[2026-04-25]] | Three decisions locked from Doug's inbox reply: mcp-native, tool-baseline, skills-first-class. Architecture v0.4. Epic 2 spec drafted (full scope: supervisor, Agent loop, Identity loader, MCP-native tools, plan/run/perm wrapping). |
| 2026-04-26 (s1) | [[2026-04-26]] | Phase 2 polish + heaviest continuous build sequence so far. Five Mermaid diagrams added. Org profile README. Status badges. GitHub presence + voice polish pass. |
| 2026-04-26 (s2) | [[2026-04-26-2]] | Epic 3 day. Spec drafted; contract loop with Poe; Doug's Flag B decision locked (LOCAL default, single OpenPub codebase). Three PRs stacked, CI green. Poe shipped v0.3.2 in twenty minutes after a concrete pluggable-issuer proposal. |
| 2026-04-27 | [[2026-04-27]] | Closed five epics in one sitting (3, 3.5, 3.6, 3.7, 3.8). Two agents collaborating cleanly without a politeness spiral. Multi-LLM-provider routing wired (Anthropic + 5 OpenAI-compatible). Ack-spiral structural guards. |
| 2026-04-28 | [[2026-04-28]] | Epic 4 Phase A (SCUT identity at spawn) v0.4 lock. Epic 6 (scheduler). Epic 7 Phase A (notifications + ask). Epic 8 Phase A (Agent brain with FTS5). |
| 2026-04-29 (s1) | [[2026-04-29]] | Three Phase-A epics shipped end-to-end across 13 PRs: Epic 5 (Migration), Epic 9 Phase A (Tool system substrate), Epic 14 Phase A (Conversational onboarding via `2200 agent spawn`). Theme-aware-from-v1 decision locked. Wiki cleanup (collapsed three github surfaces to one canonical wiki). 865 tests / 72 files. |
| 2026-04-29 (s2) | [[2026-04-29-session-2]] | Design system v0.3 from Claude Design relocated into `wiki/design-system/`. Three substrate docs drafted: Epic 15 spec, runtime-api convention, theme-format convention. First Epic 15 scaffold PR (#90) shipped: pnpm workspace + apps/web/ Vite+React+TS bootstrap. Boundary discipline mechanically enforced via lint. |
| 2026-04-29 (s3) | [[2026-04-29-session-3]] | Epic 15 Phase A substrate marathon. Five PRs (#90-#94): tokens generator + ThemeProvider; primitives library + /dev/components page; runtime HTTP server with bearer auth + 2200 web CLI; API client + WebSocket subscription + live Fleet screen. Headline criterion (Agent state change pulses Fleet without refresh) is exercisable end-to-end. Agent detail / Inbox / ⌘K deferred for next session. 884 runtime tests + 64 web tests = 948 total. |

## How to add to this index

When you write a new handoff:

1. Save the handoff at `wiki/handoffs/hobby/YYYY-MM-DD.md` (or `YYYY-MM-DD-session-N.md` for second-or-later sessions in a day).
2. Add a row to the table above with date, file link, and a one-line "what happened" summary.
3. Commit both files in the same commit.

The index is hand-maintained, not generated. Order is chronological with newest at the bottom of each month so older entries don't move when new ones land.

## Companion streams

- **State snapshots:** [[../../state]] ... daily snapshots of project state (separate stream from handoffs; lighter-weight).
- **Decisions locked:** [[../../decisions]] ... the canonical decision records.
- **Per-Agent inboxes:** [[../../inbox]] ... messages between seed-team Agents and Doug.
