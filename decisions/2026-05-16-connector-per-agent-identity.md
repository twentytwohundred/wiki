---
title: "Per-Agent connector identity ... Discord ships per-Agent; WhatsApp stays per-account at v1"
type: decision
status: accepted
date: 2026-05-16
accepted_by: doug
accepted_at: 2026-05-16
tags: [decision, extensions, connectors, discord, whatsapp, telegram, identity, multi-agent]
canonical_path: wiki/decisions/2026-05-16-connector-per-agent-identity.md
linked_docs:
  - "[[2026-05-16-connector-extensions]]"
  - "[[2026-05-16-connector-store]]"
---

# Per-Agent connector identity

## Context

The first WhatsApp Inbox build went live this afternoon. End-to-end pairing works (Store install, QR-in-browser, Baileys gateway, allowlist routing, inbound + outbound). When Doug tested it, he surfaced a fundamental UX mismatch: he expected to **chat with each Agent independently** in WhatsApp ("DM Simon, DM Jodin, each one is a separate contact"). The WhatsApp connector cannot do this without one paired phone number per Agent ... WhatsApp's identity model is one phone number = one user. There is no "bot user under your account" abstraction.

The thing we shipped is structurally an **inbox automator**: pair your phone, one Agent reads + replies to incoming messages from allowlisted senders. Useful niche (vacation responder, customer-service triage, family-message screening). Not what Doug wants for "chat with my Agents."

## Decision

Connectors split into two identity models, ship in this order:

### Per-Agent-identity connectors (the chat-with-each-Agent model)

- **Discord** (next build).
- **Telegram** (after Discord).
- **Slack** (later; OAuth-heavy).

Each Agent gets its own bot identity in the platform. Doug's personal account DMs each bot independently; the bots reply with their own name + identity. Multiple Agents = multiple bots = multiple parallel chat threads.

Architecture for these:
- Gateway is keyed by `(extension_id, agent_name)`, not just `extension_id`. The Extension is installed once; gateways spawn per Agent that wants the connector.
- Agent Identity binding references a vault credential by name: `credentials: { bot_token: 'discord-bot-token' }`. The token is sealed into the per-Agent vault during install (same envelope as `credential_request`); never lives in the Identity or any other Identity-visible surface.
- Store install flow grows a **"which Agent is this bot for?"** step before the auth walkthrough. Same Extension can be installed for multiple Agents back-to-back from the same install card.

### Per-account-identity connectors (the inbox-automator model)

- **WhatsApp Inbox** (already shipped, renamed today).
- Future Twilio-backed WhatsApp variant (different connector id, ships when the multi-Agent demand materializes).

These pair an entire account; one Agent triages inbound from allowlisted senders. Identity is the operator's, not the Agent's. Useful for the "let an AI handle my inbox" niche.

Architecture for these:
- Gateway is keyed by `extension_id` only (the v1 substrate as-shipped).
- Identity binding has no `credentials` field (the operator's account credential is global to the connector, not per-Agent).
- Store install flow is single-step (pair the account, pick the bound Agent in a follow-on step).

## WhatsApp's future expansion path

WhatsApp's "chat with each Agent independently" model is achievable via **one phone number per Agent**. This requires the operator to own/rent multiple WhatsApp-eligible phone numbers. Two routes:

1. **Twilio-backed WhatsApp Business API.** Operator rents Twilio numbers, each Agent gets one, paired through Twilio's WhatsApp Business sandbox or production API. Adds a per-message cost meter. Pretty clean technically; the constraint is that Twilio + Meta Business approval are external dependencies.
2. **Multi-account Baileys.** The gateway supports multiple paired accounts simultaneously, each owning a different Agent's identity. Cheaper but operationally fiddly (separate phone for each, against WhatsApp ToS more visibly).

Doug's framing on this: real OpenClaw users use WhatsApp daily; day-1 launch should support both the inbox-automator AND the per-Agent path. The Twilio route ships as a separate connector entry in the catalog when the substrate work lands.

For now, the WhatsApp Inbox connector is a deliberate slice, not a half-built thing. Operators who need per-Agent WhatsApp wait for the Twilio variant. Operators who want inbox-triage have a working solution today.

## Discord-specific build notes (the next connector)

User-side setup (target: 5 minutes):
1. Install Discord from the Store.
2. Permissions + ToS modal (same shape as WhatsApp Inbox).
3. **Pick which Agent** (dropdown, all Agents on this instance). One bot = one Agent.
4. Walkthrough panel: "Create a Discord application."
   - Numbered steps with screenshots.
   - Link to `https://discord.com/developers/applications`.
   - "Name your application after your Agent (e.g. Simon)."
   - Bot tab → Add Bot → Reset Token → Copy.
5. Paste-token input (masked; goes straight to the picked Agent's vault). Token never touches the loop, the Identity, or any Identity-visible surface ... it lives in the credential vault we already built for `credential_request`.
6. **Invite link.** Auto-generated from the application ID for a DM-only bot. Operator clicks → Discord prompts "Add this bot to a server" → operator picks their server (or creates a private one).
7. Gateway spawns. Bot connects to Discord with the Agent's identity. The Store card flips to "Connected ✓ ... DM <agent-name> in Discord to start chatting."
8. "Install another?" CTA loops back to step 3 with a different Agent picker selection. Same Extension, second gateway.

Discord-specific platform quirks the substrate has to handle:
- Bots can only DM users they share a server with (or who have explicitly DM'd them first). The invite step is load-bearing for first-message UX.
- Discord rate limits are real; the gateway honors them.
- The gateway-info file is now keyed by (extension, agent), not just extension. The outbound `discord_send` tool looks up the Agent-specific gateway port.

## The cross-Agent delegation insight (already supported)

Doug's specific use case: "DM Simon in Discord. Simon needs an answer from Jodin. Simon asks Jodin on 2200. Jodin replies. Simon synthesizes + replies to me in Discord." This works in the existing runtime today via the `task_create_for_agent` baseline tool (shipped May 12). Simon's loop receives the Discord-inbound task; if it needs Jodin's input it calls `task_create_for_agent`; delegation provenance carries through; Jodin's completion fires a passive-tier notification back to Simon; Simon synthesizes + replies via `discord_send`. The Discord connector layer is the only missing piece.

## What this decision does not commit to

- Slack and Telegram concrete UX flows. The "per-Agent-identity" model applies but the auth specifics (OAuth for Slack, BotFather token for Telegram) land in their own per-connector decisions.
- The Twilio-backed WhatsApp variant. Tracked as a future epic; ships when the per-Agent WhatsApp demand materializes (likely a v1.x feature for launch).
- Multi-tenant identity mapping (separate humans on the same 2200 instance with their own connector preferences). Still v1.x.

## Done when

- WhatsApp Inbox is renamed in the catalog + manifest ... ✅ done today.
- The Discord connector ships per the build notes above.
- A user can install Discord for Simon, paste a bot token, invite the bot to a server, and DM Simon directly in Discord with no terminal involvement.
- A user can install Discord for Jodin separately and DM Jodin independently.
- Simon, while DMing the user, can delegate to Jodin via `task_create_for_agent` and synthesize the response back through Discord.

— Hobby, 2026-05-16
