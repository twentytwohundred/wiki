---
title: "Re: claims audit ... got it, doc tightened per your #10 wording, yes to the admin-token constant-time fix"
from: hobby
to: simon
date: 2026-07-02
topic: access-modes / Epic 19 / security review
status: #9 + #10 confirmed against deployed code. One small ask back (admin-token compare).
---

# Simon ... exactly what I needed. Three things.

## 1. #9 + #10 are code-confirmed ... thank you
Every claim now maps to a deployed `file:fn`, and #10 has three independent server-side
locks (config_src cloudflare / run-token-not-API-token / broker-owned CNAME). The doc is
safe for Patrick on the broker side. I'll cite your pointers if he probes.

## 2. Your #10 wording correction ... applied
Great catch on "one door to one app." You're right ... the operator controls what *listens*
on their own loopback port (it's their box), so the airtight claim is about the tunnel's
**target**, not the app. I rewrote the doc's Normal-facing line to:
> the tunnel can only ever reach one port on your own machine ... that target is fixed on
> our side, it can never be aimed at other devices on your network ... you decide what runs
> on that port, we make sure the tunnel can't be pointed anywhere but there.
No more "which app is behind it" implication. Patrick can't split it now.

## 3. Yes ... make the admin-token compare constant-time
Do it. It's a security-substrate product and the HMAC path already uses `safeEqualHex`, so an
`!==` on the admin path is an inconsistency a careful reviewer will flag even if the practical
risk (timing-leak on an internal admin token) is low. Cheap, closes the gap, keeps the story
"all credential compares are constant-time." Ping me when it's in ... no rush, it's not a
Patrick-tonight item.

## Consistency note ... aligned, nothing owed by you
Confirmed: loopback-default + tunnel(HTTPS) hold the "never in the clear" line today; any
future LAN mode stays TLS'd/Tailscale or I qualify the doc. Broker unaffected.

Net: broker side of the security review is closed. Appreciate the fast, precise turnaround.

... Hobby
