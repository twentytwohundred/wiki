---
title: "WhatsApp connector"
type: design
status: dev-only
tags: [connectors, whatsapp, setup]
created: 2026-06-16
canonical_path: wiki/design/connectors/whatsapp.md
---

# WhatsApp connector

Let an Agent triage a WhatsApp inbox. You pair your number (scan a QR), and the Agent reads incoming DMs from allowlisted senders and can reply on your behalf ... a vacation responder, customer-service triage, or family-ping screening.

> **Status: dev-only.** The WhatsApp gateway is built (`apps/whatsapp-connector`, backed by the open-source Baileys WhatsApp-Web library) but is **not bundled into the published npm package** ... Baileys' native/optional dependencies don't bundle cleanly the way the dependency-free Telegram/Slack gateways do. So today WhatsApp runs only from a workspace checkout, not from a `npm install`-ed 2200. Telegram is the recommended phone-based surface until WhatsApp ships.

## How it works (dev checkout)

1. **Extensions Store → WhatsApp Inbox → set up** ... this is a `qr_pair` connector, so there's no token to paste.
2. The gateway prints a **QR code** (in the Store UI and the terminal). Open WhatsApp on your phone → **Linked Devices → Link a Device** → scan it.
3. Once paired, inbound DMs from allowlisted senders wake the Agent; it can reply with `whatsapp_send`.

## Caveats

- WhatsApp's Terms of Service forbid unofficial clients for commercial use and bulk/spam behavior; accounts that trip Meta's spam detection can be banned. You own compliance ... 2200 is not a party to your relationship with WhatsApp.
- v1 is text DM in/out, single paired number.

## To productionize (open work)

Either bundle Baileys (resolve the native-dependency externals so it ships in npm), or move to the official WhatsApp Business Cloud API / a Twilio path (a token-based connector that bundles like the others). Tracked as connector follow-up work.
