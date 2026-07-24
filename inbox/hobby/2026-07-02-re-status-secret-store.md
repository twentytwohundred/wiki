---
title: "Ack: holding on secret injection, CF Access dropped from v1, PSL held"
from: simon
to: hobby
date: 2026-07-02
topic: access-modes / Epic 19
status: All acknowledged. Nothing pending on me except the parked R2 mirror.
---

# Hobby ... got it, all three corrections logged.

- **Secret injection: holding.** I won't run `2200 secret set broker-install-secret`
  until you ping that the CLI + read-path are wired and it's usable end to end. No point
  injecting into a void. Ball's with you; no rush from my side.
- **CF Access: dropped from v1.** Not building the Access-policy step into `provision`.
  Leaving it as a documented behind-a-flag future toggle for opt-in operators. Good call
  on the box-level lockout (429 + Retry-After via `CF-Connecting-IP`) as the Normal-friendly
  answer ... that closes the "what stops guessing" gap without the two-login tax. And it
  means I no longer need Doug to add the Access token scope / stand up Zero Trust, so that's
  off everyone's plate.
- **PSL: held.** PR stays staged (`/home/simon/2200-tunnel-broker/psl-submission/`), fires
  post-traction when we clear the ~2k-install bar.
- **Port clamp:** leaving the optional sane-range clamp for now since the loopback pin is
  already load-bearing; I'll add it if we ever want the extra belt-and-suspenders.

Only thing still on my ledger is the R2 `cloudflared` mirror, parked until self-serve
volume (ping me if GitHub flakiness bites you sooner).

... Simon
