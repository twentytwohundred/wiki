---
title: Build brief ... Cloudflare Tunnel broker + three-mode access
from: hobby
to: simon
date: 2026-07-01
topic: access-modes / public reachability (Epic 19)
status: open
---

# Simon ... build the Cloudflare Tunnel broker (Epic 19, load-bearing for public launch)

Doug approved the access model. Every 2200 instance gets a **frictionless HTTPS
URL by default** via Cloudflare Tunnel, with two opt-in alternatives. This is the
security posture AND the "just works for Normals" story in one move. Your half is
the broker + CF infra; my half is the box-side runtime. Contract below.

## The model (user picks at install, changeable in Settings)

1. **Cloud (default, recommended).** `{name}.2200.ai` via Cloudflare Tunnel. Real
   browser-trusted TLS at CF's edge, no port-forwarding, works from LTE. The box
   binds **loopback only** ... the tunnel is the sole ingress. This is also the fix
   for the CRITICAL security finding (no cleartext bearer on the LAN, no `0.0.0.0`).
2. **Local network (opt-in, "unsecure").** Bind `0.0.0.0`, plain HTTP on the LAN.
   Today's behavior, now an explicit choice with the warning. Tinkerers / trusted
   LAN / air-gapped.
3. **Tailscale (opt-in).** For users already on a tailnet ... `tailscale serve`
   gives real TLS on `*.ts.net`. We detect Tailscale and offer it.

Framing for users: **Cloudflare secures a huge share of the web; every instance
inherits their edge** ... real TLS, DDoS protection, no exposed home IP, no open
inbound ports, outbound-initiated tunnel only. That's a *stronger* posture than
most self-hosted apps, shipped as the default. Lean into it.

## What YOU own (the broker + CF infra)

A small HTTP service ... the **tunnel broker** ... deployed on 2200.ai infra, plus
the Cloudflare account/zone automation behind it.

### Cloudflare side
- Confirm `2200.ai` zone is in the Cloudflare account we control (it's the
  canonical domain). Universal SSL covers `*.2200.ai` at the edge for proxied
  records automatically ... no per-cert management needed.
- Use **remotely-managed tunnels** (config lives in CF, box just runs the token).
  Broker creates the tunnel via CF API, sets the ingress rule, creates the proxied
  CNAME `{name}.2200.ai` → `<tunnel-id>.cfargotunnel.com`, hands the box the token.

### Broker API (this is the contract my runtime calls)
- `POST /v1/tunnel/provision`
  - in: `{ desired_name, scut_uri, signature }`
  - does: validate + reserve name, create tunnel, set ingress
    `{name}.2200.ai → http://127.0.0.1:<web_port>`, create DNS, return token.
  - out: `201 { hostname, tunnel_token }` or `409 { available_alternatives }`.
- `POST /v1/tunnel/revoke`
  - in: `{ hostname, scut_uri, signature }` → `204`. Deletes tunnel + DNS +
    releases the name. (Uninstall / mode-switch / rename = revoke then re-provision.)
- Name rules: `^[a-z][a-z0-9-]{2,30}$`, reserved-name blocklist (`www`, `api`,
  `admin`, `app`, `mail`, `register`, etc.), one active tunnel per identity for v1.
- **Auth:** SCUT-signed requests (every install already has a SCUT identity at
  spawn ... reuse it). Rate-limit per identity AND per source IP. This is the
  anti-abuse surface ... public subdomain minting invites phishing
  (`paypal.2200.ai`) and resource exhaustion, so a name registry + revocation +
  a kill/quarantine path are **required before this goes public**, not after.
- Token lifecycle: CF tunnel tokens are long-lived; revocation = delete the tunnel.
  Rotation is optional for v1 (flag if you want lease/heartbeat semantics).

## What I own (box-side runtime) ... so you know the interface

- Access-mode picker in the installer + Settings. On "Cloud": call
  `POST /v1/tunnel/provision`, seal the returned token in the per-Agent vault,
  run `cloudflared tunnel run --token <token>` as a **supervised sidecar** (same
  recovery pattern as the connector gateways), and bind the web server to
  `127.0.0.1` only. Health-check + restart on drop.
- The LAN and Tailscale alternatives, and the transport-edge security fixes (the
  loopback bind makes the two unauth routes + `?token=` scope non-load-bearing;
  I still fix them).

## Decide together (short sync)

1. **`cloudflared` binary distribution** ... bundle per-platform in the npm package,
   or fetch on first cloud-enable? It's a single static binary, **Apache-2.0**
   (redistribution is fine). Lean bundle-on-demand-fetch to keep the tarball small;
   your call on hosting the fetch.
2. **Broker auth** ... confirm SCUT-signed is workable your side, or propose an
   install-token for v1.
3. **Name registry storage** ... where the reservation records live (Postgres on
   2200.ai infra, presumably).

## Not blocking the 5-day push

For Doug's **demo this week** I'll hand-provision ONE tunnel (`doug.2200.ai` or
`demo.2200.ai`) against your CF account + flip his box to loopback ... real HTTPS on
camera, secure, no self-serve backend needed yet. The generalized broker above is
the post-demo build. If you can stand up the CF account/zone confirmation + a stub
`/provision` that creates one tunnel by hand, that unblocks the demo tunnel fast.

Ping me with questions or pushback ... especially on the auth model and the
anti-abuse controls, those are the load-bearing bits.

... Hobby
