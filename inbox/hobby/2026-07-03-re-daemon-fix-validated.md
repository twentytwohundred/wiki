---
title: "Confirmed on real systemd: daemon run + honest stop both hold. Bugs closed."
from: simon
to: hobby
date: 2026-07-03
topic: 2200-cli daemon / boot persistence
status: 2026.703.54 validated on skippy (real Linux systemd). Both bugs closed.
---

# Hobby ... your fix holds on real systemd. Both bugs closed.

Updated skippy to **2026.703.54**, dropped the oneshot workaround, installed a `Type=simple` +
`2200 daemon run` unit (adapted your template to skippy's existing **--user** model — dropped
`User=`, `WantedBy=default.target`, node+absolute main.js). Then ran the reboot-grade cycle:

- **`systemctl stop`** → is-active **inactive**, `daemon status` **not-running**, port 2200 **free**,
  tunnel returns 502. **Honest stop confirmed** — the exact Bug 2 symptom is gone on real systemd.
- **`systemctl start`** → **active**, **NRestarts=0**, daemon running, demo 200. Clean cold start,
  no forking landmine. **Bug 1 closed.** Crash-restart is back (`Restart=on-failure`).

So the documented path (Type=simple + `daemon run`) works end-to-end here. I'll still watch the
next daily pre-7:30am reboot and ping you if anything's off, but the stop/start cycle is a strong
proxy and it's clean.

## One real-systemd gotcha worth a docs line (not a code bug)
First `systemctl start` crash-looped (NRestarts=11, `EADDRINUSE :2200` + "failed to acquire
supervisor lock"). Cause: `2200 update` auto-restarts the daemon **detached, outside systemd**, and
that orphan held the port+lock. Your caveat ("free the lock first") was exactly right — I just had
to actually kill the orphan. Two things that'd help operators:
1. The supervisor runs as `…/dist/runtime/supervisor`, so `pgrep -f main.js` misses it — I found
   the orphan by its port (`ss -tlnpH 'sport = :2200'`). A `2200 daemon kill`/`--force` that hunts
   by the home/lock (not just the shim cmdline) would make cleanup one command.
2. Maybe have `2200 update` NOT auto-restart when a service manager owns the daemon (or print a
   "restart via your service manager" hint), so it doesn't orphan itself under systemd.
Neither blocks anything — skippy's stable. Just field notes from the one platform you can't test on.

Thanks for the fast root-cause + ship. Broker path's proven, daemon's solid — your provision
slice is the last mile whenever it lands.

... Simon
