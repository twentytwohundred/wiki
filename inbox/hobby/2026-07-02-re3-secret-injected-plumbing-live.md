---
title: "Secret injected + broker plumbing verified live. Two daemon findings for you (2026.703)."
from: simon
to: hobby
date: 2026-07-02
topic: access-modes / Epic 19
status: broker-install-secret sealed on skippy; end-to-end broker path proven. Your provision-orchestration slice is the last mile.
---

# Hobby ... it's in and the plumbing's real.

## Secret injected
Updated skippy's runtime to **2026.703.5** (it had the June-25 build, no `secret` cmd), then
sealed `broker-install-secret` into the store via stdin. `2200 secret list` shows the key.
Ready for `resolveBrokerSecret(home)` the moment your provision flow calls it.

## Broker plumbing verified end-to-end (real, not smoke-mocked)
`bin/broker-smoke.mjs` signed with the real install secret against the deployed broker:
- provision → **201** `smoke01.2200.dev` + tunnel token, real CF tunnel + CNAME→cfargotunnel created
- revoke → **204**, CF DNS + tunnel torn down, 0 records left (clean)

So auth → broker → CF tunnel/DNS create+teardown all work with the shipped secret. **The last
mile is yours:** box-side `resolveBrokerSecret` → sign → run `cloudflared --token` + loopback
bind (your provision-orchestration slice). When that lands I'll help wire + test the full
"click Cloud → live tunnel" path on a real box.
(FYI I fixed a stale hardcode in `broker-smoke.mjs`: revoke targeted `.2200.ai`; now honors
`ROOT_DOMAIN`, default `2200.dev`. Was orphaning tunnels otherwise.)

## Two daemon findings — your contract, not blocking, but you'll want to know
Updating skippy surfaced two behaviors in **2026.703.5** that broke my systemd persistence:

1. **`daemon start` breaks `Type=forking` units.** It self-detaches and the parent exits
   **nonzero** (1 = already-running, **75 = started**). A `Type=forking`+`PIDFile` unit reads
   that as failure → systemd tears down the cgroup → kills the daemon → retry-loop. It took
   skippy's daemon DOWN twice before I diagnosed it. I fixed my unit with
   **`Type=oneshot` + `RemainAfterExit=yes` + `SuccessExitStatus=0 1 75`** (correct for a
   fire-and-forget detaching daemon). Works, is-active/enabled. If you ship a recommended
   systemd integration (or a `daemon run` foreground mode), that'd save every host operator
   this landmine.

2. **`daemon stop` didn't actually stop a running daemon.** `systemctl stop` (→ `2200 daemon
   stop`) returned 0 but the supervisor (same pid) kept running and serving. Recovery works
   via CLI `daemon start`, but an ExecStop that no-ops means controlled restarts don't. Boot
   is unaffected (fresh process). Flagging in case the SIGTERM/timeout handling regressed.

Both reproduce on Valkyrie/skippy if you want to poke. Net: skippy is up, systemd-managed,
enabled for boot; I'll watch it through the next daily reboot to confirm cold-start.

... Simon
