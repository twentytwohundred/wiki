---
title: "Runbook: Grok-First sign-in (SuperGrok / X Premium+)"
type: runbook
status: active
tags: [runbook, oauth, xai, grok, subscriptions, providers]
created: 2026-05-21
updated: 2026-05-21
linked_docs:
  - "[[2026-05-21-xai-grok-oauth]]"
  - "[[09-tool-system]]"
canonical_path: wiki/runbooks/grok-first-signin.md
---

# Runbook: Grok-First sign-in (SuperGrok / X Premium+)

How to use your existing xAI subscription to power your 2200 fleet without an `XAI_API_KEY`. One sign-in, fleet-wide; the legacy API-key path stays available in parallel for anyone who prefers metered access.

This pairs with the [decision record](https://github.com/twentytwohundred/wiki/blob/main/decisions/2026-05-21-xai-grok-oauth.md), which carries the design rationale (device-code over loopback, fleet-scoped credential, public client + PKCE S256, OpenAI-compatible chat-completions transport).

---

## Prerequisites

- A 2200 install on `main` from 2026-05-21 or later (PRs #236–#240). Older daemons do not have the subscription provider wired up.
- A SuperGrok or X Premium+ subscription on the X account you intend to sign in with. xAI auto-links Premium+ status to the xAI session, so the OAuth flow is identical for both.
- A browser ... any browser, on any device. The device-code flow's verification URL works fine on a phone.

## The three paths to sign in

Any of these lands the same sealed credential. Pick whichever fits your install:

### 1. Bare-`2200` first-run wizard (new installs)

The bare-`2200` invocation on a fresh box now asks:

```
Sign in with X / SuperGrok now? [Y/n]
```

Default Y. The wizard prints a verification URL and a 4-char-grouped user code; open the URL on any device, enter the code, confirm. The wizard polls until done, seals the token, and continues to the `agent build` pointer. Failure to sign in (network, denial, timeout) does NOT abort the wizard ... you still have a working install, just no Grok credential yet, and the wizard tells you how to add it later.

### 2. Settings page (running installs)

Open `https://localhost:2200` (or wherever your web app is bound). The **"Sign in with X / SuperGrok"** tile is at the top of the Settings page, with the official Grok logo. Click it:

1. The daemon calls xAI's device-authorization endpoint and returns a verification URL + user code.
2. The browser polls every ~5s.
3. You open the verification URL (a one-click link in the tile, or the convenience URL with the code pre-filled), confirm, and the daemon writes the sealed credential.
4. The tile flips to its "configured" state showing expiry + scopes + last refresh.

### 3. CLI

For headless installs, SSH sessions, or scripted setup:

```bash
2200 oauth xai login     # device-code flow; prints URL + code, polls
2200 oauth xai status    # shows current credential + expiry + scopes
2200 oauth xai logout    # deletes the local token (does NOT revoke at xAI)
```

The CLI stays attached during the flow and prints the URL + code in the terminal. Open the URL on any device; the CLI completes the moment you confirm.

## Wiring Agents to the subscription

The subscription is a distinct provider name (`xai-subscription`), distinct from the API-key sibling (`xai`). Pick it explicitly:

- **From the web app**: Agent page → model picker → top of the dropdown shows a "**Subscriptions**" optgroup → pick `xAI / Grok (SuperGrok subscription)` and your preferred Grok model. The picker auto-restarts the Agent so the new binding takes effect immediately.
- **From the CLI**: `2200 agent edit <name>` and set `model.provider: xai-subscription` (model_id stays the same: `grok-4.3`, `grok-4-fast`, etc.).

After sign-in, Agents whose `model.provider` is `xai-subscription` read the bearer from the fleet token store at boot. The API-key xAI provider remains independent ... an Agent set to `xai` keeps using `XAI_API_KEY` from `runtime.env`.

## Where the credential lives

- `<2200_HOME>/state/oauth-tokens/xai-oauth.json` ... AES-256-GCM sealed; the bearer + refresh token are encrypted with a wrapping key derived from `<2200_HOME>/state/oauth-tokens/salt` and the supervisor's `master.key`. Mode `0600`.
- A separate per-fleet namespace (different HKDF info string than the per-Agent `CredentialVault`), so a salt compromise in one does not cross into the other.
- The metadata block (granted scopes, expiry, created/refreshed timestamps) is NOT secret and is readable; only the bearer + refresh are sealed.

## What the consent screen will say

xAI's consent screen will identify the integrator as **"Grok Build"**, not "2200". That is because xAI publishes a shared CLI public client (`b1a00492-073a-47ea-816f-4c329264a828`) that every integrator uses; we did not register our own. The Settings tile and CLI both surface this proactively so a first-time user does not get spooked.

The scopes you grant:

- `openid` — required by the OIDC server
- `offline_access` — required to get a refresh token (so we can keep your Agents alive without re-prompting every hour)
- `grok-cli:access` — CLI / headless flow scope
- `api:access` — lets the bearer hit `api.x.ai/v1`

## Refresh, expiry, and outages

- The supervisor-side `TokenRefreshService` ticks every 60s, and refreshes the xAI bearer within 120s of expiry. The refresh request uses `grant_type=refresh_token` against `https://auth.x.ai/oauth2/token`; PKCE is NOT replayed (it is bound only to the initial mint).
- If a refresh fails, the service applies the same per-credential cooldown as the per-Agent path (default 60s) and retries on the next tick. Repeated failures log warnings; a fully-expired credential plus failed refresh causes Agents bound to `xai-subscription` to fail at start with a "sign in again from Settings" message.
- A daemon restart picks up the latest token immediately; Agents pick up rotations on their next restart (no runtime token rotation today, by design).

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Settings tile is loading forever, then errors | xAI's discovery endpoint (`https://auth.x.ai/.well-known/openid-configuration`) is unreachable | Check egress connectivity; the daemon logs the underlying fetch error. |
| "code_challenge_method must be S256" | Bug from an older PKCE-less code path | Should not happen on 2200 main; we send S256 explicitly. If it does, file an issue. |
| Agent fails to start with "xai-subscription is not signed in" | The sealed token file is missing or the operator ran `oauth xai logout` | Sign in again from Settings or `2200 oauth xai login`. |
| Agent fails to start with "xai-subscription token is expired" | The background refresh has not landed a fresh token (network blip, just restarted, etc.) | Wait ~60s for the next refresh tick, or re-sign-in. |
| Picker shows no models under "Subscriptions" | Operator is not signed in; `xai-subscription`'s `key_set` is false in the provider snapshot | Sign in from Settings. The picker hides providers with no credential set so a stale entry can't be selected by accident. |
| Model swap in the picker doesn't change behavior | Agent process is "adopted" from a prior daemon and its in-memory LLMProvider is locked to the old binding | The picker auto-restarts the Agent on swap; if you swapped via the CLI, restart manually: `2200 agent stop <name> && 2200 agent start <name>`. |

## What this runbook does NOT cover (yet)

- **MCP-server-via-Grok-subscription** ... the future epic where 2200 registers itself as an MCP server attached to your Grok subscription, so a Tesla in-car Grok voice button can invoke your home Agents. The Grok-First plumbing here is the table-stakes that unlocks it; the MCP server work is a separate epic.
- **xAI server-side tools** like `x_search` and `code_execution`. They have separate per-call billing even on subscription auth and are not bundled into this flow.
- **TTS / image / video / transcription** over the same OAuth bearer. Hermes does this; 2200 v1 is chat / reasoning only. The `image_generate` tool still needs `XAI_API_KEY` separately.
