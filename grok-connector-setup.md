# Grok connector setup

This is the operator-facing runbook for the MCP connector that exposes 2200 to Grok (and any other MCP-speaking client). It's "your tunnel, your fleet, your bearer" — 2200 does not host anything in the middle.

Phase 1 ships a deliberately narrow surface: structured contributions land as Brain notes, research threads accumulate a synthesized standing brief, and proposed work packages sit inert in the Inbox until you explicitly approve them through the Settings page or `2200 connector work-package approve`. **No execution tool is reachable through the connector until you approve.**

## What you need

- 2200 running locally (`2200 daemon status` says it's up).
- A signed-in `xAI / Grok (SuperGrok subscription)` if Grok is the target client. Other MCP clients (Claude Desktop, ChatGPT MCP) work the same way; the runbook uses Grok as the canonical example.
- A tunnel service. Three are documented below; ngrok is the recommended quick-start.

## 1. Generate your connector bearer

```sh
2200 connector token regenerate
```

The output is the bearer for your install. **Shown once.** Copy it; you'll paste it at grok.com/connectors below. (You can re-display it any time with `2200 connector token show`; the value is in your sealed vault.)

Alternatively, mint and copy from Settings → MCP Connector → "Generate connector token." The Settings tile shows the masked token with a reveal toggle and copy button.

## 2. Stand up a tunnel

The connector listener is bound to `:2201` on `0.0.0.0` by default. The web UI listener stays loopback-bound (`127.0.0.1`) and is NOT reachable through any tunnel — that's the security boundary. Point your tunnel at port 2201.

### Option A: ngrok (recommended quick-start)

```sh
ngrok http 2201
```

ngrok prints a public HTTPS URL like `https://abc123.ngrok-free.app`. Copy it; you'll use it in step 3.

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

## 3. Register the connector at grok.com/connectors

1. Go to <https://grok.com/connectors>.
2. Click **New Connector** → **Custom**.
3. Enter the **MCP server URL**: `https://<your-tunnel-host>/mcp` (note the `/mcp` path — the listener mounts the MCP transport there).
4. Enter the **Authorization** value: the bearer from step 1. Grok injects it as `Authorization: Bearer <token>` on every call.
5. Save / activate.

Grok will discover the available tools (Phase 1: `liveness`, `contribute_to_thread`, `get_research_brief`, `get_fleet_context`, `propose_work_package`). Each tool's description tells Grok what it does; the Phase 1 framing is read + propose, never execute.

## 4. Confirm the chain

Call the connector from Grok with something simple ("ping the 2200 connector with the liveness tool"). The Inbox (`2200 notification list`) should show a `connector.call_received` event from your tunnel's source IP within a couple of seconds.

If you don't see that:
- Check `2200 connector status` — `listening: true` and a port should be reported.
- `curl -fsSL https://<your-tunnel-host>/mcp` from a different machine: should return a 401 (no bearer). That tells you the tunnel is reaching the listener.
- `curl -fsSL https://<your-tunnel-host>/mcp -H "Authorization: Bearer <your-token>"` → should return an MCP-shaped response (the listener accepts and the SDK requires more headers for a real call, but 401 vs 200 confirms auth).
- The daemon's log (under `<your-home>/state/supervisor.log`) shows tool calls landing.

## 5. The in-car / Tesla surface — **verify on your hardware**

Tesla in-car Grok runs on xAI's Voice Agent API backend, which **is** documented as supporting remote MCP. Practically:

- The web and mobile Grok surfaces are confirmed working in Phase 1.
- The Tesla in-car voice surface uses the same Voice Agent API and IS expected to honor custom connectors via the user's Grok subscription. **As of 2026-05, end-user reports for arbitrary user-registered connectors on the in-car surface are sparse.** The in-car experience may use a more curated tool subset and is still maturing via OTA.
- The car is therefore a **verify-on-your-hardware** target, not a shipped claim. If Grok answers in your Tesla using your fleet, that's the demo. If it doesn't, fall back to web/mobile (which covers 90% of the value) and watch xAI's connector updates.

This language is verbatim from the locked Phase 1 product handoff.

## How the safety story works

The connector enforces the following invariants. Every one of them is mechanical, not advisory:

1. **HTTPS only, tunneled.** Your tunnel terminates TLS; the listener never accepts plaintext. The web UI listener is loopback-only, so a misconfigured tunnel cannot accidentally expose the operator surface.
2. **Bearer required, constant-time compared.** No fallback-allow. A missing / mismatched / unprefixed bearer returns 401 with no body distinguishing the reason. `regenerate` instantly invalidates the prior bearer.
3. **Tool surface is read + propose.** The Phase 1 tools either read material out of the fleet or hand structured proposals in. No execution tool is reachable through the connector.
4. **Work packages sit inert.** A `propose_work_package` call writes a Brain note and submits an Agent task that has a **strict tool allowlist enforced at the dispatcher** (shared-brain read/write + pub coordination only). The coordinating Agent cannot call anything that executes, modifies external state, or spawns tasks — regardless of what the prompt says.
5. **Operator approval is the only path to execution.** When you `2200 connector work-package approve <id>` (CLI) or click Approve in Settings → Work packages, the parsed plan steps become normal Agent tasks via the existing task-submit substrate. Only at that moment does the Agent get its normal toolset back.
6. **Every call shows up in the Inbox.** `connector.call_received` for every authenticated call, `connector.contribution_received` / `_work_package_arrived` / `_synthesis_completed` / etc. for the semantic events. Auth rejections are throttled per source IP but always counted.

## Common knobs

| Setting | Where | Default |
|---|---|---|
| Listener port | env `TWENTYTWOHUNDRED_CONNECTOR_PORT` | `2201` |
| Body limit | env `TWENTYTWOHUNDRED_CONNECTOR_BODY_LIMIT_BYTES` | `8388608` (8 MiB) |
| Disable | `2200 connector token disable` | (listener stops; vault wiped) |
| Status | `2200 connector status` | — |
| Synthesis-blocked recovery | `2200 connector synthesis unblock <thread>` | (after 3 consecutive synthesis failures) |
| Work-package approval | `2200 connector work-package approve <id>` or Settings → Work packages | — |

## When something goes wrong

- **`connector.auth_rejected` events flooding the Inbox** — a scanner found your tunnel URL. Throttled per source IP to once per 10 minutes; harmless because the bearer is the entire perimeter. Rotate the bearer (`regenerate`) and the public URL if it concerns you.
- **`connector.web_host_non_loopback`** at startup — you've overridden `TWENTYTWOHUNDRED_WEB_HOST` to a non-loopback host. The Phase 1 security model assumes loopback-only for the web UI. Revert unless you know what you're doing.
- **`connector.synthesis_primary_missing`** — a research thread points at a primary Agent that isn't running. Either start the Agent or update the thread's `primary_agent` frontmatter.
- **`connector.synthesis_failed` × 3 → blocked** — the primary Agent failed to synthesize a brief three times. `2200 connector synthesis unblock <thread-slug>` resets the failure counter; the next contribution will trigger synthesis again.
- **`task_allowlist_violation` errors in a coordination task** — the coordinating Agent tried to call a tool outside its strict allowlist. This is the dispatcher's hard guard working as designed. The Agent's plan should account for the limitation ("I was unable to verify X because I could not call Y"). If a tool is consistently needed by coordination tasks, surface it as a separate operator-approval action; do not add it to the coordination allowlist without explicit review.

## References

- Decision record: `wiki/decisions/2026-05-23-mcp-connector-phase1-as-shipped.md`
- Locked handoff: `wiki/inbox/hobby/grok-mcp-connector-locked-handoff.md`
- Threat-model design notes for the listener + the hard guard: `wiki/inbox/grok/2026-05-22-mcp-listener-auth-design.md`, `wiki/inbox/grok/2026-05-23-pr4-propose-work-package-design.md`
- xAI's remote-MCP docs: <https://docs.x.ai/developers/tools/remote-mcp>, <https://docs.x.ai/grok/connectors>
