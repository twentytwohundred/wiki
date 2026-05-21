---
title: xAI / Grok OAuth via subscription (device-code flow)
type: decision
status: locked
date: 2026-05-21
tags: [decision, oauth, xai, providers, credentials, hardening]
linked_docs:
  - "[[02-architecture]]"
  - "[[14-phase-f-capability-catalog]]"
canonical_path: wiki/decisions/2026-05-21-xai-grok-oauth.md
---

# xAI / Grok OAuth via subscription (device-code flow)

**Date:** 2026-05-21
**Status:** Locked (substrate + CLI shipped; web UI in PR-B)

## Context

Until today, the only way for an Agent to use xAI / Grok was an `XAI_API_KEY` pasted into `~/.config/2200/runtime.env`. That works for users with an xAI metered API key, but it leaves SuperGrok and X Premium+ subscribers paying twice (subscription + API metered) for the same Grok models. OpenClaw and Hermes both shipped subscription auth in the last week ... 2200 was missing table-stakes parity, not chasing a differentiator.

xAI publishes an OpenID-Connect-compliant authorization server at `https://auth.x.ai` whose discovery document advertises:

- `urn:ietf:params:oauth:grant-type:device_code` (RFC 8628)
- `S256` only for PKCE code challenge methods (the gotcha that's currently blocking Hermes issue #27573)
- A shared "grok-cli" public client (`b1a00492-073a-47ea-816f-4c329264a828`); no client_secret needed for the public-client flow
- Scopes including `openid`, `offline_access`, `grok-cli:access`, `api:access`

Device-code is the priority-1 flow because the typical 2200 install runs on a headless box (Mac Mini, mini PC, homelab) accessed over SSH, where a localhost OAuth callback is awkward at best.

## Decision

Ship a device-code OAuth flow against `auth.x.ai`, with the resulting bearer + refresh token sealed in a new fleet-scoped store at `<home>/state/oauth-tokens/xai-oauth.json`. Provider resolution for `xai` prefers the OAuth bearer when present, falls back to the env API key otherwise. The OAuth credential is fleet-wide ... one operator subscription serves every Agent whose `model.provider` is `xai`. Existing `XAI_API_KEY` paths remain intact for users who prefer API-metered access.

Concrete pieces:

- **`src/runtime/oauth/device-flow.ts`** ... generic RFC 8628 device-code runner with PKCE S256. Reusable for any future public-client OAuth provider (the auth-code-with-localhost-callback flow in `flow.ts` is the existing sibling).
- **`src/runtime/oauth/xai-config.ts`** ... xAI-specific constants + OIDC discovery loader. Endpoints fetched at flow time, not hardcoded ... no drift if xAI relocates a route. Defensive checks reject a discovery doc that doesn't advertise the device-code grant or S256.
- **`src/runtime/oauth/token-store.ts`** ... fleet-scoped sealed token store. AES-256-GCM + HKDF over the per-instance master key, with a fleet-scoped HKDF info string keeping it out of the per-Agent vault namespace.
- **`2200 oauth xai login | status | logout`** CLI verbs.
- **Provider lookup in `src/runtime/llm/registry.ts`**: when `providerName === 'xai'` and a token exists in the fleet store (and is unexpired), the OAuth bearer becomes the Agent's bearer for the OpenAI-compatible transport. Otherwise fall through to `XAI_API_KEY` via the existing env path.
- **Background refresh** in `TokenRefreshService.tick()`: fleet xAI token is refreshed within `XAI_OAUTH_REFRESH_SKEW_SECONDS` (120s) of expiry using the public-client `grant_type=refresh_token`; refreshed credentials land back in the same sealed file.

## Why device-code over loopback callback

The brief explicitly chose device-code first. Reasoning ranked:

1. **Headless deployments**: a Mac Mini / homelab server accessed via SSH has no local browser to open. Hermes' loopback flow does work over SSH with port forwarding, but the UX is fragile (the operator has to know to forward port 56121, and the flow times out if they don't).
2. **No localhost dependency**: no port-binding, no random-port discovery, no firewall edge cases.
3. **Same protocol family**: PKCE binding is the same security primitive; loopback adds a localhost cert vs. provides nothing meaningful over device-code's user-code rendezvous.

Loopback can be added later as a sibling path (`oauth xai login --browser`) when there's signal that workstation users want it. Not for v1.

## Why fleet-scoped, not per-Agent

A SuperGrok subscription is one human's subscription, not one Agent's. Per-Agent OAuth would mean:

- The operator signs in N times, once per Agent, against the same upstream account.
- N copies of the same bearer drift in N per-Agent vaults; refresh races create N inconsistent copies.
- A newly-created Agent is locked out until the operator re-signs.

Fleet-scoped storage avoids all three. The trade-off: we introduce a second credential scope (the existing CredentialVault is per-Agent only). The new `oauth/token-store.ts` is small and uses the same sealing primitives; future fleet-wide credentials (any other subscription-style auth) will reuse it.

## Why a separate sealed file, not a CredentialVault extension

The per-Agent CredentialVault is shape-specific: per-Agent salt, per-Agent HKDF info string, per-Agent file layout. Bolting a fleet scope onto it would mean either (a) reserving a sentinel `__fleet__` agent name (hacky) or (b) refactoring the class to be scope-agnostic (larger change for a single use case).

A standalone `oauth/token-store.ts` is ~150 lines and uses the same primitives (`loadOrCreateMasterKey`, AES-256-GCM, HKDF over master + salt) with a fleet-scoped info string. If/when a second fleet-scoped credential appears, the token store generalizes naturally.

## Transport question (open, will resolve on first real call)

xAI's OAuth bearer is documented (informally) as "scoped to the Responses transport." But xAI's OIDC `api:access` scope is generic; Hermes' implementation reuses a `codex_responses` adapter for the bearer; 2200 currently talks to xAI via the OpenAI-compatible `/v1/chat/completions` endpoint.

The plan: send the OAuth bearer through the existing chat-completions adapter first (zero new transport code). If xAI rejects it with a scope/transport error, swap to a Responses-style adapter. Doug is the first real test case (SuperGrok Heavy); we learn from the actual response.

If the chat-completions path doesn't work for OAuth, the fix is localized to the OpenAI-compatible provider's outbound URL (one constant in `OPENAI_COMPATIBLE_VENDORS`).

## Consequences

**What gets better:**

- SuperGrok / X Premium+ subscribers can use their subscription without pasting API metered keys.
- Fleet of multiple Agents share one subscription cleanly; refresh is centralized.
- Subscription credentials are sealed on disk (not plaintext like `runtime.env`).
- The device-flow substrate is generic for future public-client OAuth providers (e.g., GitHub Copilot device-code if we ever add it).

**What could get worse:**

- Two parallel credential locations for xAI (vault env key vs. fleet OAuth store) ... mostly invisible to the operator (Settings UI surfaces both), but a sloppy mental model could confuse "did I sign in or paste a key?". The Settings tile in PR-B will show both states side-by-side to keep it explicit.
- Fleet-scoped credentials are a new scope class. Architectural cleanup (unifying per-Agent + fleet under a common interface) can wait until a second use case lands.

**What this PR does NOT do:**

- No Responses-API adapter; we use chat-completions first.
- No Settings UI (`PR-B`).
- No native xAI server-side tools (`x_search`, `code_execution`) ... out of scope per the brief; they have separate billing even on subscription.
- No TTS / image / video generation reuse of the bearer ... out of scope; possible v2.
- No browser-callback path (`oauth xai login --browser`); device-code only.

## Implementation guidance

- The OIDC discovery doc is fetched at flow time, never cached. If xAI rotates an endpoint, the next `oauth xai login` picks it up. Acceptable cost: one HTTPS round trip on login.
- Defensive discovery validation rejects a doc that drops `device_code` from `grant_types_supported` or drops `S256` from `code_challenge_methods_supported`. These guards fire BEFORE the user sees a user code, so a regression upstream surfaces as a clear error rather than a confusing mid-poll failure.
- The CLI prints the verification URI + user_code clearly and reminds the operator that xAI labels the consent screen "Grok Build" because integrators share the CLI client. This addresses the "what is Grok Build, did I just install a malicious app" mental load.
- The refresh service uses the public-client refresh grant (`grant_type=refresh_token` + client_id, no client_secret). PKCE is NOT replayed on refresh ... the verifier is bound only to the initial mint.
- Provider lookup re-reads the OAuth token on each `resolveProvider` call, so a refresh during an Agent's lifetime is picked up on the Agent's next restart. (Restart-on-refresh is the v1 trade-off; a runtime token-rotation hook is a future hardening.)
- The OAuth credential is operator-managed, not Agent-managed: an Agent cannot trigger a sign-in, refresh, or revocation. This matches the restart-authority model (Agents do not escalate operator-only operations).

## References

- xAI OIDC discovery: `https://auth.x.ai/.well-known/openid-configuration`
- RFC 8628: OAuth 2.0 Device Authorization Grant
- RFC 7636: PKCE (S256 required)
- Hermes' prior art (browser-callback only): `hermes_cli/auth.py`, constants `XAI_OAUTH_*`
- The 2026-05-21 brief in `wiki/inbox/hobby/hobby-brief-grok-oauth.md`

## Format provenance

Brain-format decision record per [[conventions/decision-record-format]]. Sections: Context, Decision, Why X / Why not Y, Consequences, Implementation guidance, References, Format provenance.
