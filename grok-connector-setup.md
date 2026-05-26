# Grok connector setup

This is the operator-facing runbook for the MCP connector that exposes 2200 to Grok (and any other MCP-speaking client). It's "your tunnel, your fleet, your bearer" — 2200 does not host anything in the middle.

The connector ships a deliberately narrow surface: structured contributions land as Brain notes, research threads accumulate a synthesized standing brief, and proposed work packages sit inert in the Inbox until you explicitly approve them through the Settings page or `2200 connector work-package approve`. **No execution tool is reachable through the connector until you approve.**

## What you need

- 2200 running locally (`2200 daemon status` says it's up).
- A signed-in `xAI / Grok (SuperGrok subscription)` if Grok is the target client. Other MCP clients (Claude Desktop, ChatGPT MCP) work the same way; the runbook uses Grok as the canonical example.
- A tunnel service. Three are documented below; ngrok is the recommended quick-start.

## Choose your auth path

The connector serves two auth paths simultaneously on the same `/mcp` endpoint:

| Path | Surface | Use for |
|---|---|---|
| **OAuth 2.0 + PKCE** | `Settings → OAuth clients` or `2200 connector oauth-client register` | grok.com/connectors, Tesla in-car Grok, anything that wires through the consumer connector flow |
| **Static bearer** | `Settings → MCP Connector → Generate connector token` or `2200 connector token regenerate` | Claude Desktop's MCP UI, headless scripts, any caller that pastes a fixed bearer into an Authorization field |

The grok.com/connectors form is OAuth-only and rejects static bearers at the Custom Connector save step; use the OAuth path for it. The static bearer is for the developer-API surface and other MCP clients that accept long-lived credentials.

## 1. Stand up a tunnel

The connector listener is bound to `:2201` on `0.0.0.0` by default. The web UI listener stays loopback-bound (`127.0.0.1`) and is NOT reachable through any tunnel — that's the security boundary. Point your tunnel at port 2201.

### Option A: ngrok (recommended quick-start)

```sh
ngrok http 2201
```

ngrok prints a public HTTPS URL like `https://abc123.ngrok-free.app`. Copy it; you'll use it in step 2 or 3.

Caveats:
- The free tier rotates the URL on each restart. If you re-launch ngrok, you'll have to update the connector URL at grok.com/connectors.
- Paid ngrok lets you reserve a stable URL.

### Option B: Cloudflare Tunnel

```sh
cloudflared tunnel --url http://127.0.0.1:2201
```

Prints a `https://*.trycloudflare.com` URL. Stable per session. For long-running deployments, set up a named tunnel against your own domain (see Cloudflare docs).

### Option C: Tailscale Funnel

```sh
tailscale serve --bg --https=443 2201
tailscale funnel 443 on
```

Surfaces the listener at `https://<your-tailscale-hostname>.<tailnet>.ts.net`. Stable across sessions; restricted to clients on the public internet (not your private tailnet).

### Anything else

Anything that gives you `https://<some-host>/` → `http://127.0.0.1:2201/` works. The connector requires HTTPS upstream; xAI's "Bring Your Own MCP" rejects plaintext connectors.

## 2. Register an OAuth client (consumer-side path, grok.com / Tesla)

Pre-authorize Grok to call your fleet by registering an OAuth client at the loopback Settings UI:

**Settings → OAuth clients → Register a new OAuth client.**

- **Display name:** "Grok" (or whatever helps you identify the client later).
- **Redirect URI:** defaults to `https://grok.com/connectors-oauth-exchange-code/` (the actual URI grok.com uses, discovered empirically 2026-05-23). Leave it on the default for grok.com/connectors; override only for a different consumer-side client.
- **Client secret:** leave unchecked. PKCE-only is the recommended path and matches grok.com's default "Token Auth Method: none (PKCE only)."

The registration result page displays the values you need to paste at grok.com:

```
MCP server URL:           https://<your-tunnel>/mcp
Client ID:                grok-<24 hex>
Client Secret:            (leave blank, PKCE-only)
Authorization Endpoint:   https://<your-tunnel>/oauth/authorize
Token Endpoint:           https://<your-tunnel>/oauth/token
Scopes:                   connector:full
Token Auth Method:        none (PKCE only)
Redirect URI:             https://grok.com/connectors-oauth-exchange-code/
```

CLI alternative: `2200 connector oauth-client register --display-name "Grok"` prints the same block.

### Now register the connector at grok.com/connectors

1. Go to <https://grok.com/connectors>.
2. **New Connector → Custom.**
3. Paste **MCP server URL** from above.
4. Paste **Client ID**.
5. Leave **Client Secret** blank.
6. Paste **Authorization Endpoint** and **Token Endpoint**.
7. Type **`connector:full`** into the Scopes field and press Enter.
8. **Token Auth Method:** leave on `none (PKCE only, recommended)`.
9. **Save and Continue.**

The OAuth handshake fires when you next use the connector (or immediately, depending on grok.com's UI state). 2200 emits `connector.oauth_authorize_succeeded` + `connector.oauth_token_issued` Inbox events on success.

### Operator surfaces for OAuth clients

- **Web:** `Settings → OAuth clients` lists every registered client with redirect URI, scopes, registered-at, last-authorize-at, and Revoke / Rotate Secret buttons (two-step confirms).
- **CLI:** `2200 connector oauth-client list | revoke <client_id> | rotate-secret <client_id>` cover the same surface.

Revoking invalidates every outstanding access + refresh token for the client. Rotating the secret keeps existing tokens valid but requires the new secret on subsequent client_credentials uses.

## 3. Static bearer (developer-API / Claude Desktop path)

Use this path if the MCP client accepts a long-lived bearer instead of OAuth:

```sh
2200 connector token regenerate
```

The output is the bearer for your install. **Shown once.** Copy it; paste it into the client's Authorization configuration. Re-display any time with `2200 connector token show` — the value is in your sealed vault.

Alternatively, mint and copy from `Settings → MCP Connector → Generate connector token`. The Settings tile shows the masked token with a reveal toggle and copy button; on regenerate the freshly-minted value is shown with a copy-toast pointing at the paste destination.

`regenerate` instantly invalidates the prior bearer.

## 4. Confirm the chain

Call the connector with something simple — "ping the 2200 connector with the liveness tool." The Inbox (`2200 notification list`) should show `connector.call_received` events for `initialize` → `tools/list` → `tools/call liveness` within a couple of seconds.

If you don't see that:

- Check `2200 connector status` — `listening: true` and a port should be reported.
- `curl -fsSL https://<your-tunnel-host>/.well-known/oauth-authorization-server` should return the AS metadata (200) — confirms the tunnel is reaching the listener.
- `curl -fsSL https://<your-tunnel-host>/mcp` should return 401 (no auth) — confirms the auth gate is up.
- The daemon's log (`<your-home>/state/supervisor.log`) shows tool calls landing.

## 5. The in-car / Tesla surface — **verify on your hardware**

Tesla in-car Grok runs on xAI's Voice Agent API backend, which **is** documented as supporting remote MCP. Practically:

- The web and mobile Grok surfaces are confirmed working (verified end-to-end 2026-05-23 against the real grok.com/connectors flow).
- The Tesla in-car voice surface uses the same Voice Agent API and IS expected to honor custom connectors via the user's Grok subscription. **As of 2026-05, end-user reports for arbitrary user-registered connectors on the in-car surface are sparse.** The in-car experience may use a more curated tool subset and is still maturing via OTA.
- The car is therefore a **verify-on-your-hardware** target, not a shipped claim. If Grok answers in your Tesla using your fleet, that's the demo. If it doesn't, fall back to web/mobile (which covers 90% of the value) and watch xAI's connector updates.

This language is verbatim from the locked Phase 1 product handoff. It does not change until Doug has personally watched it fire in a Tesla.

## How the safety story works

The connector enforces the following invariants. Every one of them is mechanical, not advisory:

1. **HTTPS only, tunneled.** Your tunnel terminates TLS; the listener never accepts plaintext. The web UI listener is loopback-only, so a misconfigured tunnel cannot accidentally expose the operator surface.
2. **Auth required, constant-time compared.** Both auth paths gate at the listener's preHandler. Missing / mismatched bearer → 401 with no body distinguishing the reason. Token-prefix disambiguation (`2200-mcp-at-...` for OAuth access tokens vs `2200-mcp-<no infix>` for static bearers) prevents silent permission widening between paths.
3. **OAuth pre-authorization IS the human security boundary.** Registering a client at the trusted (loopback) Settings UI captures the operator's "I trust this Grok integration" decision once. Subsequent `/authorize` requests over the public tunnel proceed without operator presence — no consent UI is ever rendered through the tunnel. Strict redirect-URI pre-registration prevents the authorization code from being delivered anywhere else; the new operator-side phishing vector is typing the wrong redirect URI at register time (mitigated by copying from grok.com, not typing).
4. **Tool surface is read + propose.** The shipped tools either read material out of the fleet or hand structured proposals in. No execution tool is reachable through the connector.
5. **Work packages sit inert.** A `propose_work_package` call writes a Brain note and submits an Agent task that has a **strict tool allowlist enforced at the dispatcher** (shared-brain read/write + pub coordination only). The coordinating Agent cannot call anything that executes, modifies external state, or spawns tasks — regardless of what the prompt says.
6. **Operator approval is the only path to execution.** When you `2200 connector work-package approve <id>` (CLI) or click Approve in Settings → Work packages, the parsed plan steps become normal Agent tasks via the existing task-submit substrate. Only at that moment does the Agent get its normal toolset back.
7. **Every call shows up in the Inbox.** `connector.call_received` for every authenticated call, `connector.contribution_received` / `_work_package_arrived` / `_oauth_token_issued` / `_synthesis_completed` / etc. for the semantic events. Auth rejections and OAuth `redirect_uri_mismatch` events are throttled but always counted.

## Common knobs

| Setting | Where | Default |
|---|---|---|
| Listener port | env `TWENTYTWOHUNDRED_CONNECTOR_PORT` | `2201` |
| Body limit | env `TWENTYTWOHUNDRED_CONNECTOR_BODY_LIMIT_BYTES` | `8388608` (8 MiB) |
| Disable static bearer | `2200 connector token disable` | (listener stops if no OAuth clients; vault wiped) |
| Status | `2200 connector status` | — |
| List OAuth clients | `2200 connector oauth-client list` or Settings → OAuth clients | — |
| Revoke OAuth client | `2200 connector oauth-client revoke <client_id>` | (invalidates all tokens for that client) |
| Rotate OAuth client secret | `2200 connector oauth-client rotate-secret <client_id>` | (existing tokens stay valid) |
| Synthesis-blocked recovery | `2200 connector synthesis unblock <thread>` | (after 3 consecutive synthesis failures) |
| Work-package approval | `2200 connector work-package approve <id>` or Settings → Work packages | — |

## When something goes wrong

- **`connector.auth_rejected` events flooding the Inbox** — a scanner found your tunnel URL. Throttled per source IP to once per 10 minutes; harmless because the auth gate is the entire perimeter. Rotate the bearer / revoke + re-register the OAuth client and rotate the public URL if it concerns you.
- **`connector.oauth_authorize_rejected` with `reason=redirect_uri_mismatch`** — the redirect URI in the registered OAuth client doesn't match what grok.com is sending. Check `Settings → OAuth clients` against the actual URI in the `redirect_uri` query parameter of the rejected `/oauth/authorize` request (visible in the ngrok inspector at `http://localhost:4040`). Revoke the client, re-register with the correct URI.
- **"error decoding response body" from Grok after a successful OAuth handshake** — was a real issue prior to 2026-05-23; resolved by switching the MCP transport to stateless mode (PR 251). If you see this again on a current build, check that the daemon is on a build at or after `0e5edd1`.
- **`connector.web_host_non_loopback`** at startup — you've overridden `TWENTYTWOHUNDRED_WEB_HOST` to a non-loopback host. The security model assumes loopback-only for the web UI. Revert unless you know what you're doing.
- **`connector.synthesis_primary_missing`** — a research thread points at a primary Agent that isn't running. Either start the Agent or update the thread's `primary_agent` frontmatter.
- **`connector.synthesis_failed` × 3 → blocked** — the primary Agent failed to synthesize a brief three times. `2200 connector synthesis unblock <thread-slug>` resets the failure counter; the next contribution will trigger synthesis again.
- **`task_allowlist_violation` errors in a coordination task** — the coordinating Agent tried to call a tool outside its strict allowlist. This is the dispatcher's hard guard working as designed. The Agent's plan should account for the limitation ("I was unable to verify X because I could not call Y"). If a tool is consistently needed by coordination tasks, surface it as a separate operator-approval action; do not add it to the coordination allowlist without explicit review.

## References

- Decision records: `wiki/decisions/2026-05-23-mcp-connector-phase1-as-shipped.md`
- Locked handoff: `wiki/inbox/hobby/grok-mcp-connector-locked-handoff.md`
- Threat-model design notes: `wiki/inbox/grok/2026-05-22-mcp-listener-auth-design.md`, `wiki/inbox/grok/2026-05-23-pr4-propose-work-package-design.md`, `wiki/inbox/grok/2026-05-23-phase2-oauth-as-locked-decisions.md`
- xAI's remote-MCP docs: <https://docs.x.ai/developers/tools/remote-mcp>, <https://docs.x.ai/grok/connectors>
