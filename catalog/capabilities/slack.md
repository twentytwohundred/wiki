---
id: slack
label: Slack
category: chat
description: Send and receive messages in a Slack workspace via a bot.
homepage: https://slack.com
publisher: first-party
source:
  attribution: openclaw
  openclaw_path: docs/channels/slack.md
  notes: |
    Walkthrough adapted from OpenClaw's Slack Socket Mode guide. The
    Slack app manifest is lifted near-verbatim because the scope and
    event lists are functionally identical to what 2200's connector
    needs. App name and slash command renamed to 2200. OpenClaw is
    MIT (c) 2025 Peter Steinberger.
auth:
  - name: SLACK_TOKENS
    kind: bot_token_plus_app_token
    env_var: SLACK_TOKENS_REF
    obtain_url: https://api.slack.com/apps/new
unlocks:
  tools:
    - slack_send
    - slack_react
    - slack_read_channel
    - slack_list_channels
    - slack_get_message
    - slack_pin_message
  skills: []
  extensions:
    - slack
  providers: []
network_egress:
  domains:
    - slack.com
    - edgeapi.slack.com
    - hooks.slack.com
    - wss-primary.slack.com
    - wss-backup.slack.com
    - files.slack.com
tags:
  - chat
  - slack
  - messaging
  - bot
  - workspace
  - channel
requires:
  bins: []
  os: []
  capabilities: []
walkthrough:
  estimated_minutes: 10
  difficulty: easy
---

# Setup walkthrough

*This walkthrough is for self-hosted 2200 installs. Hosted-tier operators see a different flow that we'll add when the hosted tier ships.*

This sets up Slack via Socket Mode (the recommended path; no public webhook URL needed). About 10 minutes start to finish. You'll create a Slack app from a copy-paste manifest, generate two tokens, install the app into your workspace, and hand both tokens to 2200.

If you need HTTP Request URL mode (because your workspace policy requires it), the manifest below has an HTTP variant in the second tab section ... ping back once you've got that requirement and I'll walk you through it.

## Step 1 ... create a new Slack app from manifest

Go to [api.slack.com/apps/new](https://api.slack.com/apps/new). Pick **From a manifest**. Select the workspace you want the app installed in. Paste this manifest (replace `2200 Agent` with whatever you want to call your Agent in Slack):

```json
{
  "display_information": {
    "name": "2200 Agent",
    "description": "2200 connector for an Agent on this workspace"
  },
  "features": {
    "bot_user": { "display_name": "2200 Agent", "always_online": true },
    "app_home": {
      "messages_tab_enabled": true,
      "messages_tab_read_only_enabled": false
    },
    "slash_commands": [
      {
        "command": "/2200",
        "description": "Send a message to your 2200 Agent",
        "should_escape": false
      }
    ]
  },
  "oauth_config": {
    "scopes": {
      "bot": [
        "app_mentions:read",
        "assistant:write",
        "channels:history",
        "channels:read",
        "chat:write",
        "commands",
        "emoji:read",
        "files:read",
        "files:write",
        "groups:history",
        "groups:read",
        "im:history",
        "im:read",
        "im:write",
        "mpim:history",
        "mpim:read",
        "mpim:write",
        "pins:read",
        "pins:write",
        "reactions:read",
        "reactions:write",
        "users:read"
      ]
    }
  },
  "settings": {
    "socket_mode_enabled": true,
    "event_subscriptions": {
      "bot_events": [
        "app_mention",
        "channel_rename",
        "member_joined_channel",
        "member_left_channel",
        "message.channels",
        "message.groups",
        "message.im",
        "message.mpim",
        "pin_added",
        "pin_removed",
        "reaction_added",
        "reaction_removed"
      ]
    }
  }
}
```

Click **Next → Create**. Slack creates the app with all 22 bot scopes and 12 events configured.

## Step 2 ... generate the App-Level Token

In the new app's settings, click **Basic Information** in the sidebar. Scroll to **App-Level Tokens** and click **Generate Token and Scopes**:

- **Token Name**: `2200-socket`
- Click **Add Scope** → pick `connections:write`
- Click **Generate**

Copy the token (starts with `xapp-`). This is the **App Token**. Save it.

## Step 3 ... install the app and get the Bot Token

In the sidebar, click **Install App** → **Install to Workspace** → review the scopes Slack shows → **Allow**.

After install, Slack shows a **Bot User OAuth Token** (starts with `xoxb-`). Copy this too. This is the **Bot Token**.

You now have both tokens you need.

## Step 4 ... paste both tokens into 2200

When 2200's runtime opens the credential request prompt (in your 1:1 chat with the Agent), you'll be asked for two values:

- `bot_token` ... the `xoxb-...` you got in Step 3.
- `app_token` ... the `xapp-...` you got in Step 2.

Paste them in. Both go browser → runtime → vault. Neither appears in the Agent's LLM context or transcripts.

## Step 5 ... verify

In Slack, send a DM to the bot ("hello"). The Agent's wake source should pick it up and respond.

If nothing happens:

- Check Slack's **App Home → Messages tab** is enabled (Step 1's manifest enables it; if you edited the manifest, double-check).
- Check the connector status: `2200 extension show slack`.
- Verify the app is installed in the workspace (sometimes the install gets revoked when the workspace admin reviews app installations).

## Add the bot to channels

DMs work out of the box. For channels, invite the bot manually: in any channel where you want the Agent to participate, type `/invite @2200 Agent` (or whatever you named it). Slack adds it to the channel and the Agent can read history + post.

## What this unlocks

- `slack_send` ... post messages to a channel or DM.
- `slack_react` ... add an emoji reaction to a message.
- `slack_read_channel` ... fetch recent messages from a channel.
- `slack_list_channels` ... enumerate channels in the workspace.
- `slack_get_message` ... fetch a specific message by id.
- `slack_pin_message` ... pin a message in a channel.

## Multi-workspace note

This Capability installs ONE Slack app per Agent. If you want one Agent to operate against two separate Slack workspaces, you'll need to install the app into each workspace separately and seal a credential per workspace ... not currently supported in v1 (each Capability holds one credential set). Multi-workspace is a follow-on epic.

## Multi-Agent note (v1 limitation)

Per [[../decisions/2026-05-18-capability-security-model]] § "What we defer to the External-Publisher Epic," credentials are per-Agent at v1. Two Agents both needing Slack each install their own app + tokens.

---

*Setup steps and the Slack app manifest adapted from OpenClaw's `docs/channels/slack.md` (MIT (c) 2025 Peter Steinberger). Manifest unchanged structurally; app name + slash command renamed.*
