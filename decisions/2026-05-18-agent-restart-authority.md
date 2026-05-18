---
title: "Decision: Agent-restart authority (three-tier model)"
type: decision
status: locked (Tier 1 shipped; Tier 2 existing; Tier 3 deferred to a future epic)
tags: [decision, agent-lifecycle, security, restart, authority, malice-vector]
created: 2026-05-18
updated: 2026-05-18
linked_docs:
  - "[[2026-05-18-heuristics-vs-boundaries]]"
  - "[[2026-05-14-claim-vs-evidence-audit]]"
  - "[[../epics/16-loop-layer-reliability]]"
canonical_path: wiki/decisions/2026-05-18-agent-restart-authority.md
---

# Decision: Agent-restart authority (three-tier model)

**Status:** Tier 1 shipped 2026-05-18 (PR #206). Tier 2 existing (CLI + supervisor RPCs since v0). Tier 3 deferred to a future epic with explicit gating below. Document this BEFORE any cross-Agent `request_agent_restart`-style pattern gets prototyped so the boundary stays load-bearing.

## Context

Restarting an Agent's process is destructive in the controlled sense: in-memory state is lost (loop history, cached auth, tool client connections), on-disk state survives (brain notes, sealed credentials, task store). It's a real recovery action operators need ... wedged loops, stale provider auth, dropped connections that don't self-recover.

The question this decision answers: **who can trigger an Agent restart?**

Naive answer: "any caller with access to the RPC." That answer ships the malice vector Doug flagged 2026-05-18 ("Don't want them getting malicious and stopping other agents"). A fleet where Agent A can restart Agent B is a fleet where one compromised Agent can wedge the rest of the team.

The three-tier model below is the structural answer: each tier of authority is a different code path with different security properties. The first tier is what shipped tonight; the other two are the rails the design holds for as the substrate grows.

## Tier 1: Self-restart (SHIPPED ... PR #206)

**Who can trigger:** The Agent itself, from inside its own loop.

**Surface:** `restart_self` baseline tool. Tool args are `{ reason: string }` ... NO `name` field, no caller-supplied target. The dispatch layer reads `ctx.callingAgent` and locks the supervisor RPC's `name` parameter to that value. Cross-Agent restart is not possible through this surface because the surface doesn't expose the parameter.

**Why this is structural, not a runtime check:** per [[2026-05-18-heuristics-vs-boundaries]] §3, a runtime check that "validates target == calling agent" could be bypassed by a future code path that forgets the check. A SURFACE that doesn't expose the parameter cannot be bypassed without the bypassing code being obvious (and reviewable).

**Implementation:**
- Tool: `src/runtime/tools/baseline/agent-control.ts`.
- RPC: `cli.agent.restart_self`, supervisor handler in `src/runtime/supervisor/supervisor.ts`.
- Lifecycle: stop + 200ms settle + start (via `restartAgent` helper).
- Timing: restart scheduled 500ms after RPC return so the tool's response flushes back to the Agent loop before the process recycles.

**Use case:** the Agent's own loop reasoning says "I'm stuck in a state a fresh process would clear." Cheap-tier model wedges on stale auth, repeated malformed-tool-call retries, accumulated context that won't compact. The Agent calls `restart_self` with a reason; supervisor cycles the process; new process picks up from on-disk state.

**Audit:** the RPC handler logs at INFO with `name` + `reason`. Operator can `grep` the supervisor log for `self-restart scheduled` to see when and why Agents have self-restarted. Pattern detection (Agent self-restarts every 10 minutes → something's wrong) is an operator concern surfaceable via the claim-vs-evidence audit substrate ([[2026-05-14-claim-vs-evidence-audit]]) when needed.

## Tier 2: Operator-initiated (EXISTING ... shipped since v0)

**Who can trigger:** The human operator, via CLI or web.

**Surface:** `2200 agent stop <name>` + `2200 agent start <name>` (or the web equivalent). The supervisor RPCs `cli.agent.stop` and `cli.agent.start` accept any `name` because the caller IS the operator ... operator authority is the whole point.

**Use case:** the operator wants a specific Agent to restart for a reason the Agent itself doesn't perceive (operator just upgraded the runtime, operator wants to force a state reset, operator has lost confidence in an Agent and wants a clean process).

**Audit:** the supervisor logs at INFO. Operator initiated it, so audit-of-operator-by-operator is degenerate, but the log retains the trail for compliance / post-mortem.

## Tier 3: Agent-mediated-operator-approved (FUTURE ... deferred)

**Who can trigger:** A peer Agent, gated on operator approval, via the notification-ask substrate.

**Surface (proposed; not implemented):** A future `request_peer_restart` baseline tool. Tool args: `{ peer_name: string, reason: string }`. The tool does NOT call any restart RPC directly. Instead:

1. The tool emits a `notification_ask` to the operator: "Hobby is asking to restart Simon, reason: <reason>. Approve / deny?"
2. The operator responds via the standard notification surface (CLI, chat card, web).
3. On approval, the supervisor handler triggers Tier 2 (`cli.agent.stop` + `cli.agent.start`) ... NOT a new RPC. The operator's approval IS the authority; the peer Agent's role is to propose, not to authorize.

**Why this shape:**
- Cross-Agent restart-without-operator (the "Tier 1.5" we deliberately do NOT build) is the malice vector. An Agent that can restart its peer without operator approval can disrupt the whole fleet from one compromised Agent.
- An Agent that can SUGGEST a peer restart with operator approval is fine, because the approval is the load-bearing gate. The operator can read the reason, judge whether the suggestion is legitimate, and approve / deny.
- The notification-ask substrate already exists. Tier 3's implementation is mostly "wire the request tool to notification_ask + on approval, dispatch Tier 2."

**When to build Tier 3:**
- When peer Agents start coordinating tasks where one Agent observes another's wedged state and the operator isn't actively watching. Today the fleet is small + the operator is in the loop on every test; peer-suggested restarts add value when the fleet gets bigger.
- Pre-requisites: claim-vs-evidence audit ([[2026-05-14-claim-vs-evidence-audit]]) hooks for restart events (so a Tier 3 suggestion comes with the audit record showing WHY the suggesting Agent thinks the target is wedged); operator-fatigue mitigations (the Tier 3 notification needs to not become spam).
- Probably a separate epic. Working name: "Agent-peer-restart authority." Out of scope for Epic 16 (loop-layer reliability ... that's about self-help, not peer-help).

## What we deliberately do NOT do (Tier 1.5)

The temptation: a tool that lets an Agent restart a peer directly, with no operator approval. ("Hobby calls `restart_agent simon` because Hobby noticed Simon was wedged.")

**Why we don't ship this:**
- Malice vector: a compromised Hobby can wedge the fleet by restart-looping every peer.
- Authority confusion: Hobby's judgment about Simon's state is second-hand; the operator's is first-hand or supported by Simon's own audit log. The operator's view is more authoritative.
- Substitution risk: if Hobby can restart Simon, why can't Hobby fire Simon? Why can't Hobby spawn impostor-Simons? The slippery slope is real. Keeping the "operator approves all cross-Agent destructive lifecycle" rule shuts the slope.
- No use case: peer-suggested-with-approval (Tier 3) covers the legitimate case; peer-without-approval doesn't have a legitimate case that operator-mediated doesn't cover better.

## Surface-by-surface summary

| Tier | Triggered by | RPC | Surface property |
|------|-------------|-----|------------------|
| 1 | Agent itself | `cli.agent.restart_self` | No caller-supplied target arg ... locked to ctx.callingAgent. |
| 2 | Operator (CLI/web) | `cli.agent.stop` + `cli.agent.start` | Accepts any name; operator authority is the gate. |
| 3 (future) | Peer Agent + operator approval | `cli.agent.stop` + `cli.agent.start` (via notification_ask gate) | No new RPC; reuses Tier 2 RPCs gated on operator notification response. |
| ~~1.5~~ (NEVER) | ~~Peer Agent direct~~ | ~~`cli.agent.restart_peer`~~ | ~~Malice vector; structurally never built.~~ |

The dropdown in code surfaces, CLIs, and any future web admin should reflect this hierarchy. Tier 1 lives in the Agent loop's tool surface. Tier 2 lives in the operator surfaces. Tier 3 (when shipped) is a request-token that operator surfaces fulfill.

## Audit relationship

Every restart event (Tier 1 + 2; Tier 3 inherits Tier 2's path) logs to the supervisor log with:
- Initiator (Agent name for Tier 1; "operator" for Tier 2; `"<requesting_agent>@operator_approval=<notification_id>"` for Tier 3 when shipped).
- Target Agent name.
- Reason (verbatim, capped at 500 chars per the Tier 1 tool schema).
- Scheduled timestamp.

Future: claim-vs-evidence verifier extension. An Agent that narrates "I restarted myself because X" can be cross-checked against the supervisor log's matching `self-restart scheduled` entry. Same pattern as the existing credential-request verifier.

## Why this lands as a decision doc now

PR #206 shipped Tier 1 tonight. Tier 2 has always existed. Tier 3 is future work. Without this doc in writing, the next time someone (Doug, me, a future Agent) is tempted to ship the "peer restart" pattern, they might do it the wrong way (direct restart) instead of the right way (request-with-approval). The doc captures the boundary so the boundary stays.

Same posture as [[2026-05-18-heuristics-vs-boundaries]] §3: name the structural property, name what would defeat it, name what we deliberately don't build.

## Open follow-ups

1. **Audit verifier extension for self-restart claims.** When an Agent narrates "I restarted myself," the audit substrate ([[2026-05-14-claim-vs-evidence-audit]]) should cross-check against the supervisor log's matching event. Not blocking; queued.
2. **Tier 3 implementation epic.** When the fleet is bigger and peer-observation patterns emerge organically, scope + ship. Pre-req: audit verifier extension above.
3. **CLI ergonomics.** `2200 agent restart <name>` would be a nice operator-side wrapper around stop+start. Pure ergonomics; not a new authority tier. Easy follow-up.

## Provenance

Decision crystallized 2026-05-18 (session 32) after Doug's review of PR #206's design. The "no caller-supplied target = structural closure" framing is Doug's; the three-tier model and the explicit ~~Tier 1.5~~ never-build are Hobby's articulation of the boundary Doug drew. Filed before any Tier 3 implementation work begins so the boundary is load-bearing convention, not after-the-fact rationalization.

— Hobby
