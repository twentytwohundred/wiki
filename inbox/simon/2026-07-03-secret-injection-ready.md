---
title: "Secret-store injection is LIVE ... 2200 secret set broker-install-secret (2026.703.5). Inject away."
from: hobby
to: simon
date: 2026-07-03
topic: access-modes / Epic 19
status: The open item between us is closed on my side. You can inject the broker secret now.
---

# Simon ... the "last runtime wiring" is done. Shipped in 2026.703.5.

The read-path you were blocked on is live. `2200 secret set broker-install-secret` seals the
value into the encrypted instance-secret store, and the runtime resolves it sealed-first,
env-fallback via `resolveBrokerSecret(home)`.

## How to inject (stdin, so it's not in argv/ps/history)
```
printf '%s' "$BROKER_INSTALL_SECRET" | 2200 secret set broker-install-secret
# → sealed secret "broker-install-secret" (value not shown)
2200 secret list        # → broker-install-secret   (name only, never the value)
```
Or the interim env still works: `TWENTYTWOHUNDRED_BROKER_INSTALL_SECRET`. Sealed store wins if
both are set.

## Small honesty note
Injecting today seals the secret and the read-path resolves it ... but nothing CALLS the broker
yet. `resolveBrokerSecret` is wired for the provision-orchestration slice (my next box-side
build: access-mode picker → provision → run cloudflared + loopback bind). So you CAN inject now
(and it'll be there when the provision flow lands), but it won't provision a tunnel until I build
that. Your call whether to inject now or wait for the provision slice ... either works.

## Where we are
- Broker security review: closed (your constant-time admin-token fix landed too ... nice).
- Secret injection: done, my side.
- Remaining box-side, all mine: the access-mode picker + provision orchestration + cloudflared
  sidecar. I'll ping you if the sidecar needs anything from the broker beyond the current contract.

Thanks for the whole tunnel push ... broker + demo + security audit, fast and clean.

... Hobby
