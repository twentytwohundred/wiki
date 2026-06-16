---
title: "Slack connector"
type: design
status: living
tags: [connectors, slack, setup]
created: 2026-06-16
canonical_path: wiki/design/connectors/slack.md
---

# Slack connector

Give an Agent its own Slack bot. DM it or @-mention it in a channel ... it wakes and replies with its own identity. Inbound runs over **Socket Mode** (a WebSocket), so there's no public URL to provision; the gateway is dependency-free and ships in the published package.

> Slack has both a connector (this doc ... a human messages the Agent and it wakes) and a separate `slack_api` tool (the Agent calls the Slack Web API with a single workspace token). They're independent. This doc is the connector.

## Create the Slack app (≈5 minutes)

1. Go to **api.slack.com/apps → Create New App → From scratch.** Name it, pick your workspace.
2. **Socket Mode** (left nav) → toggle **Enable Socket Mode** on. When prompted, generate an **App-Level Token** with the `connections:write` scope ... this is the `xapp-…` token.
3. **OAuth & Permissions → Bot Token Scopes**, add: `chat:write`, `app_mentions:read`, `im:history`, `im:read`, `im:write`, `channels:history` (add `groups:history`/`mpim:history` if you'll use private channels/group DMs).
4. **Event Subscriptions** → toggle **Enable Events** on (with Socket Mode, no request URL is needed) → under **Subscribe to bot events** add: `message.im`, `app_mention`, `message.channels` (and `message.groups`/`message.mpim` as needed).
5. **Install App** (OAuth & Permissions → Install to Workspace) → copy the **Bot User OAuth Token** ... the `xoxb-…` token.

You now have **two tokens**: `xapp-…` (app-level, opens the socket) and `xoxb-…` (bot, sends + identifies).

## Set it up in 2200

1. **Extensions Store → Slack → set up for this Agent.**
2. Paste **both** tokens ... the app token (`xapp-`) and the bot token (`xoxb-`).
3. Save. 2200 seals both to the Agent's vault, restarts the Agent, and starts the gateway. The gateway runs `auth.test`, opens a Socket Mode connection via `apps.connections.open`, and starts receiving events.

## Talk to it

- **DM:** message the bot directly (it appears under Apps). The Agent wakes and replies. DMs are **open by default** to workspace members.
- **Channel:** invite the bot (`/invite @yourbot`), add the channel id (`C…`) to the Agent's group allowlist, and **@-mention** the bot. Slack channel ids are alphanumeric (`C…` channels, `D…` DMs, `G…`/private).

## Behavior + limits

- **Defaults:** `dm_policy: open`, `group_policy: allowlist`, `require_mention: true` in channels.
- **Reconnect:** Socket Mode connections rotate; the gateway re-opens automatically on `disconnect`/close with backoff.
- **Long replies** auto-split (~3500 chars/message for readability).
- **Text only** at v1.

## Troubleshooting

- *Agent doesn't wake on a DM:* confirm both tokens were pasted, the bot is installed to the workspace, and `message.im` is subscribed under Event Subscriptions. Check the supervisor log for `[slack-gateway]`.
- *Nothing in a channel:* the bot must be invited to the channel, the channel id must be in the allowlist, and you must @-mention it.
- *`not_authed`/`invalid_auth` in the log:* a token is wrong or lacks scopes ... re-check the Bot Token Scopes + App-Level Token scope (`connections:write`) and re-paste.

Both tokens are sealed to the Agent's vault (`slack-bot-token`, `slack-app-token`); the Agent never sees them.
