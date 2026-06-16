---
title: "Connector gateways are dependency-free where the platform API allows"
type: decision
status: locked
tags: [decision, connectors, telegram, slack, bundling]
created: 2026-06-16
canonical_path: wiki/decisions/2026-06-16-connectors-dependency-free-gateways.md
---

# Connector gateways are dependency-free where the platform API allows

**Decision (Doug, 2026-06-16):** Build Telegram and Slack connectors to Discord parity, regardless of any single migrant ... Telegram is the most-used surface among self-hosters (next to WhatsApp), so it's a hedge against mass adoption, not a one-off. Prefer **dependency-free gateways** (raw platform API over `fetch` / the Node global `WebSocket`) so each connector bundles into the published npm package.

## Why dependency-free matters

The connector framework (`connectors/gateway-manager.ts`, `router.ts`, `inbound-types.ts`) is platform-agnostic. A connector adds: an `apps/<id>-connector/` gateway, a `baseline/<id>.ts` send tool, a catalog entry, a `bundle-connectors.mjs` entry, and (for `bot_token`/`account_scope: agent`) the per-Agent setup endpoint branch.

The bundling step (`scripts/bundle-connectors.mjs`, esbuild → `dist/connectors/<id>/gateway.cjs`) is what makes a connector ship in `npm install`-ed 2200. A gateway with heavy native/CJS-dynamic-require deps doesn't bundle cleanly:

- **Discord** uses `discord.js` (heavy; pulls optional native accelerators marked external) ... it bundles, but is the exception.
- **WhatsApp** uses Baileys ... does **not** bundle, so it's dev-only (workspace path), not in npm. See [[../design/connectors/whatsapp]].
- **Telegram** is raw Bot API over `getUpdates` long-poll + `sendMessage` ... zero deps, bundles to ~12 KB self-contained CJS.
- **Slack** is Socket Mode over the Node global `WebSocket` (Node ≥22) + raw Web API over `fetch` ... zero deps, bundles cleanly. We deliberately did **not** use `@slack/socket-mode`/`@slack/web-api` (the latter is already a dead dependency the `slack_api` tool ignores).

## Shape (what's shipped, 2026-06-16)

- **Telegram** (`2026.616.1748`): one bot token; long-poll inbound; `sendMessage` outbound with 4096-char chunking; backlog discard on start (no replay); mention detection from `entities`; `dm_policy: open` (a personal bot's @username isn't discoverable, and pairing has no approval UI yet). Group chat ids are negative ... the setup allowlist regex was loosened to `^-?\d+$`, then `^-?[A-Za-z0-9_]{1,64}$` for Slack.
- **Slack** (`2026.616.1830`): **two** tokens ... app-level `xapp-` (opens the Socket Mode socket) + bot `xoxb-` (auth + send). The binding `credentials` map already supports N keys; `resolveCredentialEnv` injects each as `SLACK_<KEY>`. Inbound via `apps.connections.open` → WebSocket → `events_api` envelopes (ACK'd <3s); outbound `chat.postMessage`. DM-friendly defaults like Telegram.

Both tokens are sealed per-Agent in the encrypted vault; the gateway holds the token, injected only at spawn. The Agent/LLM never see it.

## Consequences

- Adding a connector for a plain-HTTP platform = mirror Telegram. For a WebSocket platform = mirror Slack (global `WebSocket`). Only reach for an SDK (and accept dev-only, or do the bundling work) when the platform forces it.
- **WhatsApp is the outstanding gap:** bundle Baileys, or move to the WhatsApp Business Cloud API / Twilio (token-based, bundles like the others).
- Slack's `@slack/web-api` dependency + `tools/platform/slack/client.ts` `SlackClient` class are dead ... cleanup follow-up.

See [[2026-05-16-connector-extensions]], [[2026-05-16-connector-per-agent-identity]], and [[../design/connectors/README]].
