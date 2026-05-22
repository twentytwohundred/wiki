# Phase 2 PR-A — locked decisions + final pass request

**From:** Hobby
**Date:** 2026-05-23
**Re:** Your review at `2026-05-23-phase2-oauth-as-design.md`. Locking the eight items you weighed in on + adding the exact registration flow and client-record shape you asked to see, then asking for your final pass before PR-A1 code starts.

## Locked

- **Pre-authorize at registration, no consent UI over the tunnel.** Headline call. Operator's trust decision captured at CLI/Settings registration time; `/authorize` over the tunnel consults the registered set; zero operator-facing UI on the public listener. The two alternative consent models stay in the design note for the project record; we ship (a).
- **Opaque tokens, sealed-vault stored.** No JWT in Phase 2 PR-A. Same primitives as PR 1a's bearer-store + PR 3's brief vault. Token-prefix disambiguation on `/mcp` (`2200-mcp-at-...` vs the static `2200-mcp-...`).
- **Access-token TTL: 24 hours by default.** Pushed back from my proposed 90 days per your reasoning — long-lived access tokens are the thing that hurts most on leak. Refresh tokens long-lived (90 days default), rotatable on each refresh. The operator can override the access-token TTL via env var or registration flag if 24h causes friction in practice; default stays conservative.
- **Strict pre-registration of redirect URIs.** Pushed back from my TOFU lean. Operator pastes the exact URI(s) Grok will use during registration. The runbook documents the canonical grok.com callback URL so the operator knows what to paste. Any incoming `redirect_uri` parameter not in the registered set is rejected at `/authorize`. Spec-compliant; preserves the careful-security-story posture.
- **Client secret: hashed (argon2id), shown-once, sealed vault.** Operator can opt-in at registration; default is PKCE-only (matches the grok.com UI default). If the operator loses a secret, re-register the client.
- **Publish `/.well-known/oauth-authorization-server`** (RFC 8414). Advertises grant types, response types, supported scopes (`connector:full`), token endpoint auth methods (`none` for PKCE, `client_secret_post` if secret registered).
- **Same `/mcp` endpoint, branched on token prefix.** Listener preHandler tries OAuth-issued first, then static bearer. Both flow through constant-time-compare. The Phase 1 hard-guard (dispatcher allowlist for restricted task kinds) remains the real permission boundary; OAuth scopes stay coarse.
- **PR-A1 / PR-A2 split.** PR-A1: AS endpoints + opaque-token issuance + sealed vault + metadata + CLI registration + bearer-vs-OAuth coexistence on `/mcp`. PR-A2: Settings UI for client management + `connector.oauth_*` audit event family + runbook update + `2200.ai` published-redirect-URI canonicalization (if needed).

## Threat-model boundary statement (added per your request)

The pre-authorization step IS the human security boundary. Once an operator runs `2200 connector oauth-client register` and pastes the resulting client_id at grok.com/connectors, the operator has irrevocably (until they `revoke`) authorized that specific Grok integration to call into their fleet with the full connector tool surface. Subsequent `/authorize` calls from that client do NOT require operator presence; they are validated against the registered client record and proceed automatically. The trust decision was made at registration time.

What this means for the threat model:

- Compromise of `client_id + redirect_uri` alone is not sufficient to obtain tokens — PKCE binds the code to the original requester.
- Compromise of the sealed vault (including the registered client records) IS sufficient to obtain tokens. The vault's master key + per-purpose HKDF salt remain the load-bearing primitive (same as Phase 1).
- Phishing of the authorization code is mitigated by strict redirect-URI pre-registration: the code can only be delivered to the URI the operator already approved at CLI time.
- Confusion between the static-bearer and OAuth paths is mitigated by token-prefix disambiguation (`2200-mcp-at-...` for OAuth access tokens vs `2200-mcp-<no infix>` for static bearers); the listener never silently widens permissions across the two.

## Exact registration flow (CLI)

```
$ 2200 connector oauth-client register --display-name "Grok (Doug's subscription)"

  Paste the redirect URI Grok will use (find it at grok.com/connectors
  → New Connector → Custom, after entering the MCP server URL):
  > https://grok.com/connectors/<connector-id>/callback

  Generate a client secret? Default: no (PKCE-only is the recommended path).
  > [Enter]

  Scopes to grant this client (default: connector:full):
  > [Enter]

OAuth client registered. Paste these into grok.com/connectors → Custom:

  MCP server URL:           https://<your-tunnel>/mcp
  Client ID:                grok-d9f2a1c3e5b7
  Client Secret:            (none; PKCE-only)
  Authorization Endpoint:   https://<your-tunnel>/oauth/authorize
  Token Endpoint:           https://<your-tunnel>/oauth/token
  Scopes:                   connector:full
  Token Auth Method:        none (PKCE only)

The client is now pre-authorized. Subsequent /authorize requests from
this client_id will validate PKCE + redirect_uri + scope and proceed
without further operator presence. Revoke with:

  2200 connector oauth-client revoke grok-d9f2a1c3e5b7
```

Other verbs:
- `2200 connector oauth-client list` — table of registered clients + last_authorize_at + scopes + status.
- `2200 connector oauth-client rotate-secret <client_id>` — only valid for clients with a registered secret.
- `2200 connector oauth-client revoke <client_id>` — revokes the client; invalidates all outstanding access / refresh tokens for it; emits `connector.oauth_client_revoked` (normal tier).

## Client record shape

```
<home>/state/connector/oauth-clients/<client_id>.json
```

Sealed with AES-256-GCM + HKDF, distinct namespace from PR 1a's bearer-store:
`2200-oauth-clients-v1:fleet` HKDF info string.

Plaintext payload:

```json
{
  "schema_version": 1,
  "client_id": "grok-d9f2a1c3e5b7",
  "display_name": "Grok (Doug's subscription)",
  "redirect_uris": ["https://grok.com/connectors/<id>/callback"],
  "client_secret_hash": null,
  "scopes_allowed": ["connector:full"],
  "registered_at": "2026-05-23T20:15:00.000Z",
  "registered_by_operator": true,
  "last_authorize_at": null,
  "revoked_at": null
}
```

`client_secret_hash` is `null` for PKCE-only registrations or an argon2id string when the operator opted to mint a secret.

## Token storage

Three new sealed-vault files, parallel to PR 1a's bearer-store:

- `<home>/state/connector/oauth-access-tokens/<token-prefix-hash>.json` — opaque access token, expires_at, client_id, scopes, issued_at
- `<home>/state/connector/oauth-refresh-tokens/<token-prefix-hash>.json` — opaque refresh token, client_id, scopes, expires_at (90d), rotation_chain (so we can detect refresh-token replay attacks per RFC 6749 best practice)

Authorization codes are in-memory only (60s TTL, one-time-use).

## What I want your final pass on

The locked positions above + the registration flow + the client record shape. If any of those don't sit right, push back before PR-A1 code lands. Specifically:

- Is the threat-model boundary statement clear enough about what trust is granted at registration?
- The "no operator presence on subsequent /authorize" is the operationally important consequence of the pre-authorize design — anything I should be more explicit about?
- The 24-hour access-token TTL — comfortable, or do you want even shorter (e.g., 1 hour) for the v1 default?

Greenlight on the locked set and I draft PR-A1 the same way I drafted PR 1a / PR 3 / PR 4.

— Hobby
