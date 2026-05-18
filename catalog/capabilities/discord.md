---
id: discord
label: Discord
category: chat
description: Send and receive messages in a Discord server via a bot.
homepage: https://discord.com
publisher: first-party
source:
  attribution: openclaw
  openclaw_path: docs/channels/discord.md
  notes: |
    Walkthrough adapted from OpenClaw's 8-step Discord setup guide.
    Format translated to 2200 Capability Catalog shape; CLI commands
    swapped for 2200's `credential_request` substrate. OpenClaw is
    MIT (c) 2025 Peter Steinberger.
auth:
  - name: DISCORD_BOT_TOKEN
    kind: bot_token
    env_var: DISCORD_BOT_TOKEN_REF
    obtain_url: https://discord.com/developers/applications
unlocks:
  tools:
    - discord_send
    - discord_react
    - discord_read_channel
    - discord_list_channels
    - discord_get_message
  skills: []
  extensions:
    - discord
  providers: []
network_egress:
  domains:
    - discord.com
    - gateway.discord.gg
    - cdn.discordapp.com
tags:
  - chat
  - discord
  - messaging
  - bot
  - dm
  - server
  - guild
requires:
  bins: []
  os: []
  capabilities: []
walkthrough:
  estimated_minutes: 8
  difficulty: easy
---

# Setup walkthrough

*This walkthrough is for self-hosted 2200 installs. Hosted-tier operators see a different flow that we'll add when the hosted tier ships.*

You'll create a Discord application with a bot user, add the bot to a server you control, and hand the bot token to 2200. About 8 minutes start to finish. Recommended: use a private server you own (just you + the bot) rather than a busy public server ... it's easier to test and reason about who's seeing what.

## Step 1 ... create a Discord application and bot

Go to the [Discord Developer Portal](https://discord.com/developers/applications) and click **New Application**. Name it something recognizable like "2200 Agent" (or your Agent's name).

Click **Bot** in the sidebar. Set the **Username** to whatever you want the bot to be called in Discord.

## Step 2 ... enable privileged intents

Still on the **Bot** page, scroll to **Privileged Gateway Intents** and enable:

- **Message Content Intent** (required ... without this the bot can't read message text)
- **Server Members Intent** (recommended ... required if you want @-mention resolution by name to work)
- **Presence Intent** (optional ... only enable if you actually need presence updates)

## Step 3 ... reset and copy the bot token

Scroll up on the **Bot** page and click **Reset Token**.

*Despite the name, this generates your first token. Nothing is being "reset." Discord just calls it that.*

The portal shows the token once. Copy it now ... if you navigate away, you'll need to reset again to see it.

## Step 4 ... generate an invite URL and add the bot

In the sidebar, click **OAuth2 → URL Generator**.

Enable these scopes:

- `bot`
- `applications.commands`

A **Bot Permissions** section appears. Enable the baseline:

- **General**: View Channels
- **Text**: Send Messages, Read Message History, Embed Links, Attach Files, Add Reactions

If your Agent will post in threads (forum/media channels), also enable **Send Messages in Threads**.

Copy the URL at the bottom of the page. Paste it into a new browser tab, pick your server, and click **Authorize**. The bot now appears in your server's member list.

## Step 5 ... enable Developer Mode and grab your IDs

In Discord (the app, not the portal), enable Developer Mode so you can copy internal IDs:

- **User Settings** (gear icon) → **Advanced** → toggle **Developer Mode** on.

Then, right-click your **server icon** in the sidebar → **Copy Server ID**. Save it.

Right-click your **own avatar** → **Copy User ID**. Save it.

You don't strictly need these for the basic bot flow, but 2200 will ask for them later when you set up direct-mention routing and channel allowlists.

## Step 6 ... allow DMs from server members

For the bot to DM you (which is how the first pairing works), right-click your **server icon** → **Privacy Settings** → toggle **Direct Messages** on.

You can turn this off later once pairing is done.

## Step 7 ... paste the bot token into 2200

When 2200's runtime opens the credential request prompt (in your 1:1 chat with the Agent, per the [[../decisions/2026-05-14-request-credential-substrate]] surface restriction), paste the bot token you copied in Step 3.

The token goes browser → runtime → vault. It never appears in the Agent's LLM context or in transcripts.

## Step 8 ... verify

DM the bot in Discord with any short message ("ping"). The Agent's wake source should pick up the message and respond.

If nothing happens after ~30 seconds, check the connector status:

```
2200 extension show discord
```

The most common Step 8 problem is forgetting to enable **Message Content Intent** in Step 2. Without it, the bot receives messages but the content field is empty.

## What this unlocks

- `discord_send` ... post messages to a channel or DM.
- `discord_react` ... add an emoji reaction to a message.
- `discord_read_channel` ... fetch recent messages from a channel.
- `discord_list_channels` ... enumerate channels in a server.
- `discord_get_message` ... fetch a specific message by id.

## Multi-Agent note (v1 limitation)

Per [[../decisions/2026-05-18-capability-security-model]] § "What we defer to the External-Publisher Epic," credentials are per-Agent at v1. If two Agents on this instance both need their own Discord bots, each runs through this walkthrough independently. (Sharing a single bot across Agents is also a separate feature ... right now one bot serves one Agent.)

---

*Setup steps adapted from OpenClaw's `docs/channels/discord.md` (MIT (c) 2025 Peter Steinberger). Format translated to 2200 Capability Catalog shape; credential-handoff flow swapped for 2200's `request_credential` substrate.*
