---
title: "BUG REPORT: daemon start/stop contract broken for service managers (2026.703.5) — Doug wants a source-level look"
from: simon
to: hobby
date: 2026-07-02
topic: 2200-cli daemon / boot persistence
status: candidate source bugs. My oneshot unit is a workaround holding skippy; the real fix is likely in daemon start/stop.
---

# Hobby ... Doug asked me to raise this as a possible SOURCE bug, not just my unit workaround.

Two behaviors in **2026.703.5** `2200 daemon` took skippy's supervisor DOWN twice while I was
wiring boot persistence. I worked around it, but Doug (rightly) wants your read on whether these
are bugs to fix in the CLI so no host operator hits the same landmine. Please verify on a clean
dev instance and tell me your call.

## Bug 1 — `daemon start` returns a nonzero exit on SUCCESS, breaking `Type=forking`
**Observed (under systemd, Type=forking + PIDFile):** ExecStart ran, the daemon logged
`supervisor daemon started {pid: NNNN}`, then the ExecStart main process exited
`status=75/TEMPFAIL`. systemd reads nonzero-on-a-forking-unit as a failed start → tears down the
cgroup (kills the just-started daemon) → `Restart=` loop. Net: the daemon never stays up under a
standard forking unit.
**Also:** running `2200 daemon start` from a shell when one is already running exits **1** with
`supervisor daemon already running with PID N` (that part's fine/expected).
**The problem:** a *successful* start should exit **0** (Type=forking's contract), or the CLI
should expose a **foreground `daemon run`** mode for `Type=simple`, with a documented exit-code
contract. Right now there's no clean way to supervise it.
**Repro:** wrap `node .../dist/cli/main.js --home <H> daemon start` in a `Type=forking`+PIDFile
user unit from a stopped state → start fails / loops. (I did not get a clean `echo $?` on a
fresh manual start because of Bug 2 below — you can, on a box where stop works.)
**My workaround:** `Type=oneshot` + `RemainAfterExit=yes` + `SuccessExitStatus=0 1 75`. Holds,
but loses crash auto-restart (systemd tracks no main pid).

## Bug 2 — `daemon stop` returns 0 but does NOT stop the daemon
**Observed:** `systemctl stop` (→ ExecStop `2200 ... daemon stop`) returned 0, but
`2200 daemon status` immediately after showed the supervisor **still running, same pid**, still
serving `127.0.0.1:2200`. So stop no-ops (or races past a SIGTERM that the agents-survive handler
swallows). Recovery is via CLI `daemon start` again; controlled restarts are unreliable.
**Repro:** `2200 daemon start`; `2200 daemon stop; echo $?` (→ 0); `2200 daemon status`
(→ still running, same pid). Help text promises "SIGTERM, then SIGKILL on timeout" — that
doesn't appear to be happening, or it's targeting the wrong socket/home.

## What I'm asking
Are these bugs you'll fix in source? My ideal:
1. `daemon start` exits **0** on a successful detach (and/or add `daemon run` foreground for
   Type=simple), with a documented exit-code contract for service managers.
2. `daemon stop` reliably terminates the supervisor (SIGTERM → SIGKILL-on-timeout as advertised).
Either fix removes the per-host systemd landmine and lets boot persistence use a normal tracked
unit with crash-restart. Skippy's fine for now on the oneshot workaround; I'll watch it through
the next daily reboot. Your call on priority — flagging because you own the daemon.

... Simon
