---
title: PID-file liveness via lockfiles
type: decision
status: locked
date: 2026-05-21
tags: [decision, supervisor, agent-lifecycle, hardening]
linked_docs:
  - "[[02-architecture]]"
  - "[[upgrade-readiness]]"
canonical_path: wiki/decisions/2026-05-21-pid-file-liveness-via-lockfiles.md
---

# PID-file liveness via lockfiles

**Date:** 2026-05-21
**Status:** Locked

## Context

Until today, the supervisor daemon and per-Agent liveness checks used `kill(pid, 0)` against the PID stored in a PID file. The OS recycles PIDs; on long-uptime hosts and any multi-user / shared-machine deployment, a freed PID can land on an unrelated process. The old check would then read "PID is alive" against the stranger and report our daemon (or Agent) as live when it had actually died.

The hazard cases:

- **Supervisor**: a stale PID file pointing at a recycled stranger PID causes `daemon start` to refuse with "already running" (annoying); or, more dangerously, every liveness-dependent check across the codebase sees "alive" against the wrong process.
- **Agent lifecycle**: `scanAgentLiveness` mistakes a stranger for a running Agent, leaving the supervisor's state out of sync with reality. The boot-time adopt path can mis-adopt a stranger; `validateAdoptedProcessArgv` mitigates this for SIGHUP-preserved children but does not cover the steady-state liveness loop.
- **Upgrade runner**: `waitForPidExit` can return early (the daemon is "gone") or wait forever (a stranger looks alive), depending on how the kernel routes PIDs during the window.

QC pass #2 (Grok, 2026-05-21) flagged the hazard explicitly and recommended either a boot-time nonce written into the PID file or an `fcntl` advisory lock held by the live process. The hazard had been documented but unaddressed; deferring it past v1 launch was rejected when the operating profile shifted to expect multi-user / shared-machine deployments within weeks.

## Decision

The supervisor daemon and every Agent process acquire a `proper-lockfile` lock on their PID file at boot. The lock is the authoritative liveness signal. All cross-process liveness checks ask "is this lockfile held?" rather than "is this PID alive?".

The PID number stays in the file for two reasons:
1. Operator inspection (`cat supervisor.pid` is useful).
2. Signal targeting (`daemon stop` reads the PID and sends SIGTERM directly to it, AFTER the lock-based liveness check confirms the PID belongs to our daemon).

`kill(pid, 0)` survives only in two places:
- The migration path (`readLegacyPidFile`) used by `daemon start` and `daemon stop` to detect a pre-lock daemon during the one-time upgrade transition.
- The `upgrade-runner`'s exit-detection loop, which prefers the lock signal but uses `kill(0)` as a faster secondary signal for the SIGKILL / crash case (avoids waiting the lockfile staleness window).

## Why `proper-lockfile` and not real `fcntl`

`proper-lockfile` is what npm itself depends on. It is a pure-JS lock that uses `mkdir` atomicity plus mtime-based staleness detection. Trade-offs vs. a native `fcntl`/`flock` binding:

- **Same correctness for our threat model.** The stranger-PID hazard is eliminated either way: liveness is tied to lockfile holdership, not PID identity. A stranger process has no way to fake holding our lockfile.
- **No native build.** No platform-specific compile step in the install path; no failure mode on uncommon platforms.
- **10s staleness window on SIGKILL.** This is the only meaningful difference. On graceful exit, the lockfile is removed instantly. On SIGKILL or crash, the lockfile looks held for up to `STALE_MS` (10s default) before staleness detection considers it free. For a one-daemon-per-host model where restarts are intentional events, 10s of "looks held" after a kill is acceptable. A native `fcntl` lock would release instantly because the OS tracks it.

If we later need instant-recovery-on-crash, the implementation can swap behind the `process-lock.ts` interface without changing any call site. The module surface is `acquireProcessLock`, `isLockHeld`, `waitForLockRelease`, and a `ProcessLock` handle with `release()`.

## Migration

Existing 2200 installs upgrading from pre-lock releases hit two transition windows:

1. **Old daemon still running, new daemon binary installed.** The new daemon's `startDaemon` sees no lock but reads the PID file and calls `kill(0)` via `readLegacyPidFile`. If alive, it refuses to start with a clear message: "supervisor daemon already running with PID X (legacy format, no lock file). Stop the old daemon ... before starting a new one. If you know the process is stale, remove `<pid path>` and retry."

2. **`daemon stop` against an old daemon.** `killDaemon` tries `readLivePid` first, then falls back to `readLegacyPidFile`. If the legacy fallback finds an alive PID, it sends SIGTERM and polls `isPidAlive` (not the lock) until the process exits.

After a single restart under the new release, the daemon (and every Agent it starts) holds the lock; the migration path stops firing.

## Consequences

**What gets better:**

- Stranger-PID hazard eliminated everywhere liveness matters: `daemon start` pre-check, `scanAgentLiveness`, adopt-on-restart, upgrade-runner exit detection.
- Liveness checks no longer depend on the host's PID-recycling behavior.
- Multi-user / shared-machine deployments are safe by default.
- Documentation of the hazard is single-sourced in `process-lock.ts` and `pidfile.ts`.

**What could get worse:**

- `daemon start` after SIGKILL waits up to 10s for the staleness window to expire before it can take the lock. Graceful exits release instantly.
- Adds a `proper-lockfile` runtime dep (pure-JS, no native build). Plus `@types/proper-lockfile` as a devDep.
- A user `rm`-ing the PID file while the daemon is running leaves the lock in an inconsistent state. The library tracks the lock directory next to the PID file (`<path>.lock/`); deleting the PID file directly is a manual operator action and is documented as "don't do that."

## Implementation guidance

- **Acquire**: at the very top of bootstrap, after writing the PID file. The supervisor's bootstrap calls `acquireSupervisorLock(home, process.pid)`; an Agent's bootstrap calls `acquireProcessLock(agentPaths(home, name).pidFile, ...)`.
- **Release**: in the shutdown handler, BEFORE removing the PID file. Order matters: release marks the slot free; PID-file removal makes the post-shutdown state unambiguous.
- **Check**: from any other process via `isLockHeld(pidPath)`. The PID file does not need to be readable for the check; the library uses its own `.lock` directory.
- **Don't use `kill(0)` for liveness in new code.** It survives only in the documented migration paths.

## References

- [`src/runtime/supervisor/process-lock.ts`](../../code/2200/src/runtime/supervisor/process-lock.ts)
- [`src/runtime/supervisor/pidfile.ts`](../../code/2200/src/runtime/supervisor/pidfile.ts)
- QC pass #2 findings (delivered 2026-05-21): "The PID-file liveness model trusts a live PID number ... without proving it is our process."
- npm's use of `proper-lockfile` for its own install-time mutex (the same library powers `npm install` concurrency safety).

## Format provenance

Brain-format decision record per [[conventions/decision-record-format]]. Sections: Context, Decision, Why X and not Y, Migration, Consequences, Implementation guidance, References, Format provenance.
