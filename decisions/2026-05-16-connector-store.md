---
title: "Connector Store ... web-driven Extension install + auth flow"
type: decision
status: accepted
date: 2026-05-16
accepted_by: doug
accepted_at: 2026-05-16
tags: [decision, extensions, connectors, store, marketplace, web-ux, install, auth, security]
canonical_path: wiki/decisions/2026-05-16-connector-store.md
linked_docs:
  - "[[2026-05-16-connector-extensions]]"
  - "[[12-extensions-framework]]"
  - "[[2200-operating-thesis]]"
---

# Connector Store ... web-driven Extension install + auth flow

## Context

[[2026-05-16-connector-extensions]] established the contract: connectors are Extensions, the default install ships zero connectors on disk, the user opts in to the ones they want. That decision said the install flow would ship as a CLI surface in v1 (`2200 connector install ...`) with a web surface to follow in v1.x.

After the substrate landed, Doug surfaced the right next-level constraint: the whole point of connectors is to make 2200 usable by non-technical users. Those users will never type `2200 connector install`. The install flow has to be web-driven from day one ... browse a catalog, click a button, walk a guided auth flow, done. Doug's specific framing: "an App Store, almost ... people choose Extensions that get installed immediately and then it takes them through the auth."

This decision elevates the Connector Store from v1.x to **the same epic as the connectors themselves**. The store is not a presentation layer on top of a separate CLI epic ... it IS the operator surface for connectors.

## Decision

The Connector Store is a web-driven catalog + install + auth flow shipped on top of the Extensions framework's Phase B substrate. Distribution uses npm for packages and a 2200.ai-hosted JSON catalog for curation. Install runs in the supervisor; the web app drives the UX. Auth flows are dispatched off the connector's declared `auth_model`.

Five load-bearing pieces:

1. **Catalog** ... a curated JSON document on 2200.ai listing each first-party Extension.
2. **npm distribution** ... actual packages on the public npm registry under the `@2200/` org.
3. **Supervisor install endpoint** ... resolves catalog source / npm package / local path, npm-installs into `<home>/extensions/<name>/`, validates manifest, runs install hook, broadcasts WS progress.
4. **Web Store screen** ... browse, install, uninstall, status.
5. **Per-auth-model UI components** ... QR display for `qr_pair`, OAuth redirect for `oauth`, password input for `bot_token` / `api_key`.

## The five pieces in detail

### 1. Catalog format

The catalog lives at `https://2200.ai/v1/extensions/catalog.json` (or similar; exact path negotiable). Static JSON, signed by the build pipeline, versioned, mirrorable. Shape:

```json
{
  "schema_version": 1,
  "generated_at": "2026-05-16T15:00:00Z",
  "extensions": [
    {
      "id": "whatsapp",
      "label": "WhatsApp",
      "blurb": "Use WhatsApp Web to bring your Agents into WhatsApp DMs and groups.",
      "icon": "https://2200.ai/extensions/whatsapp/icon.svg",
      "category": "connector",
      "auth_model": "qr_pair",
      "permissions": ["network", "tools", "notifications", "fs.scratch"],
      "tos_acknowledgment": "...",
      "docs_url": "https://2200.ai/docs/connectors/whatsapp",
      "screenshots": [
        "https://2200.ai/extensions/whatsapp/shot1.png"
      ],
      "current_version": "0.1.0",
      "npm_package": "@2200/whatsapp",
      "sha256": "abcdef0123...",
      "published_at": "2026-05-16T15:00:00Z",
      "min_2200_version": "0.7.0"
    }
  ]
}
```

Key fields:

- `npm_package` ... the canonical package name on npm.
- `current_version` ... the pinned version users get on a fresh install. Updates ship by republishing the catalog.
- `sha256` ... checksum of the published tarball. The runtime verifies after npm install; mismatch aborts.
- `auth_model` ... drives the web flow dispatcher.
- `category: 'connector'` vs other Extension categories (later: `voice`, `skill`, `model_provider`, etc.).
- `min_2200_version` ... runtime gates install if its own version is older.

**Catalog mutability:** appending entries + updating `current_version` is non-breaking. Renaming an `id` or removing an entry bumps `schema_version`. Migration is handled at the runtime when it fetches the catalog.

### 2. npm distribution

First-party Extensions publish to the `@2200/` npm org. Naming:

- `@2200/whatsapp` ... the WhatsApp connector
- `@2200/telegram` ... Telegram
- `@2200/discord` ... Discord
- `@2200/slack` ... Slack
- `@2200/voice` ... eventually the Voice Extension (Epic 13)

The package's `package.json` has a `2200` block with the Extension's manifest in canonical form (or alongside in `manifest.json`). The supervisor's install reads the manifest, validates against `ExtensionManifestSchema`, runs the install hook.

**Community / third-party packages** can install via the same pipe with no catalog entry ... `2200 connector install @third-party/foo` or the web's "Install from npm" power-user option. The UI surfaces a clear "this is not in the 2200 catalog; you are running unverified code with these permissions" warning before proceeding.

**Publishing pipeline:** each connector's directory in the monorepo (e.g. `apps/whatsapp/`) has a `package.json` with the npm name + version. A GitHub Action publishes on tag. Catalog JSON is published as a separate artifact (or as part of a docs site behind 2200.ai's CDN).

### 3. Supervisor install endpoint

New endpoint:

```
POST /api/v1/extensions/install
  body: {
    source: 'catalog:<id>' | 'npm:<package>[@<version>]' | 'path:<absolute_path>'
    permissions_acknowledged: string[]    // categories the user approved in the modal
    tos_acknowledged: boolean             // for connectors that declare tos_acknowledgment
  }
  returns: {
    install_id: string,
    status: 'pending'
  }
```

Server runs install in the background. Progress events fan out over the existing WS channel:

```
{ event: 'extension.install_progress', payload: { install_id, stage: 'resolving' | 'downloading' | 'verifying_checksum' | 'extracting' | 'validating_manifest' | 'running_install_hook' | 'completed' | 'failed', percent?, message? } }
```

Failure modes (each surfaces as `stage: 'failed'` with a typed `error_code`):

- `catalog_entry_not_found`
- `version_mismatch_with_min_2200_version`
- `npm_install_failed`
- `checksum_mismatch`
- `manifest_invalid`
- `install_hook_failed`
- `permission_mismatch` (manifest asks for permissions the user didn't ack)

Uninstall mirrors via `POST /api/v1/extensions/<name>/uninstall` ... existing Phase B uninstall hook + state cleanup.

### 4. Web Store screen

New route at `/extensions` in the web app. Three tabs:

- **Installed** ... what the user has. Cards show: icon, label, version, status badge (`connected` / `needs_auth` / `errored` / `idle`), uninstall button, "configure" link that opens the connector's settings panel (allowlist editor, account list, etc.).
- **Connectors** ... the messaging-platform subset of the catalog. Cards show: icon, label, blurb, install button. Click install → permissions modal → ToS-ack modal → background install with live progress bar (from the WS events) → auth flow opens automatically when install completes.
- **All Extensions** ... full catalog (connectors + future Skills + Voice + etc).

The card layout is simple: 64px icon, label as bold sans, blurb in muted text, action button on the right, permissions preview chips at the bottom ("network", "tools", "notifications").

Power-user controls behind a "..." menu:
- "Install from npm" ... text input for `@org/package` + version + a "this is unvetted" confirmation.
- "Install from local path" ... text input for an absolute path (dev mode).
- "View catalog source" ... raw JSON link for transparency.

### 5. Per-auth-model UI components

When install completes for a connector, the Store UI dispatches off `connector.auth_model` to open the right auth flow:

- **`qr_pair`** (WhatsApp). The gateway emits the Baileys QR string as a WS event. The web app renders it as an actual QR code image (using a small QR-rendering library, e.g. `qrcode` npm). User scans on their phone. The web watches for `connection.update → open` and swaps to "Paired ✓" success state. Optional second screen: configure the allowlist (DM senders + groups).

- **`oauth`** (Slack, future Google, etc.). The web app GETs `/api/v1/extensions/<name>/oauth/authorize_url` from the supervisor, redirects the browser. The provider redirects back to `/api/v1/extensions/<name>/oauth/callback?code=...`, the supervisor exchanges the code for tokens, seals to the per-Extension vault, returns to the web with success state.

- **`bot_token`** (Telegram). Web app shows a `<input type="password">` for the BotFather token. Submit POSTs to `/api/v1/extensions/<name>/auth/token` which seals to the vault. Optional second screen: configure the bot's command list + allowlist.

- **`api_key`** (some). Same shape as `bot_token`, differently labeled.

Each auth flow is a single React component the web app ships per-connector. v1: hardcoded components for the four first-party connectors. v1.x: a generic "declared steps" model that lets community connectors describe their auth flow in the manifest and the web app renders it without per-connector code.

## Security posture

The catalog is the trust boundary. Three layers of defense:

1. **Curation.** Only Extensions Doug + the seed team have vetted appear in the catalog. The vetting process is documented (separate doc when it lands) and includes: read the package source, verify the install hook does what the manifest says, verify the permissions are minimal, verify the gateway code is reasonable.

2. **Pinning + verification.** Catalog entries declare specific `current_version` + `sha256`. The supervisor refuses to install if the npm package's downloaded tarball doesn't match the checksum. Updates ship via catalog republish, not via "always pull latest."

3. **Permission prompts.** At install time, the web app shows a granular permissions modal. User can decline permissions the Extension declared (the install hook receives only the granted set; the Extension code can opt to fail-loud if a needed permission is missing). Permission categories are closed at v1 (`network` / `tools` / `brain_read` / `brain_write` / `notifications` / `schedule` / `pub_read` / `pub_send` / `fs.scratch`).

The "Install from npm" power-user lane is **explicitly unvetted**. The UI surfaces a red banner before proceeding ("This package is not in the 2200 catalog. The code will run with these permissions on this machine. Verify the source yourself."). This is the escape hatch for community / private connectors; it should not be the default path.

## What this decision deliberately defers

- **Marketplace economics** (paid Extensions, ratings, reviews, platform cut). Per [[12-extensions-framework]] Phase D. v1 catalog is a curated free list.
- **Multi-tenant install state.** v1 is single-tenant: the installing user is the only operator. Multi-user (separate humans on the same instance with their own Extension preferences) is v1.x.
- **Auto-update.** v1 ships manual updates (operator clicks "update" on an installed Extension; the catalog tells them when a newer version is available). Auto-update is a v1.x preference toggle.
- **The "declared steps" generic auth flow model.** v1 ships per-connector components for the four first-party connectors. Community connectors ship without auth-UI integration until v1.x (they can still use the runtime install pipeline + a manual auth setup via CLI or env vars).
- **Cross-connector routing** ("forward Slack to Discord"). Out of scope.

## Sequencing (the work)

This is the rest of the connector epic. Sequencing:

1. **First-party connector publish prep.** Rename `apps/whatsapp-connector` → `apps/whatsapp`. Align `package.json` `name` to `@2200/whatsapp`. Confirm npm `@2200` scope is registered (or `@twentytwohundred` if needed).
2. **Catalog format spec + initial JSON.** Author the four catalog entries (incomplete pointers OK until packages publish).
3. **Supervisor install endpoint** ... resolver + checksum verify + WS progress events + permissions/ToS gating.
4. **Web Store screen** ... browse, install, uninstall, status. Three tabs. Permissions modal + ToS modal.
5. **`qr_pair` auth component** ... WhatsApp-flavoured QR display + connection-update WS subscription + allowlist setup screen.
6. **Connector status surfacing in Agent + Fleet views** ... per-Agent "this Agent is bound to X connector(s)" chip. Per-connector "gateway connected / not paired / errored" status bar.
7. **Telegram connector + `bot_token` auth component.**
8. **Discord connector + `bot_token` auth component.**
9. **Slack connector + `oauth` auth component.**
10. **2200.ai hosting** ... static catalog endpoint, signed publishes.

Items 1–5 are the substantive shippable unit: a user can install + pair WhatsApp end-to-end from the web. Items 6–10 are progressive enhancement.

## What's NOT in this decision

The CLI surface from [[2026-05-16-connector-extensions]] (`2200 connector install / login / status`) remains in scope as the underlying mechanism. The web Store calls the same supervisor install endpoint that the CLI calls. The CLI is the substrate; the web is the experience.

## Open questions (deferred for follow-on)

- npm org name registration: `@2200` (canonical brand) or `@twentytwohundred` (current GitHub org). Doug to register before publish.
- Catalog hosting: static JSON behind 2200.ai's CDN, or a dynamic endpoint? Static is simpler. Lean static.
- Update notifications: in-app banner vs passive notification tier? Passive is consistent with the existing notification model.
- Catalog versioning + schema migration: when catalog `schema_version` bumps, do we ship a runtime migrator? Yes; same shape as Identity migrators.
- Vetting workflow + documentation: who has commit access to the catalog repo? What's the review process? Tracked separately when the catalog repo lands.

## Done when

- This doc is reviewed + accepted.
- The catalog format is spec'd (above) and a JSON skeleton lives in the runtime repo (or a sibling repo) for testing.
- Supervisor install endpoint ships with checksum verification + WS progress.
- The web Store screen browses + installs at least one connector (WhatsApp) end-to-end.
- The `qr_pair` auth flow walks a user from "click install" to "paired with my phone" with no terminal involvement.
- `@2200/whatsapp` is published to npm at a pinned version with checksum in the catalog.

— Hobby, 2026-05-16
