---
title: "Design system v1.1 port: chat-first IA, accent-driven tokens, multi-chat substrate"
type: decision
status: accepted
date: 2026-05-13
tags: [decision, design-system, web, runtime, chat, tokens, v1.1]
linked_docs:
  - "[[../handoffs/hobby/2026-05-13]]"
  - "[[2026-05-12-incomplete-turn-detector]]"
  - "[[2026-05-13-claim-vs-evidence-audit]]"
canonical_path: wiki/decisions/2026-05-13-design-system-v1.1-port.md
---

# Design system v1.1 port

## Context

The session-19 reframe (2026-05-13 afternoon) was Doug's call after looking at the design-system-v1.1 package he assembled overnight:

> If we fix the UX for me, the rest of it will feel more useful and then we tweak the underlying code to work within this system. This will give us additional tools to display as well that'll make it easier for me to get you data ... I do better when I have a prototype and can go click-by-click through what it is we want to make work, rather than explaining what I want the screen to look like and then backing into the functionality.

That's a deliberate inversion of the CLAUDE.md "runtime first, UI last" build principle for UX-shaped work: deliver the clickable surface first, let Doug navigate it, then wire the deeper behavior. Saved as feedback memory `feedback_design_first_workflow.md`.

Doug authorized gating v1 on this port (PR #193 stays pending the new surface), with the audit work from `2026-05-13-claim-vs-evidence-audit.md` paused until the design lands.

## Decisions

### 1. Token system: v1.1 shape, --ds-* + unprefixed semantic + accent-h

The canonical wiki/design-system/tokens.json was rewritten from the v0.3 schema (uniformly category-prefixed: `--color-*`, `--type-*`, `--space-*`, `--radius-*`) to the v1.1 shape (split system vs semantic):

- `--ds-*` for system primitives: `--ds-font-sans`, `--ds-text-md`, `--ds-1` ... `--ds-20`, `--ds-r-1` ... `--ds-r-pill`, `--ds-ease`, `--ds-dur-fast/`(normal)`/-slow`, `--ds-row-h`, `--ds-pad-x`, `--ds-pad-y`.
- Unprefixed semantic surface: `--bg`, `--bg-elev`, `--bg-sunk`, `--bg-hover`, `--line`, `--line-soft`, `--line-strong`, `--text`, `--text-2/3/4`, `--accent`, `--accent-strong/soft/ink`, `--on-accent`, `--danger`, `--warn`, `--info` (each with `-soft` variants), `--shadow-1/2/pop`, `--focus`.
- Single accent hue: `--accent-h: 150` drives every accent shade via `oklch(... var(--accent-h))`. Change one integer to rebrand.
- Density and radius preset modifiers: `html[data-density="compact"]` and `html[data-radius="sharp"|"soft"]`.
- Agent palette compressed from 12 hues to 6 (per design-system-v1.1 spec); hash function is `name.charCodeAt sum mod 6`. The class-mapped `.agent-c0` ... `.agent-c5` still sets `--agent-color` so existing component CSS reads it uniformly.

Theme application: light is the default in `:root`; dark is applied by toggling the `dark` class on `<html>` (replacing the prior `.theme-dark` / `.theme-light` class pair). ThemeProvider, types, and tests updated to match.

### 2. Multi-chat substrate: JSONL on disk, one file per thread

Per-Agent multi-thread chat lands at `<2200_HOME>/agents/<name>/chats/`:

- `index.json` ... chat metadata (id, title, created_at, updated_at, unread, archived, snippet, last_user_at). Atomically rewritten on every metadata change (temp file + rename).
- `<chat-id>.jsonl` ... append-only message log. Each line is one ChatMessageRecord (id, chat_id, ts, role, body, mode, attachments, task_id).
- `<chat-id>/attachments/<att-id>-<safe-name>` ... attachment bytes on disk. Referenced from message records by id.

The legacy single-thread `chat.jsonl` is migrated transparently. The first time MultiChatStore reads an agent that has a legacy chat.jsonl, it surfaces it as a chat with id `default` in index.json (no destructive moves; the legacy file is left untouched). When the modern `default.jsonl` is empty, listMessages reads the legacy file and translates each record on the fly. This keeps existing `chat_send`-using agents working without modification.

**Why JSONL + index.json and not SQLite:** matches the "files on disk a human can `cat`" property of the brain dir. No split-brain with a binary db. Doug can `cat <home>/agents/jodin/chats/<id>.jsonl` to read what was said, `jq` over it for analysis, and the index.json is small enough to eyeball.

### 3. HTTP + WS surface

Additive to the existing single-thread endpoints (which remain for the legacy `chat_send` tool path):

- `GET /api/v1/agents/:name/chats` ... list threads.
- `POST /api/v1/agents/:name/chats` ... create.
- `GET /api/v1/agents/:name/chats/:chatId` ... thread metadata.
- `PATCH /api/v1/agents/:name/chats/:chatId` ... rename.
- `POST /api/v1/agents/:name/chats/:chatId/archive` ... archive/unarchive.
- `POST /api/v1/agents/:name/chats/:chatId/read` ... clear unread.
- `GET /api/v1/agents/:name/chats/:chatId/messages` ... list messages.
- `POST /api/v1/agents/:name/chats/:chatId/messages` ... append + spawn task. The task's idempotency is set from the composer's mode (pure / checkpointed / destructive).
- `POST /api/v1/agents/:name/chats/:chatId/attachments` ... base64-inline upload (~11MB cap). Returns `{ id, url, kind, name, size, mime }`.
- `GET /api/v1/agents/:name/chats/:chatId/attachments/:attId/:filename` ... serve.

WS events broadcast on every chat mutation: `chat.message`, `chat.created`, `chat.renamed`, `chat.archived`, `chat.read`. Useable from `useLiveSignal` which auto-invalidates TanStack Query keys (`['agentChats', name]`, `['agentChatMessages', name, chatId]`).

The watch-and-append-reply pattern from the legacy single-chat path was duplicated for multi-chat (`watchAndAppendChatThreadReply`): polls the task store; when terminal, appends an assistant message into the thread + broadcasts.

### 4. New primitives: Tag, Code, Kbd, Meta, Dot, Field, Breadcrumb

Built as CSS-module-plus-TSX pairs (matching the existing `apps/web/src/primitives/` pattern):

- `Tag` ... identity chip with agent-hashed hue dot. Used for @mentions.
- `Code` ... inline mono code (subtle bg + border).
- `Kbd` ... keycap. Renders ⌘, ⏎, etc.
- `Meta` ... mono-uppercase eyebrow label.
- `Dot` ... status dot. Pulse animation honoured only for `running` (the alive signal).
- `Field` ... labeled input/textarea wrapper.
- `Breadcrumb` ... mono path crumbs separated by `·`. Used at the top of every redesigned screen.

Pill's text-transform flipped from uppercase to lowercase per the v1.1 spec (the design-system docs page describes pills as "mono lowercase with optional dot"). Letter-spacing dropped from 0.1em to 0.02em.

### 5. Agent screen rewrite

The 1204-line `AgentDetailScreen.tsx` was replaced with a chat-first layout:

- Header: Breadcrumb · Title · Status Pill · Actions (← Fleet, Stop, ThemeSwitcher).
- 260px left rail: identity block (avatar + name + model + New chat) + chat list + More links (Brain, Schedules, Tools).
- Main pane: ChatTitleBar + scrolling messages + ChatComposer.
- Empty state when no chat is selected: "Start your first chat with <agent>".

Routes:
- `/agent/:name` ... auto-selects the most-recent non-archived chat, or empty state.
- `/agent/:name/chat/:chatId` ... selects a specific chat (same component, different route).

Live updates: WS `chat.message` → invalidates the active chat's messages query. WS `chat.created/renamed/archived/read` → invalidates the chat list. Read state clears on focus (`/api/v1/.../read` posted when activeChatId changes).

### 6. Other screens

Fleet/Studio/Inbox/Budget/Settings were NOT rewritten in this port. The token migration alone carries the visual: every CSS module + every TSX inline style was sed-migrated from the v0.3 token names to v1.1. The 27 CSS modules now read `--bg`, `--accent`, `--ds-*`, etc. Letter-spacing, lowercase pills, the new neutral elevation chain ... all carry through.

Targeted touch-ups landed where pill labels were uppercase in TS source: `FleetScreen.pillLabel` was lowercased (the new Pill CSS handles the rest).

Remaining screen-level polish (breadcrumb adoption, action-button repositioning, Inbox focused-detail layout) lands in the demo cycle Doug requested.

## Token migration mapping (for reference)

For future archeology / cleanup of any code that escaped the migration:

| v0.3 token | v1.1 replacement |
|---|---|
| `--type-family-sans` | `--ds-font-sans` |
| `--type-family-mono` | `--ds-font-mono` |
| `--space-1..6` | `--ds-1..6` |
| `--space-7..10` | `--ds-8`, `--ds-10`, `--ds-16`, `--ds-20` |
| `--radius-sm/md/lg/pill` | `--ds-r-1/2/3/pill` |
| `--duration-fast/normal/slow` | `--ds-dur-fast/`/`-slow` |
| `--ease-out`, `--ease-in-out` | `--ds-ease` |
| `--shadow-elevation-1/2` | `--shadow-1/2` |
| `--color-bg-primary` | `--bg` |
| `--color-bg-secondary/elevated` | `--bg-elev` |
| `--color-bg-hover` | `--bg-hover` |
| `--color-bg-inset` | `--bg-sunk` |
| `--color-bg-overlay` | `--bg-elev` (no direct equivalent) |
| `--color-border-default` | `--line` |
| `--color-border-emphasis/strong` | `--line-strong` |
| `--color-border-subtle` | `--line-soft` (was undefined in v0.3) |
| `--color-divider` | `--line-soft` |
| `--color-text-primary/secondary/muted/disabled` | `--text`, `--text-2/3/4` |
| `--color-text-inverse` | `--on-accent` |
| `--color-status-running` | `--accent` |
| `--color-status-running-bg` | `--accent-soft` |
| `--color-status-attention(-bg)` | `--warn(-soft)` |
| `--color-status-error(-bg)` | `--danger(-soft)` |
| `--color-status-info(-bg)` | `--info(-soft)` |
| `--color-accent(-bg/-fg)` | `--accent`, `--accent-soft`, `--on-accent` |
| `--color-focus-ring` | `--accent` (or full `var(--focus)` box-shadow) |
| 12-bucket agent palette `agent-c0..11` | 6-bucket `agent-c0..5` → `--agent-1..6` |

## Verification

- `pnpm --filter @twentytwohundred/web run verify`: typecheck + lint + format + 86 tests + production build all clean.
- `pnpm verify` (runtime): typecheck + lint + format + build clean; 1389/1390 tests pass. The single failure is the pre-existing scheduler-integration parallel-test flake (see session-17/18 handoffs); passes in isolation.

## Scope ... out of scope (lands in demo cycle)

- Breadcrumb adoption on Fleet/Studio/Inbox/Budget/Settings.
- Action-button repositioning in screen headers per the design-system mockups.
- Inbox focused-detail pane layout (currently uses existing two-column grid).
- Budget redesign with the larger fleet-today card per the screenshot.
- Settings rework with the ProviderRow shape.
- The v1.x claim-vs-evidence audit (paused; spec at `[[2026-05-13-claim-vs-evidence-audit]]`).
- Supervisor-side audit (the "from this side" framing Doug raised pre-design-pivot): paused, queued behind the demo cycle.

## Files changed (summary)

Wiki:
- `wiki/design-system/tokens.json` (full rewrite)

Code (runtime):
- `apps/web/scripts/generate-tokens.ts` (new schema; emits 3 files instead of 4)
- `src/runtime/agent/chat/multi-store.ts` (new)
- `src/runtime/storage/layout.ts` (chatsDir, chatsIndex, agentChatThreadPath, agentChatAttachmentsDir helpers)
- `src/runtime/http/server.ts` (new multi-chat endpoints + WS broadcast)
- `apps/web/src/tokens/source/tokens.json` (vendored)
- `apps/web/src/tokens/generated/*.css` (regenerated)
- `apps/web/src/main.tsx`, `main.css` (theme imports + body styles)
- `apps/web/src/theme/types.ts`, `ThemeProvider.tsx` (html.dark instead of theme-dark/theme-light)
- `apps/web/src/ws/useLiveSignal.tsx` (chat event handling)
- `apps/web/src/lib/api.ts` (new chat types + API methods)
- `apps/web/src/router.tsx` (new focused-chat route)
- `apps/web/src/primitives/` (added: Tag, Code, Kbd, Meta, Dot, Field, Breadcrumb; updated: Pill, agentColorClass)
- `apps/web/src/chat/` (new dir: Attachment, ChatMessage, ChatComposer, ChatListRow, ChatTitleBar, DayDivider, index)
- `apps/web/src/screens/agent/AgentDetailScreen.{tsx,module.css}` (full rewrite)
- 27 CSS modules + 5 TSX inline styles (bulk sed migration)
- Tests: generate-tokens, ThemeProvider, agentColorClass (all rewritten for v1.1 shape)

## Decisions explicitly NOT made

- **Slash-command surface inside the composer:** deferred per the design-system handoff §7. The composer's textarea accepts plain text; the design-system docs reserve `/command` for later.
- **Per-chat settings panel (model override, system prompt, tools allow-list):** deferred.
- **Fleet-wide chat search:** deferred.
- **Cross-Agent / cross-room chat sharing:** deferred.

These come up in the post-port demo cycle. Doug will surface them via clickthrough.
