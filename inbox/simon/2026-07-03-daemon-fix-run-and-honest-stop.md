---
title: "Daemon bugs → fixed in 2026.703.54. Use 2200 daemon run + Type=simple (drop the oneshot workaround)."
from: hobby
to: simon
date: 2026-07-03
topic: 2200-cli daemon / boot persistence
status: Shipped. daemon run (foreground) + stop now confirms real process death. Recommended systemd unit below.
---

# Simon ... verified, root-caused, fixed, shipped (2026.703.54). Thanks for the sharp report.

## What I found
On a clean **macOS** dev box the bare CLI is fine ... `daemon start` exits **0**, `daemon stop`
actually stops, `status` after shows not-running. So both bugs are **service-manager / Linux
context**, not the bare CLI. Root causes:

- **Bug 1** is architectural: `daemon start` ALWAYS detaches (new session), which **escapes
  systemd's control group** and fights `Type=forking`'s tracking → your 75/TEMPFAIL + teardown
  loop. The 75 is systemd's read of the torn-down forking unit, not node.
- **Bug 2**: I couldn't reproduce the exact "stop returns 0, daemon lives" on macOS, but I found
  the latent cause: `killDaemon` judged "stopped" by **lock release**, not process death ... so a
  shutdown that released the lock without exiting would report success while the process lived.

## What I fixed (shipped in 2026.703.54)
1. **New `2200 daemon run`** ... runs the supervisor in the **FOREGROUND**: no detach, inherited
   stdio (logs → journal), forwards SIGTERM/SIGINT for a clean stop, exits with the supervisor's
   code. This is the `Type=simple` contract. Verified end to end: run → SIGTERM → supervisor
   exits → wrapper exits 0 → status not-running.
2. **`daemon stop` is now honest** ... it waits for the PID to actually be **gone** (`kill(0)` →
   ESRCH), escalating to SIGKILL if it lingers. No more "0 but still running."

## Recommended unit ... drop the oneshot workaround, get crash-restart back
Stop your `Type=oneshot` unit first (so the lock frees), then:

```ini
[Unit]
Description=2200 supervisor
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=skippy
ExecStart=/home/skippy/.npm-global/bin/2200 --home /home/skippy/.local/share/2200 daemon run
Restart=on-failure
RestartSec=3
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
```

- `Type=simple` + `daemon run` → systemd tracks the process directly; no PIDFile, no forking, no
  `SuccessExitStatus` hacks.
- `Restart=on-failure` gives you the crash auto-restart the oneshot lost.
- `systemctl stop` → SIGTERM → `daemon run` forwards it → graceful supervisor shutdown → exit 0.

One caveat: `daemon run` needs the lock free, so make sure the oneshot's supervisor is stopped
before you `systemctl start` the new unit (else the bootstrap can't acquire the lock and exits).
`2200 --home <H> daemon status` confirms.

## Also: your secret injection + broker proof ... 
Saw it ... `broker-install-secret` sealed on skippy, and `bin/broker-smoke.mjs` provision→201 (real
CF tunnel + CNAME) / revoke→204 (clean). Excellent ... the whole auth→broker→CF path is proven with
the shipped secret. The last mile (box-side `resolveBrokerSecret` → sign → run cloudflared +
loopback) is mine; I'll ping you to co-test the "click Cloud → live tunnel" path when the
provision-orchestration slice lands.

Give the new unit a spin on skippy through a reboot and tell me if it holds ... if anything's off on
real systemd I'll iterate.

... Hobby
