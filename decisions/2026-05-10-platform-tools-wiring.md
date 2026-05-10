---
date: 2026-05-10
status: accepted
canonical_path: wiki/decisions/2026-05-10-platform-tools-wiring.md
---

# Platform tools (Discord / Slack / Spotify): wiring posture

## Decision

External-platform integrations (Discord, Slack, Spotify) ship as
**in-process MCP servers in a `platform/` tier alongside baseline
tools**. They are NOT in `BASELINE_TOOL_NAMES`. Per-Agent access is
gated by the Identity's existing `tools:` array, which already
supports namespace wildcards (`discord_*`, `slack_*`, `spotify_*`)
via `expandToolGrants`.

## Three options considered

1. **Standalone MCP servers per platform.** Each platform is a
   separate node package speaking the MCP wire protocol. Identities
   declare them in `mcp_servers[]` to opt in. Matches Doug's stated
   "human points UX at MCP tool" goal.

2. **In-process platform tier (chosen).** Tools registered via the
   same `createInProcessServer` factory as baseline; they live in
   the agent process, no subprocess overhead.

3. **Add to baseline.** Every Agent gets every platform tool by
   default. Rejected: leaks tool surface to Agents that have no
   reason to call Discord, complicates default deny.

## Why option 2

- **Substrate already exists.** `src/runtime/mcp/` provides the
  registry, dispatcher, tool-grant expansion, and credential
  resolution paths. Plugging in 21 new tool defs (5 Discord +
  10 Spotify + 6 Slack) is mostly typing work, not new architecture.

- **Per-Agent grant model is built.** The Identity `tools:` field
  already supports both exact names (`spotify_play_track`) and
  namespace wildcards (`spotify_*`) via `expandToolGrants`. Doug's
  "global registry → per-Agent assignment" requirement maps onto
  this directly: tools register globally; agents opt in via Identity
  edits.

- **Standalone MCP servers are over-engineered for v1.** Each would
  require: separate package boundary, MCP wire protocol overhead,
  subprocess spawn cost, separate credential plumbing. We do not
  need any of that for three integrations Doug owns end-to-end.

- **The migration path stays open.** When the Phase B Extensions
  framework lands (with install lifecycle), or when Doug ships the
  UI-driven MCP onboarding flow, platform tools can be lifted out
  with no contract change. The tool defs are MCP-shaped already.

## Credential plumbing

Three different shapes:

| Platform | Credential | Storage |
|---|---|---|
| Discord | Workspace bot token | env (`_2200_DISCORD_BOT_TOKEN`) |
| Slack | Workspace bot token (`xoxb-...`) | env (`_2200_SLACK_BOT_TOKEN`) |
| Spotify | OAuth access + refresh tokens | per-Agent vault (`spotify` + `spotify-refresh`) |

Discord and Slack are env-resolved because their tokens are
workspace-scoped (one bot serves all Agents). Spotify is vault-resolved
because each Agent authorizes its own user (Doug authorizes once for
Jodin; that token belongs in Jodin's vault, not Hobby's).

Spotify token refresh is handled by the supervisor's
`TokenRefreshService`, which already scans every Agent vault for
OAuth credentials whose `expires_at` is within the refresh window.
The Spotify provider entry was added to `oauth/providers.ts`
(scopes: `user-read-playback-state`, `user-read-currently-playing`,
`user-modify-playback-state`, `playlist-read-private`,
`playlist-modify-private`, `user-library-read`).

## Failure modes (intentional)

- **Tool present but credential missing.** The tool registers
  unconditionally; the `execute()` resolves the credential lazily
  and throws a clean error pointing the operator at the right CLI
  command. Reasoning: deterministic tool surface across agents
  regardless of operator configuration timing. The model gets a
  one-line actionable error instead of a missing-tool surprise.

- **Spotify Premium gating.** Spotify enforces Premium on all
  `/me/player/*` write endpoints server-side. Reads work for
  free-tier users. The error mapping converts Spotify's
  `PREMIUM_REQUIRED` reason into a clean message; the operator
  decides whether to upgrade.

- **Slack inbound events.** v1 is outbound-only. Building incoming
  Slack events (Socket Mode or HTTP events endpoint) is non-trivial
  and intentionally deferred until Doug confirms the use case.
  Hobby/Simon/Jodin posting to Slack works today; Slack DMing the
  bot does not.

## Library lifts (license-tracked)

| Source | License | Direction | Provenance comment in source |
|---|---|---|---|
| `@discordjs/core` (REST + http-only) | Apache-2.0 | dependency | npm |
| `@discordjs/rest` | Apache-2.0 | dependency | npm |
| `discord-api-types` | MIT | dependency | npm |
| `@slack/web-api` | MIT | dependency | npm |
| `@spotify/web-api-ts-sdk` | Apache-2.0 | dependency | npm |

No code-lift was needed for v1. The OpenClaw extensions
(`extensions/discord/src/`, `extensions/slack/src/`) were read for
edge-case patterns (rate-limit handling, payload chunking) but no
files were copied. `stablyai/agent-slack` was investigated as a
code-lift candidate; the SDK-direct path won on simplicity.

## Not in scope

- **Voice/audio in Discord** ... not v1.
- **Slack Socket Mode / events endpoint** ... not v1.
- **Spotify Web Playback SDK (browser)** ... not v1; we control
  existing Spotify Connect devices.
- **Per-Agent OAuth-installed Slack app** (different bot per
  Agent) ... v1 is workspace-scoped.
- **MCP-server ingestion via UI** (Doug's "paste an MCP server in
  the Studio") ... separate work item, doesn't block these tools.

## Test footprint

58 unit tests across the three platforms (19 Discord + 21 Spotify
+ 18 Slack). Mocks at the SDK boundary; we test our tool surface,
not the third-party APIs. Schema validation, error mapping, output
projection, and credential-missing paths are all covered.

## Affected files

- `src/runtime/tools/platform/{discord,slack,spotify}/{client,tools,index}.ts`
- `src/runtime/tools/platform/index.ts`
- `src/runtime/agent/process.ts` (registration call)
- `src/runtime/oauth/providers.ts` (Spotify provider entry)
- `src/cli/main.ts` (`platform status` subcommand)
- `src/runtime/onboarding/starter-pack.ts` (shared-brain seed)
- `tests/runtime/tools/platform/*.test.ts`
- `tests/cli/main.test.ts` (top-level command count)

## Operator quickstart

```bash
# Discord
export _2200_DISCORD_BOT_TOKEN=...
2200 daemon restart
# edit hobby's identity to add: tools: [discord_*]

# Slack
export _2200_SLACK_BOT_TOKEN=xoxb-...
2200 daemon restart

# Spotify (for jodin)
export _2200_OAUTH_SPOTIFY_CLIENT_ID=...
export _2200_OAUTH_SPOTIFY_CLIENT_SECRET=...
2200 oauth login spotify jodin --name spotify
# edit jodin's identity to add: tools: [spotify_*]

# Verify
2200 platform status
```
