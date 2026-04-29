---
title: 2200 Design Brief
type: design-brief
status: v0.1 draft
audience: Claude Design (Opus)
created: 2026-04-29
canonical_path: wiki/design-system/2200-design-brief.md
---

# 2200 — Design Brief

## What is 2200

2200 is the runtime where AI Agents live, work, and get supervised. Users define Agents through conversation, the runtime spawns them, and the Agents do real work on the user's behalf... reading email, managing schedules, trading on markets, curating playlists, building software, running a business. Each user operates a fleet of Agents simultaneously. 2200 is the operations surface for that fleet.

This is open infrastructure for the Agent economy. Every Agent on 2200 has a verifiable on-chain identity (SCUT), can coordinate with Agents on other 2200 instances, and runs on user-controlled hardware or hosted infrastructure. The runtime is open source. The protocols are open. The design has a point of view that the closed AI platforms (Anthropic Claude.ai, OpenAI ChatGPT, Google Gemini) structurally cannot match.

## The opinion the product has

**This is fleet operations, not chat.**

Every existing AI interface starts from the same primitive: a chat input at the bottom, a response stream above, a sidebar with chat history. That primitive is wrong for 2200. 2200's primitive is a roster of Agents working in parallel, each with their own context, schedule, budget, and tasks. The user is supervising a fleet, not conversing with one assistant.

The design must reflect this. The home screen is not a chat. It is the operations dashboard. Chat surfaces exist for individual Agents and for shared pubs, but they are part of the UI, not its center.

This is the positioning the incumbents cannot copy without rebuilding their entire frontend. The design must lean into it.

## Who uses 2200

Two audiences, often the same person at different times:

**Power users (builders, operators, technical founders).** They run 5-15 Agents. They live in the dashboard. They want density, keyboard navigation, command palette access, real-time signal. They will judge the product on whether it respects their time and intelligence. They expect dark mode, monospace where it matters, and zero hand-holding.

**Normal users (knowledge workers, professionals, curious early adopters).** They run 1-3 Agents. They open the app once or twice a day, glance at notifications, respond to pending asks, occasionally chat with a specific Agent. They will judge the product on whether they can figure out what is happening without reading documentation. They need light mode, clear language, and progressive disclosure.

Both audiences must feel the product was designed for them. The design must serve power users without alienating normals, and serve normals without feeling dumbed-down to power users.

## Aesthetic direction

**Premium without ornament.** The design should look mostly black, white, and gray, with color used as semantic signal only. Color should mean something specific (green: healthy/running, amber: attention needed, red: error/blocked). Color used decoratively reads as cheap.

**Information density without clutter.** Power users want to see a lot at once. The way to thread density is progressive disclosure: the default view shows essential signals, one click reveals depth, one more click reveals detail. Three clicks should not be required to reach anything important.

**Typography as the primary brand element.** JetBrains Mono for data, identifiers, code, terminal output, status indicators, timestamps, costs. Inter (or similar high-quality sans) for prose, headings, conversational text. The two-typeface system signals "this is for builders" without screaming it.

**Motion as information, not flair.** State changes should be immediate. Loading states should be honest (skeleton screens for known shapes, spinners only when truly indeterminate). Animations should be reserved for moments that communicate something: a task moving from queued to running, a notification arriving, a budget hitting threshold. Restraint in motion reads as confidence.

**Dark mode is canonical.** Design dark first. Get it right. Then translate to light mode. Light mode is for users who default-prefer it; dark mode is the "real" experience.

## References to extract from

- **Linear** — dark-first aesthetic, motion restraint, density-with-clarity, keyboard-first navigation, command palette, the way they treat status indicators
- **Stripe Dashboard** — financial clarity, data tables, color-as-signal, the way they make money legible
- **Bloomberg Terminal** — density-information-first, multi-pane layouts, real-time signal (aesthetic should be cleaner than Bloomberg, but the philosophy applies)
- **Raycast** — command palette pattern, keyboard-first power-user features, fast access to everything
- **Things 3** — the "operations app" feel where the user trusts the tool with their work; calm despite complexity

## References to avoid

- **Anthropic Claude.ai** — chat-shaped surface, single-conversation primitive, anonymous polish without point of view
- **OpenAI ChatGPT** — cluttered, sidebar-heavy, designed for one-AI-at-a-time
- **Google Gemini** — committee-design aesthetic, generic Material patterns
- **Copilot, Perplexity, generic AI dashboards** — the entire "I asked an AI to design an AI app" look
- **Bootstrap-default everything** — rounded corners on every element, gradient buttons, default Tailwind colors

The design must not look AI-designed. The way to avoid this is opinionated choices, restrained palette, custom typography hierarchy, and density that AI defaults rarely produce.

## Non-negotiables

- JetBrains Mono for: data, identifiers, code, terminal output, status pills, timestamps, costs, IDs, paths
- Inter (or similar quality sans-serif) for: prose, headings, button labels, conversational text, navigation labels
- Color is semantic: green = healthy/running, amber = attention needed, red = error/blocked, blue = informational/link, neutral grays for everything else
- Dark mode and light mode both required, both at full quality
- Mobile-aware design (works at 375px wide) but desktop-first (designed for 1440px and up)
- No emojis in UI chrome (they are fine in user-generated content)
- No gradient buttons, no drop shadows beyond minimal elevation, no rounded corners larger than 6px on any element
- No animation longer than 200ms for state transitions
- Density target: fleet view shows 8-12 Agents at once on a 1440px screen without horizontal scroll

## The six core screens

These six screens carry the weight of the v1 product. Each must be designed in both dark and light mode.

### 1. Fleet view (home screen)

**Purpose.** What is happening across the entire Agent fleet right now.

**Who looks at it.** Power users live here. Normals glance at it before going to notifications.

**Design priority.** Density without clutter. Status legibility at a glance. The Bloomberg-terminal moment.

**Must show.**
- Each Agent in the fleet (8-12 visible at once on desktop)
- Per Agent: name, current status (idle/running/blocked/errored), current task summary, today's cost, last activity timestamp
- Aggregate signals: total Agents running, total cost today, pending notifications count, blocked Agents count
- Quick filter: all / running / blocked / idle
- Click an Agent to go to Agent detail

**Density target.** A user with 10 Agents should see all of them on one screen without scrolling.

### 2. Agent detail

**Purpose.** Everything about one Agent in one place.

**Who looks at it.** Both audiences. Power users for diagnostics, normals to understand what the Agent is doing.

**Design priority.** Comprehensive without overwhelming. Clear information hierarchy.

**Must show.**
- Agent name, identity (SCUT URI), current status
- Current task with progress signal
- Recent activity timeline (last 10-20 events)
- Brain notes preview (most recent 3-5)
- Schedule (next 3-5 firings)
- Budget (today's spend, cap, percentage used)
- Configured tools and capabilities
- Quick actions: pause, resume, send task, view all brain notes, edit identity

### 3. Notification inbox

**Purpose.** The user's primary workspace once Agents are running. Pending asks, status updates, threshold warnings.

**Who looks at it.** Both audiences, frequently. This is the highest-traffic surface after the fleet view.

**Design priority.** Pending asks must be impossible to miss. Tier should be color-coded but not screaming. Actionable from this screen without navigating away.

**Must show.**
- Pending asks pinned at top, sorted by tier (critical first, then important, normal, passive)
- Recent answered/dismissed notifications below, collapsible
- Per notification: Agent, tier (color-coded), question/message, timestamp, action buttons (respond, dismiss, snooze)
- Inline response for simple asks (yes/no, single-line input)
- Modal for complex responses
- Filter by Agent, tier, state

### 4. Conversational onboarding

**Purpose.** The David screen. First impression for every new user. The conversation that creates a new Agent.

**Who looks at it.** Every user, every time they create an Agent. Especially every first-time user.

**Design priority.** This is the most craft-intensive surface in the product. It must feel like a thoughtful interviewer, not a form. Pacing matters. White space matters. Every word matters.

**Must show.**
- Conversation thread between user and onboarding meta-Agent
- Clean message bubbles, generous whitespace
- Inline forms when the conversation requires structured input (tool selection, schedule preferences)
- Preview pane on the right (desktop) or progressive (mobile) showing the Identity being constructed
- Final preview before Agent creation with edit affordances
- "Create Agent" as the only commit action

This screen will be the product's first impression for every user. Treat it accordingly.

### 5. Pub view

**Purpose.** The shared chat surface where humans and Agents coordinate. Multiple Agents in the room.

**Who looks at it.** Both audiences, especially in multi-Agent workflows.

**Design priority.** Slack-shaped layout, but with Agents as first-class participants. Mention routing visible. Each Agent's persona discernible at a glance.

**Must show.**
- Message thread with Agent and human messages clearly distinguished
- Agent avatars/icons (configurable per Agent)
- Mention routing (@agent triggers visible feedback)
- Message composer at bottom with mention autocomplete
- Sidebar: pub members (humans + Agents), pub settings
- Reactions on messages
- Timestamp on hover

### 6. Budget / usage view

**Purpose.** Cost transparency. What did the fleet cost, broken down by everything.

**Who looks at it.** Power users frequently, normals when they get a bill.

**Design priority.** Stripe-quality clarity on financial data. Honest, legible, not buried.

**Must show.**
- Today's total cost as the largest typography on the page
- Breakdown by Agent (table, sortable)
- Breakdown by provider (Anthropic, DeepSeek, OpenAI, etc.)
- Time series chart: cost over last 7/30 days
- Per-Agent budget caps with usage bars
- Override controls for budget caps (with confirmation)
- Export to CSV

## Component primitives needed

The design system should produce these components, not just screens. Each in dark and light mode.

**Forms.** Text input, search input, select, multi-select, checkbox, radio, toggle, textarea, date picker.

**Buttons.** Primary, secondary, ghost, destructive, icon-only. Three sizes (small, medium, large).

**Display.** Cards, modals, drawers, tabs, accordion, tooltip, popover, badge, avatar, status pill.

**Navigation.** Top nav, side nav, breadcrumbs, pagination, command palette.

**Data.** Tables (data-dense, sortable, filterable), lists, key-value displays, progress bars, sparklines, time-series charts, breakdown charts.

**Feedback.** Toast notifications, banner alerts, empty states, error states, loading states (skeleton + spinner), success confirmations.

**Typography.** Display, headings (H1-H4), body (regular, small, tiny), labels, code (mono), data (mono).

## Specific runtime primitives the UI must respect

The runtime already has these concepts. The UI should design around them, not invent new ones.

- **Agent.** Has Identity (markdown + frontmatter), brain (markdown notes), schedules (cron/interval), budget (daily cap, override), tools (configured per Agent), SCUT URI (cross-instance identity).
- **Task.** Has state (pending, running, done, errored, blocked_on_detector). Has cost. Has duration.
- **Notification.** Has tier (passive, normal, important, critical). Has state (pending, answered, dismissed, expired).
- **Pub.** Multi-participant chat. Members can be humans or Agents. Has roster.
- **Schedule.** Cron or interval. Catch-up policy. Per-Agent.
- **Brain note.** Markdown file with frontmatter. Slug-based. Tags. Links via `[[slug]]`.

## Command palette (Cmd-K)

Power-user feature. High leverage for the "feels at home for power users" requirement. Linear, Raycast, Slack, GitHub, Notion all have this. It is the signal that the design considered how power users actually work.

Must support: navigate to any Agent, open notifications, view fleet, view budget, create new Agent, send task to Agent, search brain across fleet, switch dark/light mode.

## What is NOT in v1

Skip these from the design entirely:
- Settings maze (settings inline where they apply, not a separate surface)
- Marketplace browser (Skills/Extensions browser is its own surface, not in primary nav at v1)
- Help center / docs surface (docs live at 2200.ai or in the wiki)
- Gamification / achievements / streaks
- Onboarding tour for the fleet view (the fleet view should be self-explanatory)

## Output expectations

Deliver in this order:

**1. Design system tokens.** Color palette (semantic + neutral), typography scale (mono + sans), spacing scale, border radius scale, shadow scale (minimal), z-index scale.

**2. Component library specs.** Every primitive in the list above, in dark and light mode, with all states (default, hover, focus, active, disabled, error, success).

**3. The six core screens.** Both dark and light mode. Both desktop (1440px) and mobile (375px) where the screen exists on both.

**4. Command palette spec.** Layout, behavior, default actions.

**5. A short design philosophy doc.** Two pages explaining the opinions baked into the system, so future implementers can extend it without breaking the voice.

## Final note

The product must not look AI-designed. The way to avoid this is opinionated choices, restrained palette, custom typography hierarchy, density that AI defaults rarely produce, and iteration past the first generation.

The user (Doug) will iterate against the output until the AI-designed feel is gone. The first generation is a starting point, not a deliverable. Expect 3-5 rounds of refinement on each screen.

The bar is premium. Anthropic, OpenAI, and Gemini are all polished but anonymous. 2200 should feel like it was designed by someone with a strong opinion about what the Agent economy should look like... because it is.
