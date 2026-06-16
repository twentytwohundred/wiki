---
title: "Discord connector"
type: design
status: living
tags: [connectors, discord, setup]
created: 2026-06-16
canonical_path: wiki/design/connectors/discord.md
---

# Discord connector

Give an Agent its own Discord bot. Because Discord users can't DM bots that don't share a server, the Agent's conversation surface is a **channel** ... messages in an allowlisted channel wake the Agent and it replies with its own identity.

## Create the bot (≈5 minutes)

1. Go to **discord.com/developers/applications → New Application.** Name it.
2. **Bot** (left nav) → **Reset Token** → copy the **bot token** (keep it private).
3. On the same Bot page, enable the **Message Content Intent** (under Privileged Gateway Intents). The gateway needs it to read message text.
4. **OAuth2 → URL Generator** → scopes: `bot`; bot permissions: `Send Messages`, `Read Message History` (+ `View Channels`). Open the generated URL to invite the bot to your server.

## Set it up in 2200

1. **Extensions Store → Discord → set up for this Agent.**
2. Paste the bot token, and add at least one **channel id** the Agent should listen in (right-click a channel → Copy Channel ID; enable Developer Mode in Discord settings if you don't see it).
3. Save. 2200 seals the token to the Agent's vault, restarts the Agent, and starts the gateway, which logs in via `discord.js` and connects.

## Talk to it

Post in the allowlisted channel ... the Agent wakes and replies there. Because the channel is dedicated to the Agent, no @-mention is required by default. (DMs work if the bot and user share a server, but the channel is the canonical surface.)

## Behavior + limits

- **Defaults:** `dm_policy: open`, `group_policy: allowlist`, `require_mention: false` (the channel allowlist is the gate).
- A channel id is **required** at setup (unlike Telegram/Slack, where DM is the default surface).
- **Text only** at v1.

## Troubleshooting

- *Agent doesn't respond:* confirm the **Message Content Intent** is enabled, the bot is in the server, and the channel id is in the allowlist. Check the supervisor log for `[discord-gateway]`.
- *Login failed in the log:* the token is wrong or was reset ... copy a fresh token and re-paste.

The token is sealed to the Agent's vault (`discord-bot-token`); the Agent never sees it.
