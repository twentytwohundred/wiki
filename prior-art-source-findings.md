---
title: "Prior-Art Source-Reading Findings (Permanent Reference)"
type: reference
status: active
tags: [prior-art, source-reading, openclaw, perplexity, edgeclaw, ocmt, findings, appendix]
created: 2026-04-25
updated: 2026-04-25
linked_docs:
  - "[[prior-art-analysis]]"
  - "[[2026-04-24-baseline-model-tier]]"
  - "[[2026-04-24-skill-compatibility-pipeline]]"
  - "[[2026-04-24-cost-behavior-shape]]"
  - "[[2026-04-24-runtime-upgrade-shape]]"
  - "[[2026-04-24-brain-is-files-not-database]]"
canonical_path: wiki/prior-art-source-findings.md
---

# Prior-Art Source-Reading Findings

Permanent reference appendix to [[prior-art-analysis]]. The executive synthesis lives in [[prior-art-analysis]] v0.3 Section 8 ("Synthesis by Epic"). This doc holds the deep per-target source-reading findings produced during the v0.3 execution pass.

**How to read this doc.** One section per Section 7 study-plan target. Each section quotes file paths and line numbers from the OpenClaw clone at `/Users/dhardman/code/2200-reference/openclaw/` so findings are verifiable. Use this when the executive synthesis names a pattern but you need the underlying mechanics, file pointers, or code-shape detail before implementing.

**License posture.** OpenClaw is MIT (Copyright (c) 2025 Peter Steinberger), 2200 ships under Elastic License v2. MIT → Elastic v2 is permitted. Architectural patterns are not copyrightable — free to emulate. Verbatim code copies require preserving the MIT copyright notice; default to "lift the pattern, reimplement" rather than "lift the code." See [[license-posture]] for the standing rule.

---

## Target 1: Runtime architecture (Epic 2)

**Status:** complete (orientation + 8 source files read).

### Files read

- `AGENTS.md` (root, code-agent guide)
- `src/runtime.ts` (terminal IO plumbing only, not the runtime architecture)
- `src/entry.ts` (CLI entry, respawn logic, profile/container parsing)
- `src/cli/run-main.ts` (the actual CLI runtime entry)
- `src/gateway/AGENTS.md` (test-perf guidance, not architecture)
- `src/gateway/boot.ts` (the BOOT.md ritual)
- `src/gateway/protocol/AGENTS.md` (protocol-boundary rules)
- `src/process/supervisor/types.ts` (process supervisor interface)
- `src/process/supervisor/supervisor.ts` (process supervisor implementation)
- `src/process/restart-recovery.ts` (one-function restart-iteration utility)
- `src/agents/agent-runtime-config.ts` (Agent config resolution)

### Architectural shape (as reverse-engineered)

OC's runtime is **single-process Gateway with in-process Agents**, plus a tool-process supervisor. Diagram of the pieces:

```
openclaw (CLI binary)
  └── entry.ts → cli/run-main.ts
        ├── profile/container parsing (state-dir swap for coexistence)
        ├── lazy plugin command registration (manifest-first, allowlist-gated)
        ├── Commander dispatch
        │     ├── bare-root → Crestodian (interactive REPL)
        │     ├── named subcommand → Gateway boot or one-shot
        │     └── plugin command → plugin handler
        └── runtime
              ├── Gateway (in-process)
              │     ├── Agent runtime (in-process per session)
              │     │     ├── BOOT.md ritual (one-shot Agent task on startup)
              │     │     └── tool dispatch
              │     ├── channel adapters (in-process)
              │     ├── plugin runtime (in-process)
              │     └── wire protocol (typed schema, runtime validators)
              └── Process supervisor (manages spawned tool/shell processes, NOT Agents)
                    ├── child mode + PTY mode
                    ├── overall-timeout + no-output-timeout
                    ├── scope-based cancellation
                    └── in-memory only (no persistence across Gateway restart)
```

### What held up

1. **Lazy/manifest-first plugin registration.** Plugins register CLI commands lazily, gated by a config-level allowlist (`config.plugins.allow`) and per-plugin enable flag (`config.plugins.entries.<id>.enabled`). The CLI checks both before dispatching. This is how OC implements Extension permissions at the manifest layer. **Worth lifting for 2200 Epic 12.**

2. **The BOOT.md per-Agent ritual.** Each Agent can have a BOOT.md file. On Agent startup, the Gateway runs BOOT.md as a one-shot Agent task. It uses a unique boot-session-id, snapshots and restores the main-session-mapping so boot doesn't pollute, and uses a `SILENT_REPLY_TOKEN` convention so the Agent can "say nothing" without breaking the message tool contract. **This pattern is exactly what 2200 needs for Epic 2 Identity loader / Agent startup flow.** Direct lift, with adaptation to 2200's Brain-on-disk and process-per-Agent shape.

3. **Process supervisor with no-output-timeout.** The tool-loop detector at the process layer is simple, clean, and effective: spawn a child or PTY with `noOutputTimeoutMs`; if the process produces no output for that long, kill it with `no-output-timeout` reason. Plus an `overall-timeout` for hard ceiling. **Direct lift for Epic 2 + [[2026-04-24-cost-behavior-shape]] Layer 1.**

4. **Scope-based cancellation.** Each spawned run carries a `scopeKey`. `cancelScope(scopeKey)` cancels all runs in scope. `replaceExistingScope=true` on spawn cancels existing same-scope runs first. **Useful for "this Agent's tools" or "this session's tools" cleanup.** Lift for Epic 2.

5. **Wire-protocol-as-first-class.** `gateway/protocol/` has its own boundary doc declaring "schema changes are protocol changes, not local refactors." Schema, runtime validators, docs, tests, and generated client artifacts are kept in sync. Protocol versioning is explicit. **2200's Studio/Roster/Bulletin protocols should match this discipline from day one.**

6. **Cold-start performance discipline.** Dynamic imports throughout (`await import(...)` rather than top-level imports), fast-path flags for common operations (root help, version, browser help), pre-computed help text, lazy plugin command registration, V8 compile cache enabled. **TS-on-Node cold-start is real and 2200 needs to plan for it.** Worth a convention record.

7. **Structured fatal error hooks.** `runFatalErrorHooks` runs a hook chain on uncaught exception or unhandled rejection. `restoreTerminalState` cleans up the terminal before exit. Not just stack-trace-and-die. **Lift for Epic 2.**

8. **Profile/container affordance is in the CLI entry point.** `--profile` and `--container` are first-class. The fork-survey "coexistence by state-dir" pattern IS first-class in OC, not a fork-only thing. **2200's CLI must support this from day one.**

### What broke under load (or breaks for 2200's model)

1. **Process supervisor is in-memory only.** Per `reconcileOrphans()` no-op comment: "Active runs are not recovered after process restart in the current model." Gateway crash → all in-flight tool runs lost. **2200 with [[upgrade-readiness]] discipline can't accept this.** Tool runs need at least minimal on-disk persistence so they can be reconciled on restart. Probably a "tool-run journal" pattern. Real Epic 2 design problem.

2. **In-process Agents tie everything to one process.** OC's choice — single Gateway process holds all Agent runtimes — means a Gateway crash takes everything down. Fault isolation is poor. Memory leaks in one Agent affect all. **2200's locked Agent-as-process model trades worse cold-start for fault isolation.** This is the right call for our multi-Agent product but it costs us OC's in-process speed advantage. Mark explicitly in Epic 2 spec.

3. **No "Agent-as-supervisable-unit" affordance.** OC supervises tools, not Agents. The Gateway is the supervisable unit (`openclaw gateway restart/status`). For 2200, Agent processes themselves need supervision (start, stop, restart, status, healthcheck). Epic 2 needs an Agent supervisor that mirrors what OC's process supervisor does for tools, but at the Agent layer.

### Open questions surfaced

- **The "rescue" pattern.** `src/crestodian/rescue-channel.ts`, `rescue-message.ts`, `rescue-policy.ts`. This is OC's mechanism for stuck/failed sessions. Mid-priority for v0.3 read; relevant to 2200's "blocked Agents do not retry silently" principle and to Epic 9 (integration health monitoring).
- **The Anthropic transport stream layer.** `src/agents/anthropic-transport-stream.ts`, `anthropic-payload-policy.ts`, `anthropic-payload-log.ts`. OC has explicit Anthropic-specific code paths despite a multi-provider abstraction. Why? Possibly cache-key construction, possibly tool-call shape differences. Read in Target 4 (provider plugin SDK).
- **The `acp/` directory.** Top-level `src/acp/` plus `acp-spawn.ts` and `acp-spawn-parent-stream.ts` in agents/. Agent Communication Protocol — likely the formal contract for Agent-to-Agent communication. Read in Target 8 (multi-channel routing) since it overlaps Studio/Roster/Bulletin territory.
- **The `daemon/launchd.ts` flow.** macOS-specific daemon mode. Not directly relevant to 2200 since we use Agent-as-process not Gateway-as-daemon, but worth a skim for the launchd plist generation pattern Simon will need.

### Drafts for Epic 2 spec (placeholders)

These will become real Epic 2 spec sections after all targets are walked:

- **Process model section.** "2200 runs each Agent as its own OS process under a per-host Agent supervisor. Tools spawn as child processes under the Agent process, supervised by a per-Agent tool supervisor patterned after OC's process supervisor (overall-timeout, no-output-timeout, scope-based cancellation). Crash recovery: Agent supervisor restarts crashed Agents from on-disk Identity + Brain state. Tool-run journal persists in-flight tool invocations so a crash + restart can reconcile them."
- **Boot ritual section.** "Each Agent has a `boot.md` in its Brain. On startup, the Agent runs boot.md as a one-shot task in a dedicated boot session, with mapping snapshot+restore so the boot doesn't pollute the main session. Silent-reply token convention so the Agent can complete a boot without spamming channels."
- **Cold-start discipline section.** "Dynamic imports throughout. V8 compile cache enabled. Fast-path flags for help/version/status. Lazy plugin command registration via manifest allowlist."
- **Plugin allowlist section.** "Plugins (Extensions in 2200's vocabulary) register only when allowed by `config.plugins.allow` and not disabled by `config.plugins.entries.<id>.enabled=false`. The allowlist is the install-time consent surface from Epic 12."

### What 2200 explicitly does differently from OC

1. Agent-as-process (vs OC's Gateway-as-process-with-Agents-inside).
2. State-on-disk includes in-flight tool runs (vs OC's in-memory-only supervisor).
3. Studio/Roster/Bulletin first-party Agent-coordination primitives (OC has none — Agents talk to each other only via channels or sub-agent spawn).
4. Brain inspectability is non-negotiable per [[2026-04-24-brain-is-files-not-database]] (OC's memory backends are configurable but not inspectable as a first-party concern).
5. SCUT identity layer (OC has no Agent-identity layer).

### Confidence and gaps

- **High confidence:** process supervisor shape, boot ritual, plugin allowlist, cold-start discipline, fatal error hooks.
- **Medium confidence:** Agent-as-config-entry model. I read agent-runtime-config.ts but not the larger agent-command.ts and the actual Agent loop. Adding `agent-command.ts` and `gateway/call.ts` to the read list would tighten this.
- **Lower confidence:** the actual prompt construction pipeline, message history shape, system prompt assembly. These need more reading. Currently parked as a deeper dive within Target 1 if Epic 2 spec depends on it; otherwise picked up during Epic 2 implementation.

### Next

Target 2 (Skill format, Epic 11) ready to start. Recommend pacing change: dispatch a research agent per target with named files to read, return structured findings. Keeps my context clean and lets multiple targets run in parallel.

Doug confirmed pacing change to sub-agent dispatch on 2026-04-25.

---

## Target 2: Skill format and loader (Epic 11)

**Status:** complete (sub-agent walked the format, loader, sample bundled skills, EdgeClaw ClawXSkill, and community-Skill variance).

### SKILL.md frontmatter contract

Frontmatter is YAML with one quirk: OC's parser at `src/markdown/frontmatter.ts:195` runs **both** a strict YAML parse and a hand-rolled "single-line keys" parse, then merges them. When YAML produces a structured value but the corresponding raw line is inline and contains `:`, the line value wins (`shouldPreferInlineLineValue`, `frontmatter.ts:166-181`). This is how OC implements its "single-line frontmatter keys only" rule without rejecting standard YAML.

**Required fields:**

- `name` — string. Fallback: directory basename if missing or empty (`local-loader.ts:67-70`).
- `description` — string. **No fallback.** Skills with empty description are silently dropped.

**Optional top-level fields:**

- `homepage` — surfaced as "Website" in macOS Skills UI; also accepted as `metadata.openclaw.homepage`.
- `user-invocable` — boolean-string, default `true`. Drives slash-command generation.
- `disable-model-invocation` — boolean-string, default `false`. Excludes from XML catalog.
- `command-dispatch` — only `tool` recognized. Other values silently dropped.
- `command-tool` — required when `command-dispatch: tool`. Missing → silent downgrade to model invocation with debug log.
- `command-arg-mode` — only `raw` recognized. Unknown values silently coerced to `raw`.
- `metadata` — single-line JSON object. Sub-keys consumed:
  - `metadata.openclaw.always` — skip all eligibility gates if true
  - `metadata.openclaw.os` — array of `darwin | linux | win32`
  - `metadata.openclaw.requires.bins` / `anyBins` / `env` / `config` — dependency declarations
  - `metadata.openclaw.install` — array of `{kind: brew|node|go|uv|download, ...}` install specs, validated for shell-injection safety
  - `metadata.openclaw.primaryEnv` — canonical env name tied to `skills.entries.<key>.apiKey`
  - `metadata.openclaw.skillKey` — override config-lookup key
  - `metadata.openclaw.emoji` / `homepage` — macOS UI only
- `metadata.clawdbot` — legacy alias accepted when `metadata.openclaw` absent.

**Documented but unused:** `homepage` (read at both top level and inside metadata.openclaw for compat).
**Used but undocumented:** underscored aliases `command_dispatch`, `command_tool`, `command_arg_mode`.
**In bundled skills but ignored by loader:** `allowed-tools` (Claude-Code-style; tolerated, not consumed).

### Tool-dependency declaration: there isn't one (in the structured sense)

This was a v0.1 misread on my part. Skills do **not** declare runtime tools by name. The OC contract is indirect:

- `requires.bins` — OS binaries on `PATH`. Loader gates on `hasBinary()` (`shared/config-eval.ts:152-180`).
- `requires.config` — dotted config paths in `~/.openclaw/openclaw.json` that must be truthy. So `slack` declares `requires.config: ["channels.slack.token"]` rather than declaring "I need the slack tool."
- `requires.env` — env vars present (or injected via `skills.entries.<key>.env` / `apiKey`).
- `metadata.openclaw.primaryEnv` — canonical env name tied to apiKey.

The skill's markdown body just *tells the model* what tool to call. When prerequisites aren't met, the entire skill is dropped from eligibility — there's no per-tool degradation. This conflates four things ("binary exists," "config flag set," "env var present," "model knows what tool to use") and is a real anti-pattern 2200 should avoid.

### Invocation paths

Four paths, no event-driven hooks:

1. **Model invocation via XML catalog.** At session start, eligible skills are formatted into XML and injected into the system prompt (`skill-contract.ts:44-64`). The model decides when to "open" a skill via the `read` tool against its `filePath`. **Primary invocation path.**
2. **User slash command.** Each eligible `user-invocable` skill becomes a slash command. Name sanitization: lowercased, non-alphanumeric to `_`, deduplicated with `_2`/`_3`, capped at 32 chars (`command-specs.ts:33-40`).
3. **Direct tool dispatch (`command-dispatch: tool`).** Bypasses the model. Slash command directly invokes the named tool with `{command: "<raw args>", commandName, skillName}`. Only `argMode: "raw"` implemented.
4. **Plugin bundle commands.** Claude-Code-format command markdown ingested from enabled plugins. Shares slash-command namespace with skills.

The skills snapshot is **session-scoped**. New turns reuse the snapshot. Mid-session refresh only when (a) chokidar fires, (b) eligible remote macOS node connects, or (c) effective skill allowlist changes.

### Platform variants: no directory convention

All bundled skills live flat under `skills/<name>/SKILL.md` regardless of OS. Platform variance is via `metadata.openclaw.os`. Eligibility computed in `evaluateRuntimeEligibility` (`shared/config-eval.ts:108-135`).

**Remote-node eligibility:** gateway on Linux, macOS-only skill is eligible if a connected macOS remote node has `system.run` allowed. Bin probe runs against the remote node. Skills run on the remote via `exec` tool with `host=node`. This is OC-specific to its gateway/node split and 2200 doesn't have an analog — skip this entirely.

If `os` is set and platform doesn't match (and no remote helps), skill is silently dropped. No warning.

### Loader tolerance behavior

This is the key surface for the take-and-normalize pipeline. What OC tolerates:

- Two competing frontmatter parsers, merged
- Missing `name` → directory basename
- Unknown frontmatter keys silently retained but ignored
- Underscored aliases for several keys
- Legacy `metadata.clawdbot` namespace
- Boolean strings in many forms (`yes`/`no`/`true`/`false`/`on`/`off`)
- Unsafe install specs are **dropped, not rejected** — partial install lists are kept with the unsafe entries removed
- Unknown `command-dispatch` values silently downgrade to model invocation
- Skill-name collisions resolved by precedence (workspace > project-agents > personal-agents > managed > bundled > extra), losers replaced silently in the merged map
- Slash-command name collisions auto-deduplicated
- Hidden directories and `node_modules` skipped during scan
- Nested `skills/` inside a skills root auto-detected and treated as the real root

What it **rejects:**

- Unparseable frontmatter → skill dropped
- Empty `description` → dropped (no fallback exists)
- Symlink escapes / path-traversal → hard reject via realpath comparison
- Oversized SKILL.md (default cap 256KB) → reject with warn
- Too many candidate skill dirs (300 per root, 200 loaded per source) → soft truncation with warn
- Bundled skill not in `skills.allowBundled` allowlist → filtered out

### Prompt budget overflow: two-tier degradation

Full XML format → compact (name + location, no description) → binary-search prefix. User sees "Skills truncated" or "compact format" warning at top of prompt (`workspace.ts:794-803`). 2200 needs an analog of this from day one — the catalog grows fast.

### EdgeClaw ClawXSkill divergence

Ships as a standard OC extension at `extensions/clawxskill/`, **not** a loader replacement. Sits beside OC's stock loader as a passive event listener subscribing to `input`, `context`, `tool_result`, `session_start`. Indexes the same SKILL.md files via three retrieval engines: BM25 (`engines/inverted-index.ts`), embedding similarity (`engines/embedding-search.ts`), LLM model-judge (`engines/model-judge.ts`). When user input matches an indexed skill above some threshold, ClawXSkill injects a system message recommending the skill before the model acts, but returns `{action: "continue"}` so the standard OC flow still runs.

**Architectural shift:** "everything in the prompt every turn" (OC stock) → "ranked recommendations on demand" (EdgeClaw). Relevant for 2200 when the bundled-skills XML catalog grows to a token-budget problem. Not v1, but worth a sub-deliverable in Epic 11 or Epic 8.

### Community Skill variance is huge

Bundled OC catalog is ~50 skills, very consistent. ClawHub hosts ~13,700 skills as of Feb 2026. VoltAgent's curated `awesome-openclaw-skills` filters and re-indexes 5,400+. Forms of divergence the take-and-normalize pipeline will see:

- snake_case vs hyphenated names
- Multi-line YAML metadata vs single-line JSON
- Skills with no `metadata.openclaw` at all (OC treats as "always eligible")
- Claude-Code-format keys (`allowed-tools`, `model`) silently ignored
- Legacy `metadata.clawdbot` namespace
- Massively oversized SKILL.md bodies (the 256KB cap is itself evidence)
- Bundled scripts with `{baseDir}` interpolation
- Persona-pack repos that ship SKILL.md alongside SOUL.md and AGENTS.md as a coupled bundle

"The skill works in OC" is an extremely weak signal of "the skill is well-formed." 2200's normalization pipeline must assume noise.

### Implications for 2200 Epic 11 (take-and-normalize pipeline)

Recommended first-pass normalization rules, priority order:

1. **Frontmatter parse must be tolerant by default.** Implement YAML-parse-first with line-by-line single-key fallback, exactly as OC does. Log every divergence between the two parses as a normalization event.
2. **Name fallback to directory basename.** Disclose: "no `name` field, used directory basename `apple-notes`."
3. **Description requirement.** No fallback. Reject with clear message.
4. **Reject path escapes outright.** Realpath-confined load, no symlink walks. Disclose at install-attempt level.
5. **Strip Claude-Code keys and disclose.** `allowed-tools`, `model`. Log "removed N keys not used by 2200."
6. **Coerce `metadata.clawdbot` to canonical namespace.** Disclose migration.
7. **Validate install specs.** Use OC's regex patterns verbatim. Drop unsafe entries with disclosure rather than rejecting the skill.
8. **Boolean string coercion.** Accept `yes/no/true/false/on/off` for boolean fields.
9. **Slash-command name sanitization.** Implement OC's `sanitizeSkillCommandName` semantics. Disclose when sanitization happened.
10. **Tool-dispatch downgrade.** When `command-dispatch: tool` set but `command-tool` missing, downgrade to model invocation and disclose.

**Smallest viable Skill loader for OC bundled-catalog compatibility:** frontmatter parser + realpath-confined directory walker + `requires.bins` PATH walk + `requires.env` check against `process.env` + `os` check against `process.platform` + XML catalog formatter matching OC's shape. Slash-command generation optional in v1. Skip `requires.config` until 2200's tool registry exists. Skip remote-node eligibility entirely.

**Disclosure surface is the novel piece.** OC drops to debug logs for almost everything. 2200 should surface a per-skill summary at install: "Installed `apple-notes` (1 normalization: legacy metadata namespace migrated). Installed `discord` (2 normalizations: removed unused `allowed-tools` field, command name sanitized to `discord_skill`)."

### Implications for 2200 Epic 9 (Tool registry)

OC's skill loader resolves *binaries* and *config paths*, not *tools*. The only tool-name string in the skill contract is `command-tool` for direct dispatch, and that's forwarded without pre-flight validation. If the named tool doesn't exist, slash-command dispatch fails at invocation time, not load time. **2200 can do better:**

1. **Tool registry needs a name-based lookup interface that's stable enough to be a public contract.** Skills will declare tool dependencies by name eventually (`command-tool` already does). Slash-command dispatch needs O(1) lookup keyed on the same string the skill author wrote.
2. **The registry should expose an "is this tool available right now" predicate that the skill loader can call.** Replaces OC's `requires.config` config-path-truthy quirk with direct tool availability check.
3. **Tool-availability signals should drive loader eligibility, not just runtime errors.** A skill depending on a missing tool should be filtered with a "missing tool: X" disclosure at load time, not loaded and failing on first invocation.
4. **Built-in tools and user-supplied MCP servers should share the same lookup interface.** Ask "is `slack` registered" without caring about origin.

The OC "config-path truthy" eligibility pattern is a quirk worth not copying. 2200's tool registry can model direct tool-name dependency from day one.

### Drafts for Epic 11 spec

These will become real Epic 11 spec sections after all targets are walked:

- **Take-and-normalize pipeline section.** "Parse SKILL.md (dual-parser merge), validate against spec, normalize known issues, log every change. Install to `~/.2200/agents/<agentId>/skills/<sanitized-name>/`. Surface per-skill disclosure summary at install."
- **Frontmatter contract section.** "Required: name (with basename fallback), description (no fallback). Optional: homepage, user-invocable, disable-model-invocation, command-dispatch, command-tool, command-arg-mode, metadata.openclaw.{os,requires.bins,requires.env,install,primaryEnv,skillKey}. Legacy metadata.clawdbot accepted with auto-migration."
- **Invocation paths section.** "Three paths in v1: model invocation via XML catalog (primary), user slash command, direct tool dispatch. Plugin bundle commands deferred to v1.x."
- **Catalog token-budget section.** "When the eligible-skills XML catalog exceeds a per-Agent token budget, degrade in two tiers: full XML → compact (name + location only) → binary-search prefix. Surface 'Skills truncated' warning at top of prompt."

### Confidence and gaps

- **High:** frontmatter contract, tool-dependency anti-pattern, invocation paths, platform variance, loader tolerance, prompt-budget degradation.
- **Medium:** plugin bundle commands path (file read but not followed end-to-end into `bundle-commands.ts`); ClawXSkill threshold/recall behavior (file structure confirmed, source code unread).
- **Lower:** community Skill variance (based on inference from OC tolerance posture; no individual community skill read end-to-end).

What wasn't read that would tighten next iteration:
- `src/plugins/bundle-commands.ts` (Claude-Code command-markdown ingestion)
- `src/agents/skills-install.ts` (gateway-side install execution)
- `src/security/skill-scanner.ts` (dangerous-code scanner gating `skills.install`)
- `src/agents/skills-clawhub.ts` (ClawHub fetch/install path — relevant if 2200 wants ClawHub compatibility)
- 1-2 actual community SKILL.md files end-to-end

### Cross-target findings

- **Target 1 (runtime):** Skills are session-scoped; the snapshot lives in the gateway's session state. Reinforces that 2200's session/workspace boundary needs explicit modeling for Epic 2.
- **Target 3 (plugins):** Plugin-skills coupling at `agents/skills/plugin-skills.ts:46-124` — a plugin that ships skills only loads them when the plugin is enabled. Plugin enable flag drives skill load eligibility transitively.
- **Target 9 (tool registry):** captured above. Direct dependency: 2200's tool registry exposes a name-based predicate the skill loader uses for eligibility.
- **Target 5 (memory/Brain):** skill-snapshot caching pattern (chokidar-watched files, session-scoped immutability, refresh on watcher fire) is similar to what 2200's Brain visualization will need for live-refresh on disk changes. Cross-pollinate.

---

## Target 3: Plugin and Extension model (Epic 12)

**Status:** complete. Sub-agent walked plugin SDK, manifest schema, sample bundled plugins, MCP wrapper, install/uninstall, OCMT credential vault.

### Plugin SDK surface (massive)

`@openclaw/plugin-sdk` (workspace package) plus in-tree mirror at `src/plugin-sdk/`. **No barrel** — every capability is a separate subpath export (~40 subpaths in the `exports` map). Canonical author entry: `definePluginEntry({ id, name, description, kind?, configSchema?, reload?, nodeHostCommands?, securityAuditCollectors?, register })` from `src/plugin-sdk/plugin-entry.ts:200-225`.

`register(api)` receives `OpenClawPluginApi` (`src/plugins/types.ts:2042-2212`). It is **enormous** — roughly 30 `register*` methods including `registerTool`, `registerHook`, `registerHttpRoute`, `registerChannel`, `registerGatewayMethod`, `registerCli`, `registerProvider`, `registerSpeechProvider`, `registerImageGenerationProvider`, `registerVideoGenerationProvider`, `registerInteractiveHandler`, `registerAgentHarness`, `registerMemoryCapability`, `registerMemoryEmbeddingProvider`, etc. Plus a live `runtime: PluginRuntime` handle exposing `system`, `media`, `tts`, `stt`, `channel`, `events`, `logging`, `state`, `modelAuth`, `agent`, `subagent`.

**Critical lifecycle observation:** there is no `unregister` for any of these. The only structured stop hook is `OpenClawPluginService.stop()` (`src/plugins/types.ts:1976-1981`) for long-lived background services. Otherwise teardown is process exit. The SDK comment at `types.ts:2052-2057` admits the runtime helpers are "broader than hooks. Prefer hooks for third-party automation/integration unless you need native registry integration." The framing tells you it's a smell, doesn't stop you.

### Manifest format

Two formats coexist:

**Native code-plugin manifest** (`openclaw.plugin.json`): typed at `src/plugins/manifest.ts:182-268`. Required: `id`, `configSchema` (a JsonSchemaObject). Plus identity, activation hints, auto-enable plumbing, setup metadata, provider/model wiring, capability registry advertisement, config policy, UI hints, channel configs. Manifest cap is 256 KiB. JSON5-tolerant parsing.

**Conspicuously absent: no permission declarations.** No `permissions: [...]` field. No scope-of-access manifest. `dangerousFlags` only flags specific config values that weaken defaults — not a permission system.

**Bundle manifest** (Codex/Claude/Cursor): three sub-formats — `.codex-plugin/plugin.json`, `.claude-plugin/plugin.json`, `.cursor-plugin/plugin.json` (`src/plugins/bundle-manifest.ts:13-15`). Bundle "capabilities" are derived by inspection — they describe what the bundle declares (skills present, hooks present, mcpServers configured), not what host privileges the bundle asks for.

External plugins **must** declare `openclaw.compat.pluginApi` and `openclaw.build.openclawVersion` in `package.json` per `packages/plugin-package-contract/src/index.ts:23-26`. `validateExternalCodePluginPackageJson` enforces these as install-time errors. This is the **only** compatibility-versioning discipline 2200 should lift wholesale.

### Bundle vs code plugins

- **Code plugins:** TypeScript packages with `package.json#openclaw.extensions` entry list. Loaded via Jiti as ESM into the **same Node process** as the Gateway. All bundled OpenClaw extensions in `extensions/` are code plugins.
- **Bundle plugins:** External integrations packaged in another tool's format (Codex/Claude/Cursor). Discriminator: `detectBundleManifestFormat(rootDir)` at `bundle-manifest.ts:414-447`. Contributes one or more of: skills, commands, subagents, hooks, MCP servers, LSP servers, output styles, rules, settings.

### MCP wrapper pattern

`OpenClawStdioClientTransport` at `src/agents/mcp-stdio-transport.ts:42-66`. Subprocess spawn via `child_process.spawn` — `cwd` from server params, `env` is Gateway env plus per-server overrides, `shell: false`, `stdio: ["pipe", "pipe", inherit]`. **No sandboxing.** The MCP server runs with the Gateway's full UID/permissions. Linux OOM-score adjustment via `prepareOomScoreAdjustedSpawn`; tree-kill on close via `killProcessTree`. Capability negotiation is whatever the MCP server advertises during JSON-RPC initialization. No pre-negotiation, no scoping.

### Plugin lifecycle

Discovery → manifest validation → activation decision → instantiation → capability registration → runtime → reload → teardown. Key observations:

- **Activation decision** (`resolveEffectivePluginActivationState`, `config-state.ts:213-228`) considers built-in defaults, `enabledByDefault` hint, `plugins.entries.<id>.enabled`, `plugins.allow`, `plugins.deny`, capability/slot decisions (memory plugin slot exclusivity).
- **Instantiation** is synchronous. `register(api)` is rejected if async with `"plugin register must be synchronous"`. The api is wrapped by `createGuardedPluginRegistrationApi` so post-registration calls become no-ops — clever but post-hoc.
- **Capability registration** appends to a shared `PluginRegistry` plus global module-scoped state arrays.
- **Reload** snapshots/restores registry state via `snapshotPluginRegistry`/`restorePluginRegistry`.
- **Teardown** is effectively absent for `register`-time registrations.

**Isolation: zero.** All plugins share the Node process, the global module graph, the Gateway's UID, file descriptors, and credentials. SECURITY.md lines 225-229: "Plugins/extensions are loaded **in-process** with the Gateway and are treated as trusted code."

### Permission posture (the anti-pattern reading, deep)

OpenClaw's stance is the **trusted operator model** — explicit in SECURITY.md "Operator Trust Model" (98-122), "Trusted Plugin Concept" (123-130), and "Plugin Trust Boundary" (223-230):

- "Installing or enabling a plugin grants it the same trust level as local code running on that gateway host."
- "Plugin behavior such as reading env/files or running host commands is expected inside this trust boundary."
- "Plugins can execute with the same OS privileges as the OpenClaw process."
- "Runtime helpers (for example `runtime.system.runCommandWithTimeout`) are convenience APIs, not a sandbox boundary."

What this means concretely: arbitrary shell, arbitrary file I/O, full env read, full network, decrypted model credentials. No SSRF guard at the plugin layer (an `ssrf-runtime` SDK helper exists but it's opt-in, not a chokepoint).

The install-time consent surface is a **code-pattern security scan** (`src/plugins/install-security-scan.runtime.ts`, ~870 lines). On critical findings, blocks install with `security_scan_blocked`. Bypass: `--dangerously-force-unsafe-install` downgrades block to warning. Plus a dependency denylist scanned in `node_modules` and `package.json`. Both heuristic, not principled.

A `before-install` hook (`install-policy-context.ts`) lets policy hooks reject or modify installs — useful for org policy but no schema for what plugins can request.

What's missing from a 2200 perspective:
- No `permissions: ["fs:read", "exec", "credentials:provider:anthropic", ...]` declaration
- No install-time prompt that says "this plugin wants to: run shell commands, read your Anthropic key, register a gateway HTTP route"
- No runtime enforcement boundary — once registered, a tool can do anything
- No revoke/regrant flow mid-flight
- No audit log of what the plugin actually used at runtime (security audit collectors exist but they're plugin-self-reporting, not a kernel chokepoint)

### The allowlist mechanism (the closest thing OC has to consent)

Schema on `OpenClawConfig.plugins`:

```typescript
plugins?: {
  enabled?: boolean;                // global kill switch
  allow?: string[];                  // allowlist by plugin id
  deny?: string[];                   // denylist by plugin id
  entries?: Record<string, { enabled?, config?, hooks?, ... }>;
  installs?: Record<string, PluginInstallRecord>;
  load?: { paths?: string[] };
  slots?: { memory?: string; ... };
}
```

Single canonical resolver: `enablePluginInConfig(cfg, pluginId)` at `src/plugins/enable.ts:11-30`. Logic:

```
if (cfg.plugins?.enabled === false) → "plugins disabled"
if (deny.includes(id)) → "blocked by denylist"
if (allow.length > 0 && !allow.includes(id)) → "blocked by allowlist"
```

**Enforcement points:** install (NOT consulted — a plugin can be installed but not allowed; install record sits unused), startup (loader marks as disabled with reason), CLI invocation (`resolveMissingPluginCommandMessage` returns a hint), enable command (refuses if not allowed).

Semantics: empty/unset `allow` means "all installed plugins are eligible." Non-empty `allow` is strict allowlist. `deny` always wins. Binary (load/don't-load), no granularity beyond plugin id, lives in `~/.openclaw/openclaw.json`. **Liftable structurally for 2200's install-time consent layer, but 2200 should make it richer (capability set, not just plugin id).**

### Uninstall flow

`uninstallPlugin` at `src/plugins/uninstall.ts:248-310`. Removes:

1. `plugins.entries[pluginId]`
2. `plugins.installs[pluginId]`
3. `plugins.allow` membership
4. `plugins.load.paths` entry that matches plugin's source path
5. `plugins.slots.memory` reset if this was the memory engine
6. `channels.<channelId>` entries owned by this plugin
7. Install directory under `~/.openclaw/extensions/<safeId>` (skipped for path-linked plugins)
8. Refreshes plugin registry cache

**What is NOT cleaned up:**

- **Stored credentials.** Live in OC's auth store keyed by provider id, not plugin id. Uninstalling `anthropic` does NOT remove the Anthropic API key.
- **Plugin-written workspace state.** Files written outside `~/.openclaw/extensions/<id>/` persist.
- **Scheduled jobs.** No first-class "scheduled jobs owned by plugin X" concept.
- **MCP subprocess children.** Die with Gateway process, not on uninstall.

### OCMT credential vault and isolation

`jomafilms/openclaw-multitenant`. Multi-tenant platform layer wrapping OC. Takes the position SECURITY.md rejects: hosting mutually-untrusted users on shared infra.

**Architecture split:** Management Server (control plane, secrets vault) + Agent Server(s) (data plane, user containers). Trust boundary is OS containers — one Docker container per user.

**Vault crypto:**
- AES-256-GCM for symmetric encryption of API keys, OAuth tokens, group secrets
- Argon2id for key derivation (64 MiB memory, 3 iterations)
- Session transcripts use XChaCha20-Poly1305 (24-byte nonces)
- PKCE OAuth uses SHA-256 (S256)
- Unlocked group vaults expire after 30 minutes; unlock tokens HMAC-SHA256-signed and revocable
- **Decrypt-only-on-injection pattern:** credentials never written to disk on the agent server, decrypted only when injected into a user container's memory as env vars

**Group vault N-of-M:** threshold-based unlock with multiple admin approvals using Shamir's Secret Sharing. Hardware backup keys use the same Argon2id + AES-256-GCM combo.

**Container isolation:** one Docker container per user, isolated network namespace (no inter-container traffic), isolated filesystem (per-user mount), 1.5 GB memory cap, CPU shares, no Docker socket access, no privileged caps. Threat model: an Agent break-out at worst exposes the single user's currently-injected token in container memory; the secrets vault on the Management Server is unreachable.

**Inter-container relay:** zero-knowledge — relay cannot read message contents.

### Implications for 2200 Epic 12

**Manifest declares permissions explicitly.** Top-level `permissions` array with capability tokens 2200 recognizes:
- `fs:read:workspace`, `fs:write:workspace`, `fs:read:home`, `fs:write:home`, `fs:read:any`, `fs:write:any`
- `exec:command:<allowlisted-bin>` (no wildcard exec by default), `exec:shell` (broad, requires explicit consent)
- `net:outbound:host:<hostname>`, `net:outbound:any`
- `credentials:read:provider:<id>`, `credentials:write:provider:<id>`
- `tool:register`, `channel:register`, `gateway:method:<scope>`
- `agent:spawn`, `agent:control:<id>`
- `brain:read:agent:<id>`, `brain:write:agent:<id>`, `brain:read:any`, `brain:write:any`
- `notification:emit:<tier>`
- `schedule:create`, `schedule:cancel`

If a permission isn't in the manifest at install time, the runtime **denies the call** — not warns, denies. No `dangerouslyAllowAll` flag.

**Install-time consent is mandatory and visible.** Borrow OC's `plugins.allow` schema, replace with per-Extension installed-permissions record. Installing shows the user the full permission list and requires explicit acknowledgement. Granted permissions persisted alongside install record. Re-installing a version with grown permissions re-prompts.

**No runtime permission requests.** CLAUDE.md tripwire #6 made architectural: no `api.requestPermission(...)`. Period. New permission needs new manifest version and re-consent.

**Tool/Brain/Notification calls go through a permission kernel.** Runtime helpers are not direct passthroughs. They're calls into a permission kernel that checks requested capability against install-time grant, then either executes or rejects with a typed error.

**Sharply smaller SDK surface.** Build a deliberately small SDK barrel, not OC's 30-method `register*` zoo. Initial cut:
- `defineExtension({ id, name, version, description, permissions, register })`
- `register(api)` exposes: `registerTool`, `registerHook`, `registerCommand`, `registerService` (with `start`/`stop`), `registerChannel`, `logger`, `runtime: { fs, exec, net, credentials, brain, notification, schedule, agent }`
- Synchronous `register` (OC got this right) plus explicit `unregister(api)` on disable/uninstall

**Manifest schema in separate package** (`@2200/extension-contract`) so non-runtime tooling consumes it without booting the runtime. Lift OC's `plugin-package-contract` model.

**Isolation strategy.** v1: same-process loading like OC, but with the permission kernel as the chokepoint. Design the kernel API so it doesn't assume same-address-space access (structured-clone-able request/response shapes, not direct object passing) so process/Worker/microVM isolation can swap in later. Document explicitly so it isn't forgotten.

**Uninstall contract.** Lift OC's `removePluginFromConfig` shape and **add**: stored credentials, scheduled jobs owned by Extension, Brain entries written by Extension under Extension's namespace, persistent service state. Define per-Extension namespaces (`brain/extensions/<id>/`, `credentials/extensions/<id>/`) so uninstall is a clean directory wipe plus config edit.

**Credential abstraction.** Borrow OCMT's decrypt-on-injection pattern. Credentials encrypted at rest (AES-256-GCM + Argon2id at OCMT params or stronger). Extension code never sees a credential by value — asks runtime for an authenticated client (`runtime.credentials.client("anthropic")`) which returns a thin facade. Permission kernel logs every credential access.

**Bundle plugin compatibility.** Decide explicitly: support Claude bundle format only for Skill ingestion (lowest-friction, what Doug's existing tool chain uses). Wrap any MCP servers a bundle declares as 2200 Tools that go through the permission kernel. Skip Codex/Cursor host support for v1.

**MCP wrapping.** Lift OC's stdio child-process pattern wholesale — clean. But: MCP subprocess inherits an environment scoped to the Extension's permissions, not the Gateway's. Credentials env vars are exactly the ones the Extension was granted at install. Spawn cwd is Extension's namespaced workspace dir.

**Things to NOT carry over:**
- No `--dangerouslyForceUnsafeInstall` bypass flag
- No "trusted operator equals trusted plugin" framing
- No 30-method API. Start small. Add capabilities by motivation.
- Code-pattern security scanners as the install gate (heuristics — defense-in-depth signal, not the gate)

### Cross-target findings

- **Target 1 (runtime):** OC's plugin loader and the entry-point lazy registration patterns confirm the cold-start discipline. Tight coupling between plugin manifest registry and the CLI dispatch.
- **Target 2 (Skills):** plugin-skills coupling means uninstalling a plugin should drop its skills. 2200's per-Extension namespacing handles this naturally.
- **Target 6 (Secrets):** OCMT's vault patterns are the credential abstraction reference. AES-256-GCM + Argon2id (64MiB, 3 iter) parameters as baseline.
- **Target 9 (Tool registry):** plugins register tools via `registerTool`. The permission kernel intercepts here — every tool call surfaces through Extension's granted capabilities.

### Confidence and gaps

- **High:** OC permission posture (read SECURITY.md end-to-end), plugin SDK surface, manifest schema, allowlist enforcement, uninstall flow, MCP stdio spawn pattern.
- **Medium:** Lifecycle teardown completeness (no `unregister`, but didn't trace every `clearPluginLoaderCache` path); per-channel ownership semantics in uninstall.
- **Lower:** OCMT N-of-M Shamir parameters and exact share format (README defers to `management-server/routes/group-vault.js` not opened); ClawHub install policy hooks.

What wasn't read that would tighten:
- `src/auth-store/` internals (where credentials live, how encrypted at rest)
- `src/plugins/install-source-info.ts` (install policy hook context)
- `OpenClawConfig.plugins.entries.<id>.hooks` policy schema (`allowPromptInjection`, `allowConversationAccess`, `allowModelOverride`, `allowedModels` — closest OC has to per-plugin policy granularity, the seed of what 2200's permission tokens replace)

---

## Target 12: Perplexity Computer comparative analysis

**Status:** complete. Sub-agent digested the v0.2 reading list, closed the 5-to-0 critical-source skew, and produced a comparative section for v0.3.

### Architecture: sub-agent decomposition and model routing

Perplexity Computer is best understood as a thesis about **model specialization**. Aravind Srinivas's framing on launch (Feb 25 2026): *"When you build a team, you don't build a homogenous group where everyone has the same skills... The orchestration is the product. The model is a tool."* The product accepts a high-level objective, decomposes into subtasks, delegates each to whichever of ~19 models fits best.

Concrete model lineup: Opus 4.6 for core reasoning, Gemini for deep research (with sub-agent spawning authority), GPT-5.2 for long-context recall and wide search, Nano Banana for images, Veo 3.1 for video, Grok for fast lightweight tasks. Five-tier-plus router pattern with the explicit principle: *"the smallest model that will still give the best possible user experience."* ByteByteGo synthesis: *"a heterogeneous mix of models, including in-house fine-tuned models from the 'Sonar' family and third-party frontier models"* with *"small, efficient classifier models"* doing routing.

**The strategic claim that matters most for 2200:** *"competitive moat stems from the orchestration system that manages interaction with models, not any single LLM."* This is almost word-for-word the bet 2200 has already made. [[2026-04-24-baseline-model-tier]] and the Studio/Roster/Bulletin primitives say the same thing.

**Where 2200 diverges:** Perplexity's sub-agents are **ephemeral, model-typed, invisible** — spawn for a task, do work, disappear. User sees a black box with an outcome. 2200's Agents are **persistent, identity-bearing, inspectable** — closer to colleagues than function calls. Brain on disk, SOUL/Identity that crosses host migrations, SCUT identity for cross-organization trust, names. When 2200 needs an ephemeral helper, that's a Tool call or Extension invocation — not an Agent.

The two patterns aren't opposed; they're different bets about what "agent" means. Perplexity treats agents as work-doing functions. 2200 treats Agents as first-class team members. Orchestration thesis is shared; granularity of the orchestrated unit is not.

### The wire protocol (Zenity reverse-engineering)

Closest thing to public engineering documentation Perplexity has. Four-component decomposition:

1. **Perplexity API backend** — model + task planning
2. **Sidecar UI panel** — conversation rendering
3. **Three Chrome extensions** — `comet-agent` (`agents.crx`, 700KB service worker doing RPC dispatch and security boundary enforcement), `Comet` (`perplexity.crx`, tab lifecycle and PDF parsing), `comet_web_resources.crx` (local CDN)
4. **Chromium itself**

**Dual-channel comms split is the load-bearing design choice:**

- **SSE stream** at `/rest/sse/perplexity_ask`: reasoning, citations, token streaming, high-level step types (`BROWSER_OPEN_TAB`, `BROWSER_CLOSE_TABS`, `BROWSER_GROUP_TABS`, `GET_URL_CONTENT`, `ENTROPY_REQUEST`)
- **WebSocket** at `wss://www.perplexity.ai/agent`: high-frequency bidirectional automation — actual button-clicks/keystrokes/form-fills via RPC handlers (`ComputerBatch`, `FormInput`, `Navigate`, `ReadPage`, `GetPageText`, `TabsCreate`, `CreateSubagent`)

Zenity's read of the rationale: *"the SSE stream remains dedicated to the conversational UI (model reasoning, citations, final answers), while the WebSocket handles the high-frequency, bidirectional communication required for browser automation."*

**Page perception model is the most interesting piece for 2200.** Comet calls `chrome.debugger`'s `Accessibility.getFullAXTree`, converts to YAML before sending upstream. Only interactable elements receive node-reference annotations. Token-economy decision (YAML denser than JSON, accessibility tree filters presentation noise) AND a perception decision: the LLM never sees the raw DOM, only a normalized semantic abstraction.

**Maps onto 2200 discipline:** typed protocols at the boundary, deliberate token-economy decisions in the perception layer, clean separation between reasoning channel and automation channel. When an Agent reads a page, queries a database, or inspects a Brain note, the perception format is its own design problem — not "dump the bytes into context." Section 7 study target #1 (gateway/protocol/) should adopt the Comet-style discipline.

Security boundary code path Zenity surfaced: `isInternalPage` (blocks `chrome://` and `comet://`) and `isUrlBlocked` (blocks `file://`, admin-defined URLs, user-configured domain blacklists from managed storage). Boundaries are at the extension layer, not the model layer — exactly where they fail under prompt injection.

### Trust boundaries and prompt injection (the BrowseSafe story)

**Brave Security Team disclosure (August 2025)** is the inflection point. Indirect prompt injection in Comet exploiting the architectural flaw: *"when users ask it to 'Summarize this webpage,' Comet feeds a part of the webpage directly to its LLM without distinguishing between the user's instructions and untrusted content from the webpage."* Attack vector: malicious instructions hidden in webpage content. Payload demonstrated extraction of email addresses, authentication tokens, exfiltration to attacker servers. Same-origin policy irrelevant because the agent runs with full user privileges across authenticated sessions.

**Simon Willison's verdict:** *"to an LLM the trusted instructions and untrusted content are concatenated together into the same stream of tokens, and to date (despite many attempts) nobody has demonstrated a convincing and effective way of distinguishing between the two."* Plus: *"I strongly expect that the entire concept of an agentic browser extension is fatally flawed and cannot be built safely."*

**Perplexity's response: BrowseSafe** (Dec 2 2025, paper at arxiv 2511.20597, weights and dataset on Hugging Face). Defense-in-depth in three layers:

1. **Trust boundary enforcement.** Each agent tool with potential to output untrusted content is declaratively flagged. Runtime maintains *"execution state tracking all tool invocations and their trust characteristics."*
2. **Hybrid detection.** Fast classifier (Qwen3-30B-A3B-Instruct-2507, *"only 3B active parameters at inference"*) handles bulk of decisions. Frontier models (GPT-5, Sonnet 4.5) routed in only on uncertain boundary cases.
3. **Data flywheel.** Boundary cases routed to frontier models become training data for the next classifier iteration.

BrowseSafe-Bench: 14,719 samples (11,039 train / 3,680 test), 11 attack types organized as Basic / Advanced / Sophisticated. Fine-tuned detector reports F1 ≈ 0.91. Fully open-source.

**Architectural verdict for 2200:** This is the state of the art for the web-content trust-boundary problem. **But it's mitigation, not solution.** The moment untrusted content enters the same token stream as trusted instructions, the boundary is statistical, not architectural. BrowseSafe drops successful injection rate; it does not zero it.

**2200's Extension permission model is closer to an architectural answer than a statistical one.** Permissions declared at install time, granted by user, immutable at runtime. CLAUDE.md tripwire #6 ("Extensions cannot escalate permissions at runtime") is the load-bearing principle. Notification tier system similar (CLAUDE.md tripwire #7: tiers come from action type, not Agent's judgment). These are architectural trust boundaries — they exist outside the model's token stream, in the capability surface itself.

**Where 2200 should learn from BrowseSafe:** the *secondary* layer. When an Agent processes web content, trust-boundary tagging on the Tool surface plus a classifier-router pattern for high-risk content classes makes sense as Layer 2 defense. **Pin the architectural boundary first, layer the statistical defense on top. Reverse the order and the architecture is doing nothing.**

Data-flywheel pattern: borrow in spirit but with care. Self-hosted-first means user content stays user content. Right shape is opt-in telemetry the user controls, with the data flywheel running only in the managed-service tier where consent is explicit.

### Serving stack and cost discipline

ByteByteGo's synthesis gives the real cost picture:

- **Retrieval layer (Vespa):** *"a massive index that covers hundreds of billions of webpages"*, *"over 200 billion unique URLs"*, *"fleets of tens of thousands of CPUs"*, *"over 400 petabytes in hot storage"*, *"tens of thousands of index update requests every second"*
- **Inference layer (ROSE):** Perplexity's custom Python+PyTorch+Rust serving system on AWS H100 pods orchestrated through K8s. Speculative decoding, MTP (Multi-Token Prediction) decoders for throughput.

**The $200 burn from v0.1 needs rereading against this backdrop.** Perplexity is running real infrastructure that costs real money per query. Their model-router thesis (smallest-model-that-suffices) is partly UX claim, partly margin claim. Sub-agent spawning that retries silently is an expensive failure mode for them too.

**The lesson:** infrastructure-level cost discipline doesn't translate into cost transparency at user layer. Perplexity built a routing system that picks small models when small models suffice — but the routing system cannot prevent a runaway sub-agent tree from racking up Opus calls while the user has no visibility.

**2200's eight-layer cost-protection model responds at a different point in the stack.** Layer 1 is tool-loop and stuck-Agent detection at runtime. Pulse is the visualization surface. Agent Behavior settings is the configurability surface. None are infrastructure optimizations. They're all about preventing runaway, surfacing it when it happens, giving the user the knobs. **Perplexity's failure mode shows infrastructure-level cost discipline is necessary but nowhere near sufficient.** User-visible cost surface is where the bet has to be placed.

### Browser-as-agent-surface (the path 2200 doesn't take)

Hard Fork conversation (Aug 15 2025) is the clearest articulation of why Perplexity bet on the browser. Srinivas's three pillars:

1. **Distribution:** *"we want to build your own web browser because rather than rely on Google to somehow get a user to perplexity, you would rather that they just start there."*
2. **Privacy through locality:** *"you're logged into all your sessions. You don't have to be logged in on our servers."*
3. **Browser is where work happens:** Comet thesis is that humans continue to browse voluntarily while agents handle delegated tasks in the same surface — *"the agent lives in the browser as a peer."*

Explicit alternative rejected: *"If we believed that we would never even launch a browser, we would just continue the chat UI."*

**2200 takes a different bet, also explicit.** The Pub (Epic 3) is primary surface — OpenPub provides conversational shell, Studio is where Agents collaborate, channel adapters (Epic 13/14) let an Agent be reachable from Slack/iMessage/wherever. Browser is one possible channel, not home base. Agent first-class; channel interchangeable.

**Reasoning maps onto product positioning.** Perplexity Computer's user is sitting in front of a browser. 2200's user is busy and not at a desk — busy non-engineer the vision doc targets. Home base for that user isn't the browser, it's the phone notification or the Slack channel where their team coordinates. Channel-as-surface follows from user-as-mobile.

**Security read:** browser-as-agent-surface is exactly the architecture Brave and Willison identified as *"fatally flawed."* Browser is where the trust boundary collapses (untrusted web content meets Agent privileges). By making browser one channel among many — and by making Agent's identity, Brain, capabilities live outside any one channel — 2200 doesn't escape the trust-boundary problem (no agent platform does) but doesn't put it in load-bearing product position. Comet has to solve prompt injection in the browser or product is broken. 2200 has to solve prompt injection in the Tool layer (BrowseSafe-equivalent territory), but the Pub, Studio, Roster, Brain, Extension permission model don't sit inside the same trust collapse.

Not a moral argument — Comet's bet is genuine and well-reasoned for Perplexity's distribution position. 2200's bet is different because distribution position and target user are different. Two different right answers to two different questions.

### Enterprise integration surface

Comet for Enterprise Pro launches in 2026 give shape to Perplexity's commercial product:

- **Integrations:** Slack, Snowflake, Salesforce, HubSpot + *"hundreds of other platforms"*. Same Vercel-OAuth-failure-mode brittleness from v0.1.
- **Security tier:** SOC 2 Type II, SAML SSO, audit logs, **per-query isolated sandboxing in Firecracker microVMs** (same tech behind AWS Lambda).
- **CrowdStrike partnership** for browser-level visibility into installed extensions and risk scores.
- **`@computer` mention pattern in Slack:** *"Employees can now query @computer directly inside Slack channels and threads, then continue those conversations in Perplexity's web interface or mobile app — the same full-power orchestration engine, with the same model selection and connector access, embedded where teams already collaborate."* This is exactly the multi-channel routing pattern Epic 13/14 targets.

**Enterprise compliance surface — flag for Doug.** 2200's self-hosted-first posture handles a lot of enterprise concerns by default (data never leaves customer infrastructure). But SOC 2, SAML, audit-log surfaces are line items the enterprise buyer asks about. Not Epic-2 problem. Probably managed-service-tier problem when 2200 has paying enterprise customers. Worth a decision record before the first enterprise deal, not before.

**Firecracker microVM-per-query isolation is the technical detail to absorb.** For 2200, analogous problem is Extension execution isolation (Epic 12). Mechanism is open: Firecracker is one answer; OCMT's container-per-user another; Node `vm.Context` weaker and probably insufficient. Section 7 study target #3 work and the BrowseSafe + Firecracker prior art reframes it: **right level of isolation for an Extension that holds user credentials and processes web content is closer to microVM than to in-process sandbox.** Worth a decision record before Epic 12 implementation, not just hand-wave.

### What 2200 should actively borrow from Perplexity

**1. Trust-boundary tagging on Tools, with classifier-router as Layer 2.** BrowseSafe's architectural pattern — declaratively flag any Tool that produces untrusted content, maintain runtime state of trust characteristics, run a fast classifier in parallel — is the right shape for Epic 9 Tool-system layer. Pin architectural boundary first (Extension permissions, no runtime escalation, capability scoping), classifier-router as defense-in-depth on top. Borrow the dataset (`perplexity-ai/browsesafe-bench` is open-source). Decision record before Epic 9 Tool-trust-boundary design lands.

**2. Model-router as a first-class architectural piece.** Perplexity Computer thesis ("smallest model that delivers best UX," routing classifier picks per task) is closer match to [[2026-04-24-baseline-model-tier]] than any other prior art. Lift the pattern. Provider-plugin SDK from Epic 10 must expose enough metadata about each model (cost per token, latency profile, context window, strength category) for a router classifier to make decisions. Router itself should be a small model — Perplexity's whole point. Routing transparent in Pulse so user sees which model handled which sub-task and what it cost.

**3. Adversarial data flywheel for Tool-trust-boundary classifier (managed-service tier only).** When 2200's managed service is running, opt-in telemetry on Tool-trust-boundary near-misses feeds adversarial-example collection. Self-hosted instances stay private by default. Opt-in surface explicit. Long-horizon item — flag now so telemetry hooks get added at the right place when Tool-trust-boundary code is written. Data-collection surface needs design from the start, not bolt-on later.

### What 2200 should explicitly avoid

**1. Single-token-stream trust collapse.** Don't put untrusted content and trusted instructions in the same context window without a trust-boundary marker the runtime treats as load-bearing. Brave/Willison architectural critique applies to every Agent platform that processes web content, not just browsers. 2200's Tool layer needs trust-boundary tagging from day one. Extensions cannot pass untrusted content into reasoning context without going through the trust-boundary check.

**2. Black-box sub-agent execution.** Perplexity's sub-agents are invisible during execution. Single loudest user complaint in v0.1 and BrowseSafe didn't fix it. 2200's Agents are inspectable through Brain (locked in [[2026-04-24-brain-is-files-not-database]]) and Pulse makes their work-in-progress legible. Don't add an "ephemeral helper" pattern that bypasses these surfaces. Every unit of work that costs real money or takes real time must be inspectable.

**3. Browser-as-only-surface.** Comet bet is right for Perplexity, wrong for 2200. Agent lives outside any single channel. Pub is primary; channels interchangeable. Don't let any future "let's build the 2200 browser" idea drift toward making browser the home base.

**4. Cloud-only with data flywheel on user input.** Perplexity's flywheel feeds production traffic back into model retraining. Self-hosted-first means we can't do this by default. Opt-in pattern from above is the only path. Don't build product features that assume user-input telemetry — an architecture that requires the flywheel will silently break the self-hosted promise.

### Confidence and gaps

**Accessed:** Zenity Labs reverse-engineering (full read), BrowseSafe Perplexity Research article and arxiv paper (full read), ByteByteGo serving-stack synthesis (full read), Brave prompt-injection disclosure (full read), Simon Willison commentary (full read), VentureBeat coverage (with rate-limit recovered through other sources), Hard Fork podcast (full transcript via podscripts.co).

**Couldn't access directly:** Perplexity Hub blog posts (Cloudflare-blocked programmatic WebFetch). Substantive content recovered from third-party coverage (VentureBeat, Fortune, Business Today, TechHQ, Trail of Bits, multiple ByteByteGo / Trending Topics syntheses, Lasso Security, LayerX). First-party tone missing but technical substance captured.

**For v0.4, gap-closing work:**
- One human read-through of the four Perplexity Hub blog posts to confirm third-party-recovered quotes are accurate first-party
- Trail of Bits TRAIL threat model post (`blog.trailofbits.com/2026/02/20/...`) — details four prompt-injection techniques against Comet's Gmail integration, directly relevant to Epic 9 Tool-trust-boundary design
- Lasso Security's "Red Teaming BrowseSafe" and LayerX's "CometJacking" — appear to be post-BrowseSafe-release attacks that bypassed it. If real, BrowseSafe's F1 ≈ 0.91 needs an asterisk and Section 3's recommendation strengthens.

No reading-list source from Section 7 Part C dropped out as unusable for v0.3.

---

## Target 4: Provider-plugin SDK (Epic 10)

**Status:** complete. Sub-agent walked SDK barrel, ProviderPlugin type (575 lines, ~50 hooks), sample Anthropic and Ollama plugins, Anthropic-specific transport puzzle, auth profiles, failover, prompt-cache discipline.

### Provider plugin SDK shape

`@openclaw/plugin-sdk` packages the surface as ~40 subpath exports — no monolithic barrel. Critical type: `ProviderPlugin` at `src/plugins/types.ts:1132-1706`. **Required fields are tiny:** `id`, `label`, `auth: ProviderAuthMethod[]`. Everything else is opt-in across ~50 optional hooks grouped into:

- **Catalog/discovery:** `catalog`, `staticCatalog`, `discovery`, `resolveDynamicModel`, `prepareDynamicModel`, `normalizeResolvedModel`, `contributeResolvedModelCompat`, `normalizeModelId`, `normalizeTransport`, `augmentModelCatalog`, `suppressBuiltInModel`
- **Auth:** `prepareRuntimeAuth`, `resolveSyntheticAuth`, `resolveExternalAuthProfiles`, `resolveAuthProfileId`, `formatApiKey`, `refreshOAuth`, `oauthProfileIdRepairs`, `buildAuthDoctorHint`, `shouldDeferSyntheticProfileAuth`
- **Streaming/transport:** `createStreamFn`, `wrapStreamFn`, `prepareExtraParams`, `extraParamsForTransport`, `resolveTransportTurnState`, `resolveWebSocketSessionPolicy`
- **Replay/compaction:** `buildReplayPolicy`, `sanitizeReplayHistory`, `validateReplayTurns`
- **Reasoning:** `resolveReasoningOutputMode`, `resolveThinkingProfile`, `resolveDefaultThinkingLevel`, `isBinaryThinking`, `supportsXHighThinking`
- **System prompt:** `resolveSystemPromptContribution`, `resolvePromptOverlay`, `transformSystemPrompt`, `textTransforms`
- **Failure/usage:** `matchesContextOverflowError`, `classifyFailoverReason`, `followupFallbackRoute`, `resolveUsageAuth`, `fetchUsageSnapshot`, `isCacheTtlEligible`, `buildMissingAuthMessage`, `buildUnknownModelHint`
- **Tool schemas:** `normalizeToolSchemas`, `inspectToolSchemas`
- **Embeddings + Wizard:** `createEmbeddingProvider`, `wizard`, `onModelSelected`

### Model catalog shape (worth copying nearly verbatim)

`ModelCatalogModel` (`src/model-catalog/types.ts:1-97`):

```typescript
{ id, name?, api?, baseUrl?, headers?, input?, reasoning?, contextWindow?,
  contextTokens?, maxTokens?, cost?, compat?, status?, statusReason?,
  replaces?, replacedBy?, tags? }
```

`ModelCatalog` is `{ providers, aliases, suppressions, discovery }`. **`ModelCatalogSource` enum** (`manifest | provider-index | cache | config | runtime-refresh`) attributes where each row originated. **Tiered pricing shape** (`ModelCatalogTieredCost`) supports input-token bands with per-band `cacheRead`/`cacheWrite` — needed for Anthropic prompt caching and any provider that prices reads differently from writes. **`compat: ModelCompatConfig`** is a per-model bag of transport flags (`supportsUsageInStreaming`, `supportsStore`).

### The Anthropic-specific puzzle: SOLVED

OC runs on top of upstream `@mariozechner/pi-ai` library. The `src/agents/anthropic-*.ts` files exist because pi-ai cannot express several things OC needs. **Same exact pattern exists for OpenAI** (`openai-transport-stream.ts`, `openai-responses-payload-policy.ts`, `openai-ws-stream.ts`) **and for Google (Vertex)**. The Anthropic files are NOT "Anthropic special-cases inside an otherwise-generic abstraction." They are **core-owned transport implementations for the Anthropic Messages API**, sitting one layer below the provider-plugin abstraction.

**The provider abstraction is healthy. The transport layer is per-API.**

What the per-API transport (`anthropic-transport-stream.ts`, 855 lines) handles that pi-ai can't:

- **OAuth + Claude-CLI compatibility** (when API key is `sk-ant-oat...` OAuth token, must inject system prompt `"You are Claude Code, Anthropic's official CLI for Claude."`, send specific beta headers, set `user-agent: claude-cli/2.1.75`, rename tools to canonical Claude Code set)
- **GitHub Copilot routing** (when `model.provider === "github-copilot"`)
- **Adaptive thinking** per model family (Opus 4.7 wants `{ type: "adaptive" }`, 4.6 wants `effort: "max"`, older wants `{ type: "enabled", budget_tokens }`)
- **Per-model max-token clamping** (`resolveAnthropicMessagesMaxTokens` clamps to 32k unless caller asks for more)
- **Per-model proxy/TLS overrides** (`buildGuardedModelFetch(model)`)
- **Fine-grained beta features** mapped per model family

**`anthropic-payload-policy.ts` is the home of prompt-cache discipline for Anthropic.** Three things:

1. **`resolveAnthropicPayloadPolicy`** decides whether `service_tier` is allowed and whether `cache_control: { type: "ephemeral", ttl?: "1h" }` should apply. **Long-TTL only enabled for `api.anthropic.com` or `*-aiplatform.googleapis.com`** unless operator explicitly opts in. Conservative-default-for-third-party rule.
2. **`applyAnthropicCacheControlToSystem`** walks system block array. Either tags the entire system block with cache_control, or splits at the `<!-- OPENCLAW_CACHE_BOUNDARY -->` marker (literal string sentinel) into stable prefix (cached) + dynamic suffix (not cached).
3. **`applyAnthropicCacheControlToMessages`** tags only the **trailing user turn's last block** with cache_control. Comment captures intent: "Preserve Anthropic cache-write scope by only tagging the trailing user turn." Tagging anywhere else over-writes the cache or wastes money.

### Prompt-cache discipline (3 layers)

1. **Deterministic ordering at construction time.** Sorters at every site contributing bytes to the cacheable prefix. Identified sorters:
   - `system-prompt.ts:77-93` — context files ordered by precedence map then basename then full path
   - `system-prompt.ts:589` — tool names alphabetical
   - `prompt-cache-stability.ts:21` — capability ids alphabetical + deduped
   - `cache-trace.ts:154` — `stableStringify` sorts object keys before serializing for digest
   - `manifest-registry.ts:199, 226, 482` — manifest entries sorted by id

2. **Explicit cache boundary marker in system prompt.** Literal string `\n<!-- OPENCLAW_CACHE_BOUNDARY -->\n` (constant at `system-prompt-cache-boundary.ts:3`) inserted between stable prefix (skills, tools, files, base prompt) and dynamic suffix (heartbeat, runtime-changing context, current state). Anthropic payload policy splits at this marker.

3. **Per-API placement of cache markers.** For Anthropic Messages: `cache_control` on stable system prefix block AND trailing user turn's last block. For OpenAI Responses: `store: true` and `previous_response_id`. Each API owns its dialect.

**Cache-trace observability:** `stableStringify` (sorted keys, recursive) + sha256 digest. Trace stages (`session:loaded`, `session:sanitized`, `prompt:before`, etc.) emit message-by-message fingerprints so cache misses can be diagnosed by diffing fingerprints across runs.

### Auth profile model

Three on-disk objects under `~/.openclaw/agents/<agentId>/agent/`:

- **`auth-profiles.json`**: credentials. `AuthProfileSecretsStore` with `version`, `profiles: Record<profileId, AuthProfileCredential>`.
- **`auth-profile-state.json`**: non-secret state. `AuthProfileStateStore` with `order`, `lastGood`, `usageStats`.
- Merged in memory into `AuthProfileStore`.

Three credential types:
- `ApiKeyCredential` — `{ type: "api_key", provider, key? | keyRef? }`
- `TokenCredential` — `{ type: "token", provider, token? | tokenRef?, expires? }` (OC does NOT auto-refresh)
- `OAuthCredential` — `{ type: "oauth", provider, access, refresh, expires, ... }` (refreshed via `refreshOAuth` plugin hook or shared pi-ai refresher)

Per-profile usage stats:
```
{ lastUsed?, cooldownUntil?, cooldownReason?, cooldownModel?,
  disabledUntil?, disabledReason?, errorCount?,
  failureCounts?: Partial<Record<AuthProfileFailureReason, number>>,
  lastFailureAt? }
```

**`AuthProfileFailureReason` enum** (tight): `auth | auth_permanent | format | overloaded | rate_limit | billing | timeout | model_not_found | session_expired | unknown`.

### Failover and cooldown

`computeNextProfileUsageStats` in `usage.ts:524`. Two backoff lanes:

- **Disabled lane** for `billing` and `auth_permanent`. Long backoff: billing 5h base / 24h max, auth_permanent 10min base / 60min max. Grow as `base * 2^(errorCount-1)` capped at max.
- **Cooldown lane** for everything else. Stepped: 30s → 60s → 5min cap.

**Active window is immutable** during a retry burst (`keepActiveWindowOrRecompute`) — refuses to extend an already-active window so retries inside a window cannot push recovery further out.

**Model-scoped cooldown:** when `rate_limit` includes a model id, the cooldown only blocks that model on that profile, so other models on the same key remain usable. If a second model also fails on the same profile during the active window, scope widens to all models.

`resolveAuthProfileOrder` precedence chain: per-Agent stored override → config-declared order → config-declared profile list → stored profiles for provider. After base order resolved, dedup, filter ineligible, then sort by `(typeScore: oauth=0, token=1, api_key=2, ...) ASC, lastUsed ASC` so OAuth wins over API-key and round-robin within type oldest-first.

### Local-model integration

**No generic "any HTTP completion endpoint" provider in OpenClaw.** Each local-server is its own plugin. The `openai-completions` API family is the wire-level lingua franca — any HTTP server speaking OpenAI-compat completions can be wired by setting `model.api = "openai-completions"` and pointing `baseUrl` at the server.

Plugins exist mainly for: discovery (sniffing local endpoint), warmup hooks, model-pull commands, embeddings adapters, provider-specific error matchers. **All optional.**

- **Ollama:** discovery via `OLLAMA_HOST` and 11434 endpoint, synthetic `ollama-local` auth that defers to real `OLLAMA_API_KEY` if set, custom `createStreamFn` (full transport, not wrapper), inference-preload hook, OpenAI-compat replay hooks, embeddings, model-pull on first selection.
- **LM Studio:** simpler. `prepareDynamicModel` fetches `/api/v1/models` from endpoint, caches per `baseUrl`. Discovery `order: "late"`.
- **vLLM:** not a bundled plugin. OpenAI-compat at wire level, works through OpenAI plugin pointed at custom `baseUrl`.

### Implications for 2200 Epic 10

**Required `ProviderPlugin` surface for v1 should be minimal:** `id`, `label`, `auth: ProviderAuthMethod[]`. **15 optional hooks for v1** (not 50): `catalog`, `discovery`, `resolveDynamicModel`, `wrapStreamFn`, `buildReplayPolicy`, `resolveThinkingProfile`, `isCacheTtlEligible`, `resolveSyntheticAuth`, `shouldDeferSyntheticProfileAuth`, `resolveUsageAuth`, `fetchUsageSnapshot`, `matchesContextOverflowError`, `classifyFailoverReason`, `onModelSelected`, plus `wizard` for onboarding. Add long tail (replay sanitization, transport-turn-state, prompt overlays, text transforms) only when a concrete plugin needs them.

**Per-API transport modules live in core, not plugins.** Ship a transport switchboard like `provider-transport-stream.ts` that switches on `model.api` and dispatches to a core-owned `anthropic-messages` / `openai-responses` / `openai-completions` / `google-generative-ai` transport. Plugins contribute `wrapStreamFn` to layer attribution headers and small payload patches on top of core transport. They do NOT implement SSE parsing themselves.

**Auth profile model copies OC shape:** two files per Agent (secrets + state), three credential types, ProfileUsageStats with disabled-vs-cooldown lane separation.

**Failover policy copies OC verbatim:** stepped cooldown (30s/60s/5min), exponential backoff for billing/auth_permanent, immutable active windows, model-scoped cooldown for rate_limit, failure-window-based counter reset (24h default). Skip WHAM probe (OpenAI-Codex-specific).

**Prompt-cache discipline:**
- `stableStringify` util in 2200 core
- Sorters at every site contributing bytes to cacheable prefix
- Explicit cache-boundary sentinel in system prompt
- Per-API payload policies tagging cache_control at right blocks
- Cache-trace observability with fingerprint diffing across runs

**Local-model providers** are per-server plugins. Lean on `openai-completions` API family as wire-level lingua franca. Ship Ollama and LM Studio plugins early since 2200 supports the Cray-test self-host trajectory.

**Catalog row shape copies `ModelCatalogModel`** including `compat`, `tieredPricing`, `replaces`/`replacedBy`, and `source` fields.

**Skip from OC:** the 50+ provider hooks (v1 ships 15), `discovery: { order: "late" }` over-engineering for v1, deprecated capability hooks (`isBinaryThinking`, `supportsXHighThinking`, `resolveDefaultThinkingLevel` — go straight to `resolveThinkingProfile`), Claude-CLI / Codex-CLI synthetic-auth modes (add later if 2200 wants subscription attachment).

### Cross-target findings

- **Target 1 (runtime):** Per-Agent state directory pattern (`~/.openclaw/agents/<agentId>/`). File-locked store mutation via `updateAuthProfileStoreWithLock` is the right primitive for any per-Agent state mutation that can race.
- **Target 5 (memory):** `context-engine` package shows the right interface shape for a pluggable memory layer. `ContextEngine` interface (`assemble`, `compact`, `ingest`, `bootstrap`, `info`) is generic enough that 2200's Brain can be expressed as an implementation.
- **Target 9 (tool registry):** `normalizeToolSchemas` and `inspectToolSchemas` per-provider hooks are the seam that lets a provider rewrite tool JSON-schemas at transport time — necessary because OpenAI Strict and Anthropic differ on which JSON-schema keywords they accept. 2200's tool registry should expose the same per-provider schema-normalization seam.

### Confidence and gaps

- **High:** ProviderPlugin shape, Anthropic-specific puzzle, auth profile types, failover algorithm, model catalog row shape, local-model integration, prompt-cache discipline.
- **Medium:** wrapStreamFn vs createStreamFn ordering (read type signatures + call sites, didn't trace dispatcher); ContextEngine interface shape (read first 80 lines, not delegate.ts/registry.ts/init.ts).
- **Not read:** `src/agents/tools/`, `src/agents/compaction.*`, `extensions/google/`, `openclaw doctor` repair flow, `pi-embedded-runner/`, `src/plugins/loader.ts`.

---

## Target 5: Memory backends and Brain interface (Epic 8)

**Status:** complete. Sub-agent walked Memory contract layers, builtin backend, Honcho, QMD, session pruning, EdgeClaw ClawXMemory + ClawXContext.

### Memory interface contract (3 layers)

**Deepest layer — `MemorySearchManager`** (`src/memory-host-sdk/host/types.ts:79`):

```typescript
interface MemorySearchManager {
  search(query, opts?: { maxResults?, minScore?, sessionKey?, sources?: MemorySource[] }): Promise<MemorySearchResult[]>;
  readFile(params: { relPath; from?; lines? }): Promise<MemoryReadResult>;
  status(): MemoryProviderStatus;
  sync?(params?): Promise<void>;
  probeEmbeddingAvailability(): Promise<MemoryEmbeddingProbeResult>;
  probeVectorAvailability(): Promise<boolean>;
  close?(): Promise<void>;
}
```

`MemorySource` is `"memory" | "sessions"` — same manager indexes both workspace memory files and live session transcripts. Memory is **line-addressable text**, not opaque blobs.

**Middle layer — plugin-capability seam** (`src/plugins/memory-state.ts:96`):

```typescript
type MemoryPluginCapability = {
  promptBuilder?: MemoryPromptSectionBuilder;
  flushPlanResolver?: MemoryFlushPlanResolver;
  runtime?: MemoryPluginRuntime;
  publicArtifacts?: MemoryPluginPublicArtifactsProvider;
};
```

**There is exactly one active memory capability at a time.** `memoryPluginState.capability` is a single field, not a list. Other plugins can supplement via `registerMemoryCorpusSupplement` and `registerMemoryPromptSupplement`, but only one plugin owns the `runtime`. Hard architectural choice: OC backends are mutually exclusive, not stacked.

**Outer layer — `MemoryCorpusSupplement`** (`memory-state.ts:43`): additive search surface. Anyone can register one and contribute extra results to recall.

**Async/sync semantics:** every contract method is `Promise`-returning except `status()` (synchronous snapshot). Errors flow as rejected promises; the host catches and degrades — `getMemorySearchManager` returns `{ manager: null, error?: string }` rather than throwing.

### Builtin backend

Implementation: `extensions/memory-core/src/memory/manager.ts:78`. The `MemoryIndexManager` class implements `MemorySearchManager`. **It is NOT the source of truth for memory content — it is an index over markdown files on disk.**

**Source-of-truth content:** markdown files in Agent workspace at `MEMORY.md`, `memory/**/*.md`, `DREAMS.md`. Selected media files indexed when multimodal enabled.

**Index:** SQLite at `~/.local/share/openclaw/memory/<agentId>.sqlite`. Schema includes `chunks_fts` FTS5 virtual table, `chunks_vec` sqlite-vec table, `embedding_cache` table. Per-Agent isolation by SQLite file. Hard-coded to `"sqlite"` in resolver.

**Pipeline:** files walked → chunked (default 400 tokens, 80 overlap) → hashed → embedded → FTS-indexed → vector-indexed. Chokidar watcher keeps index live. Interval timer + session-transcript-event subscription drive incremental syncs.

**Search:** hybrid by default (vector weight 0.7, text weight 0.3, normalized). MMR reranking and temporal decay optional. FTS-only fallback when no embedding provider available. Optional `onSearch`-triggered async resync.

**Multi-tenancy:** by `agentId` baked into DB path. Multi-session isolation by `sessionKey` passed in search opts. **The full DB is rebuildable from the markdown files plus session JSONLs — the SQLite is purely a derived index.**

### Honcho and QMD

**Honcho is OUT-OF-TREE.** No `src/` code; only docs at `docs/concepts/memory-honcho.md`. Ships as `@honcho-ai/openclaw-honcho` plugin. **Architecturally distinct: Honcho persists conversations to a dedicated service, exposed not through `MemorySearchManager.search` but through LLM-callable tools (`honcho_context`, `honcho_search_conclusions`, `honcho_search_messages`, `honcho_session`, `honcho_ask`).** Builds user/agent profile models server-side. Migration from workspace files is one-way upload; originals not deleted.

**Honcho does NOT use markdown files as source of truth — it inverts the OC default and treats its own service as authoritative.** This is the **anti-pattern reference** for 2200's [[2026-04-24-brain-is-files-not-database]] principle.

**QMD is in-tree alternate.** Backend resolution at `src/memory-host-sdk/host/backend-config.ts:350`:
```
const backend = params.cfg.memory?.backend ?? DEFAULT_BACKEND; // "builtin"
if (backend !== "qmd") return { backend: "builtin", citations };
```

QMD is a separate CLI binary OC spawns either per-query or via long-lived `mcporter` server. Indexes the same markdown collections, searches via `qmd query|search|vsearch`. Limits: `maxResults: 4`, `maxSnippetChars: 450`, `maxInjectedChars: 2200`, `timeoutMs: 4000`. **Like builtin, QMD treats markdown files as source of truth.**

### Session pruning (does NOT touch markdown memory files)

**Session store maintenance:**
- Default `pruneAfter`: 30 days
- Default `maxEntries`: 500
- Default `rotateBytes`: 10 MB per transcript
- Default `mode`: "enforce"
- Pruned: stale session entries from `sessions.json` plus their transcript files

**Cron run reaper** for ephemeral cron run sessions:
- Default retention: 24 hours
- Sweep throttle: every 5 minutes

**Workspace markdown memory files (`MEMORY.md`, `memory/**`) are NEVER pruned by these systems.** Session transcripts ephemeral by design; durable promotion of session insights into long-term memory happens through dreaming/promotion path, not session retention.

### memorySearch.remote

This is **provider-tuning knob for the existing local store**, not an alternate backend:

```typescript
remote?: {
  baseUrl?: string;
  apiKey?: SecretInput;       // can be ${secret:...} reference
  headers?: Record<string, string>;
  batch?: { enabled, wait, concurrency, pollIntervalMs, timeoutMinutes };
};
```

Composes with local backend by being passed into `createEmbeddingProvider`. `apiKey` is a `SecretInput` — runtime resolves via secrets gateway during agent boot. Per-Agent overrides win over `agents.defaults.memorySearch.remote`. Batch settings for OpenAI-style batch embedding APIs during initial index builds.

### EdgeClaw ClawXMemory architectural sketch

**Replaces OC's recall-only memory model with hierarchical, model-curated long-term memory** layered on markdown files plus thin SQLite control plane. Comparison from their README: OC = "Recall," Claude Code = "On-demand read," EdgeClaw = "Proactive reasoning." OC consolidation = none, EdgeClaw = "Auto-consolidation on idle & topic switch."

**Multi-tier memory layout:**
- **Global** layer for singleton user-preference profile (`global/User/user-profile.md`)
- **L2** project/timeline layer for high-level long-term context per project (`projects/<projectId>/project.meta.md`)
- **L1** structured-fragments layer distilled from concluded topics (`projects/<projectId>/Project/*.md` and `Feedback/*.md`)
- **L0** raw conversation layer
- `_tmp` project area stages incoming material

**Durable layer is markdown.** SQLite explicitly demoted to "runtime control-plane state such as raw captured sessions, settings, and recent traces." **This satisfies 2200's locked principle.**

**Retrieval model:** "model-guided recall" — instead of vector search → top-K → stuff-into-prompt, an LLM step decides whether memory is needed, then which project context is relevant, then which specific files supply best evidence. **Reasoning instead of matching.** Recall becomes a tool the model calls.

**Auto-consolidation** runs in background as the "Dream" process — reorganizes, merges, rewrites, deletes superseded file memories. Triggers on idle and topic switch (replacing OC's purely cron-driven dreaming).

**Lifting cost into 2200:** L0/L1/L2/Global layout is essentially a stricter Brain convention — already compatible with files-on-disk principle. Model-guided recall pattern is also compatible (Brain-search and Brain-get tools). The proactive-reasoning planner is the genuinely novel piece (extra LLM hop in request path). Auto-consolidation triggers (idle, topic switch) are detection problems 2200 would have to solve. **Pieces worth lifting individually rather than as bundle.**

### EdgeClaw ClawXContext architectural sketch

`kind: "context-engine"` plugin implementing OC's `ContextEngine` interface. Compaction split into three modes that can each be toggled independently:

- `snipEnabled` — cut individual messages
- `microcompactEnabled` — small ongoing summarization of fragments
- `autoCompactEnabled` — full compaction triggered automatically

Plus:
- `protectedRecentTurns` (default 6) — keep last N turns verbatim
- `autoCompactReserveTokens` (default 13000) — headroom kept under model context limit before auto-compact triggers

**Reinjection has three discrete knobs:**
- `reinjectSummary` (boolean) — put compaction summary back into assembled prompt
- `reinjectRecentFiles` (default 5) — re-pull N most recently touched files
- `reinjectCriticalToolOutputs` (default 5) — re-pull N tool results judged critical

So "dynamic reinjection" is concretely: after compaction collapses old turns into a summary, the assembler reattaches summary plus curated set of recent file states and critical tool outputs, on every turn.

**ClawXContext does NOT solve the system-prompt-too-big problem directly.** It shrinks the conversation, not the system prompt; relies on host's `autoCompactReserveTokens` budget.

### Compatibility with 2200's files-on-disk principle

**YES, the contract can be satisfied without violating the locked principle, because OC's own builtin backend already satisfies it that way.** Markdown files are source of truth; SQLite is rebuildable index. Principle survives at OC level.

**What 2200 needs:**
- `search`: requires search index. The principle-preserving framing is "index files are *cache*, not state — they live in `.cache/` location separate from Brain, with deletion-and-rebuild as documented operation."
- `readFile`: trivial against markdown files.
- `sync`: only meaningful with index. Optional in contract.
- `probeEmbeddingAvailability` / `probeVectorAvailability`: optional; return `false` if 2200 doesn't ship vector search.

**Harder conflict:** OC's `dreaming/short-term-promotion` ledger at `memory/.dreams/short-term-recall.json` — JSON state file NOT rebuildable from markdown alone (tracks recall counts, query hashes, recall days). If 2200 wants auto-consolidation, it inherits that kind of ancillary state. **Fix:** keep ledger in clearly-marked `.cache/` location, or accept some metadata about "what got recalled when" is part of Brain's durable state, written as markdown alongside consolidated memories rather than opaque JSON.

**ClawXMemory's design also satisfies the principle.** Honcho is the only one that violates it — anti-pattern reference for 2200.

### Implications for 2200 Epic 8

The Brain interface should look like a deliberately narrowed `MemorySearchManager` plus file conventions OC and ClawXMemory share:

```typescript
interface BrainStore {
  // Source-of-truth operations: act on markdown files directly
  readFile(params: { relPath; from?; lines? }): Promise<BrainReadResult>;
  writeFile(params: { relPath; content; mode: "create" | "replace" | "append" }): Promise<void>;
  listFiles(params: { prefix?, recentN?, by? }): Promise<string[]>;

  // Search: backend-pluggable, not load-bearing for v1
  search?(query: string, opts?: { maxResults?, minScore?, sources? }): Promise<BrainSearchResult[]>;

  // Status/diagnostics
  status(): BrainStatus;
}
```

**Convergence with OC:** line-windowed reads, line-numbered search results with snippets, source-of-truth-is-files invariant, `sources` enum for separating durable Brain content from transient session content.

**Divergence:**
- Drop in-tree QMD backend (out of scope, pick one)
- Drop multimodal embedding pipeline for v1 (text-only)
- Drop embedding provider abstraction's complexity for v1 (default FTS5-only with no embeddings, opt-in vector search later)
- Split OC's conflated "index" + "search manager" — one interface for read/write Brain (always available, files-on-disk only), one optional interface for search (backend pluggable, FTS5 in v1)

**Multi-Agent isolation at Brain directory level**, not index level. One Brain per Agent, subdirectory of Agent's workspace. Makes accidental cross-Agent leakage impossible.

**Auto-consolidation (dreaming/Dream pattern) belongs in Epic 8 as v2 capability, not v1.** Pattern depends on having working search/recall layer live long enough to produce a recall ledger. v1 ships files-on-disk + manual write tools + FTS5-only search. v2 adds consolidation pass.

**Compaction reinjection (ClawXContext pattern) belongs in runtime/loop epic, not Epic 8.** But Epic 8 needs to expose "recently-touched files" query for the runtime to use — 5-line addition (`listFiles({ recentN: 5, by: "mtime" })`).

### Cross-target findings

- **Target 1 (runtime):** compaction-hook seam shows three-mode pattern (`"off" | "async" | "await"`). Worth lifting for any 2200 hook. Lazy resolution pattern via `getActiveMemorySearchManager` cached by `(agentId, workspaceDir, settings, purpose)` — clean lifecycle without process-global state.
- **Target 4 (provider/cache):** `EmbeddingProvider` abstraction + `embedding_cache` SQLite table show right place for model-output cache that survives provider swaps, keyed by `(provider, model, input-hash, dims)`. Treat cache as throwaway state in `~/.local/share/...`.
- **Target 7 (automation — auto-consolidation):** OC dreaming + ClawXMemory triggers compose naturally. OC's pattern is **ledger-driven** (track recall counts, frequencies, recency, promote chunks meeting thresholds). ClawXMemory's is **trigger-driven** (detect idle, detect topic switch, run consolidation pass). Use ledger to *select what*, triggers to *decide when*. **For Epic 7: idle-detection primitive in runtime that any consolidation process can subscribe to, not just Brain.**

### Confidence and gaps

- **High:** Memory interface contract, builtin backend, session pruning, memorySearch.remote.
- **Medium:** Honcho (out-of-tree, derived from docs only), QMD (read backend-config resolver and spawn process).
- **Medium:** ClawXMemory (architectural shape from README + public ClawXMemory repo page; trigger logic biggest gap), ClawXContext (got plugin manifest configuration knobs but not TypeScript source).
- **Not investigated:** builtin backend's interaction with chokidar at scale (real edge cases there for 2200 if building on same approach), multimodal pipeline (intentionally out of v1 scope).

---

## Target 7: Automation primitives (Epic 6)

**Status:** complete. Sub-agent walked cron, hooks, standing orders, taskflow, coordination, notification tier coupling, EdgeClaw ClawXKairos.

### Cron primitive

`src/cron/`. Real, well-tested (~80 service-level tests).

- **Job declaration:** `CronJob` (`types.ts:168-177` building on `types-shared.ts:1-18`) is a tagged union over three schedule kinds: `at` (one-shot ISO timestamp), `every` (fixed-interval ms with optional anchor), `cron` (5/6-field expression with timezone and optional stagger window). Carries `id`, `agentId`, optional `sessionKey`, `enabled`, `wakeMode` (`next-heartbeat | now`), `payload` (`systemEvent` text or full `agentTurn` with model/fallbacks/timeout/tool-allowlist), optional `delivery` block (announce/webhook/none), optional `failureAlert` block. `sessionTarget`: `main | isolated | current | session:<id>`.
- **Storage split:** `~/.openclaw/cron/jobs.json` (durable, git-trackable) + `~/.openclaw/cron/jobs-state.json` (runtime state, gitignored). `nextRunAtMs`, `lastRunAtMs`, `consecutiveErrors`, `lastFailureAlertAtMs`, `scheduleErrorCount`. **Two-file split is worth lifting verbatim** — users can git-track schedules without churn.
- **Firing:** single `setTimeout`-based loop. `armTimer` computes soonest `nextRunAtMs`, takes min with `MAX_TIMER_DELAY_MS = 60_000` so loop wakes at least once a minute as drift insurance. Bounded `maxConcurrentRuns` (default 1).
- **Missed-fire on startup:** `runMissedJobs` collects all due jobs, runs first `maxMissedJobsPerRestart` (default 5) immediately, staggers rest with `missedJobStaggerMs` (default 5000ms) gaps. Uses `computeJobPreviousRunAtMs` to decide if a recurring slot was actually missed.
- **Error handling:** transient errors (`rate_limit`, `overloaded`, `network`, `timeout`, `server_error`) trigger up to 3 retries with backoff. Permanent errors disable one-shots. Recurring jobs get exponential backoff via `errorBackoffMs(consecutiveErrors)` capped via max() so backoff never lets a job fire faster than declared schedule. `MIN_REFIRE_GAP_MS = 2000` prevents same-second spin loops. `scheduleErrorCount` auto-disables after threshold for croner edge cases.
- **Failure alerts:** declarative `{ after, cooldownMs, channel, to, mode }` block. Routes through `sendCronFailureAlert`.

### Hooks primitive

`src/hooks/`. Event-driven, in-process, less tested than cron (fragile).

- **Event types:** five top-level (`command`, `session`, `agent`, `gateway`, `message`). Specific actions: `command:new/reset/stop`, `session:compact:before/after`, `session:patch`, `agent:bootstrap`, `gateway:startup`, `message:received/transcribed/preprocessed/sent`. Type-only (`command`) and type-colon-action (`command:new`) both fire when matching action dispatches.
- **Registration:** filesystem discovery. Each hook lives in directory with `HOOK.md` (frontmatter declaring events, requires.bins/env, optional os filter, install spec) + `handler.ts`/`.js`. Discovery scans bundled, managed, and workspace dirs; eligibility filters by config and platform.
- **Scoping:** **globally on the gateway process, not per-Agent or per-session.** Handler map is a `globalThis` singleton (`Symbol.for("openclaw.internalHookHandlers")`) explicitly to survive bundle splitting. Single "enabled" gate (`setInternalHooksEnabled`) for whole subsystem.
- **Failure mode:** per-handler `try/catch` inside `triggerInternalHook`. **Errors swallowed** — never propagate, never block downstream handlers, never block originating event. **Hooks cannot veto an action by throwing.** Only feedback path: mutate `event.messages` or `event.context`.

### Standing orders: NOT a code primitive

No `src/standing-orders/` directory. Pure documentation/convention pattern.

- **Format:** Markdown blocks under `## Program: <name>` headings inside workspace `AGENTS.md`. Four fields: `**Authority**`, `**Trigger**`, `**Approval gate**`, `**Escalation**`. Optionally `### Execution Steps` and `### What NOT to Do`.
- **Persistence:** none separate. Standing orders live in workspace bootstrap files (`AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `MEMORY.md`) auto-injected into every session at bootstrap.
- **Drives Agent behavior via:** system-prompt injection. Agent reads them and self-organizes. Cron jobs provide the time-based enforcement layer ("Execute daily inbox triage per standing orders" → Agent looks up own program description).

**OC treats standing orders as a UX pattern composed from existing primitives, not a fourth runtime variant.** 2200 should follow this — these belong with the workspace/Brain primitive, not the scheduler.

### Taskflow primitive

`src/tasks/task-flow-registry.ts`. Renamed from "ClawFlow."

- **Definition:** `TaskFlowRecord` carries `flowId`, `syncMode` (`task_mirrored | managed`), `ownerKey`, `controllerId`, `revision` (monotonic for optimistic concurrency), `status` (`queued|running|waiting|blocked|succeeded|failed|cancelled|lost`), `notifyPolicy`, `goal`, `currentStep`, `blockedTaskId`, `blockedSummary`, `stateJson`, `waitJson`, `cancelRequestedAt`. **The actual step graph is NOT in this record** — flows orchestrate over the existing `TaskRecord` ledger.
- **There is no built-in step DSL.** Task Flow is a state-machine wrapper, not a workflow language. The `taskflow.md` YAML example shows a Lobster workflow, not generic openclaw definition.
- **Two modes:** Managed (Task Flow owns lifecycle, creates child TaskRecords as steps) and Mirrored (observes externally created tasks, rolls up progress without owning creation).
- **Persistence:** SQLite. Revision conflict detection enables multi-writer safety.

### Coordination across primitives: not a single fan-in scheduler

Each primitive runs its own loop. Cooperate by enqueueing work on shared lanes.

- **`CommandLane` enum** (`src/process/lanes.ts:1-7`): four lanes — `Main`, `Cron`, `Subagent`, `Nested`. Each is FIFO with own concurrency cap (`setCommandLaneConcurrency`).
- **Cron pushes to Cron lane**, user commands to Main, subagent spawns to Subagent. Lanes independent.
- **Cron's single timer loop** processes due jobs with `maxConcurrentRuns`. `main`-target jobs route through `runHeartbeatOnce` on Main lane; `isolated`-target jobs go to `runIsolatedAgentJob` on Cron lane.
- **Hooks fire synchronously** at the event site, no queue. Awaits each handler in registration order. Slow hook = calling site waits.
- **Heartbeat is separate periodic loop.** Per-Agent phased schedule (sha256 hash of `agentId` modulo interval) avoids all-agents-firing-simultaneously.
- **The actual concurrency story:** four lanes, multiple loops, no central scheduler. Coordination by mailbox (`enqueueSystemEvent`) and lane queueing.

### Notification tier coupling

**OC enforces tier from action type, but only weakly.** Cron-created tasks always get `notifyPolicy: "silent"` — hardcoded at two creation sites (`timer.ts:153`, `ops.ts:507`). Agent cannot override at job-creation; cron creation API does not surface `notifyPolicy` as a field.

User-facing tier signal: `failureAlert` block on job definition. Declarative `after`, `cooldownMs`, `channel`, `to`, `mode`. Job declares "alert me on this channel after N failures with this cooldown."

`wakeMode` (`next-heartbeat | now`) is borderline tier-ish but Agent-settable at definition time, not fire time.

**Hooks have no tier mechanism at all.**

**Implication for tripwire #7:** OC mostly does the right thing by accident (cron tasks hardcoded `silent`, delivery routing declared at job-create time and immutable per-fire). Not principled — `notifyPolicy` enum exists but enforcement is by hardcoding rather than architectural rule. **2200's "tier from action type, not Agent judgment" rule needs to be enforced at the notification-creation API, not at the scheduling layer that calls into it.**

### EdgeClaw ClawXKairos sketch

Plugin extension at `extensions/clawxkairos/`. **Bolts autonomous self-driving loop on top of OC's existing heartbeat infrastructure rather than replacing it.** Six small modules: `tick-scheduler`, `sleep-tool`, `prompt-hook`, `background-commands`, `async-subagent`, `heartbeat-ack-guard`. Toggleable per-session with `/kairos on|off|status`.

- **Tick scheduler:** hooks `agent_end`. On every agent_end, if Kairos active and trigger was heartbeat tick or first user message, sets `setTimeout(tickDelayMs)` calling `runHeartbeatOnce({ reason: "hook:kairos-tick", heartbeat: { target: "last" } })`. Self-repeating loop driven by existing heartbeat runner. Bounded by `maxTurnsPerSession`.
- **Sleep tool:** first-class tool agent calls with `{ duration_ms }` (clamped). Implementation is `setTimeout` wrapped in Promise with abort-signal support. **System prompt explicitly tells agent: every tick, must call a real tool or call Sleep — never reply with just text, never reply HEARTBEAT_OK.** Sleep tool is canonical "I'm idle, don't burn tokens" signal.
- **Async sub-agents:** `before_tool_call` hook intercepts `sessions_spawn` from heartbeat ticks. Returns `{ block: true, blockReason }`, re-issues spawn through `api.runtime.subagent.run()` returning runId immediately. Enqueues system event back to parent so it learns of spawn on next tick. Parent isn't blocked; loop keeps moving.
- **Background commands and ack guard:** `before_tool_call` on `exec` injects `yieldMs: autoBackgroundAfterMs` when agent didn't set one. `heartbeat-ack-guard` listens to `llm_output` and treats bare HEARTBEAT_OK replies as default "sleep for a while."

**Architectural shape:** layer behavioral nudges via plugin hooks at boundaries (`before_tool_call`, `agent_end`, `llm_output`) rather than modifying core runtime.

### Implications for 2200 Epic 6

**Don't pre-collapse the four primitives.** Cron + hooks (separate APIs) belong in Epic 6. Standing orders defer to workspace/Brain epic. Taskflow probably its own later epic.

**Lift directly from cron:**
- Two-file storage split (definitions vs runtime state)
- Schedule-kind taxonomy (`at | every | cron`) as schema-level distinction
- `wakeMode: now | next-heartbeat` as declared field, not runtime escalation knob (right pattern for tripwire #7)
- Failure-alert decomposition (separate from delivery destination)
- Transient/permanent error classification with regex pattern matching, bounded retries, backoff
- `MIN_REFIRE_GAP_MS` safety floor + `MAX_TIMER_DELAY_MS` ceiling (track issue numbers as named hazards)
- Startup catch-up with bounded immediate runs + staggered deferred runs
- Per-job timeout with AbortController + Promise.race

**Adapt for Agent-as-process:**
- OC's cron timer is one `setTimeout` per gateway. 2200's Agent-as-process means **scheduler runs in supervisor process, Agents are wakeable targets**. Supervisor signals Agent process to wake when scheduled work fires.
- `CommandLane` enum becomes per-Agent queues with named lanes (Main/Cron/Subagent/Nested).
- Skip the `globalThis` singleton hack — with OS-process Agents, each process has its own handler map naturally.

**Skip:**
- Mirrored sync mode for taskflow as v1 feature
- Hardcoded `notifyPolicy: "silent"` for cron tasks — replace with explicit notification-tier-from-action-type rule enforced at notification creation layer

### Cross-target findings

- **Target 1 (runtime):** scheduler is NOT part of Agent runtime in OC — part of gateway/supervisor. Agent runtime exposes wake API (`runHeartbeatOnce`, `requestHeartbeatNow`, `enqueueSystemEvent`). 2200 should preserve: keep Agent runtime focused on "execute a turn, hold state," put scheduling in supervisor.
- **Target 9 (tool registry):** scheduled jobs invoke tools indirectly. Cron job's payload is either `systemEvent` (just message text) or `agentTurn` (full message + optional model override + optional `toolsAllow` allowlist). **Scheduler does not call tools directly. 2200 should preserve this: scheduled jobs as messages-into-agent, not direct tool invocations.** The `toolsAllow` per-job tool allowlist worth lifting.
- **Target 5 (memory):** ClawXKairos's auto-consolidation-on-idle pattern enabled by Sleep tool. Sleep tool pattern (tool agent explicitly calls to declare idleness, runtime can hook on) is cleaner than inferring idleness from message gaps.

### Confidence and gaps

- **High:** cron schema/storage/timer loop, hooks registration/dispatch/scoping, standing orders are not a code primitive, ClawXKairos shape.
- **Medium-high:** Taskflow shape, coordination across primitives, notification tier coupling.
- **Not covered:** plugin hooks (in-process `before_tool_call`/`agent_end` family), webhooks as inbound triggers, heartbeat runner full lifecycle, supervisor process model, ClawXMemory and ClawXContext.

---

## Target 8: Multi-channel routing (Epic 13/14) and ACP

**Status:** complete. Sub-agent walked Gateway routing, channel adapter contract, ACP, session partitioning, channel health monitoring.

### Gateway routing

Three pieces: `src/routing/resolve-route.ts` (pure logic), `src/routing/bindings.ts` + `binding-scope.ts` (config-driven evaluation), `src/gateway/server-channels.ts` (`ChannelManager` lifecycle).

`resolveAgentRoute(input)` evaluates a 9-tier fixed priority list:
1. `binding.peer` — exact peer match (channel, account, peer kind+id)
2. `binding.peer.parent` — thread parent inheritance
3. `binding.peer.wildcard` — peer kind wildcard
4. `binding.guild+roles` — Discord guild + role IDs
5. `binding.guild` — Discord guild without roles
6. `binding.team` — Slack workspace team
7. `binding.account` — channel + account
8. `binding.channel` — channel only
9. `default` — fallback Agent

First match wins. `matchedBy` recorded for debug logging. Resolved `agentId` sanitized via `pickFirstExistingAgentId` — binding referencing deleted Agent silently falls back to default.

**Caching:** two WeakMap caches keyed by `OpenClawConfig` reference. `evaluatedBindingsCacheByCfg` (pre-indexed bindings, O(1) lookups). `resolvedRouteCacheByCfg` (final resolved-route, keyed by full input tuple). Drop on config rev. Cache caps at 4000 / 2000 keys.

### Session key shape

`buildAgentPeerSessionKey` (`src/routing/session-key.ts:130`) encodes routing identity:

- DM in `main` mode: `agent:<agentId>:main`
- DM in `per-account-channel-peer`: `agent:<agentId>:<channel>:<accountId>:direct:<peerId>`
- Group/channel: `agent:<agentId>:<channel>:<peerKind>:<peerId>`
- Threads/topics: `<sessionKey>:thread:<normalizedThread>` via `resolveThreadSessionKeys`

`identityLinks` cross-channels the same human across multiple peer IDs (e.g. same person on Slack and Telegram). The session key is unit of state — Brain entries, transcripts, ACP sessions all key off it.

### Channel adapter contract: 25+ optional slots, no base class

`ChannelPlugin` (`src/channels/plugins/types.plugin.ts:53`) is a single object literal with ~25 optional adapter slots. Duck-typed plugin: identify what your channel can do, fill in relevant slots, leave the rest undefined.

**Required:** `id`, `meta`, `capabilities`, `config`.

**Optional slots, grouped:**
- **Lifecycle:** `gateway` (`startAccount`/`stopAccount`/`logoutAccount`/`loginWithQrStart`/`loginWithQrWait`), `lifecycle`, `heartbeat`
- **Send:** `outbound` is central send adapter. Multiple delivery modes (`direct | gateway | hybrid`), capability declarations, pre/post hooks, send fns (`sendPayload`, `sendText`, `sendMedia`, `sendPoll`, etc.)
- **Receive:** **no single `onMessage` callback.** Each channel runs its own provider client and dispatches via runtime helpers. **Inbound flows into `messaging.resolveInboundConversation` and downstream into `routing.resolveAgentRoute`.**
- **Routing helpers:** `messaging`, `threading`, `bindings`, `conversationBindings`, `groups`, `mentions`, `actions`, `directory`, `resolver`
- **Auth/permissions:** `auth`, `setup`, `pairing`, `secrets`, `allowlist`, `security`, `elevated`, `commands`, `approvalCapability`
- **Status:** `status`
- **Tools:** `agentTools` (channel-owned Agent-callable tools)

**`channelRuntime` SDK is for external plugins.** Bundled channels skip it and import internal modules directly. Boundary fuzzy. **2200 should make the SDK boundary load-bearing from day one — bundled and external channels both go through same surface, no internal-import shortcuts.**

### Web channel: NO bundled "web channel" in the dashboard sense

Top-level `src/channel-web.ts` is a misleading name — it re-exports the WhatsApp Web (Baileys) channel plugin. **OpenClaw does not currently ship a first-class web/dashboard channel.** The "web client" surface exists as gateway control UI (operator-facing) and plugin-runtime web apps, but inbound user interaction comes through messaging channels. **The dashboard is for operators, not end users.** Worth flagging — informs how Doug thinks about Epic 13.

### ACP (Agent Client Protocol)

**ACP is Zed's external standard** (npm `@agentclientprotocol/sdk`), not OC-internal. OC uses it two ways:

**Way 1: External clients talking to OpenClaw.** `src/acp/server.ts` runs ACP server over **stdio** (NDJSON over stdin/stdout). External ACP clients (Zed editor, etc.) speak to OC as if it were an Agent. Translator (`src/acp/translator.ts`) maps ACP RPCs onto OC gateway calls.

**Way 2: ACP as sub-Agent runtime inside OpenClaw.** `src/acp/runtime/types.ts` defines `AcpRuntime` interface — abstracts "external CLI Agent that speaks ACP" as a backend OC can spawn child sessions into. Bundled backend is `acpx`.

`AcpRuntime` capabilities:
- `ensureSession(input)` returns `AcpRuntimeHandle` (sessionKey, backend, runtimeSessionName, cwd, backendSessionId)
- `runTurn(input)` returns `AsyncIterable<AcpRuntimeEvent>` — streaming events: `text_delta`, `status`, `tool_call`, `done`, `error`. Includes thoughts (`stream: "thought"`), usage updates, tool-call updates.
- `cancel`, `close`, `prepareFreshSession`, `setMode`, `setConfigOption`, `getCapabilities`, `getStatus`, `doctor`

**Sub-agent spawn flow** (`src/agents/acp-spawn.ts`): three policy gates before spawn (`isAcpEnabledByPolicy`, `resolveAcpAgentPolicyError`, `resolveAcpSpawnRuntimePolicyError` — sandboxed sessions cannot spawn ACP, spawn-depth and per-Agent child limits enforced). `getAcpSessionManager().initializeSession(...)` creates isolated child session under derived `childSessionKey`, queues initial task as detached task run.

**Parent stream relay** (`src/agents/acp-spawn-parent-stream.ts`): JSONL sidecar log file (`<sessionId>.acp-stream.jsonl`) next to child session transcript. Tails via agent-events bus. Output buffered (max 4_000 chars), flushed every 2_500ms, surfaced into parent via `enqueueSystemEvent`. Heartbeats via `requestHeartbeatNow`. Max relay lifetime 6 hours, no-output notice at 60s.

**Two distinct transports:**
- **External ACP clients ↔ OC:** NDJSON over stdio, JSON-RPC-like
- **OC gateway ↔ OC clients (CLI, web, mobile):** separate WebSocket protocol with versioned hello, capability negotiation, scoped auth, three frame kinds (`req`/`res`/`event`)

### Session partitioning

Four `dmScope` values: `main` (single shared session per Agent), `per-peer` (one per peer across channels), `per-channel-peer` (one per channel-peer), `per-account-channel-peer` (full partition).

Group/channel sessions always partitioned. ACP sub-agent sessions are children of parent session key with own `childSessionKey`. Per-Agent and per-spawn-depth limits in `agent-limits.ts`.

### Channel health monitoring

`startChannelHealthMonitor` runs `runCheck` every 5 minutes. After 60s startup grace, iterates every `(channelId, accountId)` snapshot and runs `evaluateChannelHealth`:

- Unmanaged: healthy `unmanaged`
- `!running`: unhealthy `not-running`
- Busy with recent run activity (<25min): healthy `busy`
- Busy with stale run activity: unhealthy `stuck`
- Within `channelConnectGraceMs` (120s) of `lastStartAt`: healthy `startup-connect-grace`
- `connected === false`: unhealthy `disconnected`
- Connected but `lastTransportActivityAt` older than 30 min: unhealthy `stale-socket`

`lastTransportActivityAt` is **transport-level only** (heartbeats, polls, socket pings) — quiet workspaces can go idle while upstream maintains heartbeats.

**Triggers restart with rate limits:** 2-check cooldown (10 min), 10 restarts/hour cap. **Surface: logs only.** No notification, no Agent-side visibility unless operator pulls status. **Real gap to flag** — channel restarts silently.

### Implications for 2200 Epic 13/14 and Studio/Roster/Bulletin

**Channel adapter contract for 2200:** OC's 25+ optional slots reflect a decade of accreted edge cases. For v1, the **8 load-bearing slots:**
1. `id`, `meta`, `capabilities` — registration
2. `gateway` — lifecycle
3. `outbound` — egress
4. **Explicit `onMessage(envelope) → DeliverResult`** — 2200 should make receive a single slot (OC's pattern is more flexible but opaque)
5. `messaging.resolveInboundConversation` — channel-specific peer/thread parsing
6. `status` — per-account snapshot + probe
7. `auth` / `setup` — wizard, login
8. `bindings` / `conversationBindings` — coupling to Studio/Roster

Make the rest extension-shaped. Bundled and external channels both go through the same SDK boundary from day one — no internal-import shortcuts.

**ACP ↔ Studio/Roster/Bulletin mapping:**
- **Sub-agent spawning (ACP) → 2200 Studio's "spawn child Agent for task" primitive.** Same shape: parent passes task, gets child session key + run ID + stream log path, parent receives streamed updates as system events. Lift policy gates (depth, child limit, sandbox restrictions) verbatim.
- **Parent stream relay → Studio's "watch child Agent run" mechanism.** OC's pattern (buffering chunks, flushing on interval, surfacing into parent via system events with heartbeat re-wake) is reusable. **JSONL sidecar log format is portable, debuggable, matches files-on-disk Brain principle.**
- **Roster** (which Agents know about each other) is **NOT** in OC. ACP is push-only: parent decides who to spawn, child has no view of siblings. **2200 needs dedicated roster surface — greenfield, not a port.**
- **Bulletin** (broadcast to group of Agents) also **NOT** in OC. Closest analog is configured bindings (per-channel not Agent-to-Agent). **Greenfield.**
- **Studio surface:** 2200 needs UI for operator to see all running Agents, states, parent/child relationships, recent activity. OC has none in unified place; bits scattered. **2200 should treat Studio as first-class concept with its own protocol** (wire shape borrowed from OC's gateway frame discipline).

**Three protocols, not one:**

1. **Channel protocol** — what channel adapters implement. ~8 required slots. Defines ingress/egress for one external messaging surface.
2. **Studio/Roster/Bulletin protocol** — Agent-to-Agent. Greenfield, but borrow ACP `AsyncIterable<Event>` streaming shape and JSONL sidecar log pattern.
3. **Client protocol** — what web/mobile/CLI clients use to talk to 2200 runtime. Borrow OC's gateway frame discipline (versioned hello, capability negotiation, three frame kinds). **Load-bearing protocol because every client surface depends on it.**

**Epic 13/14 implication:** web/mobile clients sit on protocol #3 (client protocol), not channel protocol. OC conflates these — `channel-web.ts` is WhatsApp, dashboard speaks gateway protocol, external ACP clients speak third protocol. 2200 names them differently from day one.

### Cross-target findings

- **Target 1 (runtime — gateway protocol):** OC's gateway protocol (`src/gateway/protocol/schema/frames.ts`) is discriminated WebSocket frame protocol with version negotiation, capability advertisement, scoped auth, three frame kinds. Strong precedent for 2200's API negotiation. The `hello-ok` schema carries `features.methods`, `features.events`, `policy.maxPayload`, `policy.maxBufferedBytes`, `policy.tickIntervalMs` — runtime tells client what it supports and client adapts.
- **Target 3 (plugins):** **Channels in OC are plugins.** Same loader, same registry, same activation boundary, same `openclaw.plugin.json` manifest. Channel-adapter contract (Target 2) and plugin contract (Target 3) share lifecycle. **2200's Extensions framework should be the same surface that channels register through. Don't build two extension systems.**
- **Target 9 (tools):** `ChannelPlugin.agentTools` — channels can register Agent-callable tools (Telegram's "send poll", Slack's "set status", etc.). Flow into same tool registry. **2200's tool registry should accept tools from any extension type, including channels.** Plus `ChannelMessageActionAdapter` — channels expose per-message actions (buttons / context menu items). Worth lifting as first-class concept.

### Confidence and gaps

- **High:** routing flow, session key shape, channel plugin contract, Telegram as representative, channel health monitor, ACP wire shape, ACP sub-agent spawn semantics.
- **Medium:** `channelRuntime` SDK surface (read docstring, not implementation), ACP session manager internals (read type surface, not implementation).
- **Not read:** `src/gateway/server.ts` and `server.impl.ts` (WebSocket server + frame handling), `src/gateway/server-methods/`, `src/acp/control-plane/manager.ts`, `src/channels/plugins/registry-loader.ts`, other channel adapters (only Telegram in depth — Slack would inform binding section more).

---

## Target 10: Deployment topology (Simon's lane)

**Status:** complete. Sub-agent surveyed Docker, PaaS, Podman, native macOS/iOS/Android apps, launchd, Pi, AnyClaw, mimiclaw, Railway template.

### Docker model: four Dockerfiles, three trust/tool tiers

- **`Dockerfile`** (gateway/CLI image): multi-stage build. Base images pinned by SHA256. Build args gate optional installs (`OPENCLAW_INSTALL_BROWSER` adds Chromium+Xvfb ~300MB; `OPENCLAW_INSTALL_DOCKER_CLI` adds Docker CLI for sandbox use ~50MB with **GPG fingerprint verification**). **Extension allowlist via `OPENCLAW_EXTENSIONS` build arg — only opted-in plugins ship in image.** Runs as `node` user (UID 1000), bound to loopback by default with built-in `/healthz` and `/readyz` probes.
- **`Dockerfile.sandbox`** (24 lines): minimal **untrusted-code sandbox base.** bookworm-slim + bash + minimal CLI tools. Non-root `sandbox` user. `CMD ["sleep", "infinity"]`. Per-task ephemeral container.
- **`Dockerfile.sandbox-browser`** (37 lines): extends sandbox base with Chromium + Xvfb + x11vnc + noVNC + websockify. Headed browser sandbox for visual web automation.
- **`Dockerfile.sandbox-common`** (49 lines): fatter sandbox with Node, npm, Python, Go, Rust, build-essential. For tasks needing language-level deps.

**Three-tier model:**
1. Gateway image — long-lived, holds credentials, network-attached
2. Sandbox base — short-lived, no creds, minimal blast radius
3. Sandbox-common / sandbox-browser — short-lived heavier tool surface for specific task types

**Sandbox tier separation is non-negotiable if 2200 lets Agents execute code. Build into Epic 2 spec, don't retrofit.**

`docker-compose.yml`: gateway service + cli service. Both mount `${OPENCLAW_CONFIG_DIR}` and `${OPENCLAW_WORKSPACE_DIR}` from host — **state lives outside container.** CLI service drops NET_RAW + NET_ADMIN, `no-new-privileges`.

### PaaS targets converge on one convention

**Render, Fly, Railway all use `/data` as single mountpoint** with `OPENCLAW_STATE_DIR=/data/.openclaw` + `OPENCLAW_WORKSPACE_DIR=/data/workspace`. **One volume, two paths, predictable backup target.** 2200 should adopt the same convention from day one.

- **Render:** simplest. `runtime: docker`, auto-generated `OPENCLAW_GATEWAY_TOKEN` via `generateValue: true` (cleanest first-run-secret pattern), 1GB persistent disk at `/data`.
- **Fly:** `auto_stop_machines = false` and `min_machines_running = 1` — explicitly disables scale-to-zero (gateway holds long-lived WebSocket and channel connections). `NODE_OPTIONS = "--max-old-space-size=1536"` on 2048MB VM (leaves OS headroom). **`fly.private.toml` is same minus `[http_service]`** — no public IP, gateway via `fly proxy`, WireGuard, or `fly ssh console`. Hardened option for outbound-only deployments. **Right default for 2200's managed-service mode.**
- **Railway:** one-click via template. **`codetitlan/openclaw-railway-template` has 38 stars but 210 forks** — Railway requires forking template repo to deploy via button-flow, so each fork is one deployment. **Biggest concrete signal that managed-deploy-from-button-flow is dominant self-host path for non-developer users.** 2200's managed-service tier needs one-click button flow with state on mounted volume + setup password gate, not just Docker image. **Build for the button.**

### Podman as first-class peer to Docker

Rootless Podman runs gateway container as operator's UID via `--userns=keep-id`. Host `openclaw` CLI remains control plane (`OPENCLAW_CONTAINER=openclaw` env var routes commands into container). State on host at `~/.openclaw` (bind-mounted), not in Podman volume. Optional **Quadlet integration** generates systemd-user unit files for boot persistence on Linux. Helper script reads only allowlist of Podman-related env keys from `.env` (defensive against leaking provider keys).

Pattern worth lifting: **container management via host CLI plus state-on-host bind mount.** Avoids "shell into container to see logs" anti-pattern.

### Native macOS app: 231 Swift files, full menu-bar product

`apps/macos/`. Targeting macOS 15. Top-level structure:
- `OpenClaw` (executable, menu-bar app)
- `OpenClawIPC` (library, IPC surface)
- `OpenClawDiscovery` (library, Bonjour/local-network gateway discovery)
- `OpenClawMacCLI` (executable, `openclaw-mac` shell command)

Key dependencies: `MenuBarExtraAccess`, `swift-subprocess`, `Sparkle 2.9+`, `Peekaboo` (screen automation), `OpenClawKit`, `Swabble`.

**What the Mac app actually does:**
- **Menu bar host** (`MenuBar.swift`) — primary surface. `LSUIElement = true` (no Dock icon by default; toggle exists)
- **Spawns and supervises gateway as launchd LaunchAgent** via `GatewayProcessManager` + `GatewayLaunchAgentManager`. Mac app is install/control surface; gateway runs as separate process under launchd.
- **CLI installer** with GUI prompter
- **TCC permission management** for camera, mic, speech recognition, screen capture, location, AppleEvents, Reminders. Every Info.plist entry has usage description.
- **Sparkle auto-updater** with `appcast.xml` at repo root (105KB), hosted from GitHub raw URL. EdDSA signature + delta update flow.
- **Canvas window system** (CanvasManager, CanvasWindow, CanvasWindowController, CanvasSchemeHandler) — A2UI rendering surface. Custom URL scheme handler. Native window per agent canvas.
- **Settings panes**: Channels, Instances, About, Debug — persisted state via `@AppStorage` keys centralized in `Constants.swift` (40+ keys).
- **Audio/voice surface** + camera capture
- **Code signing flow**: Team ID audit step compares app bundle Team ID against every embedded Mach-O.

Sibling: `apps/macos-mlx-tts/` — isolated Swift Package for on-device Apple-Silicon TTS. Kept separate so normal macOS app tests don't compile full MLX audio stack.

**Summary: full menu-bar product with installer, supervisor, updater, permission broker, canvas renderer, voice surface.** Not a thin shell.

### iOS and Android: native, not RN/Tauri

**iOS** (`apps/ios/`): full Xcode project via XcodeGen. Bundle prefix `ai.openclaw`, deployment target iOS 18, Swift 6 strict concurrency, includes Watch app, Live Activities widget, Share Extension. Distributed via Fastlane. Each Sources subdirectory (Calendar, Camera, Contacts, EventKit, Gateway, HomeToolbar, LiveActivity, Location, Media, Motion, Onboarding, Push, Reminders, RootCanvas, RootTabs, Screen, Voice) represents real native integration. **Bonjour `_openclaw-gw._tcp` for mDNS gateway discovery.** Push via `OpenClawPushRelayBaseURL` (gateway can't push directly — needs APNs relay).

**Android** (`apps/android/`): Gradle, Kotlin + Jetpack Compose, `minSdk = 31`, `targetSdk = 36`. **Two product flavors — `play` and `thirdParty`.** Play flavor disables SMS and Call Log features (`buildConfigField "OPENCLAW_ENABLE_SMS" "false"`); third-party flavor enables them. **Play Store policy compliance done right.**

**Both share `apps/shared/OpenClawKit/`** — Sources/OpenClawKit/Resources also added to Android source-set assets, so resources cross language boundaries.

**Key insight: each integrates platform-specific surfaces** (HealthKit-adjacent, EventKit, Location, Motion, Camera, push, share extension, Watch app, Live Activities, biometric lock, encrypted prefs) **that JS bridge would reach awkwardly or not at all.** OC's choice to go native is a strong signal for 2200 Epic 16.

### macOS launchd integration: pattern worth lifting

`src/daemon/launchd.ts` + `launchd-plist.ts` + `launchd-restart-handoff.ts`:

- **Label assertion/sanitization** at every entry point (regex `/^[A-Za-z0-9._-]+$/`) — defensive against label injection
- **Profile-aware label resolution**: `ai.openclaw.gateway.<profile>.plist` per profile
- **Plist generated programmatically**, not from template. Custom escape/unescape handles entities correctly
- **Round-tripping:** `readLaunchAgentProgramArgumentsFromFile` can re-read its own plist to introspect running daemon's args/env. Useful for migration: gateway can read own boot config, modify, rewrite
- **`ThrottleInterval = 1`** overrides launchd's default 10s relaunch throttle so CLI-initiated restarts not stalled
- **Launchd-aware restart handoff:** `isCurrentProcessLaunchdServiceLabel` checks env vars (`LAUNCH_JOB_LABEL`, `LAUNCH_JOB_NAME`, `XPC_SERVICE_NAME`) to detect "I am running under launchd right now." If yes, uses `launchctl kickstart` or "start after exit" rather than self-exec. **Right pattern: never re-exec yourself when supervisor exists; ask supervisor.**

Sibling files: `schtasks.ts` (Windows), `node-service.ts`, `systemd-unavailable.ts` (Linux), `gateway-entrypoint.ts`. **Whole `src/daemon/` is the cross-platform service supervision layer.** Read end-to-end before designing 2200's Agent supervisor.

### Raspberry Pi: real, well-documented

`docs/install/raspberry-pi.md`. Pi 4 or 5, **2GB+ RAM (4GB recommended)**, 64-bit Pi OS Lite required. Installs Node 24 from `deb.nodesource.com` and standard `install.sh` — **no Pi-specific build.**

Tunings: 2GB swapfile + `vm.swappiness=10`, `NODE_COMPILE_CACHE` + `OPENCLAW_NO_RESPAWN=1`, `gpu_mem=16`, disable bluetooth/cups/avahi. **USB SSD over SD card** strongly recommended.

systemd user service is supervision model. `loginctl enable-linger "$(whoami)"` for boot persistence (equivalent to launchd's "always" load directive).

**Sanity check value:** Node-based gateway viable on $40 ARM single-board with 2GB RAM if you tune swap and avoid bundle re-evaluation.

### Coexistence-by-state-dir affordance: CONFIRMED

`src/cli/profile.ts` (101 lines, read in full). `--profile <name>` and `--dev` flags:

- `OPENCLAW_PROFILE=<name>` env var set
- `OPENCLAW_STATE_DIR` defaults to `~/.openclaw-<profile>` (`default` profile uses bare `~/.openclaw`)
- `OPENCLAW_CONFIG_PATH` defaults to `<state_dir>/openclaw.json`
- For `dev` profile, `OPENCLAW_GATEWAY_PORT` defaults to `19001` (vs standard `18789`)
- launchd label profile-aware: `~/Library/LaunchAgents/ai.openclaw.gateway.<profile>.plist`. Same for Windows Task Scheduler.
- Profile name validated against `isValidProfileName` (letters, numbers, `_`, `-` only)

**Confirmed: every fork ecosystem coexistence story (DenchClaw, LocalClaw, OCMT) leans on this primitive.** Different state dir → different config → different gateway port → different OS service label → no collision.

**For 2200, preserve from day one:**
- Single `--profile <name>` flag switches state dir + config path + port + OS-supervisor label atomically
- Default profile uses bare directory (`~/.2200`), named profiles use suffixed (`~/.2200-work`)
- Service labels include profile name (`ai.2200.gateway.work`)
- Env var so child processes inherit
- Validate profile name against strict charset

**Cheap to design in, expensive to retrofit. Load-bearing for migration story.**

### AnyClaw and mimiclaw sketches

**AnyClaw** (Android with embedded Linux): bundles Termux's `bootstrap-aarch64.zip` as APK asset, extracts to `/data/user/0/com.codex.mobile/files/usr` on first launch — minimal Linux userland runs **directly via Android's native ARM64 binary execution** (no proot/chroot, exploiting `targetSdk = 28` to avoid Android 10+ W^X SELinux). `bionic-compat.js` shim patches Node's `process.platform` to "linux." **Packaging-only — no fork of OpenClaw core.** **The W^X bypass via stale targetSdk is Play Store rejection waiting to happen.** Lift WebView + foreground-service + bundled gateway shape for third-party/sideload flavor only. Play flavor follows OC's existing model.

**mimiclaw** (ESP32-S3): pure-C reimplementation for ~$5 chip, 16MB flash, 8MB PSRAM. Both Anthropic and OpenAI providers with tool-calling in ReAct loop. Persistent cron scheduling that **agent can self-modify via `cron_add` tool**. Storage: plain-text files on SPIFFS (`SOUL.md`, `MEMORY.md`, `HEARTBEAT.md`, per-day notes). **What survived the 16MB flash budget: file-as-memory pattern, LLM provider abstraction, tool calling, ReAct, agent-modifies-its-own-schedule pattern. What was discarded: every server-side concern (gateway, channels, plugins, Brain DBs, sandboxes).** Confirms files-on-disk Brain pattern survives at absolute floor.

### Implications for 2200 Simon-lane and Epic 16

**For Simon:**
- `/data` mountpoint convention (state + workspace subdirs) consistent across Render, Fly, Railway, Hetzner, Pi. **Adopt from day one.** Simpler backups, simpler docs, simpler migration off any single PaaS.
- `fly.private.toml` pattern (no public ingress, access via tunnel) is right default for 2200 managed-service mode where user has no inbound webhooks. Doug's "more Apple than Linux" suggests private-by-default.
- Multi-stage Dockerfile with **opt-in extension allowlist at build time** is the pattern to lift for Extensions framework. Without it, every plugin's transitive deps inflate image and stale plugin code invalidates install layer.
- **Sandbox tier separation non-negotiable.** Three-tier model (gateway image + sandbox base + sandbox-common/browser) into Epic 2 spec.
- Podman-as-peer real path. If Simon picks it, host CLI / container CLI symmetry needed from day one.
- launchd, systemd user units, Windows Task Scheduler all live first-class targets in OC. **2200's Agent-as-process model still needs OS supervisor for the supervisor itself.** Lift launchd-restart-handoff pattern (detect env vars, never self-exec, ask supervisor) for Mac; lift systemd-user + lingering pattern for Linux.
- **Plugin install requires Docker rebuild for managed deployments** (read-only image layer). 2200 implication: managed-service tier needs plugin-rebuild-and-redeploy flow. Plugin manifests live under `/data` state dir, not app dir; webhook or scheduled rebuild rolls new extensions out.

**For Epic 16:**
- **Native, not React Native or Tauri.** OC chose native Swift + native Kotlin/Compose. Per-platform code surface (HealthKit, EventKit, Motion, Location, Camera, share extensions, Watch app, Live Activities, biometric lock, encrypted prefs, Bonjour discovery, push) justifies it. **Strong signal to go native.**
- **Local discovery via mDNS/Bonjour** (`_2200-gw._tcp`) right default for "phone on same WiFi as home server."
- **Two product flavors for Android** (Play vs third-party) lets you compile out features Play Store rejects (SMS, Call Log) while keeping them for sideload users.
- **Push notifications via relay**: APNs requires Apple-signed credentials, gateway cannot push directly. **2200 needs equivalent relay service. Flag to Simon.**

### Cross-target findings

- **Target 1 (entry/respawn):** OC's `ensureCliRespawnReady()` re-execs CLI with right Node version/flags/state dir. **Dangerous for deployments under supervisor** — see launchd restart-handoff. Pi docs recommend `OPENCLAW_NO_RESPAWN=1`. **2200 should design respawn as opt-in, not opt-out, and detect every supported supervisor (launchd, systemd, Docker init, Windows Task Scheduler) before re-execing.**
- **Target 3 (plugins):** Dockerfile's `OPENCLAW_EXTENSIONS` build arg is only way to ship plugins in PaaS images — runtime install would write to read-only image layer. **Managed deployments need plugin-rebuild-and-redeploy flow, not runtime install flow.**

### Confidence and gaps

- **High:** all four Dockerfiles, compose, render.yaml, fly.toml, fly.private.toml, podman setup, macOS app structure, launchd subsystem, profile.ts, install docs.
- **Medium:** macOS Swift sources (231 files; sampled), iOS/Android source detail.
- **Lower:** AnyClaw, mimiclaw (READMEs only, no source review).
- **Not read:** Azure/GCP/Oracle/DigitalOcean/Hostinger/Ansible/Nix/Bun/Node install docs, scripts/podman/setup.sh, scripts/docker/setup.sh, scripts/k8s/deploy.sh, macOS Swift implementation of GatewayProcessManager + GatewayLaunchAgentManager.

---

## Target 6: Secrets and credential abstraction (Epic 9)

**Status:** complete. Sub-agent walked auth-store internals, SecretRef abstraction, secrets directory layout, apply-plan contract, rotation/scoping, audit collectors, secrets gateway, cross-platform encryption.

### Two parallel credential trees in OC (one too many)

OC has two distinct credential stores:

**(a) Auth-profiles store** — per-Agent file at `<agentDir>/agent/auth-profiles.json`. Where model auth lives (Anthropic, OpenAI, OAuth tokens, etc). Path: `<stateDir>/agents/<agentId>/agent/auth-profiles.json`.

**(b) OAuth credentials directory** — `<stateDir>/credentials/` (overridable by `OPENCLAW_OAUTH_DIR`). Channel/provider OAuth artifacts. Per-channel subdirs (e.g. `~/.openclaw/credentials/wa-personal/`). This is the directory CLAUDE.md references.

**No centralized JSON schema for what's inside per-channel `authDir`.** Each channel plugin owns the format. Makes auditing per-channel credential staleness difficult.

**For 2200: unify on a single layout.** Agents and channels both consume credentials through the same SecretRef + resolver, with the underlying file layout being one tree.

### SecretRef abstraction (lift wholesale)

Defined in `src/config/types.secrets.ts`:

```typescript
type SecretRef = { source: "env" | "file" | "exec"; provider: string; id: string }
type SecretInput = string | SecretRef
```

**Three sources cover the credential universe:**
- **env**: ID matches `^[A-Z][A-Z0-9_]{0,127}$`. Optional `allowlist` to constrain what env vars a provider can access.
- **file**: ID is `value` (singleValue mode) or JSON pointer (`/foo/bar` with `~0`/`~1` escaping). Bounds maxBytes (1MiB default), timeout (5s default). Enforces `assertSecurePath`: absolute, optionally non-symlink, owned by current user, not group/world readable+writable.
- **exec**: ID matches strict charset, rejects path traversal. Spawns command (no shell) with stdio-piped JSON request `{ protocolVersion: 1, provider, ids }` expecting `{ protocolVersion: 1, values, errors }` response. Bounds timeoutMs, noOutputTimeoutMs, maxOutputBytes. Curated env via `passEnv` allowlist.

**SecretRef value-add:**
1. No plaintext leaks into config snapshot (logs/diagnostics/audit can hold the SecretRef freely)
2. Source can change without callsites knowing (env→file→vault migration is a config edit)
3. Per-source defaults (`secrets.defaults.{env,file,exec}`) let operator say "all env refs go through provider X by default"
4. Central audit can grep for SecretRef paths independent of secret source format

### Resolver guarantees (lift the shape)

`resolveSecretRefValues` / `resolveSecretRefValue` in `src/secrets/resolve.ts:830-956`:

- Refs deduped by `${source}:${provider}:${id}`
- Resolution grouped per provider, bounded concurrency: default 4 providers in flight, 512 refs per provider, 256KiB request batch. All configurable via `secrets.resolution`.
- Per-call cache (`SecretRefResolveCache`) deduplicates promises by ref key, caches file-provider payloads by provider name
- Two error scopes: `SecretProviderResolutionError` (provider-wide) vs `SecretRefResolutionError` (ref-specific)

### Apply-plan contract

`SecretsApplyPlan` (`src/secrets/plan.ts:42-55`):

```typescript
{
  version: 1, protocolVersion: 1, generatedAt, generatedBy,
  providerUpserts?: Record<alias, SecretProviderConfig>,
  providerDeletes?: string[],
  targets: SecretsPlanTarget[],
  options?: { scrubEnv?, scrubAuthProfilesForProviderTargets?, scrubLegacyAuthJson? }
}
```

`runSecretsApply` is **declarative state with diff/mutation/migration in one shot:**
1. Project next state without writing — apply provider upserts/deletes, write SecretRefs into config tree, capture plaintext into `scrubbedValues` for cleanup, optionally scrub auth-profile stores and `.env`
2. Validate by resolving every target ref against projected config (skip exec refs in dry-run unless `--allow-exec`)
3. Snapshot all touched files, write atomically. **On failure, restore every snapshot.**

Atomic-write-with-rollback across multiple files is a strong guarantee worth preserving for 2200.

### Rotation and scoping

**Per-Agent scoping is built in but breaks centralized rotation.** Each Agent has own `auth-profiles.json`. Subagent inheritance is **snapshot-on-first-read with materialization to disk** — once subagent has own store, rotating main agent's key does NOT propagate.

**For 2200: do live overlay (reference) instead of snapshot-and-copy** so rotation propagates atomically. Profile-state telemetry (cooldown, lastGood) can still be per-Agent on disk.

**Profile preference and rotation telemetry** in `auth-state.json`: `order`, `lastGood`, `usageStats` (per-profile `lastUsed`, `cooldownUntil`, `disabledUntil`, `errorCount`, `failureCounts`). Cooldown reasons enum: `auth | auth_permanent | format | overloaded | rate_limit | billing | timeout | model_not_found | session_expired | unknown`.

**OAuth refresh file lock** (lift verbatim): `<stateDir>/locks/oauth-refresh/sha256(provider\0profileId)`. Prevents `refresh_token_reused` storm when N Agents share an OAuth profile. When 2200 Agents share a credential, exactly one refresh in flight; others adopt the result.

### Audit collectors and runtime credential access logging

**`securityAuditCollectors` is plugin self-reporting at audit time, NOT a kernel chokepoint at credential read time.** Plugins asked "What security findings do you observe right now?" and produce `SecurityAuditFinding` records.

**There is no kernel-level "credential X was read by plugin Y at time T" log.** OC handles confidentiality through:
- Read-side: secret values flow through resolver into in-memory config snapshot; plugins consume from config rather than calling a "give me the secret" API
- Configuration-side: standalone `secrets audit` flags `PLAINTEXT_FOUND`, `REF_UNRESOLVED`, `REF_SHADOWED`, `LEGACY_RESIDUE` across config tree

**For 2200: kernel-level requireCredential audit log is needed.** Log every `requireCredential` call (Agent ID, Extension ID, credential ref, timestamp, success/failure) at the kernel layer. This is the audit log Doug will want.

### Secrets gateway (resolver at command-runtime)

Two-layer resolution: gateway-mediated (preferred) and direct (fallback).

**Boot-time check:** `agent-runtime-config.ts:8-48` calls `hasAgentRuntimeSecretRefs` to fast-path the no-refs case. If any SecretRef appears in `models.providers`, agent memory search remote api keys, TTS providers, skills entries, web tools, or plugin entries, then `resolveCommandConfigWithSecrets` invoked. Result becomes runtime snapshot via `setRuntimeConfigSnapshot`.

**Gateway resolver path** (`src/cli/command-secret-gateway.ts:654-847`):
1. Discover which configured target paths actually have refs
2. Pre-classify whether refs are on active surfaces; skip inactive surfaces with diagnostic
3. Call gateway via JSON-RPC `secrets.resolve` with `{ commandName, targetIds }`, 30s timeout
4. Apply assignments to clone of config via `setPathExistingStrict` (missing paths fail loudly)
5. If gateway unavailable, fall back to local resolution
6. `enforce_resolved` mode throws on unresolved targets

**Important:** the in-memory config snapshot for a running Agent is **partially expanded**, not a fully decrypted blob. Only requested `targetIds` are expanded; other ref-bearing paths stay as refs and resolve on demand at their own callsites.

### Cross-platform encryption: NONE in OC

**OC does NOT encrypt credentials at rest in its own stores.** All persistence is plaintext JSON secured by filesystem mode (0o600 file, 0o700 directory) and ownership checks. No symmetric encryption, no platform keychain integration for OC's own auth-profiles store.

**The only OS keychain code is for interop with other CLIs** (Codex, Claude CLI), not OC's storage:
- `cli-credentials.ts:248-326` reads Codex's macOS keychain via `security find-generic-password -s "Codex Auth"`
- `cli-credentials.ts:408-525` reads/writes Claude CLI's macOS keychain entry similarly

**For 2200: design a pluggable at-rest backend.** Filesystem-with-mode-0o600 default (matches OC), with optional macOS Keychain / Linux libsecret / Windows DPAPI backend that wraps SecretRef payloads or wraps a master key that decrypts the on-disk store. **Backend behind a single interface so default install works with no platform setup, but server deployments (like Heisenberg) can opt into stronger storage.**

### Implications for 2200 Epic 9

**Lift wholesale (with renaming):**
1. SecretRef tuple shape (`{ source, provider, id }`) and three-source design
2. `secrets.providers.<alias>` provider-side config block with per-source defaults
3. Exec provider protocol (`{ protocolVersion: 1, provider, ids }` ↔ `{ protocolVersion: 1, values, errors }`)
4. Resolver guarantees (bounded concurrency, per-call cache, two-level error scoping)
5. Atomic write with rollback for apply-plans
6. OAuth refresh file lock pattern
7. `assertSecurePath` policy as minimum bar
8. Plaintext audit standalone command
9. JSON file mode 0o600 / dir mode 0o700, fsync of file then directory

**Tighten (per Extension permission model):**
1. **Inheritance shouldn't materialize to disk.** Live overlay (reference, not copy) so rotation propagates atomically.
2. **Permission-scoped credential read.** Make the resolver an explicit API call (`requireCredential(scope, credentialId)`) gated by the calling Extension's manifest, not a config-tree expansion. The credential is never handed to the Extension as a string the Extension owns. Hand back a `CredentialHandle` wrapper whose only operation is "set this header on this outbound HTTP request" or "pass to this LLM client constructor." Prevents credential from leaking into Extension logs/diagnostics.
3. **Audit at the chokepoint.** Log every `requireCredential` call at kernel layer. Keep `securityAuditCollectors` as plugin self-reporting but don't conflate.
4. **At-rest encryption story** — pluggable backend per above.
5. **Two parallel credential trees → one.** Unified layout, one resolver answers "what credentials does this Agent have access to."
6. **Single-source-of-truth via the credential matrix.** OC's `secrets/credential-matrix.ts` (referenced but not read in detail) tracks per-channel/per-account credential identity. 2200 should make matrix first-class: every credential has `(scope, provider, principal)` and matrix is queryable index.

**OCMT pattern preferable for scoping:** OCMT's group-vault scopes credentials at tenant boundary rather than per-Agent. 2200's "Agent + Project + Pub" object model maps naturally to OCMT's group concept — Pub or Project is the credential scope. **Prefer OCMT's group-vault scoping for the credential matrix, but keep OC's SecretRef indirection, resolver protocol, and apply-plan contract on top.**

### Cross-target findings

- **Target 1 (runtime — credential lifecycle in Agent boot):** Agent boot must trigger credential resolution before any LLM call. OC's pattern (`resolveAgentRuntimeConfig` → `hasAgentRuntimeSecretRefs` → `resolveCommandConfigWithSecrets`) is the model. **Boot-time refresh check:** if any OAuth credential is within N seconds of expiry, refresh pre-emptively under named lock so first LLM call doesn't pay refresh cost.
- **Target 3 (plugins — credentials as permission token):** Extension manifest needs `credentials.required` block listing SecretRef paths. Install-time prompt: "Extension X wants to read credential `vault:openai:api-key`. Allow?" Runtime: any other read fails permission-denied at resolver chokepoint.
- **Target 4 (provider SDK — model auth profiles):** OC's `AuthProfileCredential` shape (`api_key | token | oauth` discriminated union with `keyRef` / `tokenRef` SecretRef-pointer fields) is exactly what 2200 should use. Lift the union, lift `lastGood` / `usageStats` rotation telemetry, lift cooldown reason enum. **Keep secret-data file separate from telemetry file** — secret file changes rarely, telemetry changes constantly, separating prevents lock contention.

### Confidence and gaps

- **High:** SecretRef tuple shape, three-source resolver, ID validation rules, apply-plan contract structure, file mode/atomic write, OAuth refresh lock, auth-profiles file layout and inheritance behavior, boot-time vs command-runtime resolution split, lack of at-rest encryption, securityAuditCollectors as self-reporting.
- **Medium:** per-channel `authDir` layout (each plugin defines own subtree), credential matrix internals (referenced but not read in detail), gateway's actual `secrets.resolve` server-side handler (read client side, not server).
- **Not investigated:** `prepareSecretsRuntimeSnapshot` implementation in `secrets/runtime.ts`, voice extension's two-meter billing interaction with credential reads, `setRuntimeAuthProfileStoreSnapshot` lifecycle when CLI updates credentials while Agent loop running.

---

## Target 9: Tool registry + integration health (Epic 9 + Epic 2)

**Status:** complete. Sub-agent walked tool registry, MCP integration, capability scoping, schema normalization, integration health monitoring, agent-layer tool-loop detection, EdgeClaw ClawXGovernor, OpenAEON chaosScore.

### Tool registry: no central object, assembled per session

OC has **no central tool registry object.** Tools are assembled fresh per session by `createOpenClawTools()` at `src/agents/openclaw-tools.ts:53`. Returns `AnyAgentTool[]` array. Each turn the runtime hands that array to the model adapter.

`AnyAgentTool` shape (`src/agents/tools/common.ts:31`):

```typescript
type AnyAgentTool = Omit<AgentTool<TSchema, unknown>, "execute"> &
  ErasedAgentToolExecute & {
    ownerOnly?: boolean;
    displaySummary?: string;
  };
```

Base `AgentTool` is from upstream `@mariozechner/pi-agent-core` (Mario Zechner's `pi-ai` library, OC's underlying agent framework). Shape: `{ name, label, description, parameters, execute }`. `parameters` is a TypeBox `TSchema` (JSON-Schema-compatible).

**No per-Agent tool subscription model.** Session captures entire array. Tools conditionally constructed inside `createOpenClawTools()` based on `options`: `agentSessionKey`, `agentChannel`, `senderIsOwner`, `sandboxed`, `disableMessageTool`, `disablePluginTools`, `pluginToolAllowlist`, `modelProvider`, `modelId`. Embedded mode drops several (`canvas`, `nodes`, `cron`, `gateway`, `sessions_send`, `sessions_spawn`).

**Name collision: built-ins win.** `resolvePluginTools()` accepts `existingToolNames: Set<string>` from core tools and rejects any plugin tool whose name conflicts, blocking offending plugin entirely with `"plugin id conflicts with core tool name"` diagnostic.

Higher-level "tool catalog" at `tool-catalog.ts:53` for documentation/UI ("minimal", "coding", "messaging", "full" profiles) groups tools into `fs`, `runtime`, `web`, `memory`, `sessions`, `ui`, `messaging`, `automation`, `nodes`, `agents`, `media`. **For UX (settings tool profile selection), not runtime dispatch.**

### MCP integration: bidirectional

OC is **both MCP host AND MCP server.**

**MCP-as-tool-source (host):** External MCP servers configured under `openclaw.bundleMcp` get materialized into `AnyAgentTool` objects by `pi-bundle-mcp-materialize.ts`. Flow:

1. `createSessionMcpRuntime()` opens stdio/HTTP transports per configured server, caches `SessionMcpRuntime` per session-id (lease counted, used-timestamp tracked, lazily reconnected)
2. `materializeBundleMcpToolsForRun()` calls `runtime.getCatalog()` returning `{ tools: [{ serverName, safeServerName, toolName, title, description, inputSchema, fallbackDescription }] }`
3. Each MCP tool becomes one `AnyAgentTool` with `name: safeToolName`, `parameters: tool.inputSchema` (raw MCP schema), `execute()` calling `runtime.callTool(serverName, toolName, input)`

**Translation layer:** MCP `CallToolResult` (`{ content[], structuredContent?, isError? }`) → OC's `AgentToolResult` (`{ content, details }`). `isError === true` → `details.status = "error"`. `structuredContent` survives in `details.structuredContent`. MCP server name and tool name stamped into `details.mcpServer` and `details.mcpTool` for audit attribution.

**Name safety:** namespaced as `{safeServerName}__{toolName}`, total ≤ 64 chars, server prefix ≤ 30, restricted to `[A-Za-z0-9_-]`. Duplicates get `-2`, `-3` suffixes. **Lift verbatim for 2200.**

**MCP-as-tool-consumer (server):** OC exposes own tools as MCP server through `src/mcp/`. Registers `conversations_list`, `conversation_get`, `messages_read`, `attachments_fetch`, `events_poll`, `events_wait`, `messages_send`, `permissions_list_open`, `permissions_respond`. Capabilities surface includes `experimental: { "claude/channel": {}, "claude/channel/permission": {} }`.

### Capability scoping: NONE in stock OC

**There is NO per-tool capability declaration.** `AnyAgentTool` has no `capabilities` field, no permission manifest, no scope list. Plugin tools register via `definePluginEntry()` and return `AnyAgentTool` objects that can `execute` arbitrary side effects — file I/O, network, child processes, anything Node can do.

What exists (none are real capability scoping):

1. **`ownerOnly` flag.** Tools marked `ownerOnly: true` at construction. Wrapper replaces `execute` with one that throws `"Tool restricted to owner senders."` when `senderIsOwner` is false. Sender authorization, not capability scoping — owner can still do anything.
2. **Tool allow/deny policies.** Filter tool array by name/group before dispatch. Configurable via `tools.profile`, `tools.alsoAllow`, `tools.deny`. Blocks whole tool from appearing.
3. **Filesystem policy.** `ToolFsPolicy = { workspaceOnly: boolean }`. When true, fs tools refuse paths outside workspace. **Each fs tool re-implements the check** — not a generalized capability system.
4. **Sandbox containment.** When `sandboxed: true`, process spawn goes through Docker. Runtime-around-tool sandboxed, not tool capability-scoped.
5. **`before_tool_call` hook.** De-facto capability-scoping mechanism — but dynamic, plugin-supplied, reactive. Hook can return `{ block, blockReason }`, `{ requireApproval }`, or `{ params: modified }`. Approval round-trips via `plugin.approval.request`/`waitDecision`.

**Net answer: confirms Target 3's "trusted plugin" model.** For 2200 Epic 9, this is the gap: no mechanism to say "this plugin tool may only call HTTP to api.foo.com and may not touch filesystem." **2200 will need to invent it.**

### Schema normalization: two-layer (lift directly)

**Core layer:** `normalizeToolParameterSchema(schema, { modelProvider, modelId, modelCompat })` at `pi-tools-parameter-schema.ts:135`. Always runs. Handles four classes of provider quirks:

- **Gemini** rejects several JSON Schema keywords → `cleanSchemaForGemini()` scrubs them
- **OpenAI** rejects function tool schemas unless top-level is `type: "object"` (TypeBox root unions compile to bare `anyOf` without `type`) → top-level rewritten
- **Anthropic** expects full JSON Schema draft 2020-12 → mostly pass-through
- **xAI** rejects validation-constraint keywords (`minLength`, `maxLength`, `minItems`, `maxItems`, `minContains`, `maxContains`) → `stripUnsupportedSchemaKeywords()`

Also flattens top-level `anyOf`/`oneOf` (not `allOf`) unions into merged object. Empty schemas become `{ type: "object", properties: {} }` (the "MCP no-parameter" case).

**Plugin/provider layer:** `normalizeToolSchemas?: (ctx) => AnyAgentTool[] | null | undefined`. Plugins shipping a provider register per-provider rewrite hook. OC ships two reference normalizers in `plugin-sdk/provider-tools.ts`:

- `normalizeOpenAIToolSchemas()`: forces strict-mode shape — mandatory `additionalProperties: false`, all properties required, no `anyOf`/`oneOf`/`allOf`, no array-typed `type`
- `normalizeGeminiToolSchemas()`: runs `cleanSchemaForGemini()` per tool

Each has companion `inspectToolSchemas()` returning diagnostics without rewriting (dry-run / pre-flight checks). **Strict-OpenAI fallback:** if any tool fails strict compat, runtime falls back `strict: false` instead of failing the request.

**Net effect:** single tool definition with TypeBox can ship to OpenAI strict, OpenAI non-strict, Anthropic, Gemini, xAI without per-provider tool definitions.

### Integration health monitoring: NONE in stock OC

**Confirms v0.5 epic-map gap.** The closest thing is **auth-profile health**, not tool/integration health.

`auth-health.ts` builds `AuthHealthSummary` of stored credentials per provider. Status values: `ok | expiring | expired | missing | static`. Tracks `expiresAt`, `remainingMs`, per-provider rollup, OAuth refresh margin. Surfaces in `doctor-auth` command and `models-auth-status` gateway method.

`auth-profiles/usage-state.ts` adds per-profile cooldown system: `markAuthProfileFailure()` writes `cooldownUntil`/`disabledUntil` timestamps with `cooldownReason` (`"rate_limit" | ...`) and optional `cooldownModel` for model-scoped cooldowns. Failover logic in `model-fallback.ts` rotates to next-good profile.

**For tools / MCP servers / integrations specifically: NONE.** No per-tool success/failure history. No "MCP server hasn't responded in 30 days, deprecate." No per-tool dormancy index. Session's tool-call history (in `tool-loop-detection.ts`) is sliding window of 30, used only for loop detection, reset per session, never persisted.

**EdgeClaw's ClawXGovernor adds an `audit.jsonl`** but that's third-party.

**For 2200: design from scratch.** Borrow only the *shape* of OC's auth-profile cooldown system. Per-integration record: `{ lastSuccess, lastFailure, lastFailureReason, rollingSuccessRate, cooldownUntil?, dormantSince? }`. Surface in "doctor" CLI command (analog to OC's `doctor-auth`) and via API for dashboard. Cooldown logic gates dispatch — if integration failed 5 times in a row, hold off until `cooldownUntil`. Dormancy detection ("this tool last succeeded 30 days ago") becomes notification trigger.

### Agent-layer tool-loop detection: lift wholesale

OC has substantive agent-layer loop detector orthogonal to process supervisor's `noOutputTimeoutMs`. Lives at `src/agents/tool-loop-detection.ts`. **Five detector kinds:**

```typescript
type LoopDetectorKind =
  | "generic_repeat"           // same tool+argsHash repeated N times in window
  | "unknown_tool_repeat"      // model keeps invoking nonexistent tool
  | "known_poll_no_progress"   // command_status / process(action: poll|log) with identical results
  | "global_circuit_breaker"   // hard kill switch
  | "ping_pong";               // two tool calls alternating with stable outcomes
```

**Mechanism:** sliding window of size 30 (`TOOL_CALL_HISTORY_SIZE`) keeps `{ toolName, argsHash, toolCallId, resultHash?, unknownToolName?, timestamp }` per call. `argsHash = sha256(stableStringify(params))`. `resultHash` from result `details` + extracted text content (poll-tool variants extract `status`, `exitCode`, `aggregated` for tighter equality).

**Thresholds (defaults):** warning = 10, unknown = 10, critical = 20, global circuit breaker = 30. `recordToolCall()` and `recordToolCallOutcome()` called from `pi-tools.before-tool-call.ts` and result-handler.

**`detectToolCallLoop()`** returns `{ stuck: true, level: "warning"|"critical", detector, count, message, warningKey?, pairedToolName? }`. Runtime injects system observation into next turn ("WARNING: You have called X 10 times with identical arguments..."). Escalates to "CRITICAL: Session execution blocked..." at criticals/global thresholds, then run aborted.

**OC defaults disabled** (`enabled: false` in `DEFAULT_LOOP_DETECTION_CONFIG`). Operators opt in via `tools.loopDetection.enabled = true`.

**For 2200: default ON for David-onboarding** ("Build for David" — David shouldn't have to find this knob to be safe).

### Three-layer loop detection picture (full coverage)

- **Process layer** (Target 1): `noOutputTimeoutMs` per spawned tool process — kills wedged child processes
- **Agent-loop layer** (this target): tool-call sliding window + 5 detector kinds — kills wedged model behaviour
- **Cost-behavior layer** ([[2026-04-24-cost-behavior-shape]]): token/$ ceilings per session — kills runaway cost regardless of behaviour

The three layers detect orthogonal failure modes. **OC has the first two but not the third.** 2200 has all three.

### EdgeClaw ClawXGovernor sketch

Context-engine plugin in EdgeClaw (`extensions/clawxgovernor/`). Wires three modules: context engine (recent-tail-turn trimming + compact-threshold), tool governor, session-memory note recorder. Token-savings claim ("85% over 30 rounds") is the combination — heavy compaction of tail window plus aggressive tool-result summarization.

**Tool governor** does its work entirely through OC's existing plugin hook surface — `api.on("before_tool_call", ...)`, `api.on("after_tool_call", ...)`, `api.on("before_prompt_build", ...)`. No new hook system. **EdgeClaw is "ClawXGovernor = a third opinionated wiring of OC's already-existing hooks."**

**Risk classification:** static rule table maps tool names to one of `read | workspace_write | exec | network | subagent_control | unknown`, each with default action `allow | requireApproval | block`. Substring-based matching (any tool whose name includes "exec" or "bash" → `exec` → `requireApproval`). Plus `blockPatterns` list of literal substrings in param JSON that always block (`rm -rf /`, fork-bomb `:(){ :|:& };:`, `mkfs`, `dd if=/dev/zero`).

**Loop detection:** separate per-plugin sliding window (`recentCalls[]`, default size 10) counts consecutive identical tool+paramsHash calls. Default `maxRepeats: 3` — three identical calls blocks the next with `"Loop detected"`. Strict subset of OC's built-in detector (which only fires at threshold 10) but tuned much more aggressively, gates execution rather than warning the model.

**Audit log:** every `before_tool_call`/`after_tool_call` appends one JSON line to `audit.jsonl` in plugin's state directory. When tool result exceeds `summarizeThreshold` (default 4000 chars) and there's a `toolCallId`, plugin truncates to 1000 chars and writes per-call markdown summary to `summaries/{toolCallId}.md` — model sees only truncated form.

**Token-savings driver:** `before_prompt_build` hook injects static `TOOL_GOVERNANCE_PROMPT` system message ("Avoid calling same tool >3 times consecutively with identical parameters", "When tool results are very long, reference the summary"). 85% claim reflects: (a) hard-stop loop interception preventing degenerate retry chains, (b) per-result truncation with summary-on-disk, (c) recent-tail-turn compaction. **Rule-based and cheap, which is why savings are so dramatic.**

### OpenAEON chaosScore sketch

README is sparse on mechanics. Single documented hook: *"The execution engine intercepts extreme algorithmic divergence (`chaosScore >= 10`) or continuous tool validation failures (`consecutiveErrors >= 6`) with a hard session abort."* No source-level detail on fingerprint format, score-increment rule, or whether divergence is measured by edit distance, embedding distance, or simple counter.

**Conceptual contrast with OC:** OC's loop detector measures *repetition* — same `(toolName, argsHash)` in window. OpenAEON's `chaosScore` is "algorithmic divergence" — language suggests **detecting when agent's actions are too varied/non-convergent rather than too repetitive.** Plausible reading: chaosScore accumulates when each step produces different action fingerprint with no overlap (agent thrashing without converging), threshold of 10 fires hard abort before token spend balloons.

**For 2200: contribution is the *concept* — divergence-side detector to complement repetition-side detector — not implementation we can lift.** Without source visibility, research note rather than directly emulatable design.

### Implications for 2200 Epic 9 + Epic 2

**Tool registry spec (Epic 9):** Lift OC factory pattern. 2200 `Tool` is `{ name, label, description, parameters (JSON Schema), execute, ownerOnly?, displaySummary? }`. Per-Agent `createTools(context)` factory at session start from (a) built-ins, (b) MCP-derived, (c) plugin-derived. Built-ins win name conflicts. Plugin-derived registered through wrapper that stamps `pluginId` metadata. Use OC's `pi-bundle-mcp-materialize` shape verbatim for MCP translation.

**Capability scoping (Epic 9, divergence point):** OC has no real capability scoping. **2200 should diverge.** Per CLAUDE.md ("Extension permission scope creep... do not let the framework allow Extensions to request permissions at runtime"), 2200 needs declarative install-time capability manifests on Tools the same way Extensions get them. Concrete: `Tool.capabilities: { fs?: { read?, write?, paths? }, net?: { hosts? }, exec?: boolean, mcp?: boolean }`. Enforced at dispatch layer by wrapping `execute()` with a guard. **Genuinely new design work; OC is no help.**

**Schema normalization (Epic 9, lift directly):** Adopt two-layer pattern. Core `normalizeToolParameterSchema(schema, { provider, modelId })` for top-level union flattening + provider-keyword stripping. Per-provider `normalizeToolSchemas(ctx)` plugin hook for transport-family rewrites. Steal strict-OpenAI fallback. Steal inspector pattern.

**Integration health monitoring (Epic 9, scope addition, design from scratch):** OC has no precedent. Borrow auth-profile cooldown shape: per-integration record `{ lastSuccess, lastFailure, lastFailureReason, rollingSuccessRate, cooldownUntil?, dormantSince? }`. Surface in "doctor" CLI command. Cooldown logic gates dispatch.

**Tool-loop detection at agent layer (Epic 2):** Lift OC's `tool-loop-detection.ts` essentially verbatim. Five-detector design is exactly the shape Epic 2 wants. Combined with process supervisor `noOutputTimeoutMs` (Target 1) and cost-behavior ceiling layer, 2200 has full coverage. **Choice point: OC defaults loop detection off; 2200 defaults ON for David-onboarding.**

**EdgeClaw integration shape (informative, do not lift):** ClawXGovernor's substring-based risk classification and 3-strikes loop block too crude for 2200. **Architectural lesson is right:** tool governance can ride entirely on `before_tool_call`/`after_tool_call` hooks if those hooks are first-class. **2200 should make them first-class** so a third party (or built-in 2200 governance Extension) can implement audit log, hard loop limits, result truncation as clean Extension rather than runtime patch.

### Cross-target findings

- **Target 1 (runtime — tool dispatch path):** Tool dispatch in OC: model emits tool call → `pi-tool-definition-adapter` resolves `AnyAgentTool` by name → `pi-tools.before-tool-call.ts` runs `recordToolCall()`, `detectToolCallLoop()`, then plugin `before_tool_call` hooks → `tool.execute()` runs → `recordToolCallOutcome()` and `after_tool_call` hooks → `normalizeToolExecutionResult()` shapes for model. Process-supervisor `noOutputTimeoutMs` only applies to bash-tool spawned child processes, not native JS tool execution. **For 2200, both layers needed** — JS execution timeouts via `AbortSignal` already exist in pi-agent-core interface.
- **Target 3 (plugins — tool-as-plugin-contribution):** **Confirmed.** Plugin tools are first-class — same `AnyAgentTool` interface as built-ins, same dispatch path, same loop detector, get stamped with `pluginToolMeta = { pluginId, optional }`. Optional plugin tools filtered against `pluginToolAllowlist`. **Validates 2200 plan to make Skills (Epic 11) and plugin tools (Epic 9) compose into the same dispatcher.**
- **Target 6 (secrets — tools that need credentials):** OC tools that need credentials read them from auth-profile store at execution time via `secrets/runtime.ts`. The web-search tool gets API key from runtime web tools metadata, not its own params. Provider plugins manage own credential injection. **For 2200: tool `execute()` receives runtime context that includes credential resolver, not raw secrets.** Auth-health surfaces and cooldown gating compose naturally with integration health monitoring.

### Confidence and gaps

- **High:** tool registry shape, name resolution, factory pattern, MCP integration translation layer, schema normalization (both core and provider-plugin), agent-layer loop detection (5 detector kinds, thresholds, hashing, hook integration), EdgeClaw ClawXGovernor architecture, confirmation of NO per-tool capability scoping, confirmation of NO per-tool/per-integration health record.
- **Medium:** `pi-agent-core` upstream details (couldn't locate node_modules; relied on OC's type re-exports), `before_tool_call` plugin hook approval round-trip semantics.
- **Lower / gaps:** OpenAEON chaosScore mechanics (README only, no code-level read), EdgeClaw token-savings claim independent verification, OC hook ordering/priority semantics, MCP server lifecycle/dormancy, interface boundary between `AnyAgentTool` and the model adapter.
