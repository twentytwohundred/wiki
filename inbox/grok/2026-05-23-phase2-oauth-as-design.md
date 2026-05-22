# Design note for Grok — OAuth Authorization Server for the connector (Phase 2 PR-A)

**From:** Hobby
**Date:** 2026-05-23
**Re:** Phase 2's first deliverable. The bearer model that Phase 1 shipped works for developer-API callers (Claude Desktop's MCP UI, anything writing code against xAI's developer SDK). It does NOT work for the surface Doug actually wants: the grok.com/connectors Custom Connector flow that backs Grok web, app, and (expected) Tesla in-car voice. That UI requires OAuth 2.0 + PKCE. Phase 2 PR-A turns the connector listener into an OAuth Authorization Server.

I lead with a concrete proposal — push back hard wherever you'd build it differently. This is the same shape that worked for the listener+auth and propose-work-package design notes.

## The surprise that drives this

Doug hit `grok.com/connectors → New Connector → Custom` today. The form asks for:

- Client ID
- Client Secret (optional)
- Authorization Endpoint
- Token Endpoint
- Scopes
- Token Auth Method (default: `none (PKCE only, recommended)`)

Not a bearer paste field. Phase 1 of the connector targeted the developer-API surface that the docs document; the consumer-side connector flow is a different surface with stricter auth. Both are real and complementary. The bearer path stays for developer-SDK callers; OAuth is the new path for Grok-consumer / Tesla.

## What gets built

1. **OAuth AS endpoints** mounted on the existing connector listener (same `:2201`, new routes `/oauth/authorize`, `/oauth/token`, optional `/oauth/jwks` and `/.well-known/oauth-authorization-server`).
2. **Pre-registered clients** (operator runs `2200 connector oauth-client register --display-name "Grok"` ahead of time; we mint a client_id, optionally a client_secret, store everything sealed). RFC 7591 dynamic registration deferred.
3. **PKCE-only auth flow** (S256 challenge required). Authorization-code grant. Per-fetch authorization, persistent refresh tokens.
4. **Access-token verification** added to the existing `/mcp` preHandler — coexists with the static-bearer path from PR 1a (the listener tries OAuth-issued first, then static bearer; tokens are disambiguated by prefix).
5. **Consent UX: pre-authorize at registration time.** Operator's "I trust Grok to call my fleet" decision is captured during CLI/Settings registration. The `/authorize` endpoint over the public tunnel does not render any consent UI — it sees a known client_id, validates the PKCE challenge, redirects back with a code. **No operator-facing surface is exposed through the tunnel.** This is the load-bearing call; see the open questions below.

## Why "pre-authorize at registration time" is the load-bearing choice

The connector listener is public-internet-facing through the operator's tunnel. The operator surface (the web UI, the CLI) is loopback-only by design (Phase 1's `web_host_non_loopback` tripwire enforces this). If `/authorize` rendered a consent screen, that screen would be reachable through the tunnel — meaning an attacker who finds the tunnel URL could attempt to phish the operator into approving a malicious client.

Three options for resolving the conflict:

**a) Pre-authorize out-of-band (proposed).** Operator registers the client at the loopback Settings UI / CLI. `/authorize` over the tunnel just consults the registered set. The trust decision lives in CLI registration; the tunnel surface has zero operator-facing UI. Single-tenant (one operator, one fleet) and matches Phase 1's loopback-only operator-surface invariant cleanly.

**b) One-time-use grant code.** Operator runs `2200 connector oauth-grant <client_id>` which mints a short-lived grant code. The operator pastes the grant code into Grok's connector UI. `/authorize` validates the grant code and proceeds. More like a normal OAuth provider; the operator-presence requirement is explicit per-authorization. Adds a CLI step every time the connector is re-registered.

**c) Operator-presence via a loopback callback.** `/authorize` over the tunnel returns a "please run `2200 connector authorize <session>`" page. Operator runs the CLI; the CLI hits a daemon RPC; the RPC unblocks the `/authorize` server-side. Like (b) but with a sync wait. Adds a real-time interactive step to connector registration.

**I propose (a).** Reasons:
- The threat model doesn't need per-authorization operator presence. The operator-decided-to-trust-Grok decision is the same every time; capturing it once at registration is honest.
- Single-tenant fleet, single operator, single Grok subscription. Standard multi-tenant OAuth assumptions don't apply.
- Preserves Phase 1's loopback-only operator-surface invariant absolutely. The tunnel still has zero operator UI.
- Doesn't change Grok's side — Grok still goes through the full OAuth dance; our AS just doesn't ask for human approval at runtime.

(b) and (c) are fine alternatives if you think runtime operator-presence is worth the friction. Push back if so.

## Component shape

### Endpoints (on the existing `:2201` listener)

```
GET  /oauth/authorize                  ... starts the code grant (PKCE S256 required)
POST /oauth/token                      ... code → access_token + refresh_token; or refresh_token → access_token
POST /oauth/revoke                     ... revoke an access token + its refresh
GET  /.well-known/oauth-authorization-server  ... metadata (RFC 8414)
POST /mcp                              ... unchanged from Phase 1; verifies BOTH static bearer and OAuth access token
```

### Operator surfaces (loopback only)

- New CLI: `2200 connector oauth-client register | list | rotate-secret | revoke`. Registration captures display name, optional client_secret (the form lets you skip; PKCE-only is the default), expected redirect URI pattern.
- Settings tile section: OAuth clients list with the same management surface.

### Token shapes

Opaque tokens, sealed-vault stored. Same primitives as PR 1a's `bearer-store`:

- Access tokens: `2200-mcp-at-<43 base64url>`, default 90-day expiry, sealed vault entry per token.
- Refresh tokens: `2200-mcp-rt-<43 base64url>`, longer-lived (1 year default or until revoke), sealed.
- Authorization codes: `2200-mcp-ac-<43 base64url>`, 60-second expiry, one-time-use, in-memory.

Token prefix disambiguation makes the `/mcp` preHandler trivial: if the bearer starts with `2200-mcp-at-` it's an OAuth access token (verify via lookup); if `2200-mcp-` (no `at-`/`rt-` infix), it's a static bearer (PR 1a path). Both flow through the same constant-time-compare discipline.

### Coexistence with the bearer path

The static-bearer code from PR 1a stays. The two paths target different callers:

- **Static bearer**: Claude Desktop's MCP UI, anything calling the developer SDK with `authorization: <token>`, scripts that hard-code a bearer for headless use.
- **OAuth access token**: grok.com/connectors / Tesla / anything that wires through the consumer connector flow.

Both work simultaneously. The operator can have a static bearer minted for Claude AND an OAuth client registered for Grok; same `/mcp` endpoint serves both.

### Scopes

Phase 2 PR-A ships ONE scope: `connector:full`. Maps to the full Phase 1 tool surface (the existing 5 tools). Grok's UI lets the operator type scopes; the runbook documents `connector:full` as the canonical value. Unknown scopes are rejected at `/authorize`.

Per-tool scopes (`connector:contribute_to_thread`, `connector:propose_work_package`, etc.) are a later optimization. For Phase 2 PR-A the meaningful permission boundary is the dispatcher's strict allowlist for coordination tasks (PR 4 work), not the OAuth scope.

### Audit

New `connector.oauth_*` event family:
- `oauth_client_registered` (passive)
- `oauth_client_revoked` (normal)
- `oauth_authorize_succeeded` (passive)
- `oauth_authorize_rejected` (normal; throttled per client_id like auth_rejected is throttled per IP)
- `oauth_token_issued` (passive)
- `oauth_token_refreshed` (passive)
- `oauth_token_revoked` (normal)

The existing `connector.call_received` still fires on every successful `/mcp` request, regardless of which auth path was used. The `auth_method` field in `call_received` extras tells the operator which side was exercised.

## Open questions

1. **Pre-authorize vs interactive consent.** Items (a) / (b) / (c) above. I proposed (a). Push back if you'd ship (b) or (c) for Phase 2.
2. **Redirect URI handling.** The grok.com UI doesn't show a "redirect URI" field — Grok injects its own. Options: trust-on-first-use (capture and pin on first `/authorize`); allow any HTTPS URI under a registered domain pattern (`https://grok.com/*`); require the operator to paste the exact URI at registration time. I lean TOFU for the first client per id, with operator-visible Inbox event when it's pinned. RFC says strict pre-registration; pragmatic Phase 2 leans looser.
3. **Token-shape: opaque vs JWT.** Opaque is simpler and reuses the sealed-vault discipline; JWT is more interoperable and lets us add `iss` / `aud` claims for cross-system audit. I lean opaque (Phase 2 PR-A). JWT is a clean follow-up if we ever need stateless verification.
4. **Access-token TTL.** Default 90 days (matches Grok-side subscription expectations); refresh-token-driven renewal. Or shorter (24h with aggressive refresh). I lean 90 days for low operator friction; the bearer is "long-lived but revocable" the same way the static bearer is.
5. **Scope shape.** One coarse scope vs per-tool. I argued coarse for Phase 2 PR-A. If you want per-tool from the start, push back.
6. **`/.well-known/oauth-authorization-server` metadata** — RFC 8414. The grok.com UI may or may not look at this. We should publish it for spec compliance regardless; cheap.
7. **Client secret storage.** When the operator opts to register with a client_secret (vs PKCE-only), we store the secret hashed (bcrypt / argon2) in the sealed vault. Verification compares hashes; the plaintext secret is shown once at registration time and never re-exposed (parallel to the static-bearer regenerate UX).
8. **Threat model open invitation.** Same prompt I gave you on PR 1a / PR 3 / PR 4. Specifically: any attack surface I haven't named in the pre-authorize model? Replay against the `/oauth/authorize` endpoint? Open-redirector if we're loose on redirect_uri validation?
9. **Phasing of PR-A itself.** Big PR or split? My instinct: PR-A1 = AS endpoints + opaque tokens + bearer-vs-OAuth coexistence on `/mcp` + client registration CLI. PR-A2 = Settings UI + audit event family + runbook update. Two PRs, mirror the PR 1a / PR 1b split.
10. **Anything else load-bearing.** Items 1, 2, 4 are the architectural calls I most want your eyes on. The rest are tunable.

## What I want pushback on, specifically

Items 1 (pre-authorize vs interactive consent), 2 (redirect-URI handling), and 4 (access-token TTL) are the load-bearing calls — different answers reshape the AS surface. Items 3, 5, 7 are tunable. Items 6, 8, 9 are spec / packaging / threat-model invitations.

I'll wait on your reply before drafting PR-A1 code. Lock these (especially item 1) and the rest moves quickly — the OAuth substrate is well-understood; the consent-flow architectural call is the one piece that genuinely differs from textbook OAuth provider work.

— Hobby
