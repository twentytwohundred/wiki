---
title: "Connector Extensions ... the contract for messaging-platform integrations"
type: decision
status: accepted
date: 2026-05-16
accepted_by: doug
accepted_at: 2026-05-16
tags: [decision, extensions, connectors, whatsapp, slack, discord, telegram, security, marketplace]
canonical_path: wiki/decisions/2026-05-16-connector-extensions.md
linked_docs:
  - "[[12-extensions-framework]]"
  - "[[11-skills-ingestion]]"
  - "[[2200-operating-thesis]]"
  - "[[02-architecture]]"
---

# Connector Extensions ... the contract for messaging-platform integrations

## Context

Per the 2026-05-16 strategic redirect by Doug: 2200 is in good enough shape that the next user-facing unlock is *meeting users where they already live.* Specifically, four messaging channels:

1. **WhatsApp** ... where Doug's brother Geoff lives.
2. **Telegram** ... where a large slice of the global user base lives.
3. **Discord** ... where the developer / community segment lives.
4. **Slack** ... where the working-professional segment lives.

Doug's framing: until these channels work, 2200 is a developer tool. After they work, it's a product that a non-technical user (Dana, Geoff) can use every day. That is the bar for "ready for someone outside the seed circle to use."

Doug's second framing: this is **not v0** scope. Several prerequisites land first ... migration assistant for OpenClaw → 2200, npm-installable packaging, Heisenberg migration. But the substrate for connectors can start now, with WhatsApp as the proving ground.

Doug's third framing, which reshapes the whole problem: **connectors are an attack surface.** Users who install 2200 should not have *any* connector code on disk unless they've explicitly opted in. Default install = zero connectors, zero webhook endpoints exposed, zero credentials at rest for platforms the user does not use. If a user wants WhatsApp, they install the WhatsApp connector. If they don't, the WhatsApp code does not exist on their machine.

This is exactly the **Extensions framework** path. Per [[12-extensions-framework]], Extensions ship as opt-in installable units with declared permissions, an install-time prompt flow, per-Extension state, and lifecycle hooks. Phase B is shipped (substrate exists at `src/runtime/extensions/`). What is missing is the connector-specific contract that sits on top of the Extension framework.

## Decision

**Connectors are Extensions.** Every messaging-platform integration ships as a first-party Extension following a documented "connector contract." Default 2200 installs ship with zero connectors. Users install the connectors they want from a Connector Store. Each connector is portable, sandboxed by the Extension permissions model, and can be disabled or uninstalled without ripple effects in the rest of the runtime.

**WhatsApp is the first connector,** delivered via the `Baileys` WhatsApp Web library (lifted as a pattern from OpenClaw, who already proved the 15-minute QR-scan setup model works at scale). Telegram, Discord, Slack follow in that order once the substrate is validated.

The Connector Store ships as a CLI surface in v1 (`2200 connector list / install / uninstall / status`) and gains a web surface in v1.x (post-PR-200 follow-on epic).

## The connector contract (load-bearing)

Every connector Extension declares:

### Manifest additions

The existing Extension manifest at `src/runtime/extensions/types.ts` (`ExtensionManifestSchema`) gains an optional `connector` block:

```ts
connector?: {
  /** Stable id used by Agent Identity bindings (e.g. 'whatsapp', 'slack'). */
  id: string;
  /** Display label for the Connector Store + status UIs. */
  label: string;
  /** One-line description shown in the Store list view. */
  blurb: string;
  /** Docs anchor; rendered as a link in the Store + install flow. */
  docs_path: string;
  /** Auth model the operator will see at install time. */
  auth_model: 'qr_pair' | 'oauth' | 'bot_token' | 'api_key';
  /** ToS posture string the user must explicitly acknowledge at install time. */
  tos_acknowledgment?: string;
}
```

Connectors that declare a `connector` block are eligible for the Connector Store. Non-connector Extensions (Voice, Skills) are not.

### Gateway lifecycle hook

Connectors need a long-running process to maintain the platform connection (WhatsApp socket, Slack Events subscription, Discord gateway WS, Telegram webhook receiver). The Extension framework gains a fourth lifecycle hook beyond `install` / `uninstall` / `update`:

```
hooks: {
  gateway: { script: './gateway.js', restart_policy: 'always' | 'on_demand' }
}
```

The supervisor spawns the gateway script when the Extension is installed AND at least one Agent declares a binding to this connector's `id`. The supervisor manages its lifecycle the same way it manages Agent processes ... heartbeat, auto-respawn (with a budget), graceful SIGTERM on uninstall. Gateway processes run with the permissions the Extension was granted at install time (no escalation possible).

### Inbound wake source

The gateway converts platform-specific inbound events to a uniform shape and POSTs them to a per-Extension HTTP endpoint that the supervisor mounts at install time:

```
POST /api/v1/extensions/<connector_id>/inbound
```

The supervisor's inbound handler:

1. Verifies the request came from the locally-running gateway (loopback-only socket OR a shared install-time secret).
2. Looks up which Agent the inbound event is bound to (Identity binding ... see below).
3. Creates a synthetic task on that Agent with `source.kind = 'connector'` and the normalized event payload as context.
4. The Agent's wake-source mirror (`ConnectorWakeSource`, mirror of `PubWakeSource`) picks up the task and starts the loop.

The event payload is **normalized** to a uniform envelope before it touches the Agent. The connector's gateway is the only thing that knows platform specifics; everything downstream sees:

```ts
{
  connector_id: 'whatsapp' | 'slack' | 'discord' | 'telegram';
  kind: 'message' | 'reaction' | 'system';
  conversation: {
    id: string;           // platform-native id (e.g. WhatsApp JID, Slack channel id)
    kind: 'dm' | 'group';
    display_name?: string;
  };
  sender: {
    id: string;
    display_name?: string;
    is_self: boolean;     // true if sender == bot identity
  };
  text?: string;          // normalized text body (media → placeholder strings)
  attachments?: Array<{ kind: 'image' | 'video' | 'audio' | 'document'; url: string }>;
  reply_to?: { id: string; text?: string; sender?: string };
  received_at: string;    // ISO 8601
}
```

Connector-specific extras (WhatsApp reaction emojis, Slack thread_ts, etc.) ride in an opaque `platform_extras` field. Agents do not parse platform_extras; the connector's own outbound tool reads it when the Agent calls reply.

### Identity binding

Agents that listen on a connector declare it in their Identity frontmatter:

```yaml
connectors:
  - connector_id: whatsapp
    account: default                 # for multi-account setups; default if absent
    allowlist:
      dm: ['+15551234567']           # E.164 numbers / handles
      group: []                      # empty = no groups; '*' = all groups
    policies:
      dm_policy: 'allowlist'         # 'allowlist' | 'pairing' | 'open' | 'disabled'
      group_policy: 'allowlist'
      require_mention: true          # groups only
```

The supervisor's inbound handler reads the bindings, matches the inbound event's `conversation.id` and `sender.id` against allowlists/policies, and routes (or drops) accordingly. **Default for an Agent with no `connectors:` block: ignore all inbound from all connectors.** Connectors do not implicitly subscribe Agents.

### Outbound tools

Each connector ships its own outbound tool (or family) following the platform-passthrough pattern from 2026-05-11:

- `whatsapp_send` ... send a message via the WhatsApp gateway
- `slack_send` ... already exists
- `discord_send` ... already exists
- `telegram_send` ... new

The tool's `execute` does NOT talk to the platform directly. It POSTs to the connector's gateway:

```
POST http://127.0.0.1:<gateway_port>/outbound
```

The gateway owns the platform socket and serializes outbound sends. This gives us:
- One reconnect loop per connector, not per Agent.
- Outbound rate-limit enforcement at the gateway (platform-friendly).
- Outbound observability (`tool event` stream sees the call, the gateway logs the wire-level result).
- Crash isolation ... gateway dies, Agent's tool call fails cleanly, supervisor respawns the gateway, next call works.

### Permissions

Connectors typically need the existing permission categories:

- `network` ... to talk to the platform.
- `tools` ... to register the outbound tool.
- `notifications` ... to surface install-time prompts (QR scan, pairing approvals, ToS warnings, expired auth).
- `fs.scratch` ... for the gateway's working state (auth tokens, reconnect cache).
- `brain.read` ... optional; some connectors might want to surface "this thread" context from the Agent's brain. v1 says no by default.

**No new permission category needed.** The closed set from Phase A is sufficient.

## WhatsApp via Baileys (the first build)

**Library:** `@whiskeysockets/baileys` (the same library OpenClaw uses ... proven 15-minute QR-scan setup). Pattern-lifted from OC's `extensions/whatsapp/`; no code lifted.

**Auth model:** `qr_pair`. Install flow:

1. User runs `2200 connector install whatsapp` (or installs from npm: `2200 connector install @2200/whatsapp`).
2. Manifest validated. Permissions prompt: `network`, `tools`, `notifications`, `fs.scratch`. User approves.
3. Extension's `install` hook runs, generates an empty Baileys auth dir at `<home>/state/extensions/whatsapp/auth/<account_id>/`.
4. Install hook prints a ToS acknowledgment ... "WhatsApp's official Terms of Service do not permit unofficial clients for commercial use. This connector uses WhatsApp Web (Baileys), which is widely deployed for personal use but carries non-zero ban risk if the bot account is flagged for spam-like behavior. Continue? [y/N]". User types `y`.
5. Operator runs `2200 connector login whatsapp` to pair an account. Baileys generates a QR code, printed to the terminal (and surfaced to the web UI when one is connected). User scans on their phone's WhatsApp app, Baileys saves the session, gateway boots.
6. Operator adds a connector binding to one or more Agents' Identity files (or via a future web UI). Allowlist defaults to "only your own number" until the operator widens it.
7. First inbound message arrives, fires a synthetic task, Agent replies via `whatsapp_send` → message goes out via the gateway → user sees it in their WhatsApp.

**Outbound tool:** `whatsapp_send` with args `{ to: string, body?: string, reply_to?: string, attachments?: [...] }`. Resolves `to` via the connector binding's allowlist; rejects sends to unauthorized targets.

**Default DM policy:** `pairing`. Unknown senders trigger a pairing-approval notification in the operator's inbox. The operator approves once; the sender becomes a permanent member of the allowlist for that Agent.

**Default group policy:** `allowlist` with empty list. Groups must be explicitly added.

**v1 deliberately ships without:** broadcast groups, voice notes, native reactions, system prompt overrides per group, multi-account complexity, custom mention patterns. These are all v1.x or v2. The v1 cuts are aggressive ... we want the substrate validated, not feature-parity with OC.

**ToS posture:** documented in the install flow + the connector's README. The doc is honest: this works, this is what most people do, this carries a non-zero ban risk for high-volume / spam-like patterns, the v2 alternative will be a Meta Business Cloud API variant for commercial users who need ToS-clean operation.

## License + ToS posture

**2200's commercial position:** 2200 sells the runtime substrate. Connectors are free, optional, opt-in installables that end users choose to add. 2200 does not redistribute Baileys as a paid feature, does not bundle it into the default install, and does not represent or warrant to Meta that user-installed WhatsApp connectors comply with WhatsApp's ToS. The end user is the party in a relationship with Meta when they pair their WhatsApp account to a connector they installed. This is the same posture that Baileys' own maintainers take ... see the explicit disclaimer below.

| Artifact | License | Compatibility with 2200 (Elastic v2) | Notes |
|---|---|---|---|
| OpenClaw architectural patterns | MIT | ✅ Pattern-lift only (no code copy). Document inspiration in commit + epic doc. | Per the "track licensing" rule. |
| `@whiskeysockets/baileys` v7.0.0 | **✅ MIT** (verified 2026-05-16 against the GitHub repo's `LICENSE` file via authoritative GitHub API license detection; full standard MIT text, Copyright 2025 Rajeh Taher/WhiskeySockets) | ✅ Permissive; compatible with 2200 Elastic v2 as a runtime dependency of an end-user-installed Extension. | License confirmed before substrate work begins. No copyleft, no field-of-use restrictions. |
| `@2200/whatsapp` (our published connector package) | Elastic v2 (matches 2200) | ✅ | Same as 2200 main package. |
| Baileys project disclaimer (carried into our connector README verbatim) | n/a | n/a | "Not affiliated, associated, authorized, endorsed by, or in any way officially connected with WhatsApp... The maintainers of Baileys do not in any way condone the use of this application in practices that violate the Terms of Service of WhatsApp. The maintainers of this application call upon the personal responsibility of its users to use this application in a fair way, as it is intended to be used." 2200 carries this language unchanged on the connector. |
| WhatsApp's ToS | Meta-proprietary, restrictive on unofficial clients for commercial use | The end user accepts Meta's ToS when they pair their WhatsApp account. 2200 surfaces the issue clearly at install time but does not arbitrate it. | This is end-user → Meta. 2200 is not a party. |

**License verification status: ✅ resolved.** No longer a blocker on starting code.

**Install-flow ToS surface:** the install hook prints, and requires `y` to continue:

> The WhatsApp connector uses the open-source Baileys library to connect to WhatsApp Web on your behalf. This is the same library used by many other projects for personal automation. You are responsible for using it in a way that complies with WhatsApp's Terms of Service. WhatsApp's ToS forbids unofficial clients for commercial use and prohibits bulk / spam-like behavior; bot accounts that trip Meta's spam detection can be banned. By installing this connector, you accept the Baileys library's MIT license and you take on the responsibility for your own compliance with WhatsApp's Terms of Service. 2200 is not a party to that relationship.

This is captured in the manifest's `tos_acknowledgment` field and is the gating check before the QR pair step.

## Channel sequencing

WhatsApp first (per Doug's "most complicated first" framing, even though Baileys made the *infrastructure* the easiest of the four). After WhatsApp ships end-to-end and works for Doug + Geoff in real use:

1. **Telegram** ... thinnest implementation. BotFather token in 30s, simple webhook receiver. Validates the contract on a different auth model (`bot_token` vs `qr_pair`).
2. **Discord** ... bot token + gateway WS connection. Similar shape to Telegram but with a long-lived WS (like WhatsApp's Baileys socket).
3. **Slack** ... OAuth + Events API + signing secret verification. Tests the contract on the heaviest auth model (`oauth`). Builds on the existing `slack_send` outbound tool.

Each subsequent connector should be a smaller code change than the previous one. If WhatsApp lands and Telegram takes more than half the WhatsApp diff, the contract has a gap and we revise it before continuing.

## The Connector Store

### CLI surface (v1)

```bash
2200 connector list                        # all available + installed
2200 connector show <id>                   # manifest, status, bindings
2200 connector install <id>                # from npm or local path
2200 connector uninstall <id>              # runs uninstall hook + removes
2200 connector login <id> [--account <a>]  # auth flow (QR / OAuth / token paste)
2200 connector status <id>                 # gateway state, last heartbeat, errors
2200 connector logout <id> [--account <a>] # revoke auth, keep Extension installed
```

Behind the scenes these are thin wrappers over the existing `2200 extension *` commands, filtered to Extensions that declare a `connector` block in their manifest.

### Web surface (v1.x)

A "Connector Store" section in the web app showing:
- **Installed:** what's running, last heartbeat, account count, recent error count, "open settings" link.
- **Available:** the catalog of first-party + community connectors (initial catalog is hard-coded; later pulls from a remote registry at 2200.ai).
- **Install flow:** click → permission prompt → ToS ack → auth flow (QR display for WhatsApp, OAuth redirect for Slack, token-paste for Telegram/Discord).

The web surface is deferred behind the web app's broader v1.x roadmap (per [[15-web-app]] Phase C). The CLI is sufficient for the seed-team migration plus Geoff/Dana onboarding as long as someone (likely Doug) walks them through it once. Multi-user / self-serve install is a v1.x concern.

## Deferred to v1.x or later

- **Multi-tenant identity mapping.** v1 assumes "the inbound human is Doug." Multi-user (separate humans messaging the same 2200 instance from different WhatsApp numbers) is v1.x.
- **The marketplace.** Connector Store v1 is a local catalog. The marketplace (browse, install paid Extensions, ratings, etc.) is post-launch ... per [[12-extensions-framework]] Phase D.
- **Meta Business Cloud API as a second WhatsApp connector variant.** Ships only when a commercial user with the ToS-clean need surfaces.
- **Voice / call channels.** Out of scope here; tracked in [[13-voice-extension]].
- **Cross-connector routing.** "Forward this Slack message to Discord" patterns. Not yet.
- **Web-UI install flow with QR display.** CLI prints QR for v1.

## Resolved at acceptance (2026-05-16)

1. **Default DM policy: `pairing`.** Unknown senders trigger an operator approval notification. Once approved, the sender is permanent in the allowlist for that Agent. Best UX for "Geoff messages your Agent for the first time."
2. **npm org slug: `@2200/`.** Matches the canonical brand domain (2200.ai) per the operating thesis. Register before publish.
3. **Connector bindings live in Agent Identity frontmatter.** Single source of truth for "this Agent listens here." A separate per-Agent file is more like `pubs.md` but adds a file-resolution layer for marginal benefit. Bindings stay in frontmatter unless future scope creep forces a split.
4. **Gateway ports: ephemeral, supervisor-allocated.** Supervisor binds a free local port at gateway-spawn, writes it to `<home>/state/extensions/<id>/gateway.json`, the outbound tool reads it via that file. Conflict-free across multiple Extensions.

## Done when (decision-level)

- This doc is reviewed + accepted by Doug.
- ✅ Baileys license confirmed permissive (MIT, verified 2026-05-16).
- The connector contract is implemented as a small Phase B addition to `src/runtime/extensions/` (gateway hook, inbound HTTP endpoint, `ConnectorWakeSource`, manifest `connector` block).
- The WhatsApp connector ships as `@2200/whatsapp` and works end-to-end for Doug's number → live test Agent → outbound reply visible in Doug's WhatsApp app.
- The four connectors land in the order documented above, each smaller than the previous.

## Paper trail

- Brief: [Doug's spoken framing, 2026-05-16]
- Prior art: OpenClaw's `extensions/whatsapp/` ... MIT-licensed; pattern-lifted, no code copy
- Extensions framework: [[12-extensions-framework]] (Phase B shipped)
- Skills framework: [[11-skills-ingestion]] (related substrate)
- Platform passthrough pattern: [[2026-05-11-platform-integration-pattern]]
- Licensing rule: [[feedback_track_licensing]]
- Pattern-lift over code-lift: [[feedback_integrate_over_building]]
- Operating thesis: [[2200-operating-thesis]] (the user-pays test)

— Hobby, 2026-05-16
