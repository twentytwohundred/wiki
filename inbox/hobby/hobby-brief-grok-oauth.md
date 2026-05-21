# Hobby Brief — xAI Grok Subscription Auth as a 2200 Capability

**Date:** May 21, 2026
**Requested by:** Doug
**Priority:** Near-term. This is table-stakes parity — OpenClaw and Hermes both shipped it in the last week. Not a differentiator, just something 2200 should not be missing. Doug will be the first test case as a SuperGrok Heavy subscriber.

## Goal

Let a 2200 user authenticate the xAI/Grok provider using their existing SuperGrok or X Premium+ subscription instead of pasting an `XAI_API_KEY`. After sign-in, any Agent in the fleet can use Grok models drawing on that subscription. Doug wants his whole fleet using Grok-via-subscription from the day he installs, all of them reading/writing the shared Brain.

## What this is, mechanically

It's an OAuth flow against `accounts.x.ai`, not a new API key type. Confirmed behavior from xAI + how OpenClaw and Hermes implemented it:

- Works for **SuperGrok** (grok.com subscription) and **X Premium+** (linked X account — xAI auto-links subscription status to the xAI session, so the flow is the same for both).
- **No `XAI_API_KEY` required.** OAuth issues a bearer token; the token is refreshed in the background.
- Transport is xAI's **Responses-style API** (the same "Responses"/codex-responses adapter shape other runtimes reuse). Tool-calling, streaming, reasoning, and prompt caching work over this transport without custom adapter surgery. If 2200's existing xAI provider already talks to xAI's standard endpoint, confirm whether it's the Responses surface or the older completions surface, because the OAuth token is scoped to the Responses transport.
- xAI may label the consent screen "Grok Build" because integrators use xAI's shared OAuth client. That's expected; the user does NOT need to install any "Grok Build" app. Note this in the UI copy so it isn't alarming.

## Three sign-in methods to support

Match what the mature implementations do. Priority order for 2200:

1. **Device-code flow (BUILD THIS FIRST).** 2200 prints a short code + a URL; the user opens the URL in any browser, confirms, and the 2200 process polls xAI for the completed token exchange. This is the right default for 2200 because users run it on a headless Mac Mini / mini PC / homelab box, often over SSH, where a localhost browser callback is awkward or impossible. This is the path Doug will use.
2. **Browser OAuth (localhost callback).** For users running 2200 with a local browser available. Nice-to-have after device-code works.
3. **API key (already exists).** Keep the existing `XAI_API_KEY` path as-is for users who prefer it. Don't remove it.

## CRITICAL implementation gotcha — PKCE / S256

There is an open bug in Hermes (NousResearch/hermes-agent issue #27573, filed ~4 days ago) where the xAI OAuth flow fails on headless Docker/LAN setups with the error:

> `xAI authorization failed: code_challenge_method must be S256`

This means **xAI's OAuth requires PKCE with the S256 code-challenge method** (not "plain", not omitted). Build the device-code/OAuth flow with PKCE S256 from the start. This is the single most likely thing to break the first implementation, and a competitor is currently stuck on exactly it. Get it right up front.

Also from that same bug: the headless failure was compounded by the CLI **not giving the user a place to paste the code** after browser auth. Make sure 2200's device-code UX has a clear, obvious place to complete the flow (or polls automatically and tells the user clearly what's happening). Don't reproduce Hermes's dead-end.

## Where it lives in 2200

This slots into the existing Settings → Models & API Keys surface (the one with Anthropic, OpenAI, DeepSeek, Moonshot, OpenRouter, xAI). The xAI/Grok row gets a new auth option alongside "add key": **"Sign in with X / SuperGrok."** Picking it kicks off the device-code flow (show the code + URL right in the UI).

## Security — inherit the existing model, don't special-case it

The resulting OAuth token (and refresh token) is a credential. It MUST go through 2200's existing straight-to-disk credential vault, the same path as pasted API keys: sealed to local disk, never to the cloud, never logged, scoped per-Agent or fleet-wide per the existing vault model. The whole point of 2200's security story is that credentials never leave the box — an OAuth bearer token is no exception. Treat the token exactly like a pasted key once it's issued. Background refresh writes the new token back to the same sealed location.

## Model catalog

xAI's current Grok models (newest-first, as other runtimes bundle them): grok-4.3 (current default for chat/coding), grok-4.1-fast (reasoning / non-reasoning), grok-4-fast, grok-4, grok-code-fast-1. Pull the live current list from xAI rather than hardcoding — they ship new slugs frequently and the catalog should forward-resolve new `grok-4*` ids. grok-4.3 pinned as default is reasonable.

## Out of scope for v1 (note, don't build)

- Native xAI server-side tools like `x_search` and `code_execution` are separate from chat and are NOT first-class in the bundled-provider pattern yet (and they carry separate per-call billing even on subscription auth — ~$5/1k calls per xAI pricing). v1 is chat/reasoning over the subscription. Flag x_search as a possible later add since live X search is genuinely useful, but don't build it now.
- TTS / image / video generation over the same token: Hermes reuses the one OAuth bearer for all of these. Possible later, not v1.

## Verify before building (just-shipped, docs lag the release)

This all shipped within the last week and the public docs are still settling (OpenClaw's stable provider doc still said "API-key only" while the OAuth path was already in beta). So:

- Pull xAI's **current** device-code OAuth spec directly from xAI's own docs/console, not from a week-old blog post or from this brief. Confirm the authorization endpoint, the device-code endpoint, the token endpoint, the polling interval, scopes, and the PKCE requirement (S256) against the source.
- Confirm whether 2200's existing xAI provider transport is already the Responses surface or needs to point at it for the OAuth token to work.
- Surface anything ambiguous before wiring it. Don't guess at the OAuth endpoints.

## Test plan

Doug is the first test case (SuperGrok Heavy). End to end:
1. Doug picks "Sign in with X / SuperGrok" in Settings on his real install.
2. 2200 prints code + URL (device-code flow), Doug confirms in a browser.
3. Token seals to the credential vault (verify it's on disk, sealed, not logged).
4. Assign the Grok-via-subscription capability to multiple Agents in the fleet.
5. Confirm multiple Agents can run Grok off the one subscription, coordinating and reading/writing the shared Brain.
6. Confirm background token refresh works (leave it running, confirm it doesn't fall over when the token would expire).

## Summary

Build the xAI device-code OAuth flow (PKCE S256, mandatory) as a new auth method on the existing xAI capability, surface it in Settings as "Sign in with X / SuperGrok," store the token in the existing straight-to-disk vault, keep the API-key path intact, target the Responses transport, pull the current spec from xAI directly, and test with Doug's SuperGrok Heavy subscription across a multi-Agent fleet on the shared Brain. Get on the train.
