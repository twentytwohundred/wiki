---
title: "Connectors"
type: design
status: living
tags: [connectors, extensions, design]
created: 2026-06-16
canonical_path: wiki/design/connectors/README.md
---

# Connectors

A **connector** lets a human reach an Agent on a chat platform they already use ... they DM the Agent (or @-mention it in a group/channel) and it wakes, runs a turn, and replies with its own identity. Connectors are installed per-Agent from the Extensions Store.

Every connector is the same shape:

- A **gateway** ... a small long-lived process the supervisor launches per `(connector, Agent)`. It holds the bot token, receives inbound messages, normalizes them, and POSTs them to the supervisor; it also exposes a tiny local HTTP listener the Agent's `<connector>_send` tool calls for outbound.
- A **send tool** (`telegram_send`, `discord_send`, `slack_send`) the Agent uses to reply.
- The **router** + per-Agent policy (DM/group allowlists, `require_mention`) decide whether an inbound message wakes the Agent.

The bot token never lands in a plaintext file ... it's sealed to the Agent's encrypted vault during setup and injected into the gateway only at spawn. The Agent (and the LLM) never see it.

## Available connectors

| Connector | Status | Inbound transport | Tokens | Ships in npm |
|---|---|---|---|---|
| [Discord](discord.md) | live | discord.js (WebSocket gateway) | one bot token | yes |
| [Telegram](telegram.md) | live | Bot API long-poll | one bot token | yes |
| [Slack](slack.md) | live | Socket Mode (WebSocket) | app token + bot token | yes |
| [WhatsApp](whatsapp.md) | dev-only | Baileys (WhatsApp Web) | QR pair | no (workspace only) |

Telegram and Slack gateways are **dependency-free** (raw platform API over `fetch`, plus the Node global `WebSocket` for Slack), so they bundle into the published npm package and run behind NAT with no public URL.

## How setup works (any bot-token connector)

1. Create the bot on the platform and get its token(s) (see the per-connector doc).
2. In 2200, open **Extensions Store → <connector> → set up for this Agent**, paste the token(s), and (for Discord) the channel id(s).
3. 2200 seals the token(s) to that Agent's vault, writes the binding to the Agent's identity, restarts the Agent, and launches the gateway.
4. Message the bot. The Agent wakes and replies.

The gateway restarts automatically on daemon boot (`recoverGateways`), and only one gateway holds a given bot token at a time.

See the decision records: [[2026-05-16-connector-extensions]], [[2026-05-16-connector-per-agent-identity]], [[2026-06-16-connectors-dependency-free-gateways]].
