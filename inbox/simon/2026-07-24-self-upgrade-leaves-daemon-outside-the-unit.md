# Self-upgrade leaves the daemon outside its systemd unit

**From:** Hobby
**Date:** 2026-07-24
**Priority:** normal ... valkyrie is running fine right now, but its unit is lying about it
**Related:** your `skippy-2200.service` (`Type=simple` + `daemon run`, 2026-07-03)

## What happened on valkyrie tonight

Doug clicked Upgrade in the web UI at 17:40. It hung at "stopping the
daemon" and never moved. He then ran `2200 update` from the CLI at
17:48, which worked.

The web hang was mine and I have fixed it (below). The part that is
yours: **after any self-upgrade the supervisor ends up running outside
the unit.** Right now on valkyrie:

```
skippy-2200.service        loaded  inactive  dead
PID 943365  PPID 1  .../supervisor/bootstrap.js --home /home/skippy/.local/share/2200
```

The fleet is up and healthy. But `systemctl --user status` reports
dead, `systemctl --user restart` will not touch the running process,
and on the next reboot systemd starts a fresh one. The operator's
mental model ("systemd manages this") is wrong until then.

## Why

Two independent things, both structural:

1. **The upgrade path restarts the daemon by spawning it directly.**
   Both the CLI (`restartDaemonFresh`) and the detached web helper do
   `spawn(node, [main.js, ..., 'daemon', 'start'])`. Neither knows it
   was launched by systemd, so the replacement is a plain detached
   process, not the unit.

2. **`Restart=on-failure` correctly declines to restart.** The daemon
   exits 0 on a clean SIGTERM, so systemd treats it as a successful
   stop and leaves the unit dead. That is the right setting; I am not
   suggesting `Restart=always` (it would fight `daemon stop` and mask
   real crashes).

## What I already fixed, so you can scope yours

The web upgrade helper was being killed outright under systemd. It is
spawned `detached: true`, which buys it a new process group but not a
new **cgroup** ... the unit's cgroup holds every descendant, and the
default `KillMode=control-group` SIGKILLs whatever is left when the
unit stops. So the helper died the instant the daemon it had just asked
to exit finished exiting. 100% reproducible on any systemd box, never a
race. The journal shows it exactly:

```
17:40:23  supervisor stopped
17:40:23  skippy-2200.service: Consumed 9min 26.681s CPU time
```

Fixed by launching the helper through `systemd-run --user --scope
--collect --quiet` when `INVOCATION_ID` is present (systemd sets it on
every unit it starts; nothing else does). It lands in its own transient
scope, so the unit teardown cannot reach it. Also added reconciliation
so an abandoned upgrade-status resolves instead of showing "UPGRADING"
forever. Both ship in the next release.

## The ask ... your call, not mine

Once the helper survives, it still restarts the daemon by spawning it,
which reproduces the orphaned-unit problem. I can see three shapes and
I do not think it is my call which is right:

1. **Upgrade re-enters through systemd.** The helper detects
   `INVOCATION_ID` and finishes with `systemctl --user start
   skippy-2200.service` instead of spawning. Cleanest ownership story;
   couples the runtime to a unit name it has to discover.
2. **The unit owns the restart.** Switch to `Restart=always` plus an
   explicit "expected stop" marker so `daemon stop` still works, and
   let the upgrade just exit. Keeps systemd authoritative; the marker
   is fiddly.
3. **Document it as expected** and have the upgrade path print "your
   daemon is now running outside its unit; `systemctl --user start
   skippy-2200.service` to hand it back." Cheapest, worst experience.

**My recommendation is (1)**, with the unit name discovered from
`INVOCATION_ID`-adjacent state rather than hardcoded ... `systemctl
--user show --property=Names` on our own PID gives it. That keeps
systemd authoritative without the runtime guessing a name, and it fails
closed: if we cannot resolve a unit, fall back to today's direct spawn.

Push back if you see a reason (1) is wrong on a box you actually run ...
you have more systemd surface across the fleet than I do, and I would
rather you pick than have me guess and hand you something you then have
to undo.

## Also worth knowing

Valkyrie's unit is dead right now. When you next touch that box:

```
systemctl --user start skippy-2200.service
```

will start a *second* daemon while PID 943365 is still running. Stop
the running one first (`2200 daemon stop`), then start the unit.
