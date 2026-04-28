---
title: 'Decision: Supervisor ↔ Agent Control-Plane Protocol'
type: decision
status: locked
tags: [decision, runtime, supervisor, ipc, protocol, epic-2]
created: 2026-04-26
updated: 2026-04-26
linked_docs:
  - '[[02-agent-runtime-minimum]]'
  - '[[02-architecture]]'
  - '[[2026-04-25-mcp-native]]'
canonical_path: wiki/decisions/2026-04-26-control-plane-protocol.md
---

# Decision: Supervisor ↔ Agent Control-Plane Protocol

## Context

Per [[02-agent-runtime-minimum]], the supervisor and Agent processes need a control-plane channel for lifecycle operations (spawn, stop, restart, status, "you have a new task", "respond to this notification"). The Epic 2 spec lists this as an architecture choice that is not pre-decided. This record locks the choice before the supervisor PR lands.

Constraints:

- **One process per Agent.** The supervisor is its own process; Agents are children. The control plane crosses process boundaries.
- **Cross-platform.** macOS and Linux now; Windows later. The transport must work on all three with one implementation path.
- **Restart-safe per [[upgrade-readiness]] discipline 3.** Either side can be killed and restarted without data loss; the protocol must support reconnection.
- **Inspectable.** The plan/run/perm wrapping is the bigger inspection surface, but control-plane traffic should also be debuggable when something goes wrong.
- **Aligned vocabulary with the MCP layer.** Per [[2026-04-25-mcp-native]] the runtime speaks JSON-RPC for tool calls. Using a wildly different vocabulary for the supervisor↔Agent channel adds cognitive load.

Options considered:

1. **Unix domain socket (UDS) + JSON-RPC 2.0 framed by newline-delimited JSON.** UDS is filesystem-permission-secured, low overhead, native on macOS and Linux. JSON-RPC 2.0 is a tiny well-known protocol with simple request/response and notification semantics. NDJSON framing is trivially debuggable (`cat` the socket). Cross-platform: Node 22+ supports UDS-style semantics on Windows via libuv; the same code path works.
2. **Named pipes (Windows) + UDS (Unix), per-platform.** Two transports, one of which only matters on Windows. More code, more edge cases, no real benefit since libuv abstracts UDS-on-Windows.
3. **gRPC over loopback.** Protobuf schemas, code generation, HTTP/2 transport. Heavyweight for the scope. Reasonable if we expected polyglot consumers; we do not (everything inside 2200 is TypeScript).
4. **HTTP over loopback (REST or JSON-RPC over HTTP).** Very debuggable (curl). Overhead is non-trivial per call but acceptable. Adds an HTTP server to every Agent process, which is more surface than needed for control-plane.
5. **stdio (parent ↔ child only).** Tight coupling between supervisor and Agent processes. Does not scale to multiple Agents managed by one supervisor without multiplexing. Wrong shape.

## Decision

**Option 1: UDS + JSON-RPC 2.0 over newline-delimited JSON.**

- **Transport:** Unix domain socket. The supervisor listens on `<state-dir>/supervisor.sock`. Agents connect on boot.
- **Protocol:** JSON-RPC 2.0. Two message types: requests (with `id`) and notifications (no `id`). Errors follow the spec's `{ code, message, data? }` shape. Reserved codes per the spec; implementation-defined codes start at -32000.
- **Framing:** Newline-delimited JSON. Each message is a single JSON object, terminated by `\n`. No length prefix. No binary framing.
- **Reconnection:** Either side reconnects on disconnect. The protocol is stateless at the transport layer; correlation is via the JSON-RPC `id` field within a connection. Cross-connection state (Agent's current task, its detector trip status, etc.) lives on disk per [[upgrade-readiness]] discipline 2 and is reloaded on reconnect.
- **Cross-platform:** libuv (Node) presents a unified UDS-like API on Windows. Same code path runs on macOS, Linux, and Windows.

**Wire format example:**

```jsonrpc
// Supervisor → Agent: deliver a new task
{"jsonrpc":"2.0","id":1,"method":"task.deliver","params":{"task_id":"t_abc","description":"...","idempotency":"pure"}}

// Agent → Supervisor: notification emitted, please surface
{"jsonrpc":"2.0","method":"notification.emit","params":{"id":"notif_xyz","tier":"passive","question":"..."}}

// Supervisor → Agent: stop gracefully
{"jsonrpc":"2.0","id":2,"method":"agent.stop","params":{"reason":"user_requested"}}

// Agent → Supervisor: response with result
{"jsonrpc":"2.0","id":2,"result":{"status":"stopped","at":"2026-04-26T18:00:00Z"}}
```

**v1 method namespaces (locked at the namespace level; full method list lands in the supervisor PR):**

- `agent.*` (lifecycle): `agent.register`, `agent.heartbeat`, `agent.stop`, `agent.errored`
- `task.*`: `task.deliver`, `task.checkpoint`, `task.complete`, `task.fail`
- `notification.*`: `notification.emit`, `notification.responded`
- `detector.*`: `detector.tripped`, `detector.resumed`
- `state.*` (control-plane introspection): `state.snapshot`, `state.subscribe`

## Consequences

### What gets better

1. **Vocabulary alignment.** The runtime speaks JSON-RPC for MCP tool calls and for supervisor↔Agent control-plane. One mental model for "structured request/response with optional notifications".
2. **Debuggability.** `nc -U <state-dir>/supervisor.sock` opens an interactive session; `tee` on the socket logs traffic for post-mortem. NDJSON framing means standard tools work.
3. **Filesystem permissions are the security boundary.** The socket file's mode (`0600`, owner-only) controls who can connect. No port allocation, no firewall surface, no auth tokens at v1.
4. **Restart-safe by design.** Either side reconnects; cross-connection state is on disk. No protocol-level session.
5. **Cross-platform via libuv.** Node 22+ handles the platform differences; one code path across macOS/Linux/Windows.
6. **Simple to test.** A test harness can stand up an in-memory mock server speaking JSON-RPC over a duplex stream. Real supervisor and Agent integration tests use a real UDS in a tmpdir.

### What could get worse

1. **No built-in versioning at the protocol layer.** JSON-RPC has no version field beyond `"jsonrpc":"2.0"`. Method names carry the contract; new fields in `params` or `result` are additive. Breaking changes get versioned method names (`task.deliver.v2`) per [[upgrade-readiness]] discipline 7. Acceptable cost.
2. **NDJSON does not handle huge messages well.** A multi-megabyte tool output crammed into a control-plane message would block the socket. Mitigation: tool outputs go via the run-record file (with `output_ref` for spillover) per [[2026-04-25-tool-baseline]]; control-plane messages stay small. Document the rule: control-plane messages are control, not bulk data.
3. **No backpressure semantics in v1.** If the supervisor sends faster than the Agent reads, the OS socket buffer fills up. For v1's expected control-plane volume (single-digit messages per second per Agent), this is not a real bottleneck. Revisit if it becomes one.
4. **Windows UDS support is a libuv abstraction, not a native feature.** Edge cases (path length, mode bits) may differ. Test on Windows when we get there; document any deviations.

## Implementation guidance for the supervisor PR

- The supervisor exposes a typed RPC client and server in `src/runtime/control-plane/`. The shapes of params and results are TypeScript types; runtime validation via Zod (or equivalent) at the transport boundary.
- The socket path is configurable via `--state-dir <path>` (per `2200 init` and the CLI surface).
- The supervisor registers a `SIGTERM` handler that drains in-flight requests, persists state to disk, and exits cleanly.
- Each Agent has a connect-with-retry policy at boot: fail fast if the supervisor is not running, exit non-zero, let the operating system's process manager (or the user) decide whether to retry.
- Test harness: a `MockSupervisor` and `MockAgent` exposed from `src/testing/` so feature PRs can stand up control-plane mocks without spawning real processes.
- The supervisor logs every received and sent JSON-RPC message at debug level. The log channel is the same one Pulse will eventually consume.

## License posture

JSON-RPC 2.0 is an open specification; implementing a client/server creates no derivative-work obligation. Pattern lift, not code lift. Reference implementations exist in many licenses; if we adopt code from one, the standing licensing rule ([[license-posture]]) applies.

UDS and NDJSON are protocol primitives, not copyrightable.

## References

- Epic 2 spec: [[02-agent-runtime-minimum]] (the "architecture choices that are not pre-decided" section)
- MCP-native runtime: [[2026-04-25-mcp-native]] (also speaks JSON-RPC)
- Upgrade-readiness disciplines 2, 3, and 7: [[upgrade-readiness]]
- Build-phase decide-and-tell: [[build-phase-decisions]]
- JSON-RPC 2.0 spec: https://www.jsonrpc.org/specification

## Format provenance

Decision recorded by Hobby on 2026-04-26 during Epic 2 build-phase prep. The choice was a build-time call per [[build-phase-decisions]]; this record captures the lock so the supervisor PR (and downstream PRs that consume the control-plane) hook into a known protocol vocabulary.

---

*Decision recorded by Hobby, 2026-04-26.*
