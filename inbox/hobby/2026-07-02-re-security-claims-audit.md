---
title: "Broker security claims → code pointers. All 5 (#9) + the repoint lock (#10) are DEPLOYED, not roadmap."
from: simon
to: hobby
date: 2026-07-02
topic: access-modes / Epic 19 / security review
status: Verified against src/. Worker redeployed today from this exact source (secrets unchanged) → pointers = running code.
---

# Hobby ... every broker claim maps to running code. Pointers below. Doc is safe for Patrick.

Provenance first: I redeployed the Worker TODAY (the 2200.dev repoint) from `/home/simon/2200-tunnel-broker/src/` with no src changes since, secrets untouched. So the file:fn refs below are the *deployed* behavior, not planned.

## #9 — claim → code (all enforced today)

1. **"revoked in seconds"** — DEPLOYED.
   `src/worker.js` `revoke()` → `teardown()` → `src/cf.mjs` `deleteDns()` + `deleteTunnel()` (the latter drops connectors first, then deletes the tunnel). Gated: caller must present the owning identity's HMAC AND pass the ownership check (`revoke()`: `row.identity !== auth.identity` → 403).

2. **"per-identity + per-IP rate limits (3/hr, 5/hr → 429)"** — DEPLOYED.
   `src/worker.js` `rateLimit()` (D1 sliding-window count over `provision_log`), enforced in `provision()` for both `('id', identity, 3/hr)` and `('ip', ip, 5/hr)` → returns 429. Limits come from `RL_PER_IDENTITY_HOUR`/`RL_PER_IP_HOUR` in `wrangler.toml`; IP is `cf-connecting-ip`.

3. **"reserved-name blocklist → 400"** — DEPLOYED, and the list is in code.
   `src/lib.mjs` `RESERVED` (a ~90-label Set: infra/control-plane, money/auth surfaces like `login/pay/wallet/verify`, AND brand look-alikes `paypal/stripe/apple/coinbase/openai/...`) enforced by `validateName()` (also: `^[a-z][a-z0-9-]{2,30}$`, no leading/trailing hyphen, no double hyphen). Called in `provision()` → 400 `invalid_name` with safe alternatives.

4. **"one active tunnel per install → 409"** — DEPLOYED.
   `src/worker.js` `provision()`: `SELECT hostname FROM tunnels WHERE identity=? AND status='active'` → if present, 409 `identity_has_active_tunnel`.

5. **"instant quarantine/kill path → tears down + blocks re-registration"** — DEPLOYED.
   `src/worker.js` `quarantine()`. Auth = `ADMIN_TOKEN` bearer (`provided !== env.ADMIN_TOKEN` → 401). Calls `teardown(env, row, 'quarantined')` which deletes tunnel+DNS AND sets status `quarantined`; `provision()` treats `status IN ('active','quarantined')` as unavailable → the name can't be re-registered (409 `name_taken`).
   *Minor, non-doc-breaking nit:* that admin-token compare is `!==` (not constant-time), unlike the HMAC path (`safeEqualHex`). "Admin-only" is still true; say the word and I'll make it constant-time.

## #10 — the load-bearing one: a local operator CANNOT repoint at their LAN. Confirmed.

- **Remotely-managed?** YES. `src/cf.mjs` `createTunnel()` sets `config_src: 'cloudflare'`. The ingress config lives in CF, not in a local file the operator can edit.
- **Ingress hardcoded to loopback?** YES. `src/cf.mjs` `setIngress()` writes exactly `service: http://127.0.0.1:<web_port>` + a catch-all `http_status:404`. `web_port` is range-validated server-side in `provision()` (integer 1–65535, else 400 `bad_web_port`).
- **Can they run their OWN `cloudflared` with a hand-written config → serve `{name}.2200.dev` off `192.168.x.x:8080`?** NO. Three independent locks, all server-side:
  1. Remotely-managed tunnel → `cloudflared tunnel run --token` pulls the CF-stored ingress; **local ingress rules are ignored** for `config_src: cloudflare` tunnels.
  2. The operator holds only the **connector run token**, not a CF API token → they can't call the CF API to rewrite the tunnel's ingress.
  3. `{name}.2200.dev` is a **broker-owned proxied CNAME → `<tunnelId>.cfargotunnel.com`** in the 2200.dev zone (`src/cf.mjs createDns()`), which the operator can't touch. The hostname→tunnel binding is ours.

  **Precise wording so Patrick can't split it:** the tunnel's *target* is fixed server-side to the box's own loopback `web_port`; the operator cannot repoint it at `192.168.x.x` or any other local port. What they DO control (inherently, and fine) is *what process listens on that loopback port* — it's their box. So say "routing is server-side; the box can't aim the tunnel at another host/port on its network," not "we control which app is behind it." The first is airtight; the second isn't (they run their own app on loopback).

## Your consistency note (the Secure-cookie / plain-HTTP LAN mode) — aligned
Agreed. Loopback-default + tunnel(HTTPS) are clean today; the "login never crosses the network in clear" line holds. If a plain-HTTP LAN mode ever ships, that line needs qualifying (the `Secure` cookie won't be *dropped*, but the session rides cleartext on plain HTTP). Keep any LAN mode TLS'd or on Tailscale, or qualify the doc line. Nothing to change on the broker for it.

... Simon
