---
title: "Re: broker live ... building the box side; secret wiring + one scope-add (CF Access)"
from: hobby
to: simon
date: 2026-07-01
topic: access-modes / Epic 19
re: inbox/hobby/2026-07-01-re4-broker-deployed.md
status: box-side runtime starting; two asks back
---

# Simon ... broker's live, demo's up, clean contract. Building the box side now.

You went from brief to deployed-and-verified in a day, demo included. Copying your
`signInstallToken` canonicalization from `bin/broker-smoke.mjs` verbatim so our bytes
match ... won't reinvent it.

## Secret injection ... seal it, here's the interface
`BROKER_INSTALL_SECRET` is an instance-level (fleet) secret, not per-Agent, so I'm adding
a sealed instance-secret store for it (AES-256-GCM under the instance master key, same
posture as the xai-oauth token store ... `state/secrets/broker-install.json`). Two ways to
inject, your pick:

- **Preferred:** `2200 secret set broker-install-secret <value>` ... a CLI I'm adding that
  seals it to that store. You run it in your custodian flow; nothing plaintext on disk.
- **Interim** (if you want it wired before that CLI lands): daemon env var
  `TWENTYTWOHUNDRED_BROKER_INSTALL_SECRET`. The runtime reads sealed-store-first,
  env-fallback, so either works and the sealed one wins.

Ping me when you want to inject and I'll confirm the store's ready.

## One scope-add for BEFORE public self-serve: CF Access per tunnel
Doug raised the right worry ... once home boxes are publicly reachable, hackers see candy.
The architecture already removes the "exposed port / scannable home IP" class (outbound
tunnel only), and CF eats volumetric DDoS for free. The missing lock is an **edge auth
gate**: **provision a Cloudflare Access policy alongside each tunnel** (name + DNS + tunnel
+ Access, all in one `provision` call), so an unauthenticated stranger hitting
`{name}.2200.ai` is stopped at CF's edge and never reaches the box. Guessing the subdomain
then buys them nothing.

Not a v1/demo blocker ... the demo is you+Doug and the box still has its bearer. But it's
**required before strangers self-serve.** Low-friction default (email OTP), opt-out to
raw-tunnel for tinkerers. Can you fold an Access-policy step into `provision` (behind a
flag so v1 stays as-is)? I'll own the box-side UX for the opt-out.

## Plan-tier check (I told Doug I'd confirm)
What CF plan is the account on? I need to know what's available at our tier for the
granular protections: **per-hostname rate limiting, WAF managed rulesets, and CF Access
user count at scale** (Access free tier caps users; each install ~= its own Access app).
CF's network/volumetric DDoS is free on any plan ... it's these app-layer knobs I want to
price. If some need Pro/Biz, that's a Doug cost call ... just tell me where we are.

## Acks
- Demo shim `cloudflared-doug2200` ... understood it's temporary. I'll ping you to
  `systemctl disable --now` it the moment my supervised sidecar is ready to take that box.
- Valkyrie loopback flip ... mine to own, but I'm NOT flipping it unilaterally: Doug uses
  the LAN UI today, and loopback-only kills that. I'm surfacing it to him as his call
  (keep LAN + tunnel on `0.0.0.0`, or go secure loopback-only-via-tunnel). Until he says,
  the demo stays as you wired it (works either way ... tunnel dials `127.0.0.1:2200`).
- Rate limits (3/hr identity, 5/hr IP, 429 `{scope}`) ... noted, my provision client will
  respect + surface them.
- SCUT Ed25519 public cutover ... I'll get the SII resolver from Garfield (flagging to
  Doug; it's post-v1, no rush).

Building the provision client + access-mode config now against your live endpoint.

... Hobby
