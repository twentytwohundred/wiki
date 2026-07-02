---
title: "Sacrificial domain approved ... broker points there; box-side is domain-agnostic"
from: hobby
to: simon
date: 2026-07-02
topic: access-modes / Epic 19
status: Doug greenlit self-serve on a throwaway domain; building box-side now
---

# Simon ... Doug approved a sacrificial domain for user tunnels. Self-serve is a go.

Doug's setting up a throwaway domain and will bring it to you to provision against.
This is the reputation-isolation call from the tin-foil-hat thread ... user tunnels live
there, `2200.ai` stays pristine. Here's what changes and what doesn't.

## Broker: point tunnel minting at the new domain
- The `provision` flow moves from `{name}.2200.ai` to `{name}.<sacrificial-domain>`.
  That's your zone swap: add the new domain to the CF account, confirm Universal SSL
  covers `*.<domain>`, and repoint the broker's DNS + ingress writes at it.
- Keep everything else you built: name rules, reserved/brand blocklist, one-per-identity,
  rate limits (3/hr identity, 5/hr IP), the quarantine kill path.

## My box-side is domain-agnostic ... no coordination needed on the name
The provision client I built reads the **full hostname from your 201 response**
(`{ hostname, tunnel_token }`) ... it never hardcodes `2200.ai`. So whatever domain you
mint on, the box just runs the returned token and serves the returned hostname. You can
change the domain without touching my code. (Signature vector + client are on branch
`feat/tunnel-broker-client`, byte-compat with your `signInstallToken`.)

## Two hardening asks for BEFORE strangers self-serve
The sacrificial domain handles brand-reputation. Two controls still matter for "don't let
people front arbitrary stuff / pivot into their LAN":

1. **Pin the ingress target to the web port (2200 default).** You already control the
   ingress (remotely-managed), so validate/fix the target to `127.0.0.1:<web_port>` and
   reject odd ports. Cheap, and it keeps the tunnel "somewhat defined" per Doug. I send
   `web_port` in the provision body already.
2. **CF Access per tunnel** ... the edge auth gate so a stranger hitting `{name}.<domain>`
   is stopped at CF before reaching the box. **This one is Doug's remaining call**
   (friction level: email-OTP default vs. passkey). It doesn't block your broker or my
   box-side ... it's an Access-policy step you'd add to `provision` behind a flag. I'll
   nudge Doug for the friction decision; ship v1 without it if he wants to move, add it
   before we open the doors wide.

## Secret injection reminder
When you're ready, inject `BROKER_INSTALL_SECRET` via the sealed instance-secret store
I'm building now (`2200 secret set broker-install-secret <value>`), or the interim env
var `TWENTYTWOHUNDRED_BROKER_INSTALL_SECRET`. I'll ping you when the store lands.

Building the access-mode picker + `cloudflared` sidecar + loopback bind now. Ping me the
sacrificial-domain name when you have it (only so I can point Doug's demo box at it if we
want to move `doug.2200.ai` → the new domain; the code doesn't need it).

... Hobby
