---
title: Is it safe to reach your 2200 from anywhere? (Yes ... here's why)
type: reference
status: active
tags: [security, tunnel, access, trust, cloudflare]
created: 2026-07-02
updated: 2026-07-02
linked_docs:
  - "[[02-architecture]]"
  - "[[README]]"
canonical_path: wiki/tunnel-security.md
---

# Is it safe to reach your 2200 from anywhere?

Short answer: **yes ... and it's a safer setup than most self-hosted software
ships with.** You are not opening your home network to the world. You are getting
a private, encrypted door that only you hold the key to, with Cloudflare standing
guard in front of it.

Here's exactly why, in plain terms.

## Your computer is never exposed to the internet

When you turn on the "Cloud" option, 2200 does NOT open a port on your router or
put your home computer on the public internet. Instead, your computer makes an
**outgoing** connection to Cloudflare ... the same way your browser reaches a
website. Because the connection goes *out*, there is:

- **no open port** on your router for anyone to find,
- **no home IP address** exposed ... the public address points at Cloudflare, not
  at you,
- **nothing to scan for.** The single most common way home servers get attacked
  ... someone scanning the internet for open machines ... simply cannot find you.

## Cloudflare stands guard in front

Cloudflare already protects a huge share of the entire internet. With 2200's Cloud
option, they sit **in front of** your instance. Attacks like traffic floods
(DDoS) hit Cloudflare's global network and are absorbed there ... they never reach
your computer. This is automatic, and it is what Cloudflare does for a living.

So if someone ever tried to hammer your address, that's Cloudflare's problem to
swat down, not your laptop's.

## Your computer only ever talks to itself

2200 listens **only on your own machine** (what engineers call "loopback"). The
secure tunnel is the *only* path in. That means:

- **nothing is open on your home Wi-Fi** ... other people or devices on your
  network can't reach it either,
- your **login never travels across your network in the clear.**

## Only you get in, and it only reaches your 2200

Reaching your instance requires **your login** ... a stranger who somehow learned
your address is refused without it. Every request to your data is checked against
your token; nothing is served without it. (Coming, before self-serve opens to the
public: an additional Cloudflare Access gate that turns strangers away at the edge
*before* they even reach the login screen. It is not enabled yet ... today your
login is the identity check.)

And the tunnel can **only** ever connect to your 2200 app, on one specific port.
*We* control that ... not the tunnel, not an attacker. It can never be pointed at
other devices on your home network, at your files, or at anything else. One door,
to one app, that you control.

## You're in control, always

- **Switch it off anytime.** Prefer to keep 2200 on your home network only, or use
  Tailscale instead? Both are one setting away. Cloud is the default because it's
  the easiest *and* the safest, but it's your choice.
- **Instant shutoff.** The tunnel runs on infrastructure we operate, so if anything
  is ever wrong, it can be revoked in seconds.

## The honest technical version (for the skeptics)

- Transport: an **outbound-only Cloudflare Tunnel** (`cloudflared`). No inbound
  ports; the origin IP is never published.
- The 2200 web server binds **`127.0.0.1` only** in Cloud mode. The tunnel is the
  sole ingress; the LAN sees nothing.
- TLS terminates at Cloudflare's edge with a **real, browser-trusted certificate**
  on the tunnel hostname. No self-signed warnings, no cert to manage.
- The tunnel is **remotely-managed** ... its routing (one hostname → `127.0.0.1`
  on one port) is set server-side by us, so the box operator can't repoint it at
  arbitrary local targets or the rest of the LAN.
- **Every request is authenticated** at the 2200 app: a 256-bit random bearer,
  compared in constant time (`timingSafeEqual`), required on every `/api/*` route
  and the WebSocket. Off-box requests with no/invalid token get `401` (HTTP) or a
  `4401` close with zero data (WebSocket) ... verifiable with `curl` against any
  live instance.
- **Planned, not yet enabled:** a Cloudflare **Access** policy that gates the
  hostname at the edge (an identity check before the box). Until it ships, the
  edge provides DDoS/proxy protection but not an identity gate ... the login is
  the identity check.
- Abuse controls on our side: per-identity rate limits, a reserved-name blocklist,
  one active tunnel per install, and an instant quarantine/kill path.

## Where this is in the product

This same explanation will appear **at the moment you choose Cloud mode** in setup
(and in Settings), so you're not asked to trust a black box ... you'll see exactly
what you're turning on before you turn it on. (The Cloud access-mode picker is in
build; today's tunnels are provisioned by the 2200 team.)

---

*Not sure? Start with the home-network-only ("Local") or Tailscale mode and switch
to Cloud whenever you're comfortable. Nothing about your Agents or your data
changes ... only how you reach them.*
