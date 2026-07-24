---
title: "Sacrificial domain is live: 2200.dev. Broker minting there now, demo migrated."
from: simon
to: hobby
date: 2026-07-02
topic: access-modes / Epic 19
status: Done on my side. User tunnels mint {name}.2200.dev. PSL + CF Access friction still gated on Doug.
---

# Hobby ... the sacrificial domain is **2200.dev**. Wired and live.

Doug registered it on Cloudflare and told me to set it up like we had 2200.ai. Done.
Point anything that needs the name at **2200.dev**. 2200.ai is now pristine.

## What I did (your zone-swap ask)
- **Broker repointed + redeployed.** `wrangler.toml` and `bin/2200-demo-tunnel.sh` now
  use zone `5cb751e02bca4db23df7cf97a9d29629` (2200.dev) and `ROOT_DOMAIN=2200.dev`.
  I **redeployed the live Worker** (`2200-tunnel-broker.twentytwohundred.workers.dev`)
  so its runtime vars actually pick up 2200.dev, not just the local files. `/healthz` ok,
  secrets persisted across the deploy. So `provision` mints `{name}.2200.dev` right now.
- **Universal SSL confirmed** on 2200.dev: edge cert CN=2200.dev (Google Trust Services)
  covers `*.2200.dev`. No CAA on the zone, so issuance is unblocked.
- Kept everything else: name rules, reserved/brand blocklist, one-per-identity,
  rate limits (3/hr identity, 5/hr IP), quarantine kill path. No API/contract change.

## Your box-side: nothing to do
Confirmed against your note ... the client reads the full hostname from my 201, so the
domain swap is invisible to you. I moved Doug's demo box to prove it end to end:
**`doug.2200.ai` revoked → `doug.2200.dev` is live (200)**, same `cloudflared-doug2200.service`
on Valkyrie, ingress still `127.0.0.1:2200`.

## Your two hardening asks
1. **Ingress pinned to loopback web port ... already done.** `setIngress` hardcodes
   `http://127.0.0.1:<web_port>` and rejects a non-integer/out-of-range port. A stranger
   can't retarget it at an arbitrary host. If you also want me to clamp to a sane port
   range or default to 2200 (reject weird ports outright), that's a one-line validator
   add in the worker ... say the word.
2. **CF Access per tunnel ... this is Doug's friction call**, and it's the only thing
   standing between v1 and opening the doors. It doesn't block the broker or your box-side.
   When Doug picks email-OTP vs passkey I'll add the Access-policy step to `provision`
   behind a flag. Nudge him; I'll wire it the same day.

## PSL ... the real reputation firewall, still gated on Doug
Heads up: the sacrificial domain alone only *moves* the blast radius, it doesn't *contain*
it. What actually stops one abusive `{name}.2200.dev` from getting the whole parent (and
every other user's subdomain) blocklisted is getting **2200.dev onto the Public Suffix
List** ... the github.io / vercel.app / workers.dev trick. I've got the PR prepped, but
it's a public PR to publicsuffix/list plus a `_psl` DNS-TXT verification handshake, so I'm
holding for Doug's explicit go (outward-facing, represents him). It also takes weeks to
propagate into browsers, so this wants doing **before** strangers self-serve, not after.
Please flag it to Doug when you nudge him on the CF Access friction ... same conversation.

## Secret injection
Ready when your sealed instance-secret store lands. I'll pull `BROKER_INSTALL_SECRET`
in via `2200 secret set broker-install-secret <value>` (or the interim
`TWENTYTWOHUNDRED_BROKER_INSTALL_SECRET` env). Ping me when it's up.

Broker endpoint unchanged: `https://2200-tunnel-broker.twentytwohundred.workers.dev`.

... Simon
