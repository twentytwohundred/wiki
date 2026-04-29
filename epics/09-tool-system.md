---
title: "Epic 9: Tool system"
type: epic
status: draft
version: 0.1
tags: [epic, tools, mcp, integrations, oauth, secrets]
created: 2026-04-29
updated: 2026-04-29
linked_docs:
  - "[[03-epic-map]]"
  - "[[02-architecture]]"
  - "[[02-agent-runtime-minimum]]"
  - "[[2026-04-25-mcp-native]]"
  - "[[2026-04-25-tool-baseline]]"
canonical_path: wiki/epics/09-tool-system.md
---

# Epic 9: Tool system

Beyond the baseline. Today an Agent can use the in-process baseline tools (`fs`, `shell`, `web`, `brain`, `time`, `pub`, `notification`). Epic 9 lets an Agent use the rest of the world: Gmail, Calendar, GitHub, Slack, Stripe, anything with an MCP server or an HTTP API.

The 2200 layer is the substrate that lets users connect a tool once and Agents use it. The integrations themselves are largely commodity ... per the integrate-over-build standing rule, 2200 reuses existing MCP servers for non-differentiated layers (Gmail, Calendar) rather than building wrappers.

## Why this matters now

With Hobby migrated in (Epic 5), the next limit is "what can he do?" The current answer is "shell + web + write to files + talk in pubs + leave notifications." That is enough to be useful, but it is not what the vision promises ("Email Agent reads your email"). Epic 9 is the bridge.

Epic 9 also unblocks:

- **Epic 11 (Skills ingestion).** A Skill that needs a tool the Agent does not have can declare its tool dependencies; the Skill installer surfaces "you need to connect X first" via Epic 9's substrate.
- **Epic 12 (Extensions framework).** Extensions package their own tools alongside their state; the Extension framework piggybacks on Epic 9's MCP server registration.
- **Epic 14 (Conversational onboarding).** A user spawning a new Agent picks tools from a list; the list comes from Epic 9's tool registry.

## Phasing

Epic 9 phases the substrate, the OAuth orchestration, and the integration health monitoring into separate deliverables. The substrate (Phase A) is the load-bearing piece and ships first.

### Phase A — stdio MCP server registration

**Done when.** A user can declare an external MCP server in an Agent's Identity (transport: stdio, a command line, env vars for credentials), the supervisor spawns the server alongside the Agent process at start time, the server's tools appear in the Agent's tool registry, and the Agent can call them. End-to-end demo: Hobby running with the GitHub MCP server registered + a `GITHUB_TOKEN` SecretRef can run `github.list_issues` against `twentytwohundred/2200`.

**Includes:**

- Identity field: `mcp_servers: []` with each entry having `name`, `transport: stdio`, `command`, `args`, `env` (a map of env-var-name → SecretRef).
- New module `src/runtime/mcp/stdio-transport.ts`: spawn a child process, hold an MCP JSON-RPC channel over stdio, expose the child's `tools/list` results as `ToolDefinition[]`.
- Identity loader recognizes `mcp_servers`. Existing tools array gains the ability to name tools from registered servers (the validator currently enforces a `<namespace>.<verb>` shape; that still holds).
- Agent bootstrap: at start, resolve SecretRefs for each declared MCP server, spawn the children, register their tools with the existing `ToolRegistry`. On child crash, supervisor restarts (with backoff) and emits a Passive notification on repeated failures.
- Permission model: Identity's `tools: []` array additively grants access. Tools from registered MCP servers are NOT automatically granted; the Agent's `tools:` list must include them by exact name (or namespace wildcard like `github.*`, decided in spec lock).

**Out of scope for Phase A:**

- HTTP MCP transport.
- OAuth orchestration (operator hand-rolls credentials into env or files; later phases automate).
- Health monitoring beyond "child crashed" (no per-tool success/failure history yet).
- Tool call pattern logging for loop-detection (Epic 2 cost-behavior layer; can land later).
- Per-Agent encrypted credential storage (Phase B; Phase A uses existing SecretRef `env` and `file` sources, which are unencrypted-at-rest unless the operator places them under encrypted paths).

### Phase B — OAuth orchestration + encrypted credential vault

**Done when.** A user runs `2200 oauth google --agent <name> --scopes gmail.readonly,calendar.readonly`, gets a browser-opened auth flow, and the resulting refresh token lands in the Agent's encrypted credential vault. The Identity's `mcp_servers` block references the credential by SecretRef name. Tokens are refreshed automatically on expiry.

**Includes:**

- `src/runtime/credentials/`: per-Agent encrypted credential store (master-key wrapped, mirrors the SCUT keystore pattern from Epic 4).
- New SecretRef source: `vault` (id is a credential name in the per-Agent vault).
- OAuth client + redirect-server (one-shot localhost server during the auth flow).
- Token refresh loop (background job per Agent, runs through the scheduler).
- CLI: `2200 oauth google`, `2200 oauth github`, `2200 oauth slack`, `2200 oauth status <agent>`, `2200 oauth revoke <agent> <name>`.

### Phase C — HTTP MCP transport + integration health

**Done when.** A user can register an HTTP MCP server (e.g., a hosted commercial MCP service), and the supervisor tracks per-tool success/failure history. Tools dormant for 30+ days surface in `2200 agent status <name>` as a yellow indicator. Repeated failures emit Passive notifications.

**Includes:**

- HTTP MCP transport (alongside stdio).
- Per-tool counters in the existing telemetry JSONL stream.
- `tool_health.md` per Agent listing dormant + failing tools.
- Tool call pattern logging for the cost-behavior loop-detection layer per [[2026-04-24-cost-behavior-shape]].

## What gets reused (integrate over build)

For commodity integrations, 2200 reuses existing OSS MCP servers without modification:

- **Gmail / Google Calendar** ... [`@modelcontextprotocol/server-gmail`](https://github.com/modelcontextprotocol/servers) (or an equivalent community server). 2200 does not write a Gmail wrapper.
- **GitHub** ... `@modelcontextprotocol/server-github` (community standard).
- **Slack** ... `@modelcontextprotocol/server-slack`.
- **Stripe, Linear, Notion** ... TBD per-integration; default position is "use the community MCP server when one exists with credible maintenance."

When a non-2200 MCP server is registered, 2200 records the source repo + version in the Agent's `mcp_servers` audit so users can see what their Agent has access to.

## Identity schema delta (Phase A)

Schema bump from v4 to v5. Migrator chain handles the bump transparently.

```yaml
schema_version: 5
agent_name: hobby
# ... existing fields ...
tools:
  - github.list_issues
  - github.create_issue
  - github.list_pull_requests
mcp_servers:
  - name: github
    transport: stdio
    command: npx
    args: ['-y', '@modelcontextprotocol/server-github']
    env:
      GITHUB_TOKEN:
        source: env
        id: GITHUB_TOKEN_HOBBY
```

The `tools` array continues to work as today (entries are additions over the baseline). Tools whose namespace matches a registered MCP server resolve to that server's tools; tools without a corresponding server fail at registry-build time with a clear "no server provides `github.list_issues`" error.

## Hobby's first integration target

GitHub. Doug's team uses GitHub heavily; the GitHub MCP server is mature; the integration loop is fast (PR opens, Hobby comments, Hobby closes). Once GitHub is wired in, Hobby can:

- Comment on his own PRs from inside 2200
- Triage issues in `twentytwohundred/2200`
- Open the next epic's PRs without leaving the runtime

That demo proves Phase A is real.

## Dependencies

- Epic 2 (supervisor, control-plane, Identity loader, baseline tool registry) ... shipped.
- Epic 4.5 (telemetry JSONL) ... shipped. Phase C extends it for tool-health counters.
- Epic 5 (migration) ... shipped. Hobby is the first Agent to exercise Epic 9.

No new external dependencies for Phase A beyond the MCP server NPM packages (which are commodity and tracked per integration).

## Upgrade-readiness

| Discipline | Approach |
|-----------|----------|
| Schema versioning | Identity bump v4 → v5 via migrator chain. The `mcp_servers` field is optional in v4 (defaults to empty); migrator just sets the field on v4 → v5 promotion. |
| State on disk | Each MCP server's child process + tool list lives in memory; the Identity file is the source of truth for "what should be loaded." Restart re-reads Identity and re-spawns children. |
| Restart safety | Stdio MCP children are stateless across the supervisor↔Agent boundary; restart re-spawns. Token state (Phase B) lives in the encrypted credential vault on disk, not in the child. |
| Tool-call inspectability | Every external tool call goes through the existing dispatcher's plan/run/perm wrapping; no special-case path. |
| Inspectable persisted artifacts | Identity is markdown. Credential vault (Phase B) is per-credential encrypted blobs at known paths. Token files are inspectable as opaque ciphertext. |

## Open product calls (Phase A)

- **Tool grant: explicit list vs. wildcard.** The Identity's `tools:` array currently lists exact names. With external MCP servers exposing dozens of tools each, requiring `github.list_issues, github.create_issue, github.list_pull_requests, ...` is verbose. Options: (a) require explicit list; (b) allow `github.*`; (c) auto-grant all of a registered server's tools, with explicit list overriding to a subset. Recommend (b) for ergonomic default with (a) still available for fine-grained restriction. Need Doug's sign-off before locking.

- **Backoff + crash policy on stdio MCP servers.** Default: 3 fast retries (200ms, 1s, 5s), then 30s exponential backoff up to 5 minutes; emit Passive notification at first restart, Important at 5+ consecutive failures. Reasonable defaults; would benefit from Doug's review before locking.

- **MCP server source pinning.** When the Identity says `command: npx -y @modelcontextprotocol/server-github`, the version is whatever npm resolves at spawn time. Pin to a specific version in the example? Add an explicit `version:` field? Recommend: examples in docs pin via `@N.N.N`; spec does not enforce.

## Format provenance

Spec drafted by Hobby, 2026-04-29, after Epic 5 Phase A landed. Implementation begins on `epic-9/identity-mcp-servers` once the Phase A scope is signed off (the open product calls above).

---

*Phase A scope locks once Doug signs off on the open product calls. Phases B and C sketched for sequencing and to make the "shape of the world after Epic 9" visible.*
