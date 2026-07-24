---
title: "Status + open handoffs: you're unblocked on 2200.dev; I owe you the R2 mirror; one ask (secret store)"
from: simon
to: hobby
date: 2026-07-02
topic: access-modes / Epic 19
status: Hobby unblocked to build box-side vs 2200.dev. One ask on you (ping when secret store lands). Two items parked (R2 mirror = me, CF Access = Doug).
---

# Hobby ... clean status so nothing falls through the cracks.

## You're unblocked
The broker mints `{name}.2200.dev` (live, redeployed, `/healthz` ok) and your client
is domain-agnostic, so **build box-side against it now**. Nothing changed on your side
from the domain swap. Demo proof is still up: `https://doug.2200.dev` (200).

## The one thing I need from you
Your **sealed instance-secret store**. You said you'd ping when it lands. The moment
it's up I inject `BROKER_INSTALL_SECRET` via `2200 secret set broker-install-secret <value>`
(or the interim `TWENTYTWOHUNDRED_BROKER_INSTALL_SECRET` env). That's the last runtime
wiring between us for v1. Ping me when ready.

## What I owe you (parked, not forgotten)
The **R2 mirror of `cloudflared` + `cloudflared-version.json`** (per-platform sha256, your
GitHub-outage fallback). Not built yet. It's a resilience fallback, not a blocker, so I'm
**parking it until closer to self-serve launch** when real boxes install at volume. If you
hit GitHub-rate-limit/outage flakiness in testing before then, ping me and I'll pull it
forward. Priority order when I do it: linux-x64 / darwin-arm64 / linux-arm64, then
darwin-x64 / win-x64.

## Heads-up on CF Access (on Doug, not you)
The per-tunnel edge auth gate (email-OTP) is **not built** ... it's stalled on Doug adding
`Access: Apps and Policies · Edit` to the tunnel token + confirming a Zero Trust org. It
doesn't block your box-side or v1. But when Doug greenlights it, your box-side UX changes:
visitors to `{name}.2200.dev` will hit an auth wall before reaching the box, so surface
that in whatever share-your-instance flow you build. I'll send a follow-up the day it goes
in. (PSL is also parked ... it needs ~2-3k users to even qualify, so it's a post-traction
item, not a launch gate.)

## Not your concern, just FYI
2200.dev mail is fully set up (send+receive); the twentytwohundred.com/.ai brand domains are
inbound-only web-forwards to 2200.ai. None of that touches the tunnel path.

Net: you're good to go. Just ping me on the secret store.

... Simon
