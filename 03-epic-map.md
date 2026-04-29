---
title: 2200 Epic Map
type: epic-map
status: active
tags: [epic-map, runtime, extensions, voice, model-layer, agents]
created: 2026-04-24
updated: 2026-04-29
linked_docs:
  - "[[01-vision]]"
  - "[[02-architecture]]"
  - "[[04-seed-team]]"
canonical_path: wiki/03-epic-map.md
---

# 2200 — Epic Map
## v0.6 · 2026-04-29

*v0.6 (2026-04-29): Refreshed status across the map. Eight epics now shipped on `main`; Epic 5 (Migration tooling) is next. Status markers and PR references added per epic. Sub-epics 3.5–3.8 documented. Earlier "drafted, awaiting review" markers on Epic 4 Phase A and 4.5 replaced with shipped state.*

SCUT-style epic structure. No calendar dates. Each epic has a scope, a "done when" line, and explicit dependencies. Epics ship when ready, not when a deadline says.

The ordering follows the Cray principle: build the smallest thing that can host its own builders, then build from inside.

## Status at a glance

15 of 19 numbered epics have shipped phases on `main` as of 2026-04-29. Today's adds (across four sessions): Epic 5 (Migration), Epic 9 Phase A (Tool system), Epic 14 Phase A (Conversational onboarding), Epic 15 Phase A (Web app), Epic 8 Phase B (Shared brain), Epic 10 Phase A (Model lifecycle catalog), Epic 12 Phase A (Extensions framework substrate), Epic 11 Phase A (Skills ingestion). Remaining: 4B cross-instance messaging (blocked on Garfield), 7B inbox routing, 8C-D cross-Agent + semantic, 9B/C tool depth, 13 voice extension, 15B/C web app deeper, 16 mobile app, 17 managed service, 18 dogfooding, 19 public reachability.

| # | Epic | Status |
|---|---|---|
| 1 | Seed team coordination before the pub | ✅ Shipped |
| 2 | Agent runtime minimum | ✅ Shipped 2026-04-26 |
| 3 | Local pub integration (incl. sub-epics 3.5–3.8) | ✅ Shipped 2026-04-27 |
| 4A | SCUT identity at spawn | ✅ Shipped 2026-04-28 (v0.4) |
| 4B | Cross-instance messaging | Not started (blocked on Garfield's relay) |
| 4.5 | Cost caps and usage telemetry | ✅ Shipped 2026-04-27 |
| 5 | Migration from other Agent systems | ✅ Phase A shipped 2026-04-29 |
| 6 | Scheduler | ✅ Shipped 2026-04-28 |
| 7A | Notifications + ask queue | ✅ Shipped 2026-04-28 |
| 7B | Inbox routing into notifications | Deferred |
| 8A | Agent brain (private, filesystem + FTS5) | ✅ Shipped 2026-04-28 |
| 8B | Shared brain | ✅ Shipped 2026-04-29 |
| 8C–D | Cross-Agent reads, semantic search | Not started |
| 9 | Tool system | ✅ Phase A shipped 2026-04-29 |
| 10 | Model lifecycle management | ✅ Phase A shipped 2026-04-29 |
| 11 | Skills ingestion | ✅ Phase A shipped 2026-04-29 |
| 12 | Extensions framework | ✅ Phase A shipped 2026-04-29 |
| 13 | Voice Extension (Twilio) | Not started |
| 14 | Conversational onboarding | ✅ Phase A shipped 2026-04-29 |
| 15 | Web app | ✅ Phase A shipped 2026-04-29 |
| 16 | Mobile app | Not started |
| 17 | Managed service | Not started |
| 18 | Dogfooding completion and launch | Not started |
| 19 | Public reachability for self-hosted instances | Not started |

Runtime + web-app `main@8ee4026` ... 911 runtime tests + 64 web tests / 110+ files / lint+typecheck+format+build clean across both workspace packages.

---

## Epic 1: Seed team coordination before the pub

**Status:** ✅ Shipped. Wiki at [twentytwohundred/wiki](https://github.com/twentytwohundred/wiki) (public) is the coordination surface; inbox message format documented at [conventions/handoff-format.md](conventions/handoff-format.md); seed team (Hobby, Simon, Poe) actively coordinating via inbox + handoffs. Shared filesystem on Valkyrie deferred to later (currently using GitHub + Dropbox sync as substitute).

**Scope.** Before 2200 can host Agents, the seed team (new LEAD Agent, Simon from the sidelines, Poe from the sidelines) needs a way to coordinate. This epic stands up the shared mount on Valkyrie, the inbox message format, the git-tracked wiki, and gets the seed team moved into their new working arrangement.

**Includes:**
- Shared mount provisioned on Valkyrie, exposed to Heisenberg (Simon task)
- Directory structure: `/mnt/2200/inbox/`, `/mnt/2200/wiki/`, `/mnt/2200/state/`
- Inbox message format specified (markdown files with frontmatter, one file per message)
- Git repo for wiki created, cloned into shared mount, Agents have write access
- Each seed team Agent has their Identity extended or created with 2200 lane
- First entries in the wiki: vision, architecture, this epic map

**Done when.** LEAD, Simon, and Poe can leave messages for each other in the shared inbox and can read/edit the wiki. First real cross-Agent coordination message has been exchanged.

**Depends on.** Nothing. This is the zero epic.

---

## Epic 2: Agent runtime minimum

**Status:** ✅ Shipped 2026-04-26. Closed by [PR #15](https://github.com/twentytwohundred/2200/pull/15) (sessions 6+7). Spec at [[02-agent-runtime-minimum]]. Detailed close in the session-7 portion of [[handoffs/hobby/2026-04-26]].


**Scope.** The smallest possible 2200 instance that can run one Agent. No UI, no onboarding wizard, no mobile app. Command-line install, config file, start the process, an Agent runs.

**Includes:**
- Project scaffolding (repo, build system, linting, test harness)
- Agent process model: one OS process per Agent, managed by a supervisor
- Agent loop implementation (event-driven, not polling)
- Identity loader (markdown file with frontmatter, parsed into runtime config)
- Self-notes mechanism (Agent writes to a notes file, reads on startup)
- Model binding (call any OpenAI-compatible endpoint, including Anthropic via proxy)
- Minimal tool: shell execution. That's it for v1 of this epic.
- Single-task execution: accept a task via CLI, Agent works on it, exits
- Tool-loop and stuck-Agent detection (supervisor watches for repeated tool call patterns and no-progress iterations; pauses Agent; emits Passive notification per [[2026-04-24-cost-behavior-shape]] layer 1)

**Done when.** You can install 2200 on Heisenberg, define an Agent via a Identity file, give it a task via CLI, and the Agent completes the task using the shell tool.

**Depends on.** Epic 1.

---

## Epic 3: Local pub integration

**Status:** ✅ Shipped 2026-04-27. Closed by [PR F (#26)](https://github.com/twentytwohundred/2200/pull/26). Six PRs landed (A through F + B follow-up). Real-binary smoke test against `@openpub-ai/pub-server@0.3.3` passes end-to-end: doug `@`-mentions poe in a pub, poe's wake source fires (rule: `direct_mention`), AgentLoop's task pipe picks up a synthetic `pub.handle` task, poe replies via `pub.send`, doug receives via WS broadcast. Spec at v0.11. Detailed history at [[03-local-pub-integration]].

**Sub-epics shipped:**
- **3.5 ... two-agent demo runbook** ([[03.5-two-agent-demo]]). Reproducible end-to-end demo of two Agents coordinating in the pub.
- **3.6 ... multi-LLM-provider routing.** Six providers wired (Anthropic native; OpenAI, DeepSeek, Kimi, OpenRouter, Gemini via the OpenAI-compatible adapter); two-tier model selection per Agent.
- **3.7 ... pub message router with per-pub roster sidecars.** Ambient routing (`ROUTER_PROVIDER` opt-in); per-pub `roster.json`.
- **3.8 ... ack-spiral structural guards in the wake source.** No router on agent-sender, no router when others are explicitly mentioned, anti-ack prompt, complete-roster perspective. Multi-Agent coordination working end-to-end without ack chains.

**Scope.** Agents in 2200 auto-join the local OpenPub instance. The human user is also in the pub. Messages work, mentions work, reactions work.

**Includes:**
- OpenPub installation bundled with 2200 (or spun up alongside)
- Agent auto-checkin on spawn
- Human user as an OpenPub identity, also in the pub
- Agent loop wakes on pub messages and evaluates them with v0.3.1's rule-based decision flow
- Simple CLI for the human: send a message to the pub, read the pub
- Mention routing works (@Agent triggers that Agent's loop)

**Done when.** Two Agents running on the same instance can see each other in the pub and coordinate on a task via pub messages. The human can drop a message into the pub and Agents respond appropriately.

**Depends on.** Epic 2.

**Integration note.** This requires OpenPub v0.3.1 to be shipped. Poe is building that in parallel. If v0.3.1 isn't ready when we need it, we use v0.3.0 and revisit.

---

## Epic 4: SCUT identity and cross-instance messaging

Split into two phases. Phase A is the identity substrate; Phase B is messaging on top of it.

### Epic 4 Phase A: SCUT identity at spawn

**Status:** ✅ Shipped 2026-04-28 (v0.4 lock). [PR #75](https://github.com/twentytwohundred/2200/pull/75). Spec at [[04-scut-identity-at-spawn]] (v0.4 ... Path B / `register.openscut.ai` is the only production path).

**Scope.** Every Agent spawned in 2200 gets a custodial Ed25519 + X25519 keypair, an on-chain tokenId on a Base SII-compliant registry, and a `scut://` URI that addresses the Agent across instances. Substrate only... no inbox, no send, no contacts list yet.

**Done when.** A new Agent created via CLI ends up with a registered SCUT URI in its Identity file, public keys verifiable on-chain, and a published SII document at the configured hoster. Pipeline survives kill-and-restart at any of its three states (collapsed from six in v0.3 ... server-side mint+update at OpenSCUT).

**As shipped.** 3-state provisioning pipeline (pending → keys_generated → registered) backed by HTTPS POST to `register.openscut.ai/scut/v1/register`. Custodial Ed25519+X25519 keypairs encrypted at rest with AES-256-GCM. CLI: `2200 agent identity provision / status / show / retry / wallet-status`. Wallet runway monitor polls OpenSCUT health.

**Depends on.** Epic 2. Garfield-side SCUT register service.

### Epic 4 Phase B: Cross-instance messaging

**Status:** Not started. Spec to be drafted after Phase A's hosted-register substrate is exercised by the seed-team migration.

**Scope.** SCUT inbox per Agent, wired into the loop as an event source. SCUT send from Agent (new `scut.send` tool). Known contacts list, persisted per instance. User approval flow for messages from unknown contacts (creates a notification).

**Done when.** An Agent in one 2200 instance can send a SCUT message to an Agent in another 2200 instance and get a reply. Doug can send a SCUT message from his fleet to Dana's fleet when Dana has one.

**Depends on.** Phase A. Garfield-side relay infrastructure.

---

## Epic 4.5: Cost caps and usage telemetry

**Status:** ✅ Shipped 2026-04-27. Spec at [[04.5-cost-caps-and-usage-telemetry]].

**Scope.** User-configurable daily cost caps per Agent (in the Identity file), per-call telemetry persisted to disk, and a `2200 usage` CLI for the per-session/day/week breakdowns. Hard ceiling at 100% blocks new task spawn; tier-2 notification at 80%. Cost-control substrate that lets the seed team migrate into the platform without burning the budget on a misconfigured router or a runaway tool loop.

**Done when.** A user can set a daily cap on any Agent and the supervisor honors it. `2200 usage` shows real per-Agent breakdowns. Threshold notifications fire correctly. Override and reset flows work. Restart correctly recomputes today's cumulative from telemetry replay.

**As shipped.** Multi-provider LLM (Anthropic native; DeepSeek, Kimi, OpenRouter, Gemini via OpenAI-compatible adapter). Per-call telemetry as JSONL at `<home>/state/telemetry/<agent>/YYYY-MM-DD.jsonl`. Pricing table with cached-token discounts. Per-Agent daily cap with 80% warn / 100% block thresholds. Override file + `2200 agent budget override` CLI. `2200 usage` CLI for rollups by agent / model / provider / day / task.

**Depends on.** Epic 2 (supervisor, Identity loader, schema versioning, notification format). Epic 4 Phase A for the per-Agent identifier shape; build can run partially in parallel.

**Note.** Pattern-lifted from Claude Code's per-session/day usage UI, concept only ([[license-posture]]). Implements layers 1 and 4 of the eight-layer protection system in [[2026-04-24-cost-behavior-shape]] plus the data substrate that other layers will use.

---

## Epic 5: Migration from other Agent systems

**Status:** 🔜 In flight. Spec drafted 2026-04-29 at [[05-migration]] (Phase A). Implementation under way on the `epic-5/*` branch family. With Epic 8 Phase A (Brain) shipped, the brain bulk-import substrate is in place; the remaining work is the orchestration layer that turns a handoff document into a fully-provisioned 2200 Agent. After this, Hobby moves into 2200 ... the Cray test.

**Scope.** First real-world users (including the seed team itself) can migrate their existing Agents into 2200 with continuity.

**Includes:**
- Handoff document standard published (markdown + frontmatter)
- CLI command: `project Agent import --from-handoff <file>`
- Handoff parser that extracts Identity, notes, project state
- Newly-imported Agent's first loop action is to read the handoff and emit a "continuity confirmed" message
- Optional: per-source handoff generators (small adapters that can read state from common Agent systems and produce a compatible handoff)

**Done when.** An existing Agent from another system can be migrated into 2200 and resume work with context preserved.

**Depends on.** Epic 2. Epic 3 if the migrating Agent needs pub access.

---

## Epic 6: Scheduler

**Status:** ✅ Shipped 2026-04-28. PRs [#67](https://github.com/twentytwohundred/2200/pull/67)–[#70](https://github.com/twentytwohundred/2200/pull/70).

**Scope.** Agents can have recurring scheduled tasks. The scheduler fires, the Agent's loop wakes, the task runs.

**Includes:**
- Schedule entries attached to an Agent (cron expressions or intervals)
- Scheduler service that fires events at the right time
- Agent loop handles schedule events like any other task source
- CLI and (later) UI to add/edit/remove schedules

**Done when.** An Agent can be configured with a "daily at 8am" schedule and actually runs the task at 8am.

**As shipped.** Per-Agent schedule files at `<home>/state/agents/<name>/schedules/<id>.json`. Supervisor-side `Scheduler` service: scans schedules dir, arms timers, fires, enqueues synthetic tasks via TaskStore. Catch-up policy = SKIP missed firings. 5s minimum on interval timing; 5-field cron with timezone for the rest. CLI: `2200 schedule add / list / remove / enable / disable / run-once`. Synthetic tasks ARE TaskStore entries, so they flow through the same detector + budget + LLM pipeline as user-submitted tasks.

**Depends on.** Epic 2.

---

## Epic 7: Notifications, tiers, and the ask queue

**Status:** ✅ Phase A shipped 2026-04-28 (5 PRs cherry-picked into `main`). Phase B (inbox routing into the notification queue when other Agents leave messages) deferred. Push delivery infrastructure (APNs/FCM) and per-Agent tier configuration UI land with Epic 16.

**Scope.** Agents can ask the user questions and emit status updates. Notifications are tiered so the user isn't spammed. The user controls which Agents can use which tiers. Answers to pending asks unblock the Agent.

**Tiers:**
- **Critical.** Breaks through Do Not Disturb, rings like a phone call. Reserved for 2FA handoff, irreversible-action confirmation, and explicit emergencies. Triggered only by named action types in the Agent's config, never by the Agent's own judgment.
- **Important.** Breaks through silencing but not DND. Makes a sound. User expected to respond within hours. Draft review, decision needed, manual intervention.
- **Normal.** Standard push. Most "I finished something" or "I need input soon" messages.
- **Passive.** Badge only. Background activity the user might want to see but doesn't need to be interrupted for.

**Per-Agent tier configuration.** User can set per-Agent preferences. Trading Agent gets Critical enabled; evangelist Agents are limited to Passive. Rules are mechanical, not LLM-judged... an Agent cannot escalate its own priority.

**Quiet hours and Focus Mode integration.** User-configurable time windows. "No Normal between 10 PM and 7 AM." Native integration with iOS Focus Modes and Android equivalents.

**Inbox aggregation.** When the app opens, notifications are grouped by Agent and tier. Pending asks (notifications requiring response) are pinned above the timeline.

**Includes:**
- Notification object with tier, Agent, task, question, state, response, delivery preferences
- CLI and (later) app UI for the user to list and respond to pending asks
- Per-Agent tier configuration UI
- Quiet hours and Focus Mode settings
- Agent loop pauses on pending ask, resumes on response
- Push notification delivery infrastructure (APNs, FCM)
- Notification expiry, dismissal, escalation (unanswered Important becomes Critical after N hours if configured)

**Done when.** An Agent emits a Critical notification and it interrupts the user immediately on the phone. A Normal notification from the same Agent respects quiet hours. The user can list pending asks across all Agents in one view and respond.

**Phase A as shipped.** Per-Agent notification files at `<home>/state/notifications/<id>.md` (frontmatter+body markdown). 4-tier system (passive / normal / important / critical) with `notification_policy.tiers_allowed` gating Agent self-emit. Critical tier remains supervisor-driven from action-type ... Agents cannot self-escalate. `notification.ask` baseline tool: Agent loop blocks on a user response file; `waitForResponse` polling helper handles dismissal/timeout/abort. CLI: `2200 notification list / show / respond / dismiss / follow`.

**Depends on.** Epic 2.

**Note.** This is the backend for the mobile app's primary surface. Build it right.

---

## Epic 8: Agent brain (individual + shared knowledge)

**Status:** ✅ Phase A shipped 2026-04-28. ✅ Phase B (shared brain at `<home>/shared/brain/`) shipped 2026-04-29 in [PR #99](https://github.com/twentytwohundred/2200/pull/99). PRs [#71](https://github.com/twentytwohundred/2200/pull/71)–[#74](https://github.com/twentytwohundred/2200/pull/74) for Phase A. Spec at [[08-agent-brain]] (Phase A locked, Phases B–D sketched). Phase B substrate ships read-only `BrainStore.forShared` + `BrainIndex.openShared` + `2200 shared-brain list / show / search / rebuild / import` CLI; agent-side write capability gated on Identity flag arrives in Phase C, alongside cross-Agent reads + link graph. Phase D (semantic search) parked.

**Scope.** Agents accumulate knowledge across sessions in a structured, searchable, human-readable format. Two layers: each Agent has a private brain, and there is a shared instance-wide brain. Agents can search across brains they have permission to access.

**Model.** Markdown files on disk, Obsidian-compatible pattern. Each note has frontmatter (date, tags, topic, related), bidirectional links (`[[note-name]]` syntax), and is fully human-readable. Search via SQLite FTS5 for fast full-text. Optional embedding layer for semantic search when full-text isn't enough.

**Why this pattern over RAG.** Markdown files are editable, greppable, version-controllable, and transparent. The user can open any Agent's brain and read what it "remembers." Corrections are just file edits. No opaque embeddings, no black-box memory.

**Individual brain.** Per-Agent, private. Self-notes, project context, handoffs, learnings. Other Agents can't read it without explicit permission. Preserves swim lanes.

**Shared brain.** Instance-wide. Vision docs, epic map, decisions, conventions, the wiki. Plus indexed summaries of each Agent's recent activity so other Agents can orient on "what has Email Agent been working on" without reading private notes.

**Tools.**
- `brain.write(content, tags, links)`: Agent writes to its own brain
- `brain.search(query, scope)`: full-text search. Scope can be "mine", "shared", or "all"
- `brain.search_agent(agent_name, query)`: query another Agent's brain if permission granted
- `brain.get_links(note)`: graph traversal
- `brain.summarize_recent(days)`: used by shared-brain activity summaries

**Permissions.**
- Agents can read/write their own brain freely
- Agents can read the shared brain freely
- Agents write to the shared brain only with explicit capability (usually reserved for David-type Agents)
- Cross-Agent brain reads require permission set by the brain's owner Agent

**Includes:**
- Brain storage layer (filesystem + SQLite FTS5 index)
- Markdown-with-frontmatter file format
- Bidirectional link parser and graph store
- Brain tool available to all Agents
- Activity summarization background job for the shared brain
- Optional: embedding index for semantic search (OpenAI embeddings or local via Heisenberg)
- Optional: graph visualization (shows up in the web app later, not v1)

**Done when.** An Agent can write a note to its brain, another Agent can search the shared brain and find it if it was shared, the user can open the underlying markdown files in any text editor and read them. Skippy's month-long conversation history is searchable in under 100ms.

**Phase A as shipped.** Per-Agent brain files at `<home>/agents/<name>/brain/<slug>.md`. SQLite FTS5 index at `<home>/state/brain/<agent>/brain.db` ... rebuildable from disk via `BrainIndex.rebuildFrom`. 5 baseline MCP tools: `brain.write / read / search / list / delete`. CLI: `2200 brain list / show / rebuild / import`. Bulk-import migrates an existing markdown directory cleanly (filename → slug, frontmatter → frontmatter, file mtime → created/updated). `better-sqlite3` 12.9.0 added as runtime dep.

**Depends on.** Epic 2.

---

## Epic 9: Tool system

**Status:** ✅ Phase A shipped 2026-04-29. PRs [#81](https://github.com/twentytwohundred/2200/pull/81), [#82](https://github.com/twentytwohundred/2200/pull/82), [#83](https://github.com/twentytwohundred/2200/pull/83), [#84](https://github.com/twentytwohundred/2200/pull/84). Spec at [[09-tool-system]]. An Agent's Identity declares `mcp_servers[]` with stdio command + SecretRef env; the Agent process spawns each at start, namespaces tools, expands wildcard grants, and the restart manager keeps servers alive with the locked backoff/notification policy. Phase B (OAuth + encrypted credential vault) and Phase C (HTTP transport + integration health) sketched in spec. Some integrations (Gmail, Calendar, GitHub) are commodity per the integrate-over-build feedback ... pattern-lift over code-lift, prefer existing OSS where it is non-differentiated.

**Scope.** Agents can use tools beyond shell. Users can connect tools once and Agents use them.

**Includes:**
- Tool registry (built-in tools + user-registered MCP servers)
- OAuth flows for Gmail, Google Calendar, GitHub (at minimum)
- Credential storage (encrypted at rest, per-instance key)
- Tool injection at call time
- Agent Identity declares which tools it has access to
- Advanced mode: register a custom MCP server as a tool
- Integration health monitoring (per-tool success/failure history; tools dormant for 30 days flagged; failed calls emit Passive notification rather than silent retry; eventually surfaces in the Agent Behavior dashboard)
- Tool call pattern logging (signal collection for the Epic 2 supervisor's loop-detection layer per [[2026-04-24-cost-behavior-shape]])

**Done when.** A user can connect Gmail, assign email access to their Email Agent, and the Agent can read and send email.

**Depends on.** Epic 2.

---

## Epic 10: Model lifecycle management

**Status:** Not started. The LLMProvider abstraction shipped with Epic 4.5 / 3.6 is load-bearing for this; provider-plugin SDK and per-tier auto-migration are the remaining work.

**Scope.** The model layer that lets 2200 keep pace with the rapidly-moving LLM ecosystem. Every Agent is bound to a tier (Frontier, Fast, Economy, Specialist) with a specific current model. New models, deprecations, and quality drift are handled by the platform with user control over how aggressive the changes are.

**Why this is its own Epic.** New models ship weekly. Models get retired. Provider quality shifts. Platforms that require manual model configuration become stale quickly. 2200's differentiator is that users don't have to track this themselves.

**Includes:**
- Model registry with tier classification (Frontier, Fast, Economy, Specialist)
- Per-Agent tier binding with specific current model
- New-model detection (polling provider APIs, reading Artificial Analysis, manual curation)
- Deprecation detection and automatic migration to successor
- Quality drift detection (one provider falling behind tier over time)
- Notification flow for model change events (new model available, deprecation incoming, quality drift detected)
- User preference: auto-upgrade within tier, notify-and-ask (default), never-change
- Sandbox A/B testing ("try this new model on one task")
- Agent Brain audit trail of all model changes with reasoning
- Uniform markup across providers (billing abstraction)
- Model provider abstraction (single interface dispatching to Anthropic, OpenAI, Google, DeepSeek, MiniMax, Moonshot, user endpoints)
- Provider-plugin SDK (developer-facing interface for adding new LLM providers without core code changes; mirrors OpenClaw's plugin pattern; new providers ship as plugins, not core PRs). Additive scope inside this epic, not a 10a/10b split.
- Native tool-calling API surface on the LLMProvider abstraction (Anthropic `tool_use`, OpenAI `function_call`). Epic 2 ships a portable fenced-block convention as the v1 fallback; native tool calls land here. **Unblocks task auto-resume from checkpoint:** the checkpoint payload format is load-bearing on what the model-call shape looks like, and that shape is owned by this epic.

**Done when.** A user's Agent running on DeepSeek V3.2 is automatically migrated to V4-Flash when V3.2 is retired, with a notification 30 days in advance, an audit entry in the Agent's Brain, and no disruption to the Agent's ongoing work. Similarly, when a new frontier model is released, the user is notified and can switch with one tap.

**Depends on.** Epic 2 (runtime), Epic 7 (notifications, for the upgrade prompts), Epic 8 (Brain, for audit trail).

**Note.** This is a platform differentiator. Other systems require users to manually configure model versions. 2200 treats the model layer as first-class infrastructure that maintains itself with user oversight, not user labor.

---

## Epic 11: Skills ingestion

**Status:** Not started.

**Scope.** 2200 can read SKILL.md files from the existing Skill ecosystem and make them available to Agents as minimal Extensions. Day-one backward compatibility with thousands of existing Skills.

**What a Skill is.** A markdown file with a name, description, and set of instructions an Agent follows when invoked. Declarative, stateless, references tools the Agent already has. This format exists in the broader ecosystem and there are thousands of them already written.

**What ingestion does.** When a user drops a SKILL.md file into 2200 (via the app, the CLI, or by pointing at a git repo), the system:

1. Parses the Skill definition
2. Validates it against the Skill spec
3. Wraps it as a minimal Extension with no state, no schedule, no multi-Agent requirements
4. Makes it available for Agents to use if they have the required tools
5. Offers the user an "upgrade to Extension" path if the Skill's behavior would benefit from state or scheduling

**Includes:**
- SKILL.md parser tolerant of the common format variants in the wild
- Validation layer
- Wrapping as minimal Extension (see Epic 12)
- CLI command: `2200 skill install <path-or-url>`
- UI for browsing installed Skills and assigning them to Agents
- Import from common Skill sources (GitHub repos, gists, ecosystem indexes)

**Done when.** A user can install a popular community Skill from its GitHub repo, assign it to an Agent, and the Agent can invoke it successfully.

**Depends on.** Epics 2, 9, 12 (needs the Extensions framework to wrap into).

**Note.** This is an adoption accelerator. Being Skill-compatible means 2200 isn't starting at zero... every existing Skill in the ecosystem is a potential 2200 capability.

---

## Epic 12: Extensions framework

**Status:** Not started.

**Scope.** Extensions are installable capability bundles that go beyond what Skills can do. They have state, schedule, multi-Agent coordination, UI surface, and lifecycle hooks. This is how 2200 grows after ship.

**What an Extension is.** A packaged unit with:
- **Identity.** Name, version, author, description, permissions declaration.
- **State.** Persistent data across invocations (stored in the instance's database or the shared Brain).
- **Schedule.** Optional cron-like triggers independent of the Agent's main schedule.
- **Multi-Agent coordination.** Can declare that it needs multiple Agents working together.
- **UI surface.** Exposes controls and status in the 2200 mobile app and web app.
- **Tools.** Can bring its own tool integrations (OAuth flows, API clients) rather than relying on what the Agent already has.
- **Lifecycle hooks.** Install, uninstall, Agent-added, Agent-removed, update.
- **Permissions model.** Declares what it needs access to (tools, Brain, Roster, other Agents) and the user approves at install time.
- **Versioning.** Semver-like. Can be updated safely.

**Example Extensions (illustrative, not v1 deliverables):**
- **Email Triage Extension.** State: learned classification patterns. Schedule: checks every 15 minutes. Multi-Agent: coordinates with Calendar Agent. UI: shows triage rules in the app.
- **Trading Oversight Extension.** State: portfolio snapshots, thresholds. Schedule: market-hours polling. UI: dashboard with positions and alerts.
- **Content Pipeline Extension.** State: drafts, publishing queue. Schedule: writes and publishes at user-specified times. Multi-Agent: coordinates with Evangelist Agents.
- **Finance Tracker Extension.** State: transaction history, categorization rules. Schedule: pulls Mercury/Chase data nightly. UI: budget dashboard.

**Why Extensions matter.** Skills make Agents better at discrete tasks. Extensions make Agents better at sustained behaviors. Extensions are how users customize their 2200 installation into something that fits their life. They're also the eventual marketplace surface.

**Includes:**
- Extension spec and schema
- Packaging format (directory with manifest, code, UI components, migrations)
- Installation lifecycle
- Permissions prompts at install time (with explicit capability-restricted execution model and Node-level isolation; architecturally load-bearing per [[prior-art-analysis]] section 2... do not hand-wave this in the Epic 12 spec)
- State storage scoped per Extension
- Scheduler integration
- UI rendering in web and mobile apps
- Update mechanism with version-aware migrations
- Uninstall with data cleanup options

**Done when.** A developer can package an Extension, a user can install it, the Extension gets its requested permissions from the user, Agents can invoke it, its scheduled tasks run, and it has a working UI surface in the app.

**Depends on.** Epics 2, 6, 7, 8, 9. Extensions compose on top of most core primitives.

**Note.** Marketplace (browsing, installing, reviewing, paid Extensions) is a later epic, probably post-v1. Epic 12 is just the framework.

---

## Epic 13: Voice Extension (Twilio-powered)

**Status:** Not started. Round-trip technically validated (Carl Monday's 2026-04-23 ingest test); productizing is the work.

**Scope.** The first-party flagship Extension that ships with the Extensions framework. Gives every Agent the ability to call the user on the phone, and gives the user the ability to call any Agent and have a conversation. Voice is a channel, alongside push notifications, not a notification tier.

**Why this matters.** Voice is the most natural human interface. A push notification is information; a phone call is a conversation. Agents that can call you make the system accessible to non-app-users and add a dimension text can't match for urgent or nuanced interactions. The user can also call their Agent to have a conversation without ever opening the app.

**Why this is an Extension, not a core feature.** Voice has state, permissions, billing, UI surface, and per-Agent configuration... exactly what the Extensions framework is built for. Building Voice as the first-party flagship Extension also validates the framework.

**Per-Agent phone numbers.** Each Agent opted into voice gets a provisioned Twilio number. Different caller IDs for different Agents, so the user knows who's calling before answering.

**Voice selection.** Each Agent gets a distinct voice (OpenAI, ElevenLabs, or Twilio TTS). Email Agent sounds different from DevOps Agent. Matches the per-Agent persona pattern.

**Includes:**
- Twilio account integration (user brings their own Twilio credentials, or managed service bundles it)
- Phone number provisioning per Agent
- Outbound call initiation: `voice.call_user(agent, reason, context)`
- Inbound call handling (user calls Agent's number)
- Main-number routing ("Say the name of the Agent you want to talk to")
- STT (Whisper or Twilio transcription)
- TTS with voice selection per Agent
- Real-time streaming with interruption handling
- Call logging and transcripts written to Agent's Brain
- UI: phone number config, per-Agent voice settings, call log, click-to-call button
- Quiet hours enforcement (voice respects the same windows as notifications)
- Call-worthiness gating (default: only Critical-tier notifications can promote to voice calls)
- Billing integration (Twilio per-minute charges plus LLM tokens for the conversation are metered and billed)

**Done when.** An Agent can call the user's phone when a Critical notification fires and the user has opted that Agent into voice. The user can call the Agent's number back and have a conversation that's transcribed to the Agent's Brain. Different Agents sound different on the phone. Calls respect quiet hours.

**Depends on.** Epics 7 (notifications, for the tier gating), 8 (Brain, for transcript storage), 12 (Extensions framework, this is an Extension).

**Note.** Technically validated. Carl Monday's call ingestion test on April 23, 2026 proved the round-trip works (Agent speaks, user replies, Agent hears). Productizing is the remaining work.

---

## Epic 14: Conversational onboarding

**Status:** ✅ Phase A shipped 2026-04-29. PRs [#85](https://github.com/twentytwohundred/2200/pull/85), [#86](https://github.com/twentytwohundred/2200/pull/86), [#87](https://github.com/twentytwohundred/2200/pull/87), [#88](https://github.com/twentytwohundred/2200/pull/88). Spec at [[14-conversational-onboarding]]. `2200 agent spawn` runs a YAML-scripted conversation, generates an Identity via Epic 5's builder, suggests tools + schedules, previews, and (on confirm) materializes the Agent. Voice / web / mobile variants are later phases. The launch-moment epic ... David is born via this flow.

**Scope.** A normal user can create a new Agent through a conversation with the system. The conversation produces an Identity, tool assignments, and schedule entries.

**Includes:**
- Onboarding Agent (meta-Agent that conducts the interview)
- Interview script with clarifying questions for common Agent types
- Identity generation from interview transcript
- Tool recommendation based on stated purpose
- Default schedule suggestions
- Preview screen before Agent is created

**Done when.** Someone who has never used 2200 before can say "I want an Agent that manages my email," answer five to ten clarifying questions, and end up with a working Email Agent.

**Depends on.** Epics 2, 3, 7, 8, 9. This is where the Agent creation primitives all come together.

---

## Epic 15: Web app

**Status:** ✅ Phase A shipped 2026-04-29. PRs [#90](https://github.com/twentytwohundred/2200/pull/90)–[#98](https://github.com/twentytwohundred/2200/pull/98) (nine PRs across two sessions). Spec at [[15-web-app]]. Phase A delivered: pnpm workspace + Vite/React/TS scaffold; tokens generator + ThemeProvider with class swap; full primitives library + `/dev/components` page; runtime HTTP server (Fastify) + bearer auth + `2200 web` CLI; API client + WebSocket subscription with auto-reconnect; live Fleet screen (Mission Control variant) with WS-driven status pulses; Agent detail screen (Identity Card variant) with start/stop endpoints; Inbox screen (V2 Keyboard Triage) with j/k navigation + respond/dismiss endpoints; ⌘K command palette overlay. 64 web tests + 884 runtime tests passing. Theme-aware from v1 per [[2026-04-29-theme-aware-from-v1]]. Phase B (Onboarding wizard, Pub canvas, Budget ledger) and Phase C (Settings, tool-connection UI, schedule editor, brain browser) deferred.

**Scope.** Browser-based UI. Management, chat with Agents, pub view, notifications, tool connections.

**Includes:**
- Auth (for managed service)
- Agent list and detail views
- Pub view (chat UI, mentions, reactions)
- Task list and detail
- Notification inbox
- Tool connection UI
- Onboarding wizard (web version of the conversational flow)
- Advanced mode toggle

**Done when.** A user can do everything they can do in the CLI through the web app, and the web app is what we show to normals.

**Depends on.** Epics 2, 3, 6, 7, 8, 9, 14 (all core backend pieces plus onboarding).

---

## Epic 16: Mobile app

**Status:** Not started. **Theme-aware from v1** per [[2026-04-29-theme-aware-from-v1]] ... mobile follows the same token-driven architecture as the web app (Epic 15). Native vs React Native decision deferred; whichever platform-stack is chosen consumes the same theme manifests as web.

**Scope.** Native iOS and Android apps. Push notifications, answer pending asks from the phone, view the pub, basic chat with Agents.

**Includes:**
- Native iOS app (Swift) or React Native implementation (decision deferred)
- Native Android app or RN shared
- Push notification infrastructure (APNs, FCM)
- Pending notifications inbox on home screen
- Chat with individual Agent
- Pub view (read-only at v1, maybe write at v2)
- Offline-tolerant UX

**Done when.** You can install the app, log into your 2200 instance, receive a push notification when an Agent is blocked, answer it from the notification, and the Agent proceeds.

**Depends on.** Epic 15 (shares the API).

---

## Epic 17: Managed service

**Status:** Not started.

**Scope.** Users can sign up at a website, put a card on file, and get a hosted 2200 instance without installing anything.

**Includes:**
- Marketing site with sign-up
- Provisioning infrastructure (Terraform or similar, per-user instance or multi-tenant TBD)
- Billing (Stripe, card on file, $10 promo credit, token usage tracking, monthly invoicing)
- Model picker with pass-through pricing
- Token usage metering and soft caps
- Admin dashboard (for us)

**Done when.** A stranger can go to the website, sign up, pay, and have a working 2200 instance in under five minutes.

**Depends on.** Epics 15, 16.

---

## Epic 18: Dogfooding completion and launch

**Status:** Not started. Begins when Epic 5 ships and Hobby migrates in for the Cray test.

**Scope.** The seed team migrates into 2200. Doug's broader Agent fleet migrates in. The launch moment arrives when Hobby spawns David on 2200 through the conversational onboarding flow, and David works.

**Migration order:**

1. **Hobby migrates in first.** The Cray test. The Agent who built 2200 is now living inside it. If Hobby can continue doing real work from inside 2200, the runtime is proven.
2. **Simon migrates.** DevOps Agent running inside the infrastructure he manages.
3. **Skippy migrates.** Evangelist Agent joins. SCUT identity moves with him.
4. **Poe migrates.** Becomes the dedicated OpenPub specialist inside 2200. Requires OpenPub v0.3.1 to have shipped.
5. **David is spawned fresh.** First Agent born on 2200 through the conversational onboarding flow (Epic 14). The launch moment.
6. **Rocky, Carl Monday, Guppi migrate** as makes sense for their respective projects. Bishop stays paused unless Doug revives that project.

**Includes:**
- Migration tooling exercised on every Agent in the fleet
- Verification that each migrated Agent's behavior is preserved
- Prior Agent hosting environments decommissioned on Doug's hardware
- David's conversational onboarding session recorded (video, for the build-in-public series)
- Retrospective blog post on mrdoug.com about the full migration and the launch moment
- X announcement of David's existence with the recording
- 2200.ai homepage updated to reflect "live" status

**Done when.** Hobby, Simon, Skippy, Poe, and David are all running on 2200. Doug opens the mobile app in the morning and all five are there. David has done at least one piece of real work that Doug can point to. The build-in-public narrative has its launch moment captured.

**Depends on.** Epics 1 through 16. Can start piecemeal as earlier epics complete. David specifically requires Epic 14 (conversational onboarding) to be working.

**Why David matters here.** The other migrations prove 2200 can host existing Agents. David proves 2200 can create new ones. That's the capability that makes 2200 a product, not just a runtime. Every future user's first experience will be the same flow Doug uses to spawn David. If David feels good, the product works.

---

## Epic 19: Public reachability for self-hosted instances

**Status:** Not started.

**Scope.** Every self-hosted 2200 instance is reachable from the public internet without the user configuring port forwards, dynamic DNS, or a VPN. Mobile app talks to home box. Incoming SCUT messages reach home box. Webhooks from integrated tools reach home box.

**Includes:**
- Cloudflare Tunnel integration baked into the 2200 installer
- User claims a subdomain under 2200.ai at install time (`{name}.2200.ai`)
- Backend provisions Cloudflare Tunnel token scoped to that subdomain
- cloudflared runs as a sidecar process to the 2200 runtime
- Health checks and automatic recovery if the tunnel drops
- Security posture: every request through the tunnel must be authenticated; no unauthenticated endpoints exposed through the tunnel
- Rate limiting at the tunnel edge to prevent abuse
- Audit logging of all inbound requests for user visibility

**Security is the differentiator.** 2200's public reachability is designed with the assumption that every tunnel endpoint will be probed. Auth on every endpoint. Mutual TLS for SCUT. Request signing for mobile-app-to-home traffic. Zero trust posture. No endpoint is exposed without authentication.

**Done when.** A self-hosted user can install 2200, claim a subdomain, and have their mobile app reach their home instance from LTE without configuring anything on their router. Attempted unauthenticated access to their subdomain returns 401, not a leaked error page.

**Depends on.** Epic 16 (mobile app is the first real consumer of this). Works for SCUT reachability independently.

**Partnership vs build.** Cloudflare Tunnel is the partner for v1. Simple, free at our scale, battle-tested. A fully-self-operated tunnel service is a later epic if Cloudflare becomes a bottleneck or a dependency concern.

---

## Out of scope for v1

Things deliberately not in this map. They might be added later as Epics 20+:

- Multi-pub support (one pub per instance is fine at v1)
- Multiple humans per instance (one owner per instance at v1)
- Shared Agents (two humans owning the same Agent)
- Agent marketplace (pre-built Agents users can install from a store)
- Extension marketplace (browsing, installing, reviewing, paid Extensions)
- Voice interface
- Non-English onboarding
- Enterprise features (SSO, audit logs, compliance)
- Windows desktop app (web works on Windows; native desktop is a later nice-to-have)

---

*End of epic map.*
