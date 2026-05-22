# Hobby Brief — 2200 MCP Connector Endpoint (Grok "Bring Your Own MCP")

**Date:** 2026-05-21 (for tomorrow)
**Requested by:** Doug
**Status of the research question:** ANSWERED. Your handoff said tomorrow's first step is "figuring out how xAI's attach-MCP-server surface works." It's already figured out — see Mechanism below, pulled from xAI's own remote-MCP docs this afternoon. Please double-check this against the live docs before building (Doug wants you to verify my work, which is the right instinct), but don't start from scratch — the mechanism is documented, not a mystery. The one genuine unknown is empirical (does the in-car/voice Grok surface honor custom connectors), and only Doug's Tesla can answer that.

## Goal

Let a 2200 user expose a narrow, safe slice of their fleet to Grok as a custom connector, so the user can ask Grok (web, app, and ideally voice/car) a question and Grok calls into the user's 2200 fleet to answer. The headline demo: Doug asks Grok in his Tesla to check something, Grok calls 2200's connector, a fleet Agent answers from the Brain, answer comes back. This is step 2 (after subscription OAuth, which is done). Build the bridge; the car test is Doug's.

## Mechanism (verified against xAI docs — re-confirm before building)

xAI's "Bring Your Own MCP" / custom connector works like this:
- User goes to **grok.com/connectors → New Connector → Custom**, enters the MCP server URL, completes auth.
- Grok discovers the tools the MCP server exposes and makes them available in conversation, same as built-in connectors.
- **The MCP server must be reachable over the public internet.** If it's on a local machine, the user needs a tunneling service.
- **Transport: Streaming HTTP or SSE only.** NOT a raw websocket. (Doug said "websocket" conversationally; the actual supported transports per xAI docs are streamable-HTTP and SSE. Build to those.)
- **Inbound auth: a bearer token.** xAI's remote-MCP config has an `authorization` parameter — "a token that will be set in the Authorization header on requests to the MCP server." So Grok presents `Authorization: Bearer <token>` on every call into the endpoint. That token is the permission layer.
- **Tool scoping:** xAI supports `allowed_tools` (native SDK: `allowed_tool_names`) to restrict which tools are exposed. xAI's own docs call out the use case: "restrict access to tools that only perform read-only operations to prevent the model from modifying data." Use this.
- Note for completeness: remote MCP is supported in the xAI native SDK, the OpenAI-compatible Responses API, AND the **Voice Agent API** — the voice support is the encouraging signal for the car, but it's still unconfirmed for the in-car Tesla surface specifically.

Source: https://docs.x.ai/developers/tools/remote-mcp and https://docs.x.ai/grok/connectors — re-read these before building; they were "last updated March 2026" and the consumer connector flow is newer, so confirm the consumer-side (grok.com/connectors) auth field maps to the same bearer-token mechanism as the developer API's `authorization` param.

## What to build (v1, deliberately minimal)

The point of v1 is to prove the chain end-to-end safely, not to ship the final surface. Keep it small.

1. **An HTTPS MCP server endpoint for 2200.** Streamable-HTTP or SSE transport (whichever is cleaner given 2200's existing MCP-native stack — 2200 already speaks MCP, so this should be exposing an existing surface over the right transport, not building MCP from scratch). HTTPS mandatory.

2. **A narrow, read-only-first tool allowlist.** v1 exposes a tiny set of READ-ONLY tools only:
   - fleet status (which Agents are running, what they're doing)
   - ask-an-Agent-a-question (route a question to a named Agent, return its answer)
   - Brain lookup (read from the shared Brain)
   Nothing that *acts*, mutates, moves money, or touches credentials. Anything write/action-capable stays OFF the connector in v1. The user opts in per-tool, default zero (same philosophy as the Extensions page: "default install ships zero Extensions; you choose what runs").

3. **Bearer-token auth, done right — this is the entire security boundary, so it has to be bulletproof:**
   - 2200 mints a high-entropy, per-install secret token. User pastes it into their Grok connector config's authorization field.
   - The endpoint verifies the token on EVERY request, constant-time compare. No request without a valid token does anything. No "if token missing, allow" fallback, ever.
   - Token is revocable: regenerate → old token instantly dead.
   - Token is stored in the existing straight-to-disk sealed credential vault (same path the Grok OAuth token uses — reuse that pattern, don't invent a new one). Never logged, never echoed.
   - This token is what proves "this caller is genuinely the user's Grok, not a stranger who found the public URL." Treat it with the paranoia that deserves.

4. **Tunnel docs, not a relay.** Per Doug's call, we are NOT running a relay / not putting ourselves in the middle. The user exposes their own endpoint via their own tunnel (Tailscale Funnel, cloudflared, etc.). Write clear setup docs for the user's own tunnel. Do NOT build a hosted relay — traffic goes straight from Grok to the user's box over HTTPS, which keeps the privacy promise intact (nothing passes through 2200/our infra). NEVER instruct a user to port-forward an inbound hole to their fleet — tunnel only.

5. **Every connector request surfaces in the Inbox.** Each inbound call from Grok shows up as an Inbox event (auditable, tiered), so the user can SEE what Grok asked and what the fleet answered, and has one-click revoke. This is both a security control and a trust feature — it makes "I exposed my fleet" feel manageable.

## Hard rules

- HTTPS only. Reject plaintext.
- Read-only tools only in v1. No action/write/mutate/credential/money tools on the connector surface until Doug explicitly approves a later expansion after the read-only version is proven.
- Bearer token verified on every request, constant-time, no fallback-allow, revocable, vault-stored, never logged.
- No relay. User's own tunnel. Direct Grok→box over HTTPS.
- Surface anything ambiguous before building, especially the consumer-side (grok.com/connectors) auth field — confirm it carries the bearer the same way the developer API does.

## Test plan (Doug runs the empirical parts)

1. Hobby stands up the HTTPS MCP endpoint with bearer auth + the 3 read-only tools.
2. Doug exposes it via his own tunnel, mints the token, registers the custom connector at grok.com/connectors with the token.
3. **Confirm on Grok web/app first** (a confirmed surface): ask Grok the question, watch it call the 2200 tool, watch a fleet Agent answer from the Brain, confirm the request showed up in the Inbox. This proves the whole chain on solid ground.
4. **Then the car:** Doug asks Grok the same thing in the Tesla. This is the one unknown — if the in-car surface shares the connector layer with the account (Doug's persisted-conversation experience suggests it does), it just works and that's the demo. If not, fall back to the phone version (90% of the magic) and note the car as not-yet-reachable.

## Out of scope for v1 (note, don't build)

- Any write/action tools on the connector.
- A hosted relay.
- Native xAI server-side tools (x_search, code_execution) — separate, separately billed.
- Multi-user / multi-tenant connector anything — this is single-user, the user's own fleet, their own token.

## Summary

Expose 2200's existing MCP surface as an HTTPS endpoint (streamable-HTTP/SSE), bearer-token-authed (high-entropy, per-install, constant-time verify, revocable, vault-stored, never logged), read-only tools only in v1 (fleet status / ask-Agent / Brain lookup), reachable via the user's own tunnel (no relay), every request surfacing in the Inbox with one-click revoke. The mechanism is documented — re-confirm it, don't re-research it. Build the door bulletproof; Doug tests the car.
