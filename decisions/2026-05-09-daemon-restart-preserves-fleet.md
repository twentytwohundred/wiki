---
title: Daemon restart preserves the running fleet
type: decision
status: locked
date: 2026-05-09
tags: [decision, supervisor, daemon, lifecycle, operator-surface]
linked_docs:
  - "[[2026-05-09-process-boundary-bulletproofing]]"
  - "[[../handoffs/hobby/2026-05-09]]"
canonical_path: wiki/decisions/2026-05-09-daemon-restart-preserves-fleet.md
---

# Daemon restart preserves the running fleet

## Context

PR #180 (process-boundary bulletproofing) fixed the EPIPE death and
shipped a chaos test that proved an agent process can survive the
supervisor exiting. CI passed; verify green; chaos test green.

Then the live test of `2200 daemon stop && 2200 daemon start` killed
all three agents anyway. The chaos test was insufficient.

Reason: the chaos test spawned an agent directly via
`child_process.spawn` (bypassing `supervisor.spawnAgent`), so the
agent was never in `supervisor.spawned`. The supervisor's shutdown
loop iterates `this.spawned` to send `agent.stop` to each child;
empty set in the test means no stops fire. In production, every
real agent IS in `this.spawned`, so the operator's `daemon stop`
deliberately stops every agent.

`daemon stop` SHOULD do that ... explicit operator stop. But there
was no separate path for "I want to restart the supervisor without
flapping the fleet." The single shutdown path mixed two concerns.

## Decision

Two distinct supervisor exit paths, distinguished by the signal:

- **SIGTERM / SIGINT**: full stop. `supervisor.shutdown({ preserveChildren: false })`.
  Sends `agent.stop` to every running agent, waits for them to
  exit gracefully, closes everything. The operator's intent for
  `2200 daemon stop`.
- **SIGHUP**: bounce mode. `supervisor.shutdown({ preserveChildren: true })`.
  Stops listening on the UDS socket, runs the rest of teardown,
  but does NOT signal agents to stop. Agent processes keep
  running; their heartbeat-reconnect path picks up the new
  supervisor when it boots. Pub-server children are also
  preserved. The operator's intent for "restart the daemon
  without flapping the fleet."

A new CLI command `2200 daemon restart`:

1. Sends SIGHUP to the running daemon (via the new
   `signalDaemon(home, signal)` helper in `daemon.ts`).
2. Polls for the PID file to clear (10s timeout).
3. Re-spawns the daemon with `spawnDaemon`.

Surviving agents reconnect via the heartbeat path from PR #180
within ~10s of the new daemon listening.

## Why SIGHUP

Unix convention. `SIGHUP` traditionally signals "reload your
config, but keep the long-running children." Daemons that follow
this convention (sshd, nginx, journald) re-read config on SIGHUP
without restarting their child processes. Our usage matches: SIGHUP
exits the supervisor, but the agent processes (the long-running
"children") keep running.

The CLI hides this from operators. They run `daemon restart`; the
implementation detail of which signal is used is internal. The
documentation in `daemon stop` makes the distinction visible:

```
2200 daemon stop      # SIGTERM, agents stopped, full stop
2200 daemon restart   # SIGHUP, agents preserved, daemon re-spawn
2200 daemon start     # spawn daemon (no-op if already running)
```

## Trade-offs

- **`preserveChildren: true` paths must be careful**. Anything in
  the shutdown that assumes "I'm taking everyone with me" needs
  to handle the case where children are still running. Today only
  the spawn-stop loops were affected; future shutdown additions
  (telemetry flushing, cache eviction, etc.) need the same
  per-mode awareness.
- **Pub-server adoption** is a follow-up dependency
  ([[2026-05-09-path-discipline]] PR's companion fix). Without it,
  the new supervisor's `recoverFromState` killed the running
  pub-server and respawned it, breaking every agent's WebSocket
  connection. The fix: detect a live pub-PID at boot and adopt
  rather than kill+respawn. Without that, `daemon restart` is
  agent-survival-correct but Studio-broken.
- **Stale-PID handling**. Agents that survive a daemon restart
  re-register via the heartbeat path. Re-registration uses the
  agent's CURRENT PID, which matches what the supervisor expects.
  If an agent died and the operator started a new one DURING the
  restart, the supervisor sees both as registering with the same
  name; the latest registration wins. This is a known footgun
  (a registration RPC should reject when an alive PID already
  holds the name); flagged for follow-up.

## Consequences

### Immediate

- `2200 daemon restart` actually restarts the supervisor without
  killing agents. Operator can pick up a new build / config
  change without flapping the team.
- `2200 daemon stop` semantics unchanged: explicit stop, agents
  stopped too. No regression.
- The chaos test still covers what it was always covering (agent
  survives a full `supervisor.shutdown()` that doesn't propagate
  to the test agent because it wasn't in `this.spawned`); it does
  NOT cover the production-path "stop sends agent.stop to every
  child" case. That gap is real and should be closed by a new
  chaos test that uses `supervisor.spawnAgent` and verifies
  `daemon restart` (SIGHUP equivalent) preserves them.

### Future

- Same pattern can be applied to web-app reload (refresh static
  assets without breaking websocket connections).
- An eventual "soft kill" per-agent (the operator wants to
  restart Hobby specifically without affecting Simon or Jodin)
  could reuse the same signal-based machinery.

## Implementation pointers

- `src/runtime/supervisor/supervisor.ts` ... `shutdown(timeoutMs, options)`
  takes `preserveChildren?: boolean`; the spawned-children stop
  step is gated on it.
- `src/runtime/supervisor/bootstrap.ts` ... separate handlers for
  SIGTERM/SIGINT (full stop) and SIGHUP (preserve children).
- `src/runtime/supervisor/daemon.ts` ... new `signalDaemon` helper.
- `src/cli/main.ts` ... `daemon restart` subcommand.

## Provenance

PR #183 implemented after PR #180's chaos test passed but the live
test exposed the gap. Companion fix in PR #184 (pub-server
adoption) discovered and shipped same day after the SIGHUP path
broke the Studio. Locked.
