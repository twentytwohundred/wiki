---
title: "Prior-Art Analysis: OpenClaw and Perplexity Computer"
type: analysis
status: draft
tags: [analysis, architecture, extensions, runtime, model-layer]
created: 2026-04-24
updated: 2026-04-25
linked_docs:
  - "[[01-vision]]"
  - "[[02-architecture]]"
  - "[[03-epic-map]]"
  - "[[prior-art-source-findings]]"
  - "[[2026-04-24-baseline-model-tier]]"
  - "[[2026-04-24-skill-compatibility-pipeline]]"
  - "[[2026-04-24-cost-behavior-shape]]"
  - "[[2026-04-24-runtime-upgrade-shape]]"
  - "[[2026-04-24-brain-is-files-not-database]]"
  - "[[2026-04-24-bulletin-substrate-is-scut]]"
  - "[[upgrade-readiness]]"
canonical_path: wiki/prior-art-analysis.md
---

# Prior-Art Analysis: OpenClaw and Perplexity Computer
## v0.3 · April 25, 2026 · Hobby

This is the first deliverable required by Hobby's CLAUDE.md. It surveys two existing systems that occupy adjacent territory to 2200, captures what each got right and what each got wrong, and pulls out the lessons that should shape 2200's architecture and epic map. v0.3 closes the source-reading phase: every Section 7 study target was executed, deep findings live in [[prior-art-source-findings]], and the new Section 8 synthesizes those findings into per-Epic implications for the Epic 2 spec drafting that comes next.

**Sources for this draft.**

- *OpenClaw repository* — cloned locally, ~80 top-level `src/` directories source-read across 12 study targets. Per-target file pointers and line numbers in [[prior-art-source-findings]].
- *OpenClaw fork ecosystem* — three priority forks source-read: **EdgeClaw** (OpenBMB, the architecturally aggressive fork — ClawXMemory, ClawXContext, ClawXKairos, ClawXGovernor, ClawXSandbox, ClawXSkill, ClawXRouter), **OCMT** (multi-tenant credential vault), **DenchClaw** (profile/coexistence pattern — though v0.3 confirmed the affordance is in stock OC, not just the fork). Plus skim of the Chinese channel-adapter clones (`openclaw-cn` family) and the extreme platform ports (`AnyClaw` Android-with-embedded-Linux, `mimiclaw` ESP32-S3 in C).
- *Perplexity Computer first-party and balanced material* — Zenity Labs reverse-engineering (`labs.zenity.io/p/perplexity-comet-a-reversing-story`), Perplexity Research's BrowseSafe paper (`research.perplexity.ai/articles/browsesafe` + arxiv 2511.20597), ByteByteGo serving-stack synthesis, Brave Security Team disclosure, Simon Willison commentary, Hard Fork podcast with Aravind Srinivas. The 5-to-0 critical-review skew from v0.1 is closed.

**License posture (read this every time you propose lifting something).** OpenClaw is **MIT** (Copyright (c) 2025 Peter Steinberger). 2200 ships under **Elastic License v2**. MIT → Elastic v2 is permitted. Architectural patterns are not copyrightable — free to emulate by reimplementing from understanding. Verbatim code copies require preserving the MIT copyright notice for the copied portion. Default: lift the pattern, reimplement. EdgeClaw, OCMT, OpenAEON, AnyClaw, mimiclaw upstream licenses are not personally verified — verify before any code lift. AGPL-licensed candidates (Logseq, Trilium, Joplin) were rejected for embedding paths on AGPL viral grounds. See [[license-posture]] for the standing rule.

**v0.3 scope.** This version (a) folds findings from all 12 source-reading targets into Section 7 as a completed-study summary, (b) adds **Section 8: Synthesis by Epic**, organizing the most actionable findings by 2200 Epic with explicit "pattern lift" vs "code lift" annotations, and (c) updates the Top-level lessons section to mark each finding as confirmed by source reading. Sections 1-6 stay largely intact (the high-level analysis based on docs and reviews held up against deeper reading). v0.3 is the final pre-Epic-2-spec-draft version.

**Scope check.** This doc is opinionated where it should be. The point isn't to summarize each system in full... it's to surface decisions that 2200 should emulate, decisions that 2200 should avoid, and decisions that need a position taken before code is written.

---

## 1. Architecture decisions that held up

### OpenClaw

**Gateway-centric hub-and-spoke.** OpenClaw runs as a single Gateway process on the operator's machine. Channels (Discord, Slack, iMessage, etc.), the CLI, the Control UI, and companion apps all connect into the Gateway. The Gateway is "the single source of truth for sessions, routing, and channel connections." This pattern has held up because it gives one canonical place to enforce auth, route messages, and reason about state. 2200 should copy this... a single supervisor process owning Agent lifecycle, message routing, and tool dispatch is the right shape.

**Pluggable LLM provider abstraction.** OpenClaw documents 50+ providers behind a unified interface, with first-class concepts for model failover, prompt caching, and local-model endpoints (Ollama, LM Studio, vLLM). The abstraction is real, not aspirational. This validates the bet in 2200's [[2026-04-24-baseline-model-tier]] decision: the model layer must be an abstraction, not a hardcoded coupling to one provider.

**Skills as a first-class ecosystem.** OpenClaw ships 60+ bundled skills covering productivity (Apple Notes, Notion, Obsidian, Things), communication (Discord, Slack, iMessage), media (Spotify, Sonos), dev (GitHub, GitHub Issues), cloud (1Password, OpenAI APIs), and system control (Tmux, OpenHue, smart lights). Each skill is a self-contained module. The fact that this catalog grew organically and is still maintained is the validation. Skills work as a contribution surface where channels, providers, and even a lot of tools do not.

**Cron, hooks, standing orders, taskflow.** OpenClaw separates four flavors of automation: cron-style scheduled tasks, event-driven hooks, persistent "standing orders" (recurring directives), and explicit taskflow. The fact that they didn't try to collapse these into one primitive is informative. 2200's scheduler (Epic 6) should expect to grow similar variants and shouldn't pre-collapse them.

**Multiple memory engines behind one interface.** OpenClaw exposes a Memory concept with multiple implementations (builtin, Honcho, QMD), plus session management with pruning. Memory is pluggable. 2200's Brain should follow the same pattern... the Brain interface is the contract; the storage backend (filesystem markdown today, something else later) is swappable. **Cross-ref:** [[2026-04-24-brain-is-files-not-database]] locks markdown-on-disk as the v1 default; the interface stays pluggable but the lockable contract is "the files are the source of truth, not a cache."

**Tool-loop detection.** OpenClaw has explicit tool-loop detection. This is a real concern at scale (see Perplexity Computer below) and it didn't get added retroactively after a disaster. Build it in from the start. **Cross-ref:** [[2026-04-24-cost-behavior-shape]] formalizes tool-loop detection as Layer 1 of an eight-layer cost-protection model. Epic 2 owns the implementation per [[03-epic-map]] v0.5.

### Perplexity Computer

**Sub-agent dependency queueing.** When a Perplexity sub-agent is waiting on a prior task to complete, it queues rather than hallucinating its way forward. This is one structural advantage cited by reviewers. The lesson for 2200: when an Agent is blocked on another Agent (the [[02-architecture]] doc's `BLOCKED_ON_AGENT` state), enforce that they actually wait, not retry-with-guess. This already aligns with 2200's "blocked Agents do not retry silently" principle.

**Multi-source research synthesis as a workload.** Perplexity Computer is genuinely good at parallel multi-source research, and reviewers say this alone justifies the cost within the first week for research-heavy users. 2200 should plan for this workload class. A "research" Agent or a research-mode Extension is a high-leverage early use case.

---

## 2. Decisions that broke under load

### OpenClaw

**Single trusted operator security model.** OpenClaw's `SECURITY.md` is explicit: "Authenticated Gateway callers are treated as trusted operators for that gateway instance." Sessions are routing controls, not authorization boundaries. Plugins load in-process with full Gateway privileges. Sandbox defaults are off. This is a deliberate trade-off for OpenClaw's hobby/power-user audience, but it does not survive 2200's product positioning. 2200 ships to busy non-engineers as well as power users. We cannot assume the operator is also the trusted developer of every Skill and Extension. Permission-at-install (Epic 12) and credential isolation per Agent are not optional for us, they are load-bearing.

**Agent-hierarchy framework explicitly refused.** OpenClaw's `VISION.md` says they will not merge "Agent-hierarchy frameworks as default architecture" or "heavy orchestration layers duplicating existing infrastructure." This is a direct shot at the design space 2200 is occupying. Worth understanding why they refused: they didn't want to take on the maintenance burden of a coordination layer, and their model is single-Agent-per-channel. 2200 makes the opposite bet... the team is the product, and the coordination layer is what we sell. But the warning is real. Coordination overhead is expensive to build and expensive to maintain. Keep the coordination primitives (Studio, Roster, friend lists) small and stable. Let Extensions handle higher-order coordination.

**Plugins as in-process trusted code.** OpenClaw plugins run in the Gateway's process with full privileges. This is fine for a single-developer install but breaks down in any model where users install third-party Extensions they didn't write. 2200 must not adopt this pattern for Extensions. Extensions need a permission model, not "trust the author." This is non-trivial in Node and worth flagging now... isolating Extension code in a way that's both real (capability-restricted) and developer-friendly is its own design problem.

### Perplexity Computer

**Black-box execution.** The single loudest complaint. Reviewers cannot inspect intermediate state or monitor sub-agent activity in real time. As one reviewer put it, "If you are building software, the black box is a dealbreaker." 2200's Brain pattern (markdown files on disk, readable, editable) is the direct counter-design and we should keep leaning into it. **Every Agent's state must be inspectable from outside the Agent at any time.** Brain notes, current task, blocker reason, cost-so-far. This is architectural, not a feature. **Cross-ref:** [[2026-04-24-brain-is-files-not-database]] locks the principle. Future-anyone who tries to add SQL under performance pressure has to fight that decision record.

**Compounding feedback loops with no cost cap.** A user burned $200 of credits on a single webpage build because silent integration failures triggered retries that spawned sub-agents that retried that triggered more sub-agents. No visibility, no caps, no kill switch. 2200's notification tier system and "blocked Agents do not retry silently" principle are the right reaction. **Cross-ref:** [[2026-04-24-cost-behavior-shape]] resolves the cost-cap gap with eight layers of protection (mostly silent), an Agent Behavior settings dashboard, and Pulse as the visualization surface. Pulse design captured in [[pulse]].

**Integration brittleness.** Vercel OAuth tokens expiring per-session, forcing re-authentication. 400+ advertised integrations with significant portions broken or flaky. The lesson: each integration is its own maintenance burden and a broken integration that fails silently is worse than not having the integration at all. 2200 should ship fewer integrations and own them end-to-end (Epic 9), and Extensions that bundle their own tools (Epic 12) need a health-check obligation. **An integration that hasn't been exercised in 30 days should be tested, not assumed working.**

**Cloud-only execution and data privacy concerns.** Perplexity Computer runs everything in their cloud. Reviewers (and Malwarebytes) flagged data privacy concerns about input logging. 2200's self-hosted-first posture, with managed service as a separate-but-equal option and the user owning data in both modes, is the right counter-positioning. Lean into it.

**Legal exposure from aggressive scraping.** Amazon won an injunction. Reddit and Forbes are litigating. This is what happens when an Agent platform is built around web scraping as a primary capability without guardrails. 2200 doesn't currently plan to compete on web scraping, but when Agents do fetch web content (and they will), respect robots.txt by default, log the requests, and surface the legal exposure to the user.

---

## 3. Primitives worth preserving

These are pieces of OpenClaw's design we should keep across the bridge into 2200.

**The Skill format.** Markdown files with frontmatter, declarative behavior, references to tools the Agent already has. Thousands of these exist in the broader ecosystem. Epic 11 (Skills ingestion) is right to target backward compatibility from day one. Worth confirming with source reading: the exact frontmatter fields, how Skills declare tool requirements, how they're invoked. v0.2 of this doc will go deeper.

**Bundle plugins (MCP wrappers).** OpenClaw distinguishes code-based plugins from bundle-style plugins, where the bundle is essentially a packaging format around an MCP server or external tool. They explicitly prefer bundle plugins where feasible. 2200's Extensions framework (Epic 12) should support both shapes. A lot of the integration problem becomes "wrap an existing MCP server" rather than "write new code," which is faster and safer.

**Provider plugins.** OpenClaw has a Plugin SDK specifically for adding new LLM providers (`sdk-provider-plugins`). New models ship weekly. 2200's Epic 10 (Model lifecycle management) needs the same shape... new providers should be addable without core code changes. A provider-plugin SDK is the right way to do that.

**Memory as an interface, not a single implementation.** OpenClaw exposes Memory as a concept with multiple backends. 2200's Brain should follow this. Filesystem markdown is the v1 default; another backend could plug in for users with specific needs (database for high-write-rate, S3 for managed-service durability, etc.). Don't lock the Brain to one storage layer.

**Native apps for every platform that matters.** OpenClaw ships iOS, Android, macOS, Linux, Windows. Their footprint is real. 2200's Epic 16 currently scopes iOS and Android only. We should at least consider whether the macOS app is more than just a packaging exercise, since the self-hosted user is often on a Mac and the install/setup story can be richer with a native shell.

---

## 4. Integration surface for Skills (Epic 11)

OpenClaw's Skill ecosystem is what we're inheriting. From the `skills/` directory listing and the docs index, here's what a Skill assumes about its host:

- A way to register the Skill with the runtime (`skills.md`, `skills-config.md`, `creating-skills.md` are the relevant docs)
- Access to declared tools (the Skill references tools by name; the host must resolve them)
- A session/conversation context the Skill can read and write into
- A way to invoke the Skill from the Agent's loop (mention, command, hook, etc.)
- An optional UI surface (the "Skill workshop plugin" suggests an interactive dev environment)
- Platform-specific variants (e.g. `Skills (macOS)`) so a Skill can take advantage of native OS APIs

For Epic 11 to deliver day-one compatibility, 2200's runtime needs:
- A Skill loader tolerant of common format variants in the wild
- A tool registry that resolves tool names the same way OpenClaw does (or close enough)
- A session-context shape compatible with what existing Skills expect to read/write
- An invocation path from Agent → Skill → tools → result that matches OpenClaw's expected flow

**Resolved (v0.2 update).** The strict-vs-loose flag from v0.1 is locked: 2200 ships a **take-and-normalize-with-disclosure pipeline**. Parse the SKILL.md, validate against spec, normalize known issues and log every change, notify the user of what was cleaned up and why, install as a minimal Extension. See [[2026-04-24-skill-compatibility-pipeline]]. Source-reading work for v0.3 still has to nail the actual frontmatter contract and tool-resolution mechanics — that's covered in Section 7, study target #2.

---

## 5. Operational realities

### Upgrades and migrations

OpenClaw has a documented migration guide for upgrades and a Plugin SDK migration story. They take version compatibility seriously enough to write docs about it. 2200's epic map currently treats Extension versioning as semver-like (Epic 12) but doesn't have an answer for runtime upgrades. **Resolved (v0.2 update).** [[2026-04-24-runtime-upgrade-shape]] locks an epic-plus-convention split: every epic builds substance (schema versioning, state-on-disk discipline, etc.) from day 1 per the [[upgrade-readiness]] convention; the user-facing upgrade mechanism is its own future epic. Source reading needs to capture how OpenClaw actually does an in-place upgrade (Section 7, study target #1).

### Multi-agent coordination

OpenClaw documents multi-agent routing and sub-agents, but their default architecture refuses to be opinionated about Agent hierarchies. Their use case is closer to "multiple Agent personas on multiple channels" rather than "a team of persistent Agents working together." 2200 is making the opposite bet. The implication: we should not expect to inherit multi-agent coordination patterns from OpenClaw. We're inventing this part. The Studio, Roster, and friend-list primitives in the architecture doc are the right place to start.

### Credential storage

OpenClaw has a real Secrets management story (`SecretRef credential surface`, `Secrets apply plan contract`). Per-agent auth profiles live in `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`. This is a solved problem we should learn from rather than reinvent. 2200's Epic 9 (Tool system) should adopt a similar SecretRef abstraction so credentials are referenced indirectly and can be rotated, scoped, and audited without changing Agent configuration.

### Deployment

OpenClaw supports Docker, Kubernetes, Node.js, Nix, Podman, and a long list of cloud platforms. They take "self-hosted means many environments" seriously. 2200's hosting model (architecture doc) talks about local self-hosted and managed... we should add a third row to that table: **deployment-target diversity for self-hosters.** A Mac Mini and a Raspberry Pi 5 are not the same target. Simon's lane.

### Cost and metering

Neither system has solved cost transparency to the user's satisfaction. Perplexity Computer is the cautionary tale. OpenClaw is BYO-key, so cost is the user's problem. 2200's managed-service path makes us responsible for cost visibility. **Resolved (v0.2 update).** [[2026-04-24-cost-behavior-shape]] establishes the eight-layer protection model with Pulse as the visible layer, Agent Behavior settings dashboard for configurability, and tool-loop detection at Layer 1. Section 7 study target #9 covers the source-reading work needed to understand OpenClaw's tool-loop detection well enough to lift the mechanics.

---

## 6. User experience patterns

### What OpenClaw users actually do

The Skill catalog tells the story. The most-built and most-bundled skills cluster in three areas:

1. **Personal data wrangling.** Apple Notes, Apple Reminders, Bear, Notion, Obsidian, Things, Trello. Users want their Agent to read and write into the apps they already use. **This validates the OpenPub-as-primary-surface bet only partially.** Most users don't want their Agent only in a chat surface; they want it acting on their existing tools.
2. **Communication.** Discord, Slack, iMessage, BlueBubbles, WhatsApp CLI. Users want their Agent reachable and actionable from the channels they already use. 2200's mobile-first push notification approach is a reasonable answer to this for the busy-user audience, but we should expect demand for "I want to talk to my Agent in Slack."
3. **System control.** Tmux, OpenHue, Sonos, smart-lights. Power users want their Agents to control physical and software environments. This is where 2200's shell tool (Epic 2) becomes a foundation, and where Extensions (Epic 12) earn their keep.

### What Perplexity Computer users complain about

Three patterns:

1. **Cost surprises.** Already covered. The platform doesn't make cost legible until the bill arrives.
2. **Loss of control.** "Black box" complaints translate to: the user feels the system is doing things they can't predict, can't inspect, and can't stop. 2200's pause-on-blocker model and inspectable Brain are the direct counter.
3. **Integration failure mode.** When something breaks, the user doesn't know it broke until they check the output. Silent failure is worse than loud failure. **Notification tier 4 (Passive) plus a status surface for "X integration last succeeded 7 days ago, last failed 30 minutes ago" is the right answer.** This is not in the current epic map. Recommend adding to Epic 9 (Tool system) as a sub-deliverable.

### Workflows the platform authors didn't design for

For OpenClaw, users built personal-life automation: note-taking, smart-home, timer/reminder workflows that the platform authors arguably didn't predict but that ended up being the modal use case. For Perplexity Computer, users tried to build software with it, and the platform was too opaque to support that workload, leading to expensive failures.

**Implication for 2200.** The conversational onboarding flow (Epic 14) cannot only target the use cases we predict. It needs to be open-ended enough to spawn Agents whose behavior we didn't design for. The Skill ecosystem is the answer to "how do users extend their Agents toward use cases we didn't predict." Make sure Epic 11 lands cleanly.

---

## Top-level lessons and proposed changes to the epic map

The epic map ([[03-epic-map]] is now at v0.5) is largely sound. The eight findings below were proposed in v0.1; v0.2 marks the status of each after the 2026-04-24 walkthroughs.

1. **Cost caps are a runtime concept, not just a billing UI feature.** **LOCKED.** [[2026-04-24-cost-behavior-shape]] formalizes eight protection layers with Pulse as the visible surface. Captured in [[03-epic-map]] v0.5 across Epic 2 (tool-loop, stuck-Agent), Epic 7 (Notifications), and the Agent Behavior settings dashboard.
2. **Integration health monitoring.** **LOCKED scope, design from scratch.** Source reading confirmed OC has nothing — no per-tool success/failure history, no dormancy detection, no integration-level health record. Scope addition to Epic 9 in [[03-epic-map]] v0.5 stands; 2200 designs from scratch borrowing the shape of OC's auth-profile cooldown system. See Section 8 Epic 9 for spec implications.
3. **Tool-loop detection from day one.** **LOCKED, three layers confirmed.** Source reading completed the picture: process layer (`noOutputTimeoutMs`, lift from OC), agent-loop layer (5 detector kinds in `tool-loop-detection.ts`, lift from OC), cost-behavior layer ([[2026-04-24-cost-behavior-shape]] — 2200 only). All three needed for full coverage.
4. **Extension permission model is non-trivial.** **CONFIRMED greenfield.** Target 3 source reading confirmed OC has **zero** permission declarations in plugin manifests, **zero** isolation between plugins, explicit "trusted plugin" stance in SECURITY.md. The closest OC has is `plugins.allow` (binary load/no-load, no granularity). 2200 invents the permission tokens, the install-time consent surface, the runtime kernel chokepoint, and the credential abstraction. Section 8 Epic 12 has the spec implications.
5. **Skill compatibility contract.** **LOCKED.** Take-and-normalize-with-disclosure pipeline (per [[2026-04-24-skill-compatibility-pipeline]]). Target 2 deepened: full SKILL.md frontmatter contract reverse-engineered, 10 normalization rules drafted. Section 8 Epic 11 has the spec implications.
6. **Brain-as-interface is right; commit to it.** **LOCKED, contract compatibility confirmed.** Target 5 confirmed OC's own builtin Memory backend treats markdown files as source of truth and SQLite as rebuildable index — 2200 can satisfy the same contract without violating [[2026-04-24-brain-is-files-not-database]]. Honcho is the only anti-pattern reference (treats own service as authoritative).
7. **Runtime upgrade story.** **LOCKED.** [[2026-04-24-runtime-upgrade-shape]] splits the work into substance (every epic respects [[upgrade-readiness]] from day 1) and mechanism (its own future epic). Target 1 surfaced a real gap to address: OC's tool-process supervisor is in-memory only — Gateway crash loses all in-flight tool runs. 2200's `[[upgrade-readiness]]` discipline can't accept this; tool-run journal pattern is needed.
8. **Provider-plugin SDK belongs in Epic 10.** **LOCKED, scoped down.** Target 4 deepened: OC's ProviderPlugin has only 3 required fields (`id`, `label`, `auth`) and ~50 optional hooks. 2200 v1 ships ~15 hooks, adds the rest by motivation. Per-API transport (Anthropic Messages, OpenAI Responses, OpenAI Completions, Google Generative AI) lives in core, not plugins. Plugins contribute `wrapStreamFn` for attribution headers and small payload patches.

**Side-branch decisions from the same walkthrough**, not in the original eight but worth surfacing here for completeness:

- **Bulletin substrate is SCUT.** [[2026-04-24-bulletin-substrate-is-scut]]. SCUT v2.0 sibling primitive; Garfield owns; spec draft target ~2026-05-10.
- **Design language convention.** [[design-language]] — familiar-analog plus high-tech-polish principle. First formal application is [[pulse]].
- **Voice and framing convention.** Voice rules tightened, em-dashes restricted to titles only.

---

## 7. Source-reading findings (v0.3 execution complete)

All twelve study targets executed. Deep findings — file pointers, code-shape detail, file paths and line numbers — live in [[prior-art-source-findings]]. This section gives the brief tour. For each target, "verdict" captures the headline finding; for actionable Epic implications, see Section 8.

### Per-target verdicts

#### Target 1: Runtime architecture (Epic 2)
**Verdict.** OC is single-process Gateway with in-process Agents and a tool-process supervisor — the **opposite** of 2200's locked Agent-as-process model. We lift patterns, not architecture. Notable patterns to lift: BOOT.md per-Agent startup ritual, no-output-timeout tool-loop detection at process layer, plugin allowlist in config, structured fatal error hooks, cold-start performance discipline (dynamic imports, V8 compile cache, fast-path flags, lazy plugin command registration), profile/coexistence-by-state-dir CLI flag. **Notable gap in OC:** in-flight tool runs are NOT crash-recoverable (process supervisor is in-memory only); 2200's [[upgrade-readiness]] discipline can't accept this — needs tool-run journal pattern. See [[prior-art-source-findings]] §Target 1.

#### Target 2: Skill format and loader (Epic 11)
**Verdict.** SKILL.md frontmatter contract reverse-engineered. Required: `name` (with directory-basename fallback), `description` (no fallback). Rich `metadata.openclaw.{requires.bins,env,config,os,install,primaryEnv,...}` namespace plus invocation knobs (`user-invocable`, `command-dispatch`, `command-tool`, `command-arg-mode`). **Surprise finding:** OC skills do NOT declare runtime tools by structured name — only binaries, config flag paths, env vars. This was a v0.1 misread on our part. Loader tolerance is rich (dual-parser frontmatter merge, name fallback, unknown-key tolerance, legacy `metadata.clawdbot` namespace). Four invocation paths (model via XML catalog, slash command, direct tool dispatch, plugin bundle commands). EdgeClaw's ClawXSkill is an OC extension (not fork) — BM25 + embedding + LLM-judge skill discovery; recommends rather than replaces. ClawHub is ~13,700 community skills (Feb 2026); take-and-normalize pipeline must assume noise. See [[prior-art-source-findings]] §Target 2.

#### Target 3: Plugin and Extension model (Epic 12)
**Verdict.** OC's plugin model has **zero isolation, no permission declarations in manifests, and explicitly trusts plugins as operator-trusted code.** Plugin SDK is enormous (~30 register* methods, ~50 ProviderPlugin hooks). The closest OC has to permissions is `plugins.allow` allowlist (binary load/no-load, no granularity). OCMT (multi-tenant fork) has the credential isolation we want: AES-256-GCM + Argon2id (64MiB, 3 iter), decrypt-on-injection, container-per-user, group-vault with N-of-M threshold unlock. **2200 must invent install-time permission declarations + runtime kernel chokepoint** — OC offers no model. See [[prior-art-source-findings]] §Target 3.

#### Target 4: Provider-plugin SDK (Epic 10)
**Verdict.** OC's ProviderPlugin has only 3 required fields (`id`, `label`, `auth`) and ~50 optional hooks. Anthropic-specific code paths in `src/agents/anthropic-*.ts` exist because OC runs on top of `@mariozechner/pi-ai` which can't express several Anthropic Messages API needs (OAuth + Claude-CLI compat, GitHub Copilot routing, adaptive thinking per model, fine-grained beta features) — **the provider abstraction is healthy; per-API transport sits one layer below**. Same pattern for OpenAI and Google. Auth-profile model + cooldown lanes (disabled vs cooldown, immutable active windows, model-scoped cooldown) is the failover blueprint. Prompt-cache discipline is distributed across 3 layers (deterministic ordering at construction, cache boundary marker `<!-- OPENCLAW_CACHE_BOUNDARY -->`, per-API cache-control placement). **Catalog row shape (`ModelCatalogModel` with compat/tieredPricing/replaces/replacedBy/source) worth lifting nearly verbatim.** See [[prior-art-source-findings]] §Target 4.

#### Target 5: Memory backends and Brain interface (Epic 8)
**Verdict.** Memory contract (`MemorySearchManager`) has 3 layers (deepest: search/readFile/status; middle: capability seam; outer: corpus supplements). **One active memory capability at a time** — backends mutually exclusive. Builtin uses SQLite at `~/.local/share/openclaw/memory/<agentId>.sqlite` as **rebuildable index over markdown files on disk** — confirms 2200's [[2026-04-24-brain-is-files-not-database]] principle is implementable as a backend that satisfies the contract. **Honcho is the only anti-pattern reference** (treats own service as authoritative, inverts files-on-disk). EdgeClaw's ClawXMemory layered structure (Global / L2 project / L1 distilled fragments / L0 raw) plus model-guided recall ("reasoning instead of matching") is genuinely novel — likely v2 work. ClawXContext compaction knobs (`snipEnabled`, `microcompactEnabled`, `autoCompactEnabled`, `protectedRecentTurns`, `reinjectSummary`/`reinjectRecentFiles`/`reinjectCriticalToolOutputs`) are clean defaults to inherit. See [[prior-art-source-findings]] §Target 5.

#### Target 6: Secrets and credential abstraction (Epic 9)
**Verdict.** SecretRef tuple `{ source: "env"|"file"|"exec", provider, id }` is the abstraction worth lifting. Resolver guarantees (bounded concurrency, per-call cache, two-level error scoping, strict ID validation) and exec-provider protocol (`{ protocolVersion: 1, provider, ids }`) are clean designs. **OC has NO at-rest encryption** — plaintext JSON files secured only by filesystem mode 0o600 + ownership. Two parallel credential trees (`auth-profiles.json` per-Agent + `credentials/` for channels) — 2200 should unify. **Subagent inheritance is snapshot-and-copy, breaks rotation** — 2200 should do live overlay. **`securityAuditCollectors` is plugin self-reporting, NOT a kernel chokepoint** — 2200 needs `requireCredential(scope, credentialId)` API gated by Extension manifest, returning `CredentialHandle` wrapper not raw strings. OAuth refresh file lock pattern (`<stateDir>/locks/oauth-refresh/sha256(provider\0profileId)`) prevents thundering-herd; lift verbatim. See [[prior-art-source-findings]] §Target 6.

#### Target 7: Automation primitives (Epic 6)
**Verdict.** Four primitives worth keeping separate (cron, hooks, standing orders, taskflow). **Standing orders is NOT a code primitive — pure markdown convention in workspace bootstrap files.** Cron is the gold standard: tagged-union schedule kinds (`at`/`every`/`cron`), two-file storage split (definitions vs runtime state), declarative `wakeMode`, declarative `failureAlert` decomposition, transient/permanent error classification with backoff, `MIN_REFIRE_GAP_MS` safety floor. Hooks have global registration (not per-Agent), synchronous dispatch, error swallowing, less testing — fragile. Taskflow is state-machine wrapper over TaskRecord ledger, NOT a workflow language. **Coordination is via `CommandLane` enum (Main/Cron/Subagent/Nested) + mailbox pattern (`enqueueSystemEvent`), not a central scheduler.** Cron tasks hardcoded `notifyPolicy: "silent"` — does the right thing by accident; 2200's tier-from-action-type rule must be enforced at notification-creation API not scheduling layer. EdgeClaw's ClawXKairos shows tick-scheduler + Sleep tool pattern bolted on existing heartbeat. See [[prior-art-source-findings]] §Target 7.

#### Target 8: Multi-channel routing (Epic 13/14) and ACP
**Verdict.** Channel adapters have ~25 optional slots (decade of accreted edge cases). 2200 needs ~8 load-bearing slots. **No bundled "web channel" in OC** — `channel-web.ts` is misleading (re-exports WhatsApp Web). **ACP is Zed's external standard** (`@agentclientprotocol/sdk`), not OC-internal. OC uses ACP two ways: external clients in (NDJSON over stdio), and as sub-Agent runtime out (spawn child Agent that speaks ACP). **Roster and Bulletin are GREENFIELD for 2200** — OC has nothing comparable. **Three protocols not one:** channel protocol (adapter contract), Studio/Roster/Bulletin protocol (greenfield), client protocol (CLI/web/mobile, borrow OC gateway WebSocket frame discipline). Channel health monitor is thorough (transport-activity tracking with state-machine evaluation) but **logs only, no Agent-visible "channel offline" notification** — gap to flag. See [[prior-art-source-findings]] §Target 8.

#### Target 9: Tool registry + integration health (Epic 9 + Epic 2)
**Verdict.** No central tool registry object — assembled fresh per session by `createOpenClawTools()`. Built-ins win plugin-name conflicts. **MCP integration uses `{server}__{tool}` namespacing — lift verbatim.** OC is BOTH MCP host AND MCP server. **No per-tool capability scoping** (confirms Target 3 trust model). Schema normalization is two-layer (core + plugin-provider) handling 4 provider quirks (Gemini/OpenAI/Anthropic/xAI) — strict-OpenAI fallback worth lifting. **Integration health monitoring: NONE in stock OC** — confirms v0.5 epic-map gap, must design from scratch. **Agent-layer tool-loop detection EXISTS in OC** (`tool-loop-detection.ts`): 5 detector kinds (`generic_repeat`, `unknown_tool_repeat`, `known_poll_no_progress`, `ping_pong`, `global_circuit_breaker`), sliding window of 30 calls, default disabled. **2200 should default ON for David-onboarding.** Three-layer loop detection picture complete: process layer (Target 1) + agent-loop layer (this) + cost-behavior layer ([[2026-04-24-cost-behavior-shape]]). See [[prior-art-source-findings]] §Target 9.

#### Target 10: Deployment topology (Simon's lane)
**Verdict.** Four Dockerfiles split along trust/tool tiers: gateway image + 3 sandbox tiers (base, browser, common). All PaaS targets (Render, Fly, Railway) converge on `/data` mountpoint convention (`OPENCLAW_STATE_DIR=/data/.openclaw`, `OPENCLAW_WORKSPACE_DIR=/data/workspace`). **Native macOS app is 231 Swift files — full menu-bar product, not thin shell** (Sparkle auto-update, launchd LaunchAgent supervision, TCC permission management, Canvas window system). iOS/Android are **native (not RN/Tauri)** with Bonjour mDNS gateway discovery, two Android flavors (Play vs thirdParty) for Play Store policy compliance. launchd integration discipline (profile-aware labels, programmatic plist generation, restart handoff via `launchctl kickstart` — never self-exec when supervisor exists) worth lifting. **Coexistence-by-state-dir CONFIRMED in stock OC** (`src/cli/profile.ts`) — every fork ecosystem leans on this primitive. **Plugin install requires Docker rebuild for managed deployments** (read-only image layer) — managed-service tier needs plugin-rebuild-and-redeploy flow. See [[prior-art-source-findings]] §Target 10.

#### Target 11: OpenClaw fork survey
**Verdict.** Three priority forks source-read. **EdgeClaw** (OpenBMB) is the most architecturally aggressive — ClawXMemory, ClawXContext, ClawXKairos, ClawXGovernor each contributes a divergent reference design that gets routed into the relevant Part A target. **OCMT** (jomafilms) is the credential isolation reference (Target 6). **DenchClaw** was supposed to be the coexistence-pattern reference, but Target 10 confirmed the affordance is in stock OC, not just the fork. **No fork has done what 2200 is doing** — none attempts multi-Agent-as-process supervisor with first-party Agent-coordination primitives, none integrates a SCUT-equivalent identity layer, none has the OpenPub-equivalent pub surface, none ships a real Extension permission model. **The runtime + coordination + identity stack is greenfield for 2200.** See [[prior-art-source-findings]] §Target 11 for fork details and skipped/skimmed inventory.

#### Target 12: Perplexity Computer comparative analysis
**Verdict.** Perplexity Computer is best understood as a thesis about **model specialization** (~19 models, router picks per task). Aravind Srinivas's framing: *"The orchestration is the product. The model is a tool."* This is almost word-for-word 2200's bet ([[2026-04-24-baseline-model-tier]]). **Where 2200 diverges:** Perplexity's sub-agents are ephemeral, model-typed, invisible — opposite of 2200's persistent identity-bearing Agents. Comet wire protocol (per Zenity reverse-engineering) is dual-channel SSE+WebSocket; page perception is `Accessibility.getFullAXTree` returned as YAML for token economy — pattern worth borrowing for typed-protocol-from-day-one discipline. **BrowseSafe is mitigation, not solution** — single-token-stream trust collapse remains architectural. **2200's Extension permission model is closer to architectural answer than statistical.** Three things to actively borrow: (1) trust-boundary tagging on Tools + classifier-router as Layer 2 defense, (2) model-router as first-class architectural piece, (3) adversarial data flywheel for Tool-trust-boundary classifier — managed-service tier only. Four things to actively avoid: single-token-stream trust collapse, black-box sub-agent execution, browser-as-only-surface, cloud-only with data flywheel on user input. **Browser-as-agent-surface is Perplexity's bet — wrong for 2200's mobile/busy-non-engineer target.** Firecracker microVM-per-query isolation is the technical detail to absorb for Epic 12 — right level of isolation for an Extension that holds user credentials and processes web content is **closer to microVM than to in-process sandbox.** See [[prior-art-source-findings]] §Target 12.

---

## 8. Synthesis by Epic

This section organizes the source-reading findings into per-Epic implications. For each Epic, the structure is:

- **Pattern lift (free):** ideas to emulate by reimplementing from understanding. No license obligation.
- **Code lift (notice required):** specific code shapes worth copying — preserve OpenClaw's MIT copyright notice when used. Default to pattern-lift unless the saving is real.
- **Diverge from OC:** where 2200 needs to invent because OC's model is wrong for our shape or has no precedent.
- **Source pointers:** key sections in [[prior-art-source-findings]] for deeper reading.

License rule applies to all of this — see the license posture preamble at the top of this doc and [[license-posture]] for the standing rule.

### Epic 2: Agent runtime minimum

**Pattern lift:**
- Per-Agent BOOT.md startup ritual. Each Agent has a `boot.md` in its Brain. On startup, run as one-shot Agent task in a dedicated boot session with mapping snapshot+restore, plus silent-reply token convention so it doesn't spam channels.
- Tool process supervisor with two-mode spawn (child + PTY), per-run overall-timeout, **no-output-timeout (the tool-loop detector at process layer)**, and scope-based cancellation.
- Agent-layer tool-loop detection (5 detector kinds: `generic_repeat`, `unknown_tool_repeat`, `known_poll_no_progress`, `ping_pong`, `global_circuit_breaker`), sliding window of 30 calls, sha256 args/results hashing.
- Cold-start discipline: dynamic imports, V8 compile cache enabled, fast-path flags for help/version/status, lazy plugin command registration via manifest allowlist.
- Structured fatal error hooks (uncaught exception + unhandled rejection trigger a hook chain; restoreTerminalState before exit).
- Plugin allowlist mechanism: `config.plugins.allow` + `config.plugins.entries.<id>.enabled=false`. Enforced at startup, CLI invocation, enable command. **Liftable as 2200's install-time consent layer structurally, but make richer (capability set, not just plugin id).**
- Profile/container affordance in CLI entry: `--profile <name>` switches state dir + config path + port + OS-supervisor label atomically. Cheap to design in, expensive to retrofit.

**Code lift (notice required):** none planned for v1. Possible exception: `stableStringify` util (sorted keys, recursive) for cache-key construction. ~30 lines, lift with MIT notice if reimplementation creates correctness risk.

**Diverge from OC:**
- **Agent-as-process model** (locked in CLAUDE.md). OC is Gateway-as-process-with-Agents-inside; 2200 inverts. Trade real per-Agent startup speed for fault isolation.
- **State-on-disk for in-flight tool runs.** OC's process supervisor is in-memory only — Gateway crash loses all in-flight runs. [[upgrade-readiness]] can't accept this. Need tool-run journal pattern, persisted enough that restart can reconcile.
- **Agent-as-supervisable-unit.** OC supervises tools, not Agents. 2200's per-host Agent supervisor needs analogous primitives (start/stop/restart/status/healthcheck) for Agent processes themselves.
- **Default loop detection ON.** OC defaults off; 2200 defaults on for David-onboarding ("Build for David").

**Source pointers:** [[prior-art-source-findings]] §Target 1, §Target 9.

### Epic 6: Scheduler and automation

**Pattern lift:**
- Don't pre-collapse the four primitives. Cron + hooks (separate APIs) belong in Epic 6. Standing orders defer to workspace/Brain epic. Taskflow probably its own later epic.
- Cron schema: tagged union over `at` / `every` / `cron`. `wakeMode: now | next-heartbeat` as declared field, not runtime escalation knob (right pattern for tripwire #7).
- Two-file storage split (definitions vs runtime state). Definitions git-trackable; runtime state gitignored.
- Failure-alert decomposition: `{ after, cooldownMs, channel, to, mode }` declared per-job, separate from `delivery` block.
- Transient/permanent error classification with regex pattern matching, bounded retries, exponential backoff, `MIN_REFIRE_GAP_MS = 2000` safety floor, `MAX_TIMER_DELAY_MS = 60_000` ceiling. Track these as named hazards.
- Startup catch-up: bounded immediate runs (`maxMissedJobsPerRestart`, default 5) + staggered deferred runs (`missedJobStaggerMs`, default 5000ms).
- Hook event taxonomy (`command/session/agent/gateway/message`) and HOOK.md + handler.ts directory layout.

**Code lift (notice required):** none planned.

**Diverge from OC:**
- **Scheduler runs in supervisor, not Agent runtime.** OC's cron timer is one setTimeout per gateway. 2200's Agent-as-process model means scheduler runs in supervisor, signals Agent process to wake when scheduled work fires.
- **Per-Agent CommandLane queues.** OC has global Main/Cron/Subagent/Nested lanes. With OS-process Agents, each process has its own queue naturally.
- **Skip the `globalThis` singleton hook handler hack.** OC needs it for hook handler registration across bundle splits. 2200's per-process model makes this unnecessary.
- **Tier-from-action-type enforced at notification-creation API**, not scheduling layer. OC hardcodes `notifyPolicy: "silent"` for cron tasks — does the right thing by accident. 2200 makes it architectural.

**Source pointers:** [[prior-art-source-findings]] §Target 7.

### Epic 8: Brain (memory)

**Pattern lift:**
- `BrainStore` interface narrowed from OC's `MemorySearchManager` — `readFile(relPath, from?, lines?)`, `writeFile(relPath, content, mode)`, `listFiles(prefix?, recentN?, by?)`, optional `search(query, opts)`, `status()`. Line-windowed reads, line-numbered search results.
- Source-of-truth-is-files invariant. SQLite (or whatever) is rebuildable index, lives in `.cache/` location separate from Brain.
- ClawXContext compaction knobs (`snipEnabled`, `microcompactEnabled`, `autoCompactEnabled`, `protectedRecentTurns`, `autoCompactReserveTokens`, `reinjectSummary`/`reinjectRecentFiles`/`reinjectCriticalToolOutputs`) as clean defaults.
- ClawXMemory's L0/L1/L2/Global layered structure as a stricter Brain convention (reachable as v1.x once core lands).

**Code lift (notice required):** none yet.

**Diverge from OC:**
- **Per-Agent isolation at Brain directory level**, not index level. Makes accidental cross-Agent leakage impossible.
- **Auto-consolidation as v2 capability**, not v1. Pattern depends on having working search/recall layer live long enough to produce a recall ledger.
- **Drop multimodal embedding pipeline for v1** (text-only). Drop QMD backend (out of scope). FTS5-only search in v1; opt-in vector search later.
- **Compaction reinjection (ClawXContext pattern) belongs in runtime/loop epic**, not Epic 8. Epic 8 just exposes "recently-touched files" query for runtime to use.

**Source pointers:** [[prior-art-source-findings]] §Target 5. Plus parking doc [[brain-visualization]] for the visualization layer (build with libraries, native React shell — Cytoscape.js MIT + react-markdown MIT + remark-wiki-link MIT).

### Epic 9: Tools, integrations, secrets

**Pattern lift:**
- Tool registry per-session factory: `createTools(context)` returns `Tool[]` array. Built-ins win name conflicts. Plugin tools registered through wrapper that stamps `pluginId` metadata.
- MCP wholesale: stdio child-process pattern, `{server}__{tool}` namespacing capped at 64 chars (server prefix ≤ 30), sanitized to `[A-Za-z0-9_-]`, dedup with `-2`/`-3` suffixes, preserve `mcpServer`/`mcpTool` in `details` for audit.
- Schema normalization two-layer pattern: core for top-level union flattening + provider-keyword stripping; per-provider plugin hook for transport-family rewrites. **Strict-OpenAI fallback** ("if any tool fails strict, send `strict: false` instead of failing the request"). Inspector pattern for diagnostics.
- SecretRef tuple `{ source: "env"|"file"|"exec", provider, id }`. Three-source resolver with bounded concurrency (4 providers, 512 refs/provider, 256KiB batch). Per-call cache. Two-level error scoping. Strict ID validation. Exec-provider protocol: `{ protocolVersion: 1, provider, ids }` ↔ `{ protocolVersion: 1, values, errors }`.
- `assertSecurePath` policy: absolute, non-symlink unless allowed, owner-uid match, no group/world write/read.
- OAuth refresh file lock pattern: `<stateDir>/locks/oauth-refresh/sha256(provider\0profileId)`. Prevents thundering-herd.
- Atomic-write-with-rollback for credential apply-plans. Snapshot-then-restore on failure.
- Auth profile model: secrets file (`auth-profiles.json`) + state file (`auth-state.json`) split. Three credential types (`api_key | token | oauth`). `ProfileUsageStats` shape.
- Failover policy: stepped cooldown (30s/60s/5min), exponential backoff for billing/auth_permanent, immutable active windows, model-scoped cooldown for `rate_limit`, failure-window-based counter reset (24h default). Skip the WHAM probe (OpenAI-Codex-specific).
- Three-layer loop detection: process layer (`noOutputTimeoutMs`) + agent-loop layer (5 detector kinds) + cost-behavior layer ([[2026-04-24-cost-behavior-shape]]).

**Code lift (notice required):** SecretRef resolver implementations are tightly tested; lifting the env/file/exec resolver code with MIT notice may save real implementation time. ~100-300 lines per resolver. Decision deferred to implementation pass — try reimplementation first, fall back to lift if reimplementation creates correctness or security risk. Schema normalization helpers similar story (~200 lines, well-tested).

**Diverge from OC:**
- **Real per-Tool capability scoping.** OC has none. 2200 needs declarative install-time capability manifests on Tools (not just Extensions): `Tool.capabilities: { fs?, net?, exec?, mcp? }`. Enforced at dispatch layer by wrapping `execute()` with a guard.
- **Integration health monitoring designed from scratch.** OC has nothing. Borrow shape from auth-profile cooldown system: per-integration record `{ lastSuccess, lastFailure, lastFailureReason, rollingSuccessRate, cooldownUntil?, dormantSince? }`. Surface in "doctor" CLI command. Cooldown gates dispatch.
- **At-rest credential encryption.** OC has none — plaintext JSON files. Pluggable backend: filesystem-with-mode-0o600 default (matches OC), with optional macOS Keychain / Linux libsecret / Windows DPAPI backend that wraps SecretRef payloads or wraps a master key.
- **Live overlay credential inheritance.** OC snapshots-and-copies subagent inheritance, breaks rotation. 2200 does live overlay (reference, not copy) so rotation propagates atomically.
- **Kernel-level credential audit log.** OC's `securityAuditCollectors` is plugin self-reporting only. 2200 logs every `requireCredential(scope, credentialId)` call (Agent ID, Extension ID, credential ref, timestamp, success/failure) at kernel layer.
- **Single unified credential layout.** OC has two parallel trees. 2200 unifies.
- **`requireCredential` returns `CredentialHandle` wrapper**, not plaintext string. Wrapper has only operations like "set this header on outbound HTTP request" or "pass to LLM client constructor." Prevents credential from leaking into Extension logs/diagnostics.
- **Default loop detection ON** per Epic 2 divergence above.

**Source pointers:** [[prior-art-source-findings]] §Target 6, §Target 9.

### Epic 10: Provider lifecycle

**Pattern lift:**
- Provider plugin SDK shape: `definePluginEntry({ id, name, description, register })`. Required `ProviderPlugin` fields: `id`, `label`, `auth: ProviderAuthMethod[]`. ~15 optional hooks for v1 (catalog, discovery, resolveDynamicModel, wrapStreamFn, buildReplayPolicy, resolveThinkingProfile, isCacheTtlEligible, resolveSyntheticAuth, shouldDeferSyntheticProfileAuth, resolveUsageAuth, fetchUsageSnapshot, matchesContextOverflowError, classifyFailoverReason, onModelSelected, wizard).
- Catalog row shape `ModelCatalogModel` with `compat`, `tieredPricing`, `replaces`/`replacedBy`, `source` fields.
- Per-API transport modules in core, not plugins. Transport switchboard switches on `model.api` and dispatches to core-owned `anthropic-messages` / `openai-responses` / `openai-completions` / `google-generative-ai` transport. Plugins contribute `wrapStreamFn` to layer attribution headers and small payload patches; do NOT implement SSE parsing themselves.
- Local-model integration: lean on `openai-completions` API family as wire-level lingua franca. Per-server plugins (Ollama, LM Studio) for discovery, warmup, model-pull, embeddings, error matchers.
- Prompt-cache discipline (3 layers): deterministic ordering at construction, cache boundary marker (literal string sentinel), per-API placement (`cache_control` for Anthropic, `store: true` + `previous_response_id` for OpenAI Responses).

**Code lift (notice required):** schema normalization helpers are well-tested and probably worth lifting with MIT notice. ~200 lines.

**Diverge from OC:**
- **Skip the 50+ provider hooks.** v1 ships 15. Add hooks only when a real plugin needs one.
- **Skip `discovery: { order: "late" }` machinery** until plugin count crosses ~10.
- **Skip deprecated capability hooks** (`isBinaryThinking`, `supportsXHighThinking`, `resolveDefaultThinkingLevel`) — go straight to `resolveThinkingProfile`.
- **Skip Claude-CLI / Codex-CLI synthetic-auth modes** for v1. Add later if 2200 wants subscription attachment.

**Source pointers:** [[prior-art-source-findings]] §Target 4.

### Epic 11: Skills (ingestion and runtime)

**Pattern lift:**
- Frontmatter contract: required `name` (with directory-basename fallback), required `description` (no fallback). Optional: `homepage`, `user-invocable`, `disable-model-invocation`, `command-dispatch`, `command-tool`, `command-arg-mode`, `metadata.openclaw.{requires.bins,env,config,os,install,primaryEnv,...}`. Legacy `metadata.clawdbot` accepted with auto-migration disclosure.
- Dual-parser frontmatter merge (YAML parse + line-by-line single-key parse, line wins on inline `:`). Log every divergence as normalization event.
- Take-and-normalize-with-disclosure pipeline per [[2026-04-24-skill-compatibility-pipeline]]. 10 normalization rules: tolerant frontmatter parse, name fallback, description requirement, path-escape rejection, strip Claude-Code-format keys (`allowed-tools`, `model`), coerce legacy namespace, validate install specs (drop unsafe entries), boolean-string coercion, slash-command name sanitization, tool-dispatch downgrade.
- Three invocation paths in v1: model invocation via XML catalog (primary), user slash command, direct tool dispatch. Plugin bundle commands deferred.
- Catalog token-budget two-tier degradation: full XML → compact (name + location only) → binary-search prefix. Surface "Skills truncated" warning.

**Code lift (notice required):** frontmatter parser merge logic could be lifted with MIT notice if dual-parser implementation is non-trivial. Probably reimplementable.

**Diverge from OC:**
- **Skills install as minimal Extensions** in 2200. OC treats skills as a first-class runtime concept; 2200 reuses the Extension permission infrastructure.
- **Per-skill disclosure surface at install.** OC drops to debug logs for almost everything; 2200 surfaces a per-skill summary: "Installed `apple-notes` (1 normalization: legacy metadata namespace migrated)."
- **Skip `requires.config` until 2200's tool registry exists.** OC's "config-path truthy" eligibility pattern is a quirk worth not copying. 2200's tool registry should expose direct tool-name dependency.
- **Skip remote-node eligibility entirely.** OC-specific to its gateway/node split.

**Source pointers:** [[prior-art-source-findings]] §Target 2.

### Epic 12: Extensions framework

**Pattern lift:**
- Manifest format inspiration from `openclaw.plugin.json` shape: identity (id, name, version, description), config schema, capability declarations, lifecycle hooks. **But add `permissions: [...]` array as required field — see diverge below.**
- `package.json` compat metadata: `compat.pluginApi` and `build.openclawVersion` enforced as install-time errors.
- MCP wrapping pattern: stdio child-process spawn, name-safety rules, capability negotiation deferred to MCP server's own JSON-RPC initialize.

**Code lift (notice required):** none planned.

**Diverge from OC:**
- **Manifest declares permissions explicitly.** Top-level `permissions` array with capability tokens 2200 recognizes:
  - `fs:read:workspace`, `fs:write:workspace`, `fs:read:home`, `fs:write:home`, `fs:read:any`, `fs:write:any`
  - `exec:command:<allowlisted-bin>`, `exec:shell` (broad, requires explicit consent)
  - `net:outbound:host:<hostname>`, `net:outbound:any`
  - `credentials:read:provider:<id>`, `credentials:write:provider:<id>`
  - `tool:register`, `channel:register`, `gateway:method:<scope>`
  - `agent:spawn`, `agent:control:<id>`
  - `brain:read:agent:<id>`, `brain:write:agent:<id>`, `brain:read:any`, `brain:write:any`
  - `notification:emit:<tier>`
  - `schedule:create`, `schedule:cancel`
  
  If a permission isn't in the manifest at install time, runtime **denies the call** — not warns, denies. No `dangerouslyAllowAll` flag.
- **Install-time consent mandatory and visible.** Borrow OC's `plugins.allow` schema, replace with per-Extension installed-permissions record. Installing shows full permission list, requires explicit acknowledgement.
- **No runtime permission requests.** CLAUDE.md tripwire #6 made architectural: no `api.requestPermission(...)`. New permission needs new manifest version and re-consent.
- **Tool/Brain/Notification calls go through permission kernel.** Runtime helpers are not direct passthroughs — calls into kernel that checks against install-time grant. Rejection is typed error; Extension can catch but not bypass.
- **Sharply smaller SDK surface.** OC's 30 register* methods; 2200 v1 ships ~7: `registerTool`, `registerHook`, `registerCommand`, `registerService` (with `start`/`stop`), `registerChannel`, `logger`, `runtime: { fs, exec, net, credentials, brain, notification, schedule, agent }` — each runtime helper is a permission-kernel chokepoint. Add explicit `unregister(api)` on disable/uninstall.
- **Manifest schema in separate package** (`@2200/extension-contract`) so non-runtime tooling consumes it without booting the runtime.
- **Isolation strategy: in-process v1 with permission kernel chokepoint, microVM future.** Design kernel API so it doesn't assume same-address-space access (structured-clone-able request/response shapes). Document explicitly so it isn't forgotten when isolation gets added. Per Perplexity findings: right level of isolation for an Extension that holds user credentials and processes web content is closer to microVM than to in-process sandbox.
- **Uninstall contract.** Lift OC's `removePluginFromConfig` shape; **add** stored credentials, scheduled jobs owned by Extension, Brain entries written under Extension namespace, persistent service state. Define per-Extension namespaces (`brain/extensions/<id>/`, `credentials/extensions/<id>/`) so uninstall is clean directory wipe + config edit.
- **No `--dangerouslyForceUnsafeInstall` bypass flag.** No "trusted operator equals trusted plugin" framing. Code-pattern security scanners as defense-in-depth signal, not the install gate.

**Source pointers:** [[prior-art-source-findings]] §Target 3, §Target 6.

### Epic 13/14: Web client / Mobile client / Multi-channel routing

**Pattern lift:**
- Channel adapter contract (~8 load-bearing slots): `id`/`meta`/`capabilities` (registration), `gateway` (lifecycle), `outbound` (egress), `onMessage(envelope) → DeliverResult` (explicit receive — 2200's improvement over OC's opaque pattern), `messaging.resolveInboundConversation` (channel-specific peer/thread parsing), `status` (per-account snapshot + probe), `auth`/`setup` (wizard, login), `bindings`/`conversationBindings` (Studio/Roster coupling).
- Gateway routing tier list (9 tiers, first match wins): peer / peer.parent / peer.wildcard / guild+roles / guild / team / account / channel / default. WeakMap caches keyed by config reference, drop on config rev.
- Session key shape: encodes routing identity. `agent:<agentId>:main` (DM main), `agent:<agentId>:<channel>:<peerKind>:<peerId>` (group/channel), thread suffix `:thread:<normalizedThread>`.
- ACP sub-Agent runtime pattern: parent passes task, gets child session key + run ID + stream log path. Lift policy gates verbatim (depth, child limit, sandbox restrictions). JSONL sidecar log format for parent-watch-child streaming — portable, debuggable, files-on-disk friendly.
- Gateway frame discipline: versioned `hello` handshake, capability negotiation, scoped auth, three frame kinds (`req`/`res`/`event`).

**Code lift (notice required):** session-key construction logic is well-tested and short (~50 lines). Lift with MIT notice if convenient.

**Diverge from OC:**
- **Three protocols, not one:** channel protocol (adapter contract), Studio/Roster/Bulletin protocol (Agent-to-Agent, greenfield), client protocol (CLI/web/mobile).
- **Channel-protocol SDK is load-bearing from day one.** OC's `channelRuntime` SDK was retrofitted late; bundled channels skipped it and import internal modules directly. 2200 makes the SDK boundary load-bearing — bundled and external channels both go through same surface.
- **Studio, Roster, Bulletin are greenfield.** OC has nothing comparable. ACP is push-only; child has no view of siblings. 2200 needs dedicated surfaces.
- **No bundled "web channel" in OC**, and 2200 doesn't ship one either as a *channel*. Web client is on the client protocol, not the channel protocol — different concern.
- **Channel health → Agent-visible notification.** OC's channel health monitor is logs-only. 2200 surfaces "channel offline" as Notification (action-type-determined tier).

**Source pointers:** [[prior-art-source-findings]] §Target 8.

### Epic 16 and Simon's lane

**Pattern lift:**
- Native Swift (iOS) and native Kotlin/Compose (Android), not React Native or Tauri. Per-platform code surface (HealthKit-adjacent, EventKit, Location, Motion, Camera, share extensions, Watch app, Live Activities, biometric lock, encrypted prefs, Bonjour discovery, push) justifies it.
- Bonjour mDNS gateway discovery (`_2200-gw._tcp` or whatever name). Right default for "phone on same WiFi as home server" use cases.
- Two product flavors for Android: `play` and `thirdParty`. Compile out features Play Store rejects (SMS, Call Log) for `play`, keep them for sideload users.
- Push notifications via APNs relay. Gateway can't push directly; needs relay service. Simon owns.
- launchd integration pattern (macOS): label assertion/sanitization, profile-aware label resolution, programmatic plist generation, restart handoff via `launchctl kickstart` (never self-exec when supervisor exists).
- Sandbox-tier Dockerfile separation: gateway image + sandbox-base + sandbox-common + sandbox-browser. Three trust/tool tiers.
- `/data` mountpoint convention for PaaS targets: `state/.2200` and `state/workspace` subdirs.
- `--profile <name>` CLI flag switching state dir + config path + port + OS-supervisor label atomically. Cheap to design in, expensive to retrofit.

**Code lift (notice required):** launchd helper (`launchd-plist.ts`, `launchd-restart-handoff.ts`) is small (~200 lines combined) and well-defended. Worth lifting with MIT notice if Simon prefers.

**Diverge from OC:**
- **Build for the button.** OC's `codetitlan/openclaw-railway-template` has 38 stars but 210 forks — Railway requires forking template repo to deploy, so 210 forks = 210 deployments. **Managed-deploy-from-button-flow is dominant self-host path.** 2200's managed-service tier needs one-click button flow with state on mounted volume + setup password gate.
- **Plugin install requires Docker rebuild for managed deployments** (read-only image layer). 2200 implication: plugin manifests live under `/data` state dir, not app dir; webhook or scheduled rebuild rolls new extensions out.
- **Respawn opt-in, not opt-out.** OC's CLI re-execs itself with right Node version/flags/state dir; dangerous under supervisor. Detect every supported supervisor (launchd, systemd, Docker init, Windows Task Scheduler) before re-execing.
- **Push relay service** is 2200-specific (Simon owns).

**Source pointers:** [[prior-art-source-findings]] §Target 10. Plus Simon-inbox message scoped for next session.

### Cross-cutting: Brain visualization (Epic 8 + Epic 13)

**Build with libraries**, not whole-app integration. SilverBullet rejected (iframe-only embedding); Logseq rejected (AGPL viral + ClojureScript/Electron + perf ceiling at 3.5k notes). Native React component using:
- **Cytoscape.js** (MIT) — graph rendering, click-and-drag native
- **react-markdown** (MIT) + **remark-wiki-link** (MIT) — content rendering
- 2200 owns the React shell, interaction model, visual language

See [[brain-visualization]] for the parking-doc analysis.

### Cross-cutting: Perplexity-derived patterns

**Pattern borrowed in spirit (not lifted in code):**
- **Trust-boundary tagging on Tools.** Declaratively flag any Tool that produces untrusted content. Runtime tracks trust characteristics across tool invocations.
- **Hybrid detection: fast classifier + frontier-LLM router on uncertain cases.** Layer 2 defense. Pin architectural boundary first (Extension permissions, no runtime escalation, capability scoping); classifier-router as defense-in-depth on top. Borrow `perplexity-ai/browsesafe-bench` as benchmark dataset (separate licensing concern; verify their weights' license before using).
- **Model-router as first-class architectural piece.** Classifier picks model per task. Router itself is a small model. Routing transparent in Pulse.
- **Adversarial data flywheel for Tool-trust-boundary classifier.** Managed-service tier only (opt-in telemetry). Self-hosted instances stay private.

**Patterns explicitly avoided:**
- Single-token-stream trust collapse (untrusted content + trusted instructions in same context window without architectural marker)
- Black-box sub-agent execution (every unit of work that costs real money or takes real time must be inspectable)
- Browser-as-only-surface (Pub primary; channels interchangeable; Agent first-class)
- Cloud-only with data flywheel on user input (architecture that requires the flywheel silently breaks self-hosted promise)

**Source pointers:** [[prior-art-source-findings]] §Target 12.

---

## What's next

This is v0.3 of the prior-art doc. Source-reading phase is complete. Next steps per CLAUDE.md sequencing:

1. **Doug reviews v0.3** (this doc) plus [[prior-art-source-findings]] (the appendix). Surface anything that needs further investigation before Epic 2 spec drafting.
2. **Hobby drafts Epic 2 spec** at `wiki/epics/02-agent-runtime-minimum.md`. Folds in Section 8 Epic 2 implications. Includes upgrade-readiness section per [[upgrade-readiness]] disciplines 1, 2, 3, 6. Includes tool-loop and stuck-Agent detection per [[2026-04-24-cost-behavior-shape]] Layer 1. Process supervisor model with state-on-disk discipline. Identity loader, BOOT.md ritual, model binding. Schema versioning for Identity files and any other persistent artifacts.
3. **Doug reviews Epic 2 spec.** Lock or revise.
4. **Begin Epic 2 implementation** if spec approved. Project structure, lint, test harness, CI.

**Mid-stream:** watch for Garfield's Bulletin spec draft (~2026-05-10). When it lands, fold into 2200 planning where relevant.

**Inbox messages drafted next session:** Simon (Phase 2 deployment-target diversity findings, push relay service ownership, plugin-rebuild-and-redeploy flow for managed mode). Garfield if Bulletin spec timing slips.

---

*End of prior-art-analysis.md v0.3.*
