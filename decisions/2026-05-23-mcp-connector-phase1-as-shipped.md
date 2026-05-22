---
date: 2026-05-23
status: locked
authors: hobby, grok, doug
supersedes: (none)
supersededBy: (none)
---

# MCP connector — Phase 1 as shipped

Captures the concrete state of the MCP connector substrate after PRs 1a + 1b + 1c + 1d merged. The locked product handoff at `wiki/inbox/hobby/grok-mcp-connector-locked-handoff.md` is the canonical scope document; this record pins the substrate-level decisions Grok's 2026-05-22/23 reviews settled.

## Scope of "Phase 1 substrate"

The door, not the rooms. PR 1a–1d ship a dedicated MCP-over-HTTPS listener with bearer auth, sealed vault, full Inbox audit, CLI verbs, web Settings tile, first-run opt-in, and a single `liveness` probe tool. The real Phase 1 tool surface (`contribute_to_thread`, `propose_work_package`, `get_fleet_context`) lands in PR 2 onward.

## Decisions

### 1. Dedicated listener on `:2201`, isolated from web UI

A second Fastify instance, separate port (default `:2201`, env `TWENTYTWOHUNDRED_CONNECTOR_PORT`), separate bearer space. The web UI listener stays loopback-bound (`127.0.0.1`); the connector listener binds `0.0.0.0` because the user's tunnel points at it. Network binding is the security boundary, not route-level middleware.

**Why:** locked handoff: "binding > middleware." Mounting on one listener would either share bearer space (broken trust split) or require special-casing routes (footgun).

### 2. Bearer format: `2200-mcp-<43 base64url chars>`

32 random bytes via `crypto.randomBytes`, base64url-encoded, prefixed `2200-mcp-` for human-recognizable provenance.

**Why:** prefix per Grok review (2026-05-22) — low-key, provider-neutral, leaves room for non-Grok MCP clients later.

### 3. Sealed vault namespace distinct from OAuth

`<home>/state/connector/bearer.json`, sealed with AES-256-GCM + HKDF. The HKDF info string is `2200-connector-bearer-v1:fleet`, distinct from `2200-oauth-tokens-v1:fleet`. Per-fleet salt at `<home>/state/connector/salt` randomizes the wrapping key further.

**Why:** the bearer is a long-lived credential; the user has already pasted it into Grok's connector config. We protect it from local-disk casual reads but treat it as "long-lived but revocable from our side," not "secret from the provider." Per-purpose HKDF + per-fleet salt make sure a compromise of any single sibling store does not derive this one's wrapping key.

### 4. Auth: constant-time bearer, no fallback-allow, uniform 401

Every request reads `Authorization: Bearer <token>`; comparison is `crypto.timingSafeEqual` on equal-length buffers, length-mismatch short-circuits but returns the same 401 response shape. No vault token → listener doesn't bind at all (zero attack surface when disabled).

**Why:** uniform-response means an attacker can't probe error class. No fallback-allow per Grok review item #3 — better to be unreachable than ambiguously authed.

### 5. Audit emission BEFORE transport handoff

`connector.call_received` fires at request receipt, not after `mcp.transport.handleRequest` resolves. The SDK's streamable-HTTP transport holds SSE streams open well past the JSON-RPC result; post-handoff timing would defer the audit until the stream closes.

**Why:** Grok PR 1a review. The right semantic is "Grok called in," not "the response stream finally drained." A separate `connector.call_errored` event covers the transport-throws path. Latency / completion telemetry is deferred to a follow-up that has proper SDK hooks.

### 6. Per-source-IP throttle for failed-auth: in-memory, 10-minute window

`connector.auth_rejected` is tier-`normal` (operator-visible). Throttled to one event per source IP per 10 minutes; the next emission carries a `suppressed_since_last` counter. State is per-process; restart resets the window.

**Why:** scanner pounding the public tunnel URL shouldn't flood the Inbox. State on disk would add a corruption surface for no real continuity gain; the listener-restart Inbox event itself signals "the window reset" to the operator.

### 7. Brief outage accepted on regenerate; hot-swap rejected

`regenerateConnectorBearer` mints the new token, persists it, closes the listener (in order: `mcp.close()` → `fastify.close()` so SSE streams terminate from the server side), and starts a fresh listener. In-flight clients see a clean connection termination, not a half-open state.

**Why:** Grok review 2026-05-22 — "hot-swapping adds unnecessary complexity at this stage." `forceCloseConnections: true` + `connectionTimeout: 60_000` are the belt-and-suspenders for stuck streams.

### 8. Disable stops the listener entirely

`disableConnector` deletes the vault record and stops the listener (port closes, no surface to attack). Re-enable = `regenerateConnectorBearer` (mints fresh + starts listener). There is no "preserved-but-paused" intermediate state.

**Why:** Grok review — "zero attack surface when disabled" beats the convenience of preserving an inactive token.

### 9. Operator surfaces (CLI + Settings + first-run) — symmetric, default-NO at install

Three operator paths to the same vault:
- `2200 connector token show | regenerate | disable` (CLI), plus `connector status`.
- Settings → MCP Connector tile (masked token + reveal + copy + 2-step regenerate / disable).
- First-run wizard offers connector setup inline after Grok sign-in, default **NO**.

**Why:** CLI parity for headless use (and `show` writes paste guidance to stderr so `... | pbcopy` keeps the bare token on stdout). Settings tile makes regeneration safe-with-confirm. First-run default-NO keeps the install path uncluttered for users who don't yet know what MCP is.

### 10. Web-host loopback safety check

If `TWENTYTWOHUNDRED_WEB_HOST` is overridden to non-loopback, the daemon emits a `connector.web_host_non_loopback` Inbox event at boot.

**Why:** the entire MCP-connector security model assumes the web UI is loopback-only (it is the source of truth for the connector-management routes). If the operator opens that surface to a LAN or the public internet, the warning is the tripwire that surfaces the foot-gun.

### 11. X-Forwarded-For trust assumption

`clientIp` trusts `X-Forwarded-For` because the supported configuration is "operator's own single tunnel terminator in front of us" (ngrok / cloudflared / Tailscale Funnel). The audit values are never used for auth or routing — only operator visibility — so the worst case of an unscrubbed XFF is "fake IP in an Inbox event."

**Why:** documented in `listener.ts:clientIp` so a future non-tunnel deployment knows the assumption.

### 12. 1 MiB body limit

Sized for Phase 1's surface. `contribute_to_thread` will carry research blobs; PR 2 will raise the default and/or expose `bodyLimitBytes` via supervisor options.

**Why:** keep the door tight by default; widen explicitly when the tool surface needs it.

## Out of scope for Phase 1 (do not regress)

- Real tool implementations beyond `liveness`. Owned by PR 2+.
- `propose_work_package` arrival guard. **Load-bearing invariant**: the handler must only allow internal Agent-to-Agent messaging that produces a reviewable plan in the Inbox. Zero task / schedule / Agent / external side effects. Phase 2 PR must encode this as a guard, not just a comment.
- Standing-brief ownership + storage. The locked handoff names the contract; the implementation lands in PR 3 with Grok-as-reviewer.
- Rate limiting beyond Fastify defaults.

## Open future-proofing notes

- Master-key rotation: when key rotation lands, the connector bearer must be re-wrapped (or re-minted). TODO surfaced in `bearer-store.ts` header.
- MCP SDK supply chain: pin updates and re-review on each version bump. Comment present in `server.ts`.
- Multi-token / per-client attribution: today the connector is single-bearer for the operator's own fleet. If Phase 2 demand surfaces, multi-token is a follow-up.

— Hobby, with Grok architecture review and Doug final approval.
