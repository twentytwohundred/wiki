---
title: "Telegram connector"
type: design
status: living
tags: [connectors, telegram, setup]
created: 2026-06-16
canonical_path: wiki/design/connectors/telegram.md
---

# Telegram connector

Give an Agent its own Telegram bot. DM it, or add it to a group ... it wakes and replies with its own identity. Telegram is the most-used chat surface among self-hosters, and the gateway is dependency-free (raw Bot API over `getUpdates` long-polling + `sendMessage`), so it runs behind NAT with no public URL and ships in the published package.

## Create the bot (≈1 minute)

1. In Telegram, open a chat with **@BotFather**.
2. Send `/newbot`. Choose a display name, then a username (must end in `bot`, e.g. `dana_assistant_bot`).
3. BotFather replies with a **token** like `123456789:ABCdef...`. That's the whole secret ... keep it private.

Optional, for groups: send `/setprivacy` → select your bot → **Disable** if you want the bot to see all group messages (by default a group bot only sees @mentions, replies to it, and commands). After changing privacy, remove and re-add the bot to the group.

## Set it up in 2200

1. **Extensions Store → Telegram → set up for this Agent.**
2. Paste the bot token.
3. Save. 2200 seals the token to the Agent's vault, restarts the Agent, and starts the gateway. Within a few seconds the gateway calls `getMe`, learns the bot's identity, and begins long-polling.

## Talk to it

- **DM:** open your bot (search its @username), send a message. The Agent wakes and replies. DMs are **open by default** ... a personal bot's @username isn't discoverable unless you share it. To lock it down, set a DM allowlist of user ids in the Agent's connector policy.
- **Group:** add the bot to a group, then add the **group chat id** to the Agent's group allowlist. In groups the Agent only responds when **@-mentioned** (or replied to). Group chat ids are negative (e.g. `-1001234567890`).

### Finding a chat id

DM the bot once; the gateway sees `message.chat.id` (for a DM, this equals your user id). For a group, the chat id is the negative number on the group's messages. (A quick manual check: `curl "https://api.telegram.org/bot<token>/getUpdates"` and read `result[].message.chat.id`.)

## Behavior + limits

- **Defaults:** `dm_policy: open`, `group_policy: allowlist`, `require_mention: true` in groups.
- **No replay:** on (re)start the gateway discards the backlog, so a restart doesn't re-answer old messages.
- **Long replies** auto-split at Telegram's 4096-char limit.
- **One consumer per token:** only the gateway polls a given bot token. Don't run `getUpdates` elsewhere against the same token (Telegram returns `409 Conflict`).
- **Text only** at v1 (media in/out is deferred).

## Troubleshooting

- *Agent doesn't respond to a DM:* confirm the connector is set up for **that** Agent and the gateway is running (`2200 daemon status`; check the supervisor log for `[telegram-gateway]`).
- *Nothing in a group:* the bot must be @-mentioned, the group chat id must be in the allowlist, and privacy mode may be hiding messages (disable it in BotFather + re-add).
- *`401 Unauthorized` in the log:* the token is wrong or was revoked ... regenerate via BotFather (`/token`) and re-paste.

The token is sealed to the Agent's vault (`oc-...`/`telegram-bot-token`); you never see it again, and neither does the Agent.
