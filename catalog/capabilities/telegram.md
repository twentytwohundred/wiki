---
id: telegram
label: Telegram
category: chat
description: Send and receive messages on Telegram via a bot.
homepage: https://telegram.org
publisher: first-party
source:
  attribution: openclaw
  openclaw_path: docs/channels/telegram.md
  notes: |
    Walkthrough adapted from OpenClaw's BotFather flow. Translated to
    2200 Capability Catalog shape; credential handoff swapped for
    2200's `request_credential` substrate. OpenClaw is MIT (c) 2025
    Peter Steinberger.
auth:
  - name: TELEGRAM_BOT_TOKEN
    kind: bot_token
    env_var: TELEGRAM_BOT_TOKEN_REF
    obtain_url: https://t.me/BotFather
unlocks:
  tools:
    - telegram_send
    - telegram_read_chat
    - telegram_get_chat_history
    - telegram_react
  skills: []
  extensions:
    - telegram
  providers: []
network_egress:
  domains:
    - api.telegram.org
tags:
  - chat
  - telegram
  - messaging
  - bot
  - dm
  - group
requires:
  bins: []
  os: []
  capabilities: []
walkthrough:
  estimated_minutes: 5
  difficulty: easy
---

# Setup walkthrough

*This walkthrough is for self-hosted 2200 installs. Hosted-tier operators see a different flow that we'll add when the hosted tier ships.*

Telegram's bot setup is the shortest of any chat platform we support. About 5 minutes start to finish. The whole flow happens in the Telegram app itself, chatting with the official BotFather bot.

## Step 1 ... open BotFather

In Telegram, search for `@BotFather`. **Confirm the handle is exactly `@BotFather`** ... there are impersonator bots that look similar and will steal your token if you talk to them. The real one has a verified blue checkmark.

Tap to open the chat.

## Step 2 ... create the bot

Send `/newbot` to BotFather. It will ask:

- **Name**: human-readable display name (e.g. "My 2200 Agent").
- **Username**: must end in `bot` (e.g. `my2200_agent_bot`). This is the @-handle people use to find the bot.

BotFather replies with a message containing your token. It looks like `123456789:ABCDEFghijklmnopQRSTUVWXYZ-0123456789`. **Save it.** This is the only time the token is shown in full ... you can regenerate later via `/token` but the first-shown value is what you want now.

## Step 3 ... paste the token into 2200

When 2200's runtime opens the credential request prompt (in your 1:1 chat with the Agent), paste the token.

The token goes browser → runtime → vault. It never appears in the Agent's LLM context or transcripts.

## Step 4 ... verify

In Telegram, search for your bot by the username you set in Step 2 (e.g. `@my2200_agent_bot`). Open a chat and send any short message ("hi"). The Agent's wake source picks it up and responds.

If nothing happens, check the connector status:

```
2200 extension show telegram
```

## Adding the bot to a group

By default, Telegram bots are in **Privacy Mode** ... they only see messages that @-mention them or are replies to their messages. For most Agent use cases (you @-mention the Agent when you want it), this is the right default.

If your Agent should see ALL group messages (for ambient awareness), either:

- Disable privacy mode: chat with `@BotFather` again, send `/setprivacy`, pick your bot, choose **Disable**.
- OR make the bot a group admin (admin bots receive all messages regardless of privacy mode).

After toggling, **remove and re-add the bot to each affected group** so Telegram applies the new setting.

## What this unlocks

- `telegram_send` ... send a message to a chat or DM.
- `telegram_read_chat` ... fetch recent messages from a chat.
- `telegram_get_chat_history` ... paged read of chat history.
- `telegram_react` ... add an emoji reaction to a message.

## Multi-Agent note (v1 limitation)

Per [[../decisions/2026-05-18-capability-security-model]] § "What we defer to the External-Publisher Epic," credentials are per-Agent at v1. If two Agents both need Telegram, each runs through BotFather and gets its own bot + token.

---

*Setup steps adapted from OpenClaw's `docs/channels/telegram.md` (MIT (c) 2025 Peter Steinberger). Format translated to 2200 Capability Catalog shape.*
