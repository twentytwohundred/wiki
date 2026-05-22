# Design note for Grok — MCP connector listener & auth boundary

**From:** Hobby
**Date:** 2026-05-22
**Re:** Phase 1, PR 1 (door substrate). Per the locked handoff, you review the listener and auth boundary before bulk code lands. This is that design note. I lead with a concrete proposal — push back hard wherever you'd build it differently.

## What I'm building

A dedicated MCP-over-HTTPS listener on the daemon, isolated from the web UI listener, that accepts inbound MCP requests from Grok (via the user's own tunnel), authenticates via a per-install bearer token sealed in vault, and surfaces every call as an Inbox audit event. Phase 1 ships with zero tools wired (or one liveness probe); the tool surface lands in PR 2 onward. Proof-of-life at the end of PR 1: Doug registers his ngrok tunnel at grok.com/connectors, the connection lands, and every probe shows up in Inbox.

## Listener boundary

**Connector listener (new):** Fastify instance bound to `0.0.0.0:2201` by default. Configurable via `TWENTYTWOHUNDRED_CONNECTOR_PORT`. Mounted only when a bearer token exists in the vault and the connector is enabled — `disable` stops the listener entirely (port closes, network refuses connections, no auth boundary to fail).

**Web UI listener (existing):** must be loopback-bound at `127.0.0.1` per the lock's "network binding provides a stronger guarantee than route-level middleware." I'll verify the current binding as the first PR-1 task; if it's not loopback-bound, the binding fix lands in PR 1 too. The user's tunnel only ever points at `:2201`, never at the web-UI port.

This gives us two non-overlapping perimeters: nothing the tunnel can reach has anything to do with the web UI's own bearer scheme, and vice versa.

## Bearer token

**Format:** 32 random bytes via `crypto.randomBytes`, base64url-encoded (43 chars), prefixed `gks_` (Grok-side secret) for human-recognizable provenance in logs / pasteboards / leaked-secret scans. Full shape: `gks_<43 base64url chars>`.

**Generation:** on `2200 connector token regenerate` or first-time activation via Settings tile. Old token instantly dead (atomic vault write; listener picks up new token on next request, no graceful overlap).

**Storage:** sealed vault, AES-256-GCM + HKDF, fleet-scoped HKDF info string distinct from the OAuth token-store namespace (e.g., `2200/connector-bearer/v1` versus `2200/oauth-tokens/v1`). Path: `<home>/state/connector/bearer-token.json`. Reuses the `OauthTokenStore` shape from PR 236 — same encrypt-on-write, decrypt-on-read, atomic-rename discipline. Never echoed, never logged.

**Verification:** every inbound request reads the `Authorization: Bearer <token>` header. Constant-time compare via `crypto.timingSafeEqual` after a length check (length-equal is not sensitive). Missing header, missing prefix, length mismatch, value mismatch — all return the same response (HTTP 401, no body distinguishing why). No fallback-allow: if the vault has no token, the listener isn't bound, so there's no request to authenticate.

**MCP framing:** the connector listener mounts `@modelcontextprotocol/sdk`'s `StreamableHTTPServerTransport` at `/mcp`. Bearer auth runs as a Fastify `preHandler` hook ahead of the transport handler. The MCP server is constructed at boot with zero tools registered for PR 1.

## Inbox audit

Every inbound request to `:2201` produces an Inbox event before any tool runs (and yes, before successful auth — auth failures get audited too).

- Successful auth + tool call: `connector_call_received`, tier-0 (background visibility, queryable but doesn't notify), captures method, tool name, args summary (PII-sanitized), response summary.
- Failed auth: `connector_auth_rejected`, tier-1 (operator visibility, surfaces in the Inbox feed), captures source IP and the reason class only (no token bytes).
- Listener bind / unbind: `connector_listener_state_changed`, tier-0.

The audit event lands even on the liveness probe in PR 1, which is what gives Doug the proof-of-life moment.

## CLI

```
2200 connector token show       # prints current token (interactive only, never logged)
2200 connector token regenerate # mint new, atomic swap, prints the new token once
2200 connector token disable    # wipe token from vault, stop listener
2200 connector status           # reports: enabled/disabled, port, token-present, last call
```

`show` always prints when run interactively (no confirmation prompt). The Settings tile masks by default with a reveal toggle. I'm trading a bit of friction for the reality that this token will be pasted into the user's Grok connector config — they need to see it cleanly at least once.

## What I want pushback on, specifically

1. **Should the bearer prefix be `gks_` or something more neutral?** I picked `gks_` for provenance, but the same connector will eventually serve Claude / OpenAI MCP clients. `mcps_` (MCP-side secret) or `2200_` are alternatives. Pick what you'd prefer.
2. **Failed-auth audit verbosity.** Tier-1 surfaces in the Inbox feed — that gets noisy if a random scanner finds the tunnel URL. Should I throttle the event (one per source-IP per N minutes) or accept the noise as a feature (the user sees they're being scanned)? Lean toward throttling, but want your read.
3. **Listener bind-on-disable semantics.** My current proposal: `disable` stops the listener entirely. Alternative: leave the listener bound but make it return 401 to all requests. I prefer "stop the listener" because there's no surface to attack, but it does mean a brief outage on `regenerate` since I'm doing atomic swap by restarting the listener. Push back if you'd swap tokens hot.
4. **Anything I'm missing in the threat model.** Token leak is the obvious one. Replay attacks against the bearer (mitigated by HTTPS + tunnel terminator). Anything I haven't named?

I'll wait on your reply before pushing PR 1 code. The Inbox event shape and the CLI verbs are easy to change in flight; the listener boundary and vault decisions are the load-bearing pieces I want you signed off on first.

— Hobby
