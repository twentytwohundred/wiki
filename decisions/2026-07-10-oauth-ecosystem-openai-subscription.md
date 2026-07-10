---
title: OAuth-ecosystem positioning + ChatGPT (OpenAI) subscription connector
type: decision
status: accepted
date: 2026-07-10
tags: [decision, oauth, openai, chatgpt, providers, credentials, positioning]
linked_docs:
  - "[[02-architecture]]"
  - "[[2026-05-21-xai-grok-oauth]]"
canonical_path: wiki/decisions/2026-07-10-oauth-ecosystem-openai-subscription.md
---

# OAuth-ecosystem positioning + ChatGPT (OpenAI) subscription connector

**Date:** 2026-07-10
**Status:** Accepted + implemented 2026-07-10 (PR #367). Inference half remains verify-on-live-token, see Open question. See the implementation addendum at the bottom for where the live surface diverged from this record's assumptions.

## Context

On 2026-05-21 2200 shipped SuperGrok subscription sign-in (device-code OAuth against `auth.x.ai`) and positioned it as the headline "Grok-First" auth path ... top of Settings, first-run installer prompt. See [[2026-05-21-xai-grok-oauth]].

Two things changed since:

1. **Product positioning.** The operator has walked back "Grok-First" to an "OAuth fully supported" ecosystem: subscription sign-ins are presented as peer, first-class options rather than one pinned leader. Give users the choice of provider. Grok stays fully supported (the Tesla/in-car-Grok/MCP thread is unaffected); it just no longer gets sole top billing.

2. **A second viable subscription provider exists.** Research (2026-07-10) found that of the three other frontier vendors, only OpenAI offers a subscription-OAuth path a self-hosted third-party product can use:

   - **OpenAI (ChatGPT Plus/Pro):** viable. Public statements from OpenAI leadership sanction third-party harnesses using a user's ChatGPT subscription (OpenClaw, OpenCode, Pi). ~10% of Codex production traffic is third-party. A Plus subscription yields roughly $100-200/mo of equivalent API tokens.
   - **Anthropic (Claude Pro/Max):** prohibited. Feb-2026 ToS explicitly bans subscription OAuth tokens in any non-Claude-Code product; server-side client-identity checks; account bans enforced.
   - **Google (Gemini / AI Pro/Ultra):** prohibited. Named ToS violation; Feb-Apr 2026 ban waves disabled paying subscribers' accounts.

   Landscape detail and citations live in the operator's memory note `project-subscription-oauth-landscape`; category-level summary only is recorded in this public record per wiki redaction policy.

Anthropic and Google therefore stay **API-key-only** in 2200. This record covers **OpenAI only.**

## Decision

Ship a ChatGPT (OpenAI) subscription sign-in as a first-class peer to Grok: its own Settings card with the OpenAI mark, a first-run installer option, and an `openai-subscription` LLM provider. Refactor the Grok-specific OAuth wiring into a **provider-neutral subscription-OAuth registry** so a second (and future third) provider is a data entry, not a fork.

### Positioning

- Settings presents subscription providers (Grok, ChatGPT) as **peer cards**, not one pinned leader. API-key providers (Anthropic, DeepSeek, ...) and local remain below.
- First-run offers each subscription sign-in as an option.
- Copy is "OAuth fully supported / bring your subscription," not "Grok-First" and not "13 providers."

### Provider-neutral subscription-OAuth registry

Today six call sites import `xai-config` directly (`registry.ts`, `refresh-service.ts`, the `/api/v1/oauth/xai/*` HTTP routes, the `2200 oauth xai` CLI subcommand, `fleet-defaults.ts`, and first-run). Introduce a small registry keyed by provider slug (`xai-oauth`, `openai-oauth`) that returns the flow config, token-store key, discovery loader, and label. The core machinery (`device-flow.ts`, `token-store.ts`, `pkce.ts`, the refresh service body, the per-request hot-read bearer pattern) is already provider-agnostic and does **not** change. The six call sites become registry lookups.

### Auth: dual-flow (device-code primary + loopback fallback)

OpenAI publishes two sign-in shapes for a ChatGPT account:

- **Device-code** (RFC 8628) ... the shape identical to our Grok card (enter a code on any device, we poll). OpenAI gates it behind a one-time "device code authentication" toggle in the user's ChatGPT security settings.
- **Loopback authorization-code + PKCE** ... browser to `http://localhost:1455/...` callback. No account-settings toggle, but requires a browser that can reach `127.0.0.1` on the box running 2200 ... the SSH/headless problem device-code was chosen to avoid for Grok.

Decision: **device-code first, loopback as automatic fallback** when the account has device-code disabled. The card tries device-code; if OpenAI rejects it (toggle off), it falls back to the loopback flow and tells the user. This is the most resilient "just works" story across both headless and workstation installs, at the cost of ~2x the auth surface to build and test.

Implementation note: the existing loopback runner `flow.ts` is a **confidential-client** flow (it sends `client_secret` in the token exchange). OpenAI's Codex OAuth is a **public client** (PKCE-bound, no secret). The fallback needs a public-client variant of the loopback exchange (empty/omitted `client_secret`), not a straight reuse of `flow.ts`. Preferred: make `flow.ts`'s `client_secret` optional (omit the param when empty) so both callers share one runner.

### OpenAI OAuth constants

Public client shared by the open-source Codex CLI and the third-party harnesses OpenAI has blessed:

- Client id: `app_EMoamEEZ73f0CkXaXp7hrann` (public client, no secret)
- Authorization endpoint: `https://auth.openai.com/oauth/authorize`
- Token endpoint: `https://auth.openai.com/oauth/token`
- Scopes: `openid profile email offline_access`
- Loopback callback: `http://localhost:1455/...`; `originator=codex_cli_rs` query param
- Device-code: present but gated behind the user's ChatGPT security setting

### Inference: Codex Responses adapter (NOT chat-completions)

This is where OpenAI diverges from Grok. For xAI, the OAuth bearer worked against the ordinary OpenAI-compatible `/v1/chat/completions` endpoint, so subscription auth was a pure header swap on the existing adapter. For OpenAI, subscription tokens do **not** work against `api.openai.com`; they work only against the ChatGPT backend:

- Endpoint: `https://chatgpt.com/backend-api/codex/responses`
- Request shape: OpenAI **Responses API** shape (not chat-completions), with a **mandated Codex system-prompt scaffold** per model family that the backend validates.
- Required headers: `Authorization: Bearer <token>`, `chatgpt-account-id: <id>` (extracted from a JWT claim in the access token), `originator: codex_cli_rs`.
- Constraints: `store: false`, `include: ["reasoning.encrypted_content"]`.

So `openai-subscription` needs a new small adapter distinct from the OpenAI-compatible chat-completions `OpenAIProvider`. It reuses the per-request hot-read bearer pattern; only the transport (URL, request body translation, headers) is new.

### Models

Subscription tokens serve the **Codex model family only** (GPT-5.x Codex variants), not OpenAI's full catalog. The model picker's Subscriptions optgroup for OpenAI is scoped to those and labeled honestly (coding-tuned, general-capable). API-metered `openai` (full catalog) remains a separate provider.

### Interim posture

OpenAI's sanction is public statements, not contract, and the shared client_id and validated request shape are theirs to change. This ships with the same interim discipline as the pub-server trust-the-cred patch: marked interim in code comments and with an inline note on the card, and a clean kill switch (remove the `openai-subscription` provider entry). Two favorable factors: (1) 2200's model is **fleet-scoped** ... one operator's subscription serves that operator's own fleet, which is the personal-use shape OpenAI blesses, not the multi-user resale shape it is wary of; (2) removal is a data-only change given the registry refactor.

## Why dual-flow over device-code-only

Grok's device-code-only choice worked because xAI has no account-settings gate on device-code. OpenAI does. A device-code-only card would silently fail for every user who hasn't flipped the ChatGPT setting, with a confusing error. A loopback-only card would break the headless/SSH deployment target 2200 is built for. Dual-flow (device-code, fall back to loopback) is the only option that "just works" for both the homelab-over-SSH user and the workstation user without a mandatory manual toggle. Cost: two auth paths and their tests. The operator chose this trade explicitly.

## Why a provider-neutral registry now

The Grok work left six call sites importing `xai-config` directly. Adding OpenAI by copy-paste would double that to twelve and guarantee drift (a bug fixed in one refresh path but not the other). A slug-keyed registry is small, makes the second provider a data entry, and makes the eventual removal of a provider (kill switch) a one-line change. The core flow/store/refresh machinery is already generic; this only threads a lookup through the callers.

## Consequences

**What gets better:**

- Users can bring a ChatGPT subscription (best onboarding economics: ~$100-200/mo of tokens for a $20 plan) with no API key.
- Subscription providers are peer options; positioning matches the operator's ecosystem framing.
- The OAuth substrate is genuinely multi-provider; a future fourth provider (if one opens a sanctioned path) is a data entry.

**What could get worse:**

- Two auth flows for OpenAI to maintain and test.
- A second inference transport (Codex Responses) that OpenAI can break unilaterally; the interim flagging + kill switch bound the blast radius.
- The ToS posture is softer than Grok's (public statements vs an explicit integrator program). Fleet-scoped/personal-use shape keeps us on the blessed side, but this is a watch item, not a settled contract.

**What this record does NOT cover:**

- Anthropic or Google subscription OAuth (prohibited + enforced ... API-key-only).
- Native OpenAI server-side tools or non-text modalities on the subscription bearer.

## Open question (blocks the inference half only)

The Codex Responses wire shape above is from OpenAI's open-source Codex CLI and community reverse-engineering ... it has **not** been verified against a live 2200 build with a real ChatGPT subscription token. Per the operator's "one candle for unverified claims" discipline, the inference adapter ships behind a clearly-marked, single-location wire-config block and is treated as **unverified until it returns a real completion from the operator's own ChatGPT subscription**. The auth half (both flows) is independently buildable and unit-testable now with mock fetch, exactly as the Grok flow was. Needs from the operator: a ChatGPT Plus/Pro account to sign in and drive one real completion, or an explicit decision to ship the adapter unverified-flagged.

## Implementation guidance

- Do not reuse `flow.ts` as-is for the loopback fallback ... make its `client_secret` optional (public-client mode) and share the one runner.
- Keep the Codex Responses transport details (URL, header names, system scaffold, `store`/`include` flags) in one exported config object so a wire-shape change is a one-place edit and the "verify on real hardware" boundary is obvious.
- Fleet-scoped, sealed token storage exactly as Grok (`<home>/state/oauth-tokens/openai-oauth.json`), same AES-256-GCM + HKDF primitives.
- Fix the stale `cli/main.ts` Grok login-success message (claims an `XAI_API_KEY` fallback the registry does not implement) while generalizing the CLI subcommand.
- Extend `refresh-service.ts` from its hardcoded `xai-oauth` if-branch to a registry-driven loop over all signed-in subscription providers.

## References

- OpenAI Codex CLI OAuth (open source): client_id, `auth.openai.com/oauth/{authorize,token}`, loopback:1455, `originator=codex_cli_rs`.
- Codex Responses backend: `chatgpt.com/backend-api/codex/responses`.
- RFC 8628 (device grant), RFC 7636 (PKCE S256).
- Prior art: [[2026-05-21-xai-grok-oauth]].
- Landscape + risk detail: operator memory `project-subscription-oauth-landscape` (not mirrored to the public wiki).

## Implementation addendum (2026-07-10, PR #367)

Keyless probes against the live surface before building, per the resolve-documented-gaps discipline. Three findings diverged from this record's assumptions:

1. **OpenAI's device flow is not RFC 8628.** It is OpenAI's own JSON surface: mint at `POST auth.openai.com/api/accounts/deviceauth/usercode` (returns `device_auth_id`, `user_code`, `interval` as a **string**, `expires_at` as ISO; tolerates `client_id`/`scope`/PKCE fields), poll at `POST .../deviceauth/token` with pending signalled as HTTP 403 + `error.code: deviceauth_authorization_pending`. Verification page: `auth.openai.com/deviceauth`. Consequence: the registry seam is behavioral (per-provider start/poll/refresh functions), not a config entry on the RFC 8628 runner. The poll's **success** payload could not be observed keylessly and stays behind the verify boundary; both plausible shapes (direct tokens; authorization code + PKCE exchange) are handled.
2. **The live discovery document is authoritative and differs from the constants above.** `auth.openai.com/.well-known/openid-configuration` reports `authorization_endpoint: /api/accounts/authorize` and `token_endpoint: /api/accounts/oauth/token` (the `/oauth/*` paths in this record also respond, as aliases). The implementation fetches discovery lazily at flow time, matching the xAI pattern; only the deviceauth endpoints, client id, and scopes are pinned constants.
3. **Grant inventory:** the discovery doc advertises no device grant (`authorization_code` + `refresh_token` only) and `token_endpoint_auth_methods_supported` includes `none`, confirming the public-client posture.

Also recorded during implementation: `src/runtime/config/fleet-defaults.ts` (named in Implementation guidance above) turned out to be orphaned ... no runtime consumers since the pub-server credential removal. Left untouched; flagged for removal in a cleanup pass rather than converted.

## Format provenance

Brain-format decision record per [[conventions/decision-record-format]]. Sections: Context, Decision, Why X / Why not Y, Consequences, Open question, Implementation guidance, References, Format provenance.
