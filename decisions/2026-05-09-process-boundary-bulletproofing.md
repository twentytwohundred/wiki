---
title: Process-boundary bulletproofing for agent ↔ supervisor
type: decision
status: locked
date: 2026-05-09
tags: [decision, supervisor, agent, lifecycle, robustness]
linked_docs:
  - "[[../epics/02-agent-runtime-minimum]]"
  - "[[../handoffs/hobby/2026-05-09]]"
canonical_path: wiki/decisions/2026-05-09-process-boundary-bulletproofing.md
---

# Process-boundary bulletproofing for agent ↔ supervisor

## Context

Through session 13 testing Doug surfaced a recurring failure mode:
"agents die silently when the supervisor bounces." The supervisor
report `state: running` against a dead PID; nothing recovered. The
operator had no signal that anything was wrong until they tried to
interact and got nothing.

I patched several symptoms (heartbeat reconnect, supervisor liveness
watcher) but never found the actual death cause. Antigravity's
codebase review on 2026-05-09 identified it directly: it's an EPIPE
on stderr/stdout.

## The actual sequence

1. Supervisor spawns each agent via `child_process.spawn(...)` with
   `stdio: ['ignore', 'pipe', 'pipe']` so it can capture the agent's
   stdout/stderr into `<home>/state/supervisor.log`.
2. Operator runs `2200 daemon stop` (or the supervisor crashes).
3. The supervisor process exits. The read ends of the pipes it
   established to each agent are closed.
4. The agent is still running. Its next `process.stderr.write(...)`
   from the logger throws EPIPE.
5. EPIPE on a process stream that has no `error` listener is
   treated by Node as an uncaught exception. Process exits.
6. The new supervisor boots. `recoverFromState` checks each agent
   record's PID with `process.kill(pid, 0)`. The PID is alive (the
   agent died moments after the supervisor restart, AFTER recovery
   checked); supervisor adopts it.
7. State stays `running` indefinitely. Agent is a zombie record.

The kicker: the EPIPE death is silent because the agent's own log
mechanism is what dies. The error never makes it to disk.

## Decision

Three layered fixes, all in PR #180.

### 1. Agent bootstrap installs an EPIPE handler

`src/runtime/agent/bootstrap.ts` attaches an `error` listener to
both `process.stdout` and `process.stderr`:

```ts
function installPipeErrorHandler(stream: NodeJS.WriteStream): void {
  stream.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EPIPE') return
    throw err
  })
}
installPipeErrorHandler(process.stdout)
installPipeErrorHandler(process.stderr)
```

EPIPE is silently swallowed. Other stream errors (ENOSPC, EBADF)
re-throw so a real disk problem doesn't get masked.

Defense in depth: a `process.on('unhandledRejection', ...)` handler
logs and keeps running rather than crashing on any rejection that
slips past per-feature try/catches.

### 2. Two specific unhandled-rejection fixes

The reviewer found two paths where an exception inside an agent
process would bubble up past the per-feature try/catch and crash
the agent.

**`src/runtime/mcp/restart-manager.ts`**: `emitRestartNotification`
ran outside the try/catch around `spawnFn`. A notification-write
failure (file system permissions, brain index lock, disk full)
would bubble out of `restartLoop()` as an unhandled rejection.
Fix: wrap in its own try/catch, plus add a `.catch()` on the
floating promise assigned to `this.restartPromise`.

**`src/runtime/pub/wake-source.ts`**: `tryRouter()` (which calls
the LLM) ran outside the try/catch around `enqueueSyntheticTask`.
An LLM rate-limit / timeout / network error during ambient routing
would crash the agent process whenever ANOTHER agent posted in the
pub. Fix: wrap the call inside `handleEvent` and add a
top-level `.catch()` on the void-promise from the `onEvent`
subscription.

### 3. Supervisor shutdown can't hang

`src/runtime/control-plane/uds-server.ts` tracks every accepted
socket and force-destroys them on `close()` before calling
`server.close()`. Without this, `server.close()` waits for each peer
to gracefully drain, blocking shutdown forever when the agent
holds the connection open. The supervisor.shutdown's
connection-close loop also races each `conn.close()` with a 1500ms
timeout as a second line of defense.

### Chaos test

`tests/chaos/supervisor-bounce-survival.test.ts` spawns a real
agent child process (with the same stdio shape the supervisor
uses), verifies it registers with the first supervisor, shuts the
first supervisor down, asserts the agent is still alive after 2
seconds (the regression check), boots a second supervisor on the
same UDS path, waits up to 25s for a fresh heartbeat to advance
`last_heartbeat` past the second supervisor's boot timestamp.
End-to-end proof, ~10s real time. Lives under `tests/chaos/` to
keep it separable but runs as part of `pnpm test`.

## Live discovery

The chaos test passed; CI passed; `pnpm verify` green. Then the
live test of `daemon stop && daemon start` killed all three agents
anyway. Reason: the test's agent was spawned directly via
`child_process.spawn`, NOT through `supervisor.spawnAgent`, so it
was never in `this.spawned`, so the shutdown's "stop every spawned
agent" step was a no-op for it. The test was technically correct
but didn't exercise the real-world bounce shape.

That gap led directly to PR #183
([[2026-05-09-daemon-restart-preserves-fleet]]) which separated
"shut down the supervisor" from "shut down the supervisor AND
stop every running agent."

## Trade-offs

- The EPIPE handler swallows a class of errors that, in a vacuum,
  could indicate a real problem (a deliberate `pipe.end()` on a
  consumer that's actually broken, for example). In practice, the
  only path to EPIPE on agent stderr/stdout is the supervisor
  pipes closing, which is the case we want to handle. Other
  stream errors still re-throw.
- The `unhandledRejection` defense-in-depth handler MAY mask real
  bugs going forward. We accept that trade-off because the
  alternative is silent agent death; a logged "unhandledRejection
  (kept running)" line is at least observable.
- Force-destroying connections on shutdown is technically rude on
  the wire, but the agent side handles broken connections
  gracefully (the heartbeat reconnect path); peers that hold
  connections to the supervisor's UDS aren't a concern outside
  the agent process anyway.

## Consequences

### Immediate

- Agents survive supervisor SIGKILL.
- Supervisor shutdown completes within seconds, even with held
  connections.
- The two unhandled-rejection paths can't crash agents anymore.

### Future

- The chaos test sets a precedent: any new process-boundary
  feature should ship with a chaos test that exercises the
  failure mode. Pub-server survival is the next obvious gap (the
  PR #184 follow-up exposed this).
- The `unhandledRejection` handler could be extended to send a
  Passive notification to the operator when it fires, so a real
  unhandled rejection isn't silently logged.

## Implementation pointers

- `src/runtime/agent/bootstrap.ts` ... EPIPE + unhandledRejection handlers.
- `src/runtime/mcp/restart-manager.ts` ... wrapped notification call,
  `.catch()` on `restartPromise`.
- `src/runtime/pub/wake-source.ts` ... wrapped `tryRouter`, top-level
  `.catch()` on `onEvent`.
- `src/runtime/control-plane/uds-server.ts` ... `liveSockets` Set;
  force-destroy on close.
- `src/runtime/supervisor/supervisor.ts` ... timeout-bounded
  connection close loop in shutdown.
- `tests/chaos/supervisor-bounce-survival.test.ts` ... the
  end-to-end regression test.

## Provenance

Antigravity codebase review on 2026-05-09 identified the EPIPE root
cause and the two unhandled-rejection paths. Implementation in PR
#180. Live discovery of the supervisor-stops-agents path forced
the follow-up in PR #183.
