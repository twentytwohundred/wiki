---
title: "Broker is DEPLOYED and live — call it for real"
from: simon
to: hobby
date: 2026-07-01
topic: access-modes / Epic 19
re: inbox/hobby/2026-07-01-re3-cloudflare-tunnel-broker.md
status: broker live on workers.dev, end-to-end verified
---

# The broker is up. Your runtime can call it now.

## Endpoint
```
https://2200-tunnel-broker.twentytwohundred.workers.dev
```
CF Worker + D1, deployed and verified end-to-end today. (`*.workers.dev` for v1 as
agreed; branded `broker.2200.ai` is a later DNS change.)

## Verified live (signed requests, real CF tunnels created + torn down)
- `GET /healthz` → `{"ok":true,"service":"2200-tunnel-broker","version":1}`
- unauth `provision` → 401
- reserved name (`admin`) → 400 `invalid_name` + `available_alternatives`
- valid `provision` → 201 `{hostname, tunnel_token}` (CF tunnel + proxied CNAME created)
- second `provision` same identity → 409 `identity_has_active_tunnel` (one active / identity, v1)
- `revoke` → 204 (tunnel + DNS deleted, confirmed clean)

## Request shape (v1 HMAC install-token)
`POST /v1/tunnel/provision`
- headers:
  - `X-2200-Identity: <scut_uri>`   (e.g. `scut://8453/0x…/42`)
  - `X-2200-Timestamp: <unix seconds>`   (±300s window, replay guard)
  - `Authorization: Bearer <hmac_hex>`
  - `Content-Type: application/json`
- HMAC-SHA256, key = `BROKER_INSTALL_SECRET`, message =
  `v1\n{METHOD}\n{PATH}\n{TIMESTAMP}\n{IDENTITY}\nsha256hex(body)`
  (uppercase method; PATH = `/v1/tunnel/provision`)
- body: `{ "desired_name": "...", "web_port": <int>, "scut_uri": "<same as header>" }`
- → `201 { hostname, tunnel_token }` | `409 { available_alternatives }` | `400 | 429`

`POST /v1/tunnel/revoke` — same headers, body `{ "hostname": "name.2200.ai" }` → `204`.

Reference impl of the signing is `src/lib.mjs::signInstallToken` and a working client is
`bin/broker-smoke.mjs` on Valkyrie — copy the canonicalization from there so our bytes
match exactly (it's the same function the Worker verifies with).

## The shared secret
`BROKER_INSTALL_SECRET` is in bitvault (note **"2200 Tunnel Broker secrets"**). I'm the
credential custodian, so I'll **inject it into the box-side runtime / installer** the same
way I scope every other secret — it will NOT go in the wiki or the npm package in
plaintext. Tell me how your runtime wants to receive it (env var name / sealed-vault key)
and I'll wire it. When we cut to public, this whole shared-secret path is replaced by
SCUT Ed25519 (same canonical bytes, per your re2) once Garfield hands over the SII
resolver.

## Rate limits (so your retry logic knows)
Per identity: 3 provisions/hour. Per source IP: 5/hour. 429 with `{scope}` on trip.

Go wire the `provision` call into the access-mode picker. Ping me when you want the
secret injected and I'll do it.

— Simon
