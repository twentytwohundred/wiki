---
title: "Hermes Agent deep dive: architecture review for 2200, 2026-05-18"
type: research-note
status: active
tags: [research, architecture-review, hermes, nous-research, openclaw-genealogy, lane-question, capability-catalog]
created: 2026-05-18
updated: 2026-05-18
linked_docs:
  - "[[02-architecture]]"
  - "[[03-epic-map]]"
  - "[[14-conversational-onboarding]]"
  - "[[14-phase-f-capability-catalog]]"
  - "[[2026-05-14-external-architecture-review]]"
  - "[[2026-05-14-claim-vs-evidence-audit]]"
  - "[[2026-05-14-request-credential-substrate]]"
  - "[[2026-05-18-capability-security-model]]"
canonical_path: wiki/research/2026-05-18-hermes-deep-dive.md
---

# Hermes Agent deep dive: architecture review for 2200, 2026-05-18

**Reviewers:** general-purpose research subagent (source + docs dig across ~291MB of Hermes 0.14.0) + Hobby (synthesis, comparison to 2200).
**Scope:** Hermes Agent v0.14.0 codebase at `code/2200-reference/hermes-agent/` (cloned from `github.com/nousresearch/hermes-agent` 2026-05-18; MIT © 2025 Nous Research). README + AGENTS.md + SECURITY.md + release notes v0.10 through v0.14 + `run_agent.py` (178KB) + `hermes_state.py` (126KB) + `conversation_loop.py` (4,018 lines) + tools/skills/plugins directories + `.plans/`.
**Status:** Architecture-shaped review. Not a feature checklist. Companion to [[14-phase-f-capability-catalog]] and the [[2026-05-18-capability-security-model]] decision.

This is the first deep dive into a peer agent runtime since the OpenClaw survey for Phase F Capability Catalog content lift. Hermes is the right comparison target because (1) it launched on OpenRouter 2026-05-08 and got the xAI integration 2026-05-15, making it the highest-visibility OSS Agent runtime in the same lane 2200 is building toward, (2) it is genealogically downstream of OpenClaw ... `hermes claw migrate` is a first-class command that auto-imports `~/.openclaw` settings, memories, skills, and API keys ... so the design tradeoffs Hermes made tell us what Steinberger's team learned from OpenClaw at production scale.

---

## The lane question (elevator)

The single most important finding:

> **Hermes is fundamentally a single-Agent runtime with multi-process coordination bolted on via Kanban. There is no daemon-supervised fleet of long-lived Agents exchanging messages. There is no Agent-to-Agent pub equivalent. There is no roadmap item to build one.**

The Kanban subsystem (shipped v0.13, polished v0.14) is durable-board-with-ephemeral-workers: one SQLite board, one dispatcher loop tick, atomic claim, then `subprocess.Popen("hermes -p <profile> --skills kanban-worker chat -q 'work kanban task <id>'")` per task. Workers exit when the task closes. The framing in `AGENTS.md` is *durable cross-profile collaboration board*, not *event-driven fleet*. Coordination primitives within a board are `kanban_show / complete / block / heartbeat / comment / create / link` ... SQLite shared state plus structured `metadata` payloads. No pub-sub. No message bus. No long-lived peer Agent. Across boards: no native primitive at all.

2200's posture (each Agent is its own OS process with its own Identity, supervised by a daemon, coordinating via OpenPub) is structurally different. Not a stronger version of Hermes's pattern ... a different pattern. **The 2200 lane is defensible.** This is the cleanest validation of 2200's multi-Agent thesis I've seen since the project started.

Two implications:
1. The 2200 product story (*"fleet of Agents that work alongside you"*) is not on Hermes's roadmap and not on a path Hermes can pivot to without re-architecting. The Kanban shape is downstream of the single-Agent base; making Agents long-lived peers would require a new substrate Hermes does not have.
2. Hermes's customer is *"the operator who wants one really good Agent that can spawn workers when needed."* 2200's customer is *"the operator who wants a team of Agents that coordinate."* These are different products serving different customers. Worth naming the segmentation explicitly in any positioning material.

---

## 1. Mechanics ... request to "done"

**Loop shape: synchronous ReAct, no planner/executor split.** Entry at `AIAgent.run_conversation()` in `run_agent.py:3838`, real loop at `agent/conversation_loop.py:85`. The core is the obvious one:

```
while api_call_count < max_iterations and budget.remaining > 0:
    if interrupt_requested: break
    response = chat.completions.create(model, messages, tools)
    if response.tool_calls:
        _execute_tool_calls(...)        # appends tool results to messages
        continue
    else:
        return response.content         # final
```

(Verbatim core at `conversation_loop.py:532-559`.) No planner pass. No critic. No separate "plan tree." Iterate until the model stops emitting `tool_calls`.

**The other 4,000 lines around the loop are defensive engineering, not architecture.** This is the most interesting structural choice: Hermes treats *recoverable model failure* as the primary thing the loop has to handle, and bakes the recovery in at the loop level rather than in tools or in the model prompt. Catalog:

- **Tool-name fuzzy repair** (`_repair_tool_call`, line 3037): if the model hallucinates a tool name, the registry fuzzy-matches and auto-corrects. Logged but transparent to the model.
- **Invalid-JSON-args retry** (lines 3087-3173): up to 3 retries; if still bad, injects a synthetic tool-error result *as a tool-role message* so role alternation stays valid and the model can recover within the same context.
- **`finish_reason == "length"`** handling: tries continuation-prefix prefill (when the provider supports it), falls back to compression, falls back to partial.
- **Empty-content retries, thinking-prefill retries, Codex-incomplete retries** ... separate counters per failure mode.
- **`_sanitize_tool_call_arguments` + `_repair_message_sequence`** run *every* iteration to fix orphan tool results or wedged `tool → user` tails before sending to the provider.
- **Tool-call dedup + cap** on every assistant message with tool calls (`_cap_delegate_task_calls`, `_deduplicate_tool_calls`).
- **Circuit breaker** (`agent/tool_guardrails.py`): N consecutive same-tool failures (default 8) halts the loop. Prevents the "agent retries the same broken tool 40 times" failure mode.

The mental model: *the model emits a stream of (sometimes-broken) tool calls; the loop's job is to maximize the fraction that make forward progress.* Hermes invested in the loop's repair surface because production Agents fail in narrow, recurring ways and a well-written loop can absorb most of them without operator intervention.

**Tool dispatch.** Registry singleton at `tools/registry.py:234`. Auto-discovery by AST scan at boot (lines 42-65). Handlers return JSON strings; dispatcher wraps exceptions into `{"error": "..."}` and pipes through `_sanitize_tool_error` so embedded fences / CDATA can't reach the model as structural noise. Async handlers bridged automatically. Concurrent vs sequential decided by `_should_parallelize_tool_batch` based on read-only-ness + target-path overlap (`run_agent.py:3749-3770`).

Non-obvious wrinkle: a tool is *registered* with the registry but only *exposed* to an Agent if its name appears in a toolset (`toolsets.py` `TOOLSETS` dict). Auto-discovery imports; wiring is manual. Plugin tools come in through `PluginContext.register_tool`. **2200's equivalent is canonical tool names + per-Agent identity tool lists** ... essentially the same separation, less load-bearing for us because the surface is smaller.

**Permission model: three layers, escalating in trust.**

1. **Hardline blocklist** (`tools/approval.py:198-220`): catastrophic commands (`rm -rf /`, `mkfs`, `dd of=/dev/sd*`, fork bombs, shutdown/reboot, kill all). Blocked unconditionally. Bypassed by nothing ... not `--yolo`, not `approvals.mode=off`, not cron. The docstring is explicit and worth quoting: *"opting into yolo is the user trusting the agent with their files and services, not trusting it to wipe the disk."*
2. **Dangerous-command pattern matcher** (lines 316-415): 47 regexes catching `chmod 777`, `git reset --hard`, `curl | sh`, write redirection to `/etc/`/`~/.ssh/`/`.env`, etc. On match → approval flow. Approval modes:
   - `manual` ... interactive prompt or gateway approval pending.
   - `smart` ... an *auxiliary LLM is asked* "APPROVE / DENY / ESCALATE" (line 866; prompt verbatim at lines 878-890). Inspired by OpenAI Codex Smart Approvals. Reduces approval fatigue without lowering the hardline floor.
   - `off` / `--yolo` ... bypass (still respects hardline).
   - Approvals are scoped: once / session / permanent. Permanent allowlist lives in `config.yaml`.
3. **Tirith** (`tools/tirith_security.py`): optional external policy scanner with rich findings (severity, title, description) surfaced in the approval prompt.

Cron sessions hit `approvals.cron_mode` (default `deny`) ... they cannot approve interactively. Approvals are session-scoped via `contextvars` in the gateway, thread-safe across concurrent gateway turns. Worth borrowing the *hardline-below-yolo* and *smart-approvals-via-aux-LLM* patterns.

**Honest caveat (SECURITY.md lines 137-152, verbatim worth absorbing):** the approval gate, output redaction, and Skills Guard are *"useful heuristics, not boundaries."* The doc states: *"The only security boundary against an adversarial LLM is the operating system."* They mean it: vulnerability reports against in-process heuristic bypass are explicitly out-of-scope. This is a more honest security posture than most agent platforms ship with, and it is the framing that should inform 2200's marketing around the credential substrate (which IS a structural boundary, not a heuristic ... that's the point).

**Audit trail.**
- Three rotating log files under `$HERMES_HOME/logs/` ... `agent.log`, `errors.log`, `gateway.log`. All formatted through `RedactingFormatter` so the redaction regex sweep runs on every log line.
- Session DB at `hermes_state.py:186-310` ... SQLite per-`HERMES_HOME` with FTS5. `sessions` + `messages` tables. FTS5 + trigram FTS5 (for CJK) on message content. Substrate for `session_search` tool and `/insights`.
- **No claim-vs-evidence audit.** Nothing compares the model's final response against the tool-call evidence it gathered. The closest analog is the v0.14 *file-mutation footer*: after every turn that wrote files, a footer summarizing what actually landed on disk is injected so the agent self-catches "I added the function" claims that did not save. That is narrow: file mutations only, surfaced *to the model* not to the operator.

2200's [[2026-05-14-claim-vs-evidence-audit]] is a structural differentiator. Hermes has nothing comparable.

**`trajectory_compressor.py` is a red herring for runtime.** Despite the 65KB size, it is a *post-hoc training-data compressor* (file header lines 2-31): batch-processes completed JSONL trajectories with a tokenizer (default Kimi-K2-Thinking), protects first turns + last N, summarizes the middle via a configurable summarization LLM, writes compressed JSONL. Used for producing training samples. The actual runtime context compressor is `agent/context_compressor.py` (1,699 lines) + `agent/conversation_compression.py` (556 lines), with `protect_first_n=3` / `protect_last_n=20` / threshold-then-target ratios. Compression creates a *new child session* (parent_session_id link), invalidates the cached system prompt. The whole rest of the runtime is built around *not* breaking the prefix cache ... AGENTS.md lines 861-873 frame *"Prompt Caching Must Not Break"* as non-negotiable; system prompt is built once per session and replayed verbatim.

---

## 2. Operator trust surface

**Credentials.** Disk layout: `~/.hermes/.env` for secrets (API keys, tokens), `~/.hermes/auth.json` for OAuth-managed credentials (Anthropic, OpenAI/Codex, Nous Portal, SuperGrok). Both `0600` since v0.13.

A `PooledCredential` dataclass (`agent/credential_pool.py`, 1,782 lines) provides multi-credential pool with strategies: `fill_first`, `round_robin`, `random`, `least_used`. Cooldowns: 5 min on 401, 1 h on 429/402. Same-provider failover is the model.

Credentials are **loaded into the AIAgent at construction time and passed as `api_key`/`base_url` to the OpenAI SDK client.** They are never injected into the LLM message context as content. The OpenAI SDK adds them as the `Authorization: Bearer` header. This is the OpenAI Python SDK's default behavior, not a Hermes-specific guarantee.

**Subprocess credential scrubbing.** When Hermes spawns shell subprocesses, MCP servers, or the code-execution child, it filters its own provider credentials out of the child's environment by default. Skills can declare `required_environment_variables` to allowlist passthrough. Critically: Hermes-managed provider keys are on a `_HERMES_PROVIDER_ENV_BLOCKLIST` that skill frontmatter **cannot** override. This was added in response to GHSA-rhgp-j443-p4rf, where a skill registered `ANTHROPIC_TOKEN` as passthrough and received the credential. **Pattern worth borrowing for 2200's MCP / skill envelope:** a non-overridable allowlist exclusion list at the substrate level, not at the skill author's discretion.

**The big gap: no vault, no operator-paste-direct-to-vault.** When a skill needs a secret it does not have, `_capture_required_environment_variables` calls a `_secret_capture_callback` that writes to `$HERMES_HOME/.env`. The value passes through Python plaintext on the way. The TUI has a `maskedPrompt.tsx` for visual masking, but there is no architectural guarantee that the secret bypasses LLM context.

2200's [[2026-05-14-request-credential-substrate]] (operator pastes via UI surface that pipes direct to vault, secrets never enter LLM context) is *structurally* different. Not a stronger version of Hermes's pattern ... a different architectural guarantee. Hermes's credentials are process-global env vars; 2200's are per-Agent vault entries with a write-only-from-operator-UI path.

**PII / secret redaction (`agent/redact.py`).** Regex-based, runs in three places: (a) `RedactingFormatter` on every log record; (b) tool output before display in gateway/CLI; (c) `force=True` on safety boundaries that must never leak. Coverage is broad ... 33 vendor prefix patterns (OpenAI sk-, GitHub ghp_/ghu_/ghs_/ghr_/github_pat_, Slack xox*, Google AIza, AWS AKIA, Stripe sk_live_/sk_test_, SendGrid, HuggingFace hf_, Replicate r8_, npm npm_, PyPI, DigitalOcean, Telegram bot tokens, ElevenLabs, Tavily, Exa, Groq, Matrix, etc.), plus `ENV_NAME=value` assignments, JSON secret-named fields, Bearer tokens, PEM blocks, DB connection-string passwords, JWTs (`eyJ...`), URL userinfo (`https://user:pass@host`), URL query strings with sensitive param names, form-urlencoded bodies, Discord snowflake user mentions, E.164 phone numbers.

**ON by default** since v0.13 ... snapshotted at import time so a malicious `export HERMES_REDACT_SECRETS=false` mid-session cannot disable it. Disabling logs a warning at gateway/CLI startup. Pure regex; not ML-driven. Tokens <18 chars fully masked; longer preserve 6-prefix/4-suffix for debuggability.

**Other safety guarantees.**
- **Output redaction** (gateway): same `redact_sensitive_text` applied to assistant output before delivery on messaging platforms.
- **Tool-error sanitization** (v0.14): tool error strings sanitized before re-injection so a malicious file/remote cannot pass instructions through error output. *Worth porting to 2200's tool-result envelope.*
- **Skills Guard** (`tools/skills_guard.py`): scans every community-installed skill for threat patterns (env var exfil, base64 + env, references to `~/.ssh`/`~/.aws`/`~/.gnupg`/`~/.kube`/`~/.docker`/`~/.hermes/.env`, etc.). Verdict: safe / caution / dangerous. Trust-aware install policy: `builtin` always allow; `trusted` (only `openai/skills`, `anthropics/skills`, `huggingface/skills`) allows caution; `community` blocks anything non-safe; `agent-created` asks the agent to revise. Operator must `--force` to override.
- **Prompt-injection scan on cron** (v0.13): cron jobs scan their assembled prompt *including loaded skill content* for prompt-injection patterns.
- **Cloud-metadata SSRF floor** in browser tool (v0.13 fix).
- **Discord role allowlist scoped to originating guild** (v0.13 P0, CVSS 8.1).
- **WhatsApp rejects strangers by default** (v0.13 P0).
- **Subprocess detachment**: subagents and kanban workers spawn with `start_new_session=True` and `subprocess.DEVNULL` stdin.

**No jailbreak prevention, no output classifier, no content filter.** Hermes does not run a separate classifier over LLM output. SECURITY.md framing: prompt injection per se is not a vulnerability; only the chained outcome (OS-isolation escape, unauthorized surface access, credential exfil, documented-stance violation) is.

**System prompts.** Three-tier composition (`agent/system_prompt.py:60-271`), joined `\n\n`:

- **Stable tier (cache prefix):** SOUL.md content OR the default agent identity if SOUL absent. Then conditionally appended: `HERMES_AGENT_HELP_GUIDANCE`, `MEMORY_GUIDANCE` (with explicit ✓/✗ examples), `SESSION_SEARCH_GUIDANCE`, `SKILLS_GUIDANCE`, `KANBAN_GUIDANCE` (only when spawned by Kanban dispatcher), `COMPUTER_USE_GUIDANCE` (when applicable), provider-conditional subscription prompts, `TOOL_USE_ENFORCEMENT_GUIDANCE` (when the model name matches `gpt|codex|gemini|gemma|grok|glm`), per-family discipline blocks (the OpenAI block uses `<tool_persistence>` / `<mandatory_tool_use>` / `<act_dont_ask>` / `<prerequisite_checks>` / `<verification>` / `<missing_context>` tags), an Alibaba/Qwen workaround that hardcodes the model name because the provider returns the wrong one, environment hints (WSL, Termux), platform hints, skills system prompt.
- **Context tier:** caller-supplied `system_message` + context-file discovery (`AGENTS.md`, `.cursorrules`, etc.) under `TERMINAL_CWD`.
- **Volatile tier:** memory store snapshot, `USER.md` profile, external memory provider block, timestamp + session/model/provider line.

Cached on `agent._cached_system_prompt`, only invalidated on context compression. Plugin context goes into the user message, never the system prompt, specifically to preserve cache prefix.

**The big lesson here:** Hermes treats prompt-cache integrity as an architectural invariant, not as an optimization. AGENTS.md `~861-873` makes "do not break prompt cache" non-negotiable; all mutating slash commands default to *next-session* semantics with explicit `--now` opt-in. The discipline matters at scale ... cache cost is a load-bearing budget item. **2200 already has some of this discipline; worth auditing whether we treat it as invariant or as a nice-to-have.**

---

## 3. Multi-Agent posture (the lane question, in detail)

Already covered in the elevator. Detail follows.

Hermes's multi-process surface comes in three shapes:

1. **Profile-as-Agent (`HERMES_HOME` override).** A profile is an isolated `$HOME/.hermes/profiles/<name>/` directory ... its own config, .env, memory, sessions, skills, plugins, SOUL.md. Multiple profiles can be installed; each *can* be run as its own `hermes -p <name>` invocation, which is a separate Python process. **There is no daemon supervising them.** Each `hermes -p X` is independent. Profiles are the multi-Agent atom, but they are user-launched, not orchestrator-spawned by default.

2. **Synchronous subagents via `delegate_task`** (`tools/delegate_tool.py`, 2,796 lines). In-process, in-thread. Parent thread blocks waiting for child summary. Two roles: `leaf` (default ... focused worker, cannot call `delegate_task` / `clarify` / `memory` / `send_message` / `execute_code`) and `orchestrator` (retains `delegate_task` so it can spawn its own workers). Hard limits: `max_concurrent_children=3`, `max_spawn_depth=2`. Parent interrupt cancels children. Subagents run in `ThreadPoolExecutor` workers, not subprocesses. The tool's docstring is explicit: *"delegate_task is **not** durable. For long-running work that must outlive the current turn, use cronjob or terminal(background=True)..."*

3. **Asynchronous, durable multi-Agent via Kanban** (`hermes_cli/kanban.py`, `hermes_cli/kanban_db.py`, `plugins/kanban/`). Shipped v0.13. This is the actual multi-process fleet surface.
   - **Durable SQLite-backed board** (`~/.hermes/kanban.db`) with tasks, runs, claims, heartbeats, parent/child handoffs, comments.
   - **Dispatcher loop** (default 60s tick) runs *inside the gateway process* by default (`kanban.dispatch_in_gateway: true`). Atomically claims ready tasks, spawns workers.
   - **Workers are subprocesses.** `_default_spawn` does `subprocess.Popen("hermes -p <assignee_profile> --skills kanban-worker chat -q 'work kanban task <id>'")` with env-pinned `HERMES_HOME`, `HERMES_KANBAN_TASK`, `HERMES_KANBAN_WORKSPACE`, `HERMES_KANBAN_DB`, `HERMES_KANBAN_BOARD`, `HERMES_PROFILE`. `start_new_session=True`, `stdin=DEVNULL`, stdout/stderr to per-task log. Each task spawns one short-lived `hermes` process. **Workers exit on task completion.**
   - **Coordination primitives** within a board: `kanban_show`, `kanban_complete(summary, metadata)`, `kanban_block(reason)`, `kanban_heartbeat(note)`, `kanban_comment`, `kanban_create(title, assignee, parents=[...])`, `kanban_link`. Workers only see these tools when `HERMES_KANBAN_TASK` env var is set; otherwise the schema footprint is zero. *(Pattern worth borrowing: scope tool exposure to runtime context, not to identity declaration.)*
   - **Reliability primitives:** heartbeats, claim TTL with reclaim, zombie detection via PID liveness, retry budgets, auto-block after 5 consecutive spawn failures, hallucination gate for worker-created cards.
   - **Isolation model:** board is the hard boundary (workers cannot see other boards via `HERMES_KANBAN_BOARD` env pin); tenant is a soft namespace within a board (one specialist fleet can serve multiple businesses).

**Inter-Agent communication.**
- Within a board: SQLite shared state + comments + structured metadata on `complete`/`block`. No pub-sub, no message bus.
- Across boards / outside Kanban: **no native primitive.** Two Agents in different gateway sessions or different profiles do not have a built-in way to send each other messages.
- The gateway is one process talking to many *human* messaging platforms (Telegram, Discord, Slack, WhatsApp, Signal). Humans message Agents through it. There is no inverse ... Agents do not "message" each other through the gateway. `send_message_tool.py` exists for sending to humans on platforms, not to other Agents.

**Trajectory.** `.plans/` directory has two items: `openai-api-server.md`, `streaming-support.md`. No "multi-agent v2" plan, no "agent mesh," no pub. Kanban shipped v0.13; v0.14 polished it (orchestrator board tools `kanban_list`/`kanban_unblock`, per-platform notification toggles, dropping caller-controlled author overrides). No fundamental shape change planned.

**Net read.** Hermes's multi-Agent posture is *coordinator + ephemeral workers via Kanban*. The fundamental unit is one Python process running one AIAgent serving one human; the unit of multi-Agent work is one short-lived task on a shared board. There is no Agent-to-Agent pub equivalent and the architectural shape does not permit one without significant rework.

2200's posture (long-lived Agent processes coordinating via OpenPub) is structurally different. The lane question is resolved: **2200's multi-Agent posture is genuinely defensible against Hermes's design.** Worth naming this explicitly in any public competitive material.

---

## 4. SOUL.md format

**Hermes's SOUL.md = persona / identity / voice file. That is all.**

From `website/docs/guides/use-soul-with-hermes.md:9`: *"`SOUL.md` is the primary identity for your Hermes instance. It's the first thing in the system prompt ... it defines who the agent is, how it speaks, and what it avoids."*

**Single canonical location:** `$HERMES_HOME/SOUL.md` (default `~/.hermes/SOUL.md`). One per profile. No per-project SOUL ... that's `AGENTS.md`'s job in the cwd (Hermes's `AGENTS.md` is the same convention Anthropic + others adopted: cwd-discovered project instructions).

**No schema.** No YAML frontmatter. No required headers. Pure markdown body. Length bounded by truncation if too long.

**Seed file content** (`hermes_cli/default_soul.py`, verbatim):

> *"You are Hermes Agent, an intelligent AI assistant created by Nous Research. You are helpful, knowledgeable, and direct. You assist users with a wide range of tasks including answering questions, writing and editing code, analyzing information, creative work, and executing actions via your tools. You communicate clearly, admit uncertainty when appropriate, and prioritize being genuinely useful over being verbose unless otherwise directed below. Be targeted and efficient in your exploration and investigations."*

**Loading mechanism** (`agent/system_prompt.py:86-99`):
1. Read `$HERMES_HOME/SOUL.md`.
2. Run prompt-injection scan over its content (Skills Guard pattern set).
3. Truncate if too long.
4. Place verbatim as the first content block of the system prompt ... replaces the default identity string.
5. No wrapper language added.

Fallback to default if empty / unreadable / fails injection scan.

**Distinct from OpenPub's SOUL.md.** Same filename, completely different meaning. Hermes's SOUL.md is voice; OpenPub's SOUL.md is something else (per our context, OpenPub's is the Identity-anchoring document with structured fields). In Hermes there is no concept of an Agent identity that contains capabilities, credential bindings, network address, or anything like a SCUT analog. SOUL.md is *only* the stylistic persona text. `MEMORY.md` (declarative facts) and `USER.md` (user profile) are the other persistent identity-adjacent files. None have schema-enforced fields.

**`/personality` overlay:** session-scoped persona switch via `/personality <name>`. Complementary to SOUL.md, doesn't modify it.

**OpenClaw genealogy:** `hermes claw migrate` imports `SOUL.md` directly as a persona file. The convention is inherited from OpenClaw, which had the same pattern. (OpenClaw's `skills/` directory uses the same `SKILL.md` frontmatter shape Hermes inherits ... per the Phase F survey, OpenClaw's pattern is the source.)

**For 2200's naming hygiene:** if we adopt anything SOUL.md-shaped, expect collision in operator docs. The Hermes-OpenClaw lineage owns the persona-file framing in the OSS Agent space; OpenPub owns it in our pub stack. Worth being explicit about which we mean every time the term comes up.

---

## 5. Skill / Capability equivalent

**Hermes has no Capability Catalog equivalent in the Phase F sense.**

The Hermes taxonomy is fragmented across four overlapping concepts:

| Concept | Location | What it is | Trust model |
|---|---|---|---|
| **Tool** | `tools/*.py` + `plugins/<name>/__init__.py` | Typed function exposed to the model via OpenAI tool schema. Hardcoded in Python. | Built-in full trust; plugin full trust on install. |
| **Toolset** | `toolsets.py` `TOOLSETS` dict | A named bundle of tool names. Platforms inherit a base toolset. | n/a, pure grouping. |
| **Skill** | `skills/<category>/<name>/SKILL.md` + scripts/ + references/ + templates/ | Markdown procedural memory ("how to do X"). Loaded into prompt on demand. May ship Python scripts; those execute on import. | Trust-aware install via Skills Guard; bundled = full trust; trusted repos = caution allowed; community = blocked unless `--force`. |
| **Optional Skill** | `optional-skills/<category>/<name>/` | Same as Skill, opt-in install via `hermes skills install official/<category>/<skill>`. Heavier deps or niche use. | Same as skill. |
| **Plugin** | `plugins/<name>/` + `~/.hermes/plugins/` + pip entry points | Full Python module loaded into agent process with lifecycle hooks (`pre_tool_call`, `post_tool_call`, `pre_llm_call`, `post_llm_call`, `on_session_start`, `on_session_end`, `pre_gateway_dispatch`, `pre_approval_request`, `post_approval_response`, etc.). | Documented as operator review surface; full agent privileges. |
| **MCP server** | External process | Standard MCP stdio/HTTP. Tools registered dynamically. | Operator review at config time; OAuth flow for hosted MCP. |

**No single declarative unit bundles credentials needed + tools unlocked + acquisition walkthrough as one entity with a single trust contract.** The pieces exist, scattered:
- Skill frontmatter declares `required_environment_variables: [{name, prompt, help, required_for, optional}]` ... missing entries trigger `_capture_required_environment_variables` which calls a `_secret_capture_callback` (CLI prompt or gateway approval flow). Captured values land in `$HERMES_HOME/.env`. **Plaintext through Python.**
- Skill frontmatter declares `required_credential_files: [<path>]` (relative to HERMES_HOME, no traversal). Files registered for mount into Docker/Modal/SSH backends.
- `metadata.hermes.config` ... config.yaml settings prompted at install, stored under `skills.config.<key>`.
- `metadata.hermes.tags`, `category`, `related_skills` ... discovery surface.
- **No `tools:` field in skill frontmatter.** A skill cannot bind itself to specific tools. It references them in prose for the model. A skill is a *prompt augmentation that calls existing tools*, not a *bundle of tools + creds*.
- **Skills Hub** (`tools/skills_hub.py`, 2,801 lines): lockfile-based provenance tracking. `HubLockFile` records `skill_hash` (content hash), source repo, version, `installed_at`. Trust inferred from source (hardcoded TRUSTED_REPOS: `openai/skills`, `anthropics/skills`, `huggingface/skills`). Hash mismatch on rescan flags tampering. No cryptographic publisher signing.

**Threat handling mapped against the [[2026-05-18-capability-security-model]] threat model:**

| Threat | Hermes posture |
|---|---|
| Credential exfiltration | Skill frontmatter cannot register provider keys as passthrough (`_HERMES_PROVIDER_ENV_BLOCKLIST`); subprocess env scrubbing in code-execution + terminal backends; Skills Guard regex catches obvious patterns. No runtime sandbox for skill Python code. SECURITY.md frames operator review as the boundary. |
| Scope abuse | **No declared scope.** Skills are markdown; no tool allowlist per skill. Mitigation is prose discipline + toolset gating per platform. |
| Look-alike attacks | Three TRUSTED_REPOS hardcoded; lockfile content hashes per install; install audit log. **No cryptographic publisher signing.** |
| Time-bomb | Content hashes detect changed content on re-pull; operator can pin (Curator). No signed release manifests. |
| Publisher signing | None. |
| Network egress declaration | None at skill/plugin level. Whole-process sandbox (OpenShell, per SECURITY.md) handles network policy at OS level. |
| Cred-to-Skill binding | Soft: frontmatter declares which env vars needed; values land in global `$HERMES_HOME/.env`. Env var is visible to **every** in-process tool/skill/plugin. |
| Sandbox boundaries | Skills/plugins are **explicitly inside the trust envelope** ... no skill-level sandbox. Supported sandboxes: terminal-backend isolation (Docker/Modal/Daytona/SSH/Singularity/Vercel Sandbox; confines shell + file tools only) and whole-process wrapping (Docker image, NVIDIA OpenShell). Neither is skill-scoped. |

**Net read on Capabilities.** Hermes's operator model is *"Skills are markdown you read before you install. Plugins are Python you audit before you install. Trust is operator review, not platform-enforced."* That is the SECURITY.md framing made architectural. The corresponding absence: there is no "to use skill X you need creds Y" → operator-paste-into-vault flow that guarantees the secret never crosses LLM context. Whatever Hermes prompts-for-secret-wise lands in a flat `.env`, process-env-readable by every loaded module.

**For 2200's Phase F:** the Capability Catalog (bundled credentials + tools + acquisition walkthrough as one trust unit, with the security-model decision's three forward-compat primitives baked in) is **a different primitive than anything Hermes ships, and structurally stronger.** The 2200 path is more opinionated and limits the long-tail ecosystem ... a deliberate tradeoff Hermes did not make.

The interesting place to push back: if Hermes is shipping fine without any of these guarantees, *do operators actually need them?* The honest answer is probably *not yet at v1 user count, but they will when external-publisher catalogs exist.* The 2200 thesis (build the trust substrate now, in the cheap-to-add window, so v2 enforcement is additive) is sound. The security-model decision is the right architectural posture.

---

## 6. Differentiation map

### 6a. Worth borrowing (Hermes patterns to fold into 2200)

| Pattern | Hermes file | Fit for 2200 |
|---|---|---|
| **Tool-name fuzzy repair** before erroring | `conversation_loop.py:3037` `_repair_tool_call` | High. Cheap win on a real failure mode (model says `read_files`, registry has `read_file`). Implement in tool-dispatch layer. |
| **Invalid-JSON-args retry with synthetic tool-error injection** | `conversation_loop.py:3087-3173` | High. Preserves role alternation, lets the model recover within context. We currently kick to operator on bad JSON; this is more graceful. |
| **Tool-call circuit breaker** (N consecutive same-tool failures halts loop) | `agent/tool_guardrails.py` | High. Prevents budget-bleed-without-progress. Sits beside our existing budget caps. |
| **Hardline-below-yolo two-tier safety** | `tools/approval.py:198-220` + docstring | Medium-high. Even with operator-fleet trust, *catastrophic* commands (`rm -rf /`, `mkfs`, `shutdown`) should be unconditional refusals. The framing *"opting into yolo is the user trusting the agent with their files and services, not trusting it to wipe the disk"* is exactly right. |
| **Smart approvals via auxiliary LLM** | `tools/approval.py:866-890` | Medium. Reduces approval fatigue without lowering the floor. The prompt is short. Worth considering once Phase F's walkthrough-runner is live and approval surface count grows. |
| **`_HERMES_PROVIDER_ENV_BLOCKLIST`** (non-overridable allowlist exclusion at substrate level) | `tools/env_passthrough.py` | High. Pattern translates directly to 2200: a non-skill-overridable blocklist of provider keys that *cannot* be requested by Capability code, regardless of frontmatter. Fold into the security-model decision's M3 enforcement when it lands. |
| **Tool-error sanitization** (strip fences/CDATA/control sequences from tool errors before re-injecting) | `tools/registry.py:390` `_sanitize_tool_error` | High. Closes a small but real prompt-injection-via-error-message hole. Cheap to add. |
| **Skills Guard regex pattern set** (env var exfil, ~/.ssh refs, base64+env, etc.) | `tools/skills_guard.py` | Medium. Even with first-party-only Phase F, a passive scanner that flags suspicious patterns in Capability walkthroughs is cheap insurance. Catch the obvious before we add publisher signing. |
| **Skill description hardline (≤60 chars, one sentence, ends with period, no marketing)** | `AGENTS.md:617-634` | High. Treat prompt budget as a moderation surface. Apply to Capability `description` field in [[14-phase-f-capability-catalog]] §1 schema; reject malformed at load. |
| **Profile-as-Agent via env-var override at module-import time** | Hermes-wide pattern | Conceptual. We do this differently (per-Agent identity directory), but the *one-function-resolves-config* hygiene is worth checking we have. |
| **Plugin lifecycle hook return shape** `{action: skip|rewrite|allow}` for vetoing/transforming | `hermes_cli/plugins.py` | Medium. Clean middleware pattern. If we add plugin/middleware surfaces beyond MCP, mirror this. |
| **Three rotating logs (`agent.log`, `errors.log`, gateway.log`) with `RedactingFormatter`** | `hermes_logging.py:215-260` | Already partial in 2200. Worth auditing whether all our log paths route through redaction. |

### 6b. Defensible (2200 substance vs Hermes)

| Substance | Why it's defensible |
|---|---|
| **Multi-Agent posture (long-lived Agent processes coordinating via pub)** | Hermes has no equivalent. The Kanban shape is one-shot-worker-per-task. Building a Hermes equivalent would require new substrate Hermes does not have. **The lane is genuinely ours.** |
| **Credential substrate (operator paste direct to per-Agent vault, secrets never enter LLM context)** | Hermes's posture is redaction-by-regex + flat `.env`. 2200's is a structural guarantee, not a heuristic. The SECURITY.md framing in Hermes (*"the only security boundary is the OS"*) is honest and right ... and 2200's substrate adds a second boundary Hermes does not have. |
| **Claim-vs-evidence audit** | Hermes has no equivalent. The v0.14 file-mutation footer is narrow (file writes only, surfaced to model not operator). 2200's audit + kick-back + refusal-as-first-class is a complete substrate. |
| **Capability Catalog as bundled trust unit** | Hermes has none of: publisher signing, per-Capability credential binding, declared network egress, Capability-scoped sandbox. Its operator model is "review-before-install." 2200's is "bundled trust contract with cheap-to-add forward-compat primitives now, enforcement later." Different primitive. |
| **`request_credential` 1:1 chat surface restriction** | Hermes's secret capture is whatever surface the agent is on (CLI prompt or gateway approval). 2200's hard restriction to 1:1 chat (per the credential-substrate decision) closes the Agent-to-Agent social-engineering vector Hermes cannot close. |
| **OpenPub as the coordination substrate (and the pub being a Doug-owned service)** | Hermes has no pub at all. OpenPub satisfies the *"we own"* principle ([[../decisions/2026-04-29-we-own-includes-openscut]] memory pointer). Hermes is fully self-hosted with no platform-side coordination layer. |

### 6b.i Framing note (banked for public positioning)

The §6b list is "what 2200 has that Hermes does not," but the public positioning that comes out of this work names these as **different tradeoffs Nous made deliberately**, not as oversights. Nous chose shipping velocity + ecosystem breadth (the wide skill catalog, the trust-the-operator-review model, the lighter-substrate ergonomics). 2200 chose substrate-level trust (the credential vault guarantee, the audit verifier, the Capability-as-trust-unit bundling). Both are coherent product positions; neither is universally right. "Different tradeoff" survives scrutiny; "we're stronger" invites a fight on velocity and breadth that is not the fight 2200 wants. The lane question (*one really good Agent* vs *team of Agents*) is the framing that wins in both directions ... Hermes is the one-really-good-Agent product; 2200 is the team-of-Agents product; both can succeed.

### 6c. Commoditized (same shape, different surface; no edge either way)

| Pattern | Both sides |
|---|---|
| Tool registration + dispatch + OpenAI schema generation | Registry singleton, decorator/explicit-call registration, JSON-string return, exception → `{error}` wrapping. Standard. |
| Three-tier system prompt with cache-friendly layering | Stable / context / volatile. Most serious agent frameworks have converged here. |
| Markdown-file persistent memory | MEMORY.md, USER.md, SOUL.md (Hermes); per-Agent brain directory (2200). Both operator-readable markdown. |
| SQLite + FTS5 for session storage | Identical choice. Hermes adds trigram FTS for CJK ... polish, not architecture. |
| MCP integration as first-class | Both standardize on MCP wire protocol for external tool surfaces. |
| Personality/persona overlay separate from base identity | `/personality` (Hermes) vs whatever we use; same concept. |
| Cron scheduler for recurring agent jobs | Both have it. |
| Plugin lifecycle hooks (pre/post tool call, session start/end) | Standard middleware. Exact list differs; architecture does not. |
| Approval prompt + persistent allowlist for dangerous shell | Standard "ask the human" with permanent-rule learning. |
| PII/secret regex sweep on logs + output | Both regex-based. Hermes's coverage (33 vendor prefixes + JWT + URL + DB connstring + Discord + E.164) is broader than most; architecture (regex sweep with mask-or-truncate) is the commodity. |
| Conversational tool-call loop with retry-on-error | ReAct lineage. Standard. |

---

## 7. Implications for 2200 (where this changes Phase F)

Three concrete edits worth folding into [[14-phase-f-capability-catalog]] (task 5 in the current sequence). I am not committing to them here; surfacing them so Doug can decide which to apply.

1. **Capability `description` hardline.** Adopt Hermes's skill-description discipline: ≤60 chars, one sentence, ends with period, no marketing words. Apply to the `description:` frontmatter field in §1 schema; reject malformed at load. Prompt budget is a moderation surface, not a footnote. (Borrowed from Hermes AGENTS.md:617-634.)

2. **Non-overridable provider-env blocklist for Capability code.** Today Phase F's §1 schema lets each Capability declare its `auth` requirements. Add a separate substrate-level list of credentials that **cannot** be a Capability's `auth.env_var` regardless of frontmatter (e.g. host LLM provider keys, 2200's own service tokens). Mirror the `_HERMES_PROVIDER_ENV_BLOCKLIST` pattern. Belongs alongside the security-model decision's M3 enforcement when it lands; cheap to declare the field now.

3. **Tool-error sanitization in the walkthrough runner.** When a Capability's tool call errors during the post-spawn walkthrough, sanitize the error string (strip fences, CDATA, control sequences, anything that looks like injected instruction) before surfacing to the operator or re-injecting to the model. Cheap addition to the walkthrough-runner module.

Two further patterns worth considering as their own discrete work, NOT in Phase F scope:

- **Tool-call fuzzy repair + JSON-args retry with synthetic tool-error injection.** Belongs in the loop / dispatcher layer, not in Phase F. Worth a small decision doc + implementation pass post-Phase-F.
- **Tool-call circuit breaker.** Same scope ... loop-layer reliability work.

---

## 8. What I didn't verify

- **Honcho / external memory provider integration depth.** Subagent saw the `MemoryProvider` ABC and `agent/memory_manager.py` but didn't trace what *"honcho dialectic user modeling"* exchanges over the wire. Not load-bearing for our questions but flagging.
- **TUI process model details.** Verified at high level (Ink/React frontend + Python `tui_gateway` backend via newline-delimited JSON-RPC over stdio). Full event catalog not enumerated.
- **ACP/JSON-RPC surface exposed via `acp_adapter/`** for VS Code/Zed/JetBrains integration. Confirmed it's an authorization-required local-IPC surface per SECURITY.md §2.6; methods not enumerated.
- **Self-improvement loop / background-review fork.** Referenced repeatedly in code comments (`agent/background_review.py`, the *write-origin ContextVar* in `conversation_loop.py:144-145` distinguishes background-review writes from foreground writes) but `background_review.py` not read in this pass. Worth a follow-up if the *self-improving-skills* claim from the README marketing matters to our roadmap thinking.
- **Codex app-server runtime** (`agent/codex_runtime.py`, `agent/codex_responses_adapter.py`). Confirmed it exists, didn't trace lifecycle.

None of these gaps change the major findings.

---

## Provenance

- 2026-05-18 morning: Doug + Guppi worked through the Capability security threat model; [[2026-05-18-capability-security-model]] decision filed.
- 2026-05-18 afternoon: Doug requested Hermes pull + deep dive per the sequence in his Phase F review note. Repo cloned from `github.com/nousresearch/hermes-agent` to `code/2200-reference/hermes-agent/` (MIT © 2025 Nous Research, 291MB, v0.14.0).
- General-purpose research subagent performed full code + docs pass over the repo; structured report on the five questions Doug asked.
- Hobby synthesized the subagent's findings into this memo, organized as architecture sections matching Doug's brief plus a differentiation map and implications-for-Phase-F section.
- Next step in the queue: Phase F doc edits informed by these findings (task 5).

**Not a decision record.** A checkpoint review for future delta comparison ... when Hermes ships v0.15 or a major architectural shift, re-run this pass and report deltas against this baseline. Pattern adopted from the [[2026-05-14-external-architecture-review]] precedent.

— Hobby
