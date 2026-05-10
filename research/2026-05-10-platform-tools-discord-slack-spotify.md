---
date: 2026-05-10
author: hobby
status: draft
canonical_path: wiki/research/2026-05-10-platform-tools-discord-slack-spotify.md
---

# Platform tools: Discord, Slack, Spotify ... port plan

External integration audit for the three platforms Doug greenlit during
session 15. Findings + a build-vs-lift call per platform + recommended
order of attack. Doug picks the order; I implement.

## What we already have in 2200

The substrate is more built than I'd remembered. Relevant existing
runtime modules:

- `src/runtime/mcp/` ... in-process tool registry. Tools are MCP-shaped
  (`defineTool({ name, description, idempotency, argsSchema, execute })`),
  registered into a per-Agent `ToolRegistry`. New platform tools plug in
  here directly. `tool-grants.ts` already exists ... per-Agent allowlist
  plumbing is in place.
- `src/runtime/oauth/` ... PKCE, redirect-server, refresh-service. Generic
  Authorization Code + PKCE flow. Spotify drops in cleanly.
- `src/runtime/secrets/` and `src/runtime/credentials/` ... credential
  storage with dispatcher, perms, audit records. Bot tokens land here.
- `src/runtime/extensions/` ... Phase A (read-only manifest scanning).
  Phase B (install/uninstall/lifecycle) is the future home for "user
  installs an extension via UI." Not a v1 dependency for these tools.

Implication: we are NOT building substrate. We are adding tool defs +
plugging into the existing OAuth/secrets paths.

## What's in OpenClaw (MIT, code-lift compatible)

OpenClaw is MIT, our codebase is Elastic v2 ... lift direction is open.

**Discord:** `extensions/discord/src/` is a substantial plugin (channel-runtime,
contract APIs, security audit, components, draft-stream, outbound-adapter,
chunk handling). Built for OC's plugin/channel architecture which we don't
have. **Verdict: reference for API call patterns and edge-case handling
(rate-limits, payload chunking), do NOT lift wholesale.** Cherry-pick.

**Slack:** `extensions/slack/src/` ... even larger surface than Discord
(HTTP routes, interactive replies, inbound/outbound contracts, blocks
rendering). Same verdict: reference, don't lift the package shape.

**Spotify:** `skills/spotify-player/SKILL.md` is a markdown skill telling
the agent to shell out to `spogo` or `spotify_player` CLI binaries.
**Not what we want.** We want native Web API calls so Jodin works on any
host without local CLI installs. Skip.

## What's liftable from GitHub (MIT/Apache compatible)

### Discord
| Source | License | Verdict |
|---|---|---|
| `@discordjs/core` + `discord-api-types` | Apache-2.0 + MIT | **Use as deps.** Thin REST/gateway surface; skip full `discord.js` (drags voice/sharding we don't need). |
| `aj-geddes/discord-agent-mcp` | MIT | **Reference-only.** Clean tool decomposition (71 tools split: messages / channels / threads / roles / mod / events). Lift the *shape*, write fresh code. |

### Slack
| Source | License | Verdict |
|---|---|---|
| `@slack/web-api` | MIT | **Use as dep.** Generated typed methods, small surface, current. |
| `stablyai/agent-slack` | MIT, 409 stars, active May 2026 | **Code-lift candidate.** TS-native, agent-shaped already, token-efficient JSON pruning baked in. Strongest of the three platforms for direct lift. |
| `slackapi/bolt-js` | MIT | **Reference-only for events.** Don't lift; framework-shaped. Mirror the request-URL + `ack()` discipline if/when we build incoming Slack events. |

### Spotify
| Source | License | Verdict |
|---|---|---|
| `@spotify/web-api-ts-sdk` v1.2.0 | Apache-2.0 | **Use as dep.** Official, post-Feb-2026-migration, domain-decomposed (`player.*`, `playlists.*`, `library.*`). Plug our PKCE runtime into its `AuthorizationCodeWithPKCEStrategy`. |
| `spotify/web-api-examples/authorization_code_pkce` | Apache-2.0 | **Reference for PKCE wiring** if needed. We already have PKCE; mostly redundant. |
| `spotify-web-api-node` (community) | MIT | **Hard skip.** 5+ years stale, broken against the Feb 2026 API rewrite. Spotify gutted Dev Mode (deadline March 9 2026): removed batch endpoints, browse, public user data; renamed playlist tracks endpoint; consolidated library writes. The community lib doesn't know any of this. |

## Per-platform call

### Discord
- **Deps:** `@discordjs/core` (Apache-2.0) + `discord-api-types` (MIT).
- **Tools to write (v1):** `discord_send_message`, `discord_list_channels`,
  `discord_fetch_history`, `discord_search_messages`, `discord_react`,
  `discord_create_thread`. Six tools covers ~80% of useful Agent surface.
- **Auth:** Bot token, stored in `secrets/`. No OAuth. Bot lives in a single
  Discord app ("2200") owned by Doug's account, invited to whichever
  guilds Agents need access to.
- **Reference reading:** `discord-agent-mcp` for tool granularity decisions;
  OC `extensions/discord/src/` for rate-limit handling and payload
  chunking lessons.

### Slack
- **Deps:** `@slack/web-api` (MIT). Possibly selective lift from
  `stablyai/agent-slack` for the token-efficient response pruning.
- **Tools to write (v1):** `slack_send_message`, `slack_list_channels`,
  `slack_fetch_history`, `slack_search_messages`, `slack_react`,
  `slack_get_user`. Same shape as Discord, mostly.
- **Auth:** Bot token + signing secret, stored in `secrets/`. Slack app
  installed to a specific workspace.
- **Open question:** does Doug want incoming events (Agent reacts when
  someone DMs the bot, or when @mentioned in a channel)? That's
  significant additional scope (Socket Mode or HTTP events endpoint with
  ngrok-style ingress). **My assumption v1: outbound-only. Mention me if
  wrong.**

### Spotify (for Jodin)
- **Deps:** `@spotify/web-api-ts-sdk` (Apache-2.0).
- **Tools to write (v1):** `spotify_search_tracks`, `spotify_get_playback_state`,
  `spotify_play_track`, `spotify_queue_track`, `spotify_pause`,
  `spotify_skip`, `spotify_get_playlists`, `spotify_get_playlist_tracks`,
  `spotify_add_to_playlist`. Read-heavy + basic playback control.
- **Auth:** OAuth 2.0 Authorization Code + PKCE. Doug clicks through once
  per host migration. Token + refresh stored in `secrets/`. Refresh
  service handles rotation.
- **Scopes (initial):** `user-read-playback-state`, `user-read-currently-playing`,
  `user-modify-playback-state`, `playlist-read-private`, `playlist-modify-private`,
  `user-library-read`. Add `playlist-modify-public` if Jodin's pipeline
  needs to publish.
- **Premium gating (load-bearing):** all `/me/player/*` write/control
  endpoints require the **end user** (Doug) to have Premium. Reads work
  for Free. Non-Premium gets HTTP 403 `PREMIUM_REQUIRED`. Scopes don't
  unlock these ... server-side enforcement. Doug confirmed Jodin's use
  case implies Doug has Premium; flagging anyway because the failure mode
  is silent on free-tier users.
- **Dev Mode cap (load-bearing):** apps in Dev Mode after Feb 2026 are
  capped at 5 users per app and the app owner needs Premium. For Jodin
  + Doug only, this is fine. If we ever expose Spotify tools to other
  Agents whose users sign in independently, we hit the cap fast.
  Extended Quota Mode requires a formal application to Spotify.

## Order of attack (recommendation)

1. **Discord first.** Broadest leverage (any Agent can announce, log,
   coordinate via Discord). No OAuth dance ... bot token only. Cleanest
   first integration. Validates the platform-tool registration shape and
   credential plumbing for the next two.

2. **Spotify second.** Specific named use case (Jodin's music pipeline).
   Forces us to wire OAuth callback through the existing PKCE runtime,
   which is the harder of the two auth shapes. Once Spotify works,
   any future OAuth-based platform (Google services, GitHub, etc.) is
   mostly copy.

3. **Slack third.** Same shape as Discord but bigger native API surface
   and the question of incoming events (Socket Mode vs HTTP events) adds
   a design pass we don't need to do today. Land Discord first to set
   the pattern, then Slack inherits the shape.

## Open questions for Doug

1. **Discord:** create a new "2200" app under `dh@2200.ai`, or use an
   existing one if you have it?
2. **Slack workspace:** which workspace, and is there an existing 2200
   app I should reuse?
3. **Slack incoming events:** outbound-only for v1? (My default
   assumption.)
4. **Spotify:** confirming OAuth click-through is acceptable. (You did
   already; restating for the record.)

## Wiring posture (decided, not asked)

- These ship as **built-in tools** (alongside `web_*`, `fs_*`, etc.),
  not as Phase A extensions. Phase B (install lifecycle) doesn't exist
  yet, and these tools don't need install/uninstall semantics for v1.
  When extensions Phase B lands, the tool defs migrate cleanly because
  they're already MCP-shaped.
- **Per-Agent enablement** uses the existing `tool-grants.ts` machinery.
  A platform tool is registered globally but enabled per-Agent via
  `2200 agent grant <name> discord_*` (glob support). Default: no Agent
  has access until granted.
- **Credentials** land in `~/.2200/secrets/<platform>.json` (chmod 600)
  via the existing `secrets/` resolver. Encrypted-at-rest is a later
  epic; v1 trusts filesystem perms on a single-user Mac.

## Licensing record

| Lift | License | Direction | Notes |
|---|---|---|---|
| `@discordjs/core` | Apache-2.0 | dep | Compatible with Elastic v2. |
| `discord-api-types` | MIT | dep | Compatible. |
| `@slack/web-api` | MIT | dep | Compatible. |
| `stablyai/agent-slack` (selective) | MIT | code-lift candidate | Compatible. Attribute in source. |
| `@spotify/web-api-ts-sdk` | Apache-2.0 | dep | Compatible. |
| OC `extensions/discord/src/` | MIT | reference-only | Compatible if lifted later. |
| OC `extensions/slack/src/` | MIT | reference-only | Compatible if lifted later. |

All lifts (when made) get an in-source comment with provenance + license
+ commit SHA at lift time, per the licensing-track-at-all-times
discipline.

## Not in scope for this work

- **MCP server ingestion via UI** (Doug's "human points UX at MCP tool"
  goal) ... the substrate is already in `src/runtime/mcp/` but no UI flow
  exists. Separate work item; doesn't block these three.
- **Voice in Discord** ... not v1.
- **Slack Socket Mode / events endpoint** ... not v1 unless Doug
  overrides.
- **Spotify Web Playback SDK (in-browser playback)** ... not v1; we
  control existing Spotify Connect devices, we don't render audio.
- **OpenClaw bulk tool port** ... separately tracked; this doc covers
  three specific platforms only.
