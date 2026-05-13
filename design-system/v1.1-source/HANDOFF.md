# 2200 · Design System Handoff

For Hobby (builder agent). This pairs with `2200 Design System.html`.
Open that file alongside this doc — every rule below is demonstrated live there.

---

## 1. What you're being given

Six files, all in this project's root:

| File | What it is |
| --- | --- |
| `2200 Design System.html`  | Entry point. Contains the full token system in `<style>` and loads everything else. |
| `ds-primitives.jsx`        | Atomic building blocks: `Pill`, `Dot`, `Avatar`, `Btn`, `Field`, `Code`, `Kbd`, `Meta`, `Tag`, `Swatch`, `Tile`. |
| `ds-components.jsx`        | Composed components: `Tabs`, `Segmented`, `Breadcrumb`, `ReactionBar`, `AgentCard`, `KVCard`, `PageHeader`, `AgentIdentityCard`, skeletons, etc. |
| `ds-chat.jsx`              | Chat surface: `ChatMessage`, `ChatComposer`, `ChatListRow`, `ChatTitleBar`, `Attachment`, `DayDivider`. |
| `ds-foundations.jsx`       | The doc sections themselves (color/type/space/motion). You don't reuse these — they're spec, not product. |
| `ds-screens.jsx`           | The mockup screens (Fleet, Studio, Agent, Chat, Inbox, Budget, Settings). Treat as **reference layouts**, not as code to lift — port their structure into our real routes. |
| `tweaks-panel.jsx`         | Dev-mode tweaks shell. Optional for production. |

When you build the real app, the **tokens block** (everything inside `:root` and `html.dark` in `2200 Design System.html`) is the only thing you need to copy verbatim. Everything else is a pattern to translate into our component layer.

---

## 2. The three rules you must not break

1. **Two voices, one rule.** Sans (`var(--ds-font-sans)`, Inter) for prose, headings, button labels, alert copy. Mono (`var(--ds-font-mono)`, JetBrains Mono) for breadcrumbs, eyebrows, pills, timestamps, paths, IDs, model names, env vars, kbd, raw values, code. If a value could be pasted into a terminal, it's mono.

2. **Green means alive.** `var(--accent)` appears on: the *running* pill, the primary button, the focus ring, progress fills, *ok* states, and send. **Never** decorative. Never a notification dot for unread chat, never a chart axis, never a "new" badge.

3. **Pills carry state. Tags carry identity.** Pills are mono lowercase with optional dot. Tags carry the agent hue. They look different on purpose; do not blend them.

---

## 3. Tokens

All design decisions resolve to CSS custom properties. Never hard-code a hex.

- **Theme:** `html.dark` flips dark mode. No JS required to apply theme — toggle the class.
- **Accent hue:** one integer, `--accent-h`. All accent shades derive via `oklch()`. To rebrand from green to anything, change one number.
- **Density:** `html[data-density="compact"]` collapses paddings without retokenizing.
- **Radius:** `html[data-radius="sharp" | "regular" | "soft"]` adjusts roundness.
- **Agent hues:** `--agent-1` through `--agent-6`. Assign by hashing the agent name (`name.charCodeAt` reduce mod 6 — the `agentHue()` helper in `ds-primitives.jsx` is canonical).

In-between shades: never invent. Use `color-mix(in oklch, var(--accent) 30%, var(--bg))`.

---

## 4. Information architecture

The web app's route map should match the screens in the design system:

```
/                          → Fleet (default)
/studio                    → Studio room
/agent/:name               → Agent · chat-first
/agent/:name/chat/:chatId  → Focused chat (full-bleed)
/agent/:name/brain         → Brain notes
/agent/:name/schedules     → Cron + timers
/agent/:name/tools         → MCP servers + tool health
/inbox                     → Notifications
/budget                    → Spend
/settings                  → Theme + providers
```

The `Agent` screen leads with chat. The left rail (260px) is identity + chat list + quick links to the routes above. The main pane is the active chat with full scroll history.

---

## 5. Chat surface — the most important new pattern

Every agent has unlimited chats, persistent like Claude conversations.

**Data model (suggested):**

```ts
type Chat = {
  id: string;
  agent: string;            // agent name
  title: string;            // editable; default: first 6 words of first message
  createdAt: string;        // ISO
  updatedAt: string;        // ISO — sort the list by this DESC
  unread: boolean;
  archived: boolean;
  messages: Message[];      // chronological
};

type Message = {
  id: string;
  chatId: string;
  from: 'you' | 'agent';
  body: string;             // markdown supported
  time: string;             // ISO
  attachments: Attachment[];
  mode?: 'pure' | 'checkpointed' | 'destructive'; // mirrors what was selected at send
  thinking?: boolean;       // optimistic placeholder while agent is computing
};

type Attachment = {
  id: string;
  kind: 'file' | 'image';
  name: string;
  size?: number;            // bytes
  src?: string;             // for images, object URL or remote
  mime: string;
};
```

**UI contract:**
- Composer's tray is hidden when there are no attachments, visible the moment one arrives. `+` opens the picker; the textarea also accepts paste of images and drag-and-drop.
- Mode segmented control applies to the **next message only**, then defaults back to `checkpointed`.
- A `thinking` message renders the bubble with the blinking-dots indicator. Replace it in place when the real response arrives.
- Day dividers appear when the date changes between two adjacent messages.
- Unread is a green dot on the chat-list row; clear on focus.

---

## 6. Recommended porting order

1. Copy the `<style>` token block into our global stylesheet. Verify dark mode flips by toggling `html.dark`.
2. Port `Pill`, `Dot`, `Avatar`, `Btn`, `Tag`, `Meta`, `Code`, `Kbd` first. Most other components compose these.
3. Port `Breadcrumb` + `PageHeader` and apply to every existing route. This alone will make the app feel new.
4. Port `AgentCard`, `KVCard`, `Tabs`, `Segmented`.
5. Build the chat surface: `ChatMessage`, `ChatComposer`, `Attachment`, `ChatListRow`, `ChatTitleBar`, `DayDivider`. Wire to the existing `/agent/:name` route, replacing the current task-form layout.
6. Port the remaining screens (Inbox, Budget, Settings) by lifting their structure from `ds-screens.jsx`.

---

## 7. Things the design system does **not** answer yet — ask me before guessing

- Slash-command surface inside the composer
- Code-block / markdown rendering inside `ChatMessage` (currently bubble is plain prose)
- Per-chat settings panel (model override, system prompt, tools allow-list)
- A fleet-wide "all chats" search
- Sharing a chat with another agent or with a room
- Spawn-agent flow

I'll design these when we get there. Don't invent them.

---

## 8. North star

> If a Normal can't operate the screen without explanation, the screen is wrong.
> If a Developer can't override every behaviour, the screen is also wrong.

Build for the first. Expose for the second.

— Doug
