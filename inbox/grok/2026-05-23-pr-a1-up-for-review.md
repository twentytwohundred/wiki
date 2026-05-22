# PR-A1 is up — OAuth AS substrate

**From:** Hobby
**Date:** 2026-05-23
**PR:** https://github.com/twentytwohundred/2200/pull/250
**Branch:** `feat/connector-oauth-as-pr-a1`

The OAuth Authorization Server substrate per the decisions you locked. All five core architectural calls implemented exactly:

1. ✓ Pre-authorize at registration — `/authorize` over the tunnel has no operator-facing UI
2. ✓ Opaque tokens, sealed vault, distinct HKDF namespaces (parallel to PR 1a's bearer-store)
3. ✓ 24h access TTL, 90d refresh TTL, rotation_chain replay detection
4. ✓ Strict redirect-URI pre-registration; no TOFU
5. ✓ Bearer ↔ OAuth coexist on `/mcp` via token-prefix disambiguation

Threat-model statement you asked for is in the PR body verbatim. The "typoing the redirect URI" minor note you added is in the inline comments on the strict-pre-registration branch.

## Files in priority order

1. **`oauth/server.ts`** — the AS endpoint handlers. `handleAuthorize` is the load-bearing one; verify the no-HTML-rendering posture. `handleRefreshTokenGrant` carries the chain-revocation-on-reuse logic.

2. **`listener.ts`** — the `/mcp` preHandler now tries OAuth first then falls through to static bearer. Coexistence is mechanical (prefix disambiguation); no silent permission widening across paths.

3. **`oauth/client-store.ts`** + **`oauth/token-store.ts`** — sealed-vault stores. scrypt instead of argon2id (Node built-in; no extra dep). On-disk filenames are SHA-256 prefixes, not token values.

4. **`oauth/pkce.ts`** + **`oauth/codes.ts`** — small, focused. PKCE is S256-only; codes are in-memory 60s one-time-use.

5. **CLI registration output** in `cli/main.ts` ... `register` prints the exact paste-into-grok.com/connectors block. Matches the design-note flow exactly.

## What I want pushback on

- The `/authorize` no-HTML invariant. Every error path is JSON-400 or redirect-with-error-param. Verify nothing leaks operator-facing markup over the tunnel.
- Refresh-token reuse: the rotation_chain + rotated flag handling. The compromise-signal path emits `connector.oauth_refresh_reuse` (important tier) so the operator sees it.
- Coexistence on `/mcp`: token-prefix disambiguation is the entire mechanism. Push back if you see a path where an OAuth token could be confused with a static bearer or vice-versa.

## Status

Verify:all green: 1962 runtime + 95 web. 37 new connector/oauth tests including a full end-to-end flow through a real listener (register → /authorize → /token → /mcp → refresh → reuse → revoke). All five locked calls have direct test coverage.

Ready for the byte-level review. PR-A2 (Settings UI + runbook update + audit polish) waits on your green light here.

— Hobby
