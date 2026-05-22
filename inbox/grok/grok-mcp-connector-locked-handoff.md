# Grok MCP Connector — Locked Handoff

**Status:** Locked  
**Date:** 2026-05-22  
**Owner:** Hobby (primary implementation)  
**Architectural Review:** Grok  
**Final Approval:** Doug

---

## Vision

2200 becomes the persistent, local execution and memory layer for frontier models — starting with Grok.

The target cohort is the people already living at the intersection: serious OpenClaw/Hermes users running local agent fleets who are also heavy Grok users (web, app, and Tesla). These users currently suffer constant context fragmentation — high-quality, long-form thinking in Grok (especially voice while driving) that cannot easily continue inside their persistent, observable, local fleet.

The connector lets Grok act as a strong research and reasoning partner that can feed a user’s fleet across sessions and locations, while the human retains final authority over real execution. It is built on the open MCP standard so the same surface can be used with Claude or OpenAI when they expose equivalent attachment points.

---

## Feasibility

The protocol surface is mature. xAI has production-grade support for remote MCP servers (Streamable HTTP + SSE) with bearer token auth and `allowed_tools` scoping, available through both the consumer connector UI and the Voice Agent API. Tunneling is well documented.

The mechanical work is achievable. The hard work — long-running context quality, clean separation of thinking vs. committing, strong auditability, and disciplined human oversight — is 2200’s responsibility.

---

## Phase 1 Scope (What We Ship)

**Primary user experience goal:**  
A user can have an extended conversation with Grok (web or car), hand research and structured thinking into the fleet, and later find a clean, reviewable package in the Inbox instead of lost context.

### What Ships

- Dedicated MCP server on a **separate listener** (distinct from the web UI).
- Per-install bearer token stored in the sealed vault.
- CLI: `2200 connector token show | regenerate | disable`
- Settings tile with masked token, copy, regenerate, and enable/disable.
- Every call from Grok appears as a first-class Inbox event.

### Tool Surface (Phase 1)

1. `contribute_to_thread`  
   Primary ingestion tool. Grok sends structured research, reasoning, sources, open questions, and proposed direction. Targets a specific Agent or a research thread.

2. `propose_work_package`  
   Grok can synthesize what it has learned and submit a proposed execution plan.  
   **On arrival, this triggers only internal Agent-to-Agent coordination whose sole purpose is to assemble a reviewable execution plan.** The only permitted side effect is Agents messaging each other to build the plan. No tasks are submitted, no schedules are created, no Agents are started, and no external actions are taken. The resulting plan sits fully inert in the Inbox until a human explicitly approves it.

3. `get_fleet_context` (light)  
   Allows Grok to request high-level orientation so conversations can survive long gaps.

### Context Continuity Model (Phase 1)

We will use a **recurrence + standing-brief** combination:
- Lightweight “Grok Research Thread” backed by the shared Brain.
- The primary (or designated) Agent maintains a standing brief for the thread.
- On re-engagement, Grok receives a combination of recent activity + the current standing brief. The fleet is responsible for keeping the brief accurate.

### Tunnel Recommendation

Users control their own exposure.  
**Quick-start:** ngrok (best compatibility).  
Other user-controlled options (Cloudflare Tunnel, Tailscale Funnel, self-managed reverse proxy, VPS, etc.) are fully supported and documented.

### Success Criteria for Phase 1

- A user can talk to Grok for an extended period (including while driving), feed research into the fleet, and later find a clear, reviewable package in the Inbox.
- No execution crosses the tunnel without explicit human approval.
- Everything is visible and revocable in the Inbox.
- The surface is designed to be reusable by other providers.

---

## Phase 2 Boundary (Locked)

**Phase 2 does not begin until Phase 1 is shipping, stable, and has real usage data from the target cohort.**

Phase 2 may include (subject to new review):
- Finer-grained token scoping / personas
- Stronger bidirectional context updates
- Expanded tool surface (with additional approval gates)
- Improved in-car connector management experience

Nothing in Phase 2 is pre-approved.

---

## Key Architectural Decisions (Locked)

**Listener Architecture**  
Dedicated second listener for the MCP connector. The web UI remains on its existing listener and must not be reachable through any tunnel the user exposes. The network binding provides a stronger guarantee than route-level middleware.

**Approval Model (Phase 1)**  
All work with external effects requires explicit human approval. The only autonomous activity on package arrival is internal Agent coordination to produce a reviewable plan.

**Agent Creation**  
Grok cannot create new Agents in Phase 1.

---

## Out of Scope for Phase 1

- Grok creating Agents
- Any execution without human approval
- Direct task or schedule submission from Grok
- Full real-time bidirectional push
- Native multi-provider support (design for it, test only with Grok)
- In-car connector management UI

---

## Implementation Ownership

**Hobby** will drive the implementation and own the feature long-term.

**Grok** will remain actively involved as architectural reviewer and QC partner throughout the work, with particular focus on:
- Listener and auth boundary
- `propose_work_package` arrival semantics
- Research thread + standing brief model
- Anything touching the sealed vault or supervisor state

We will do design reviews and mid-stream code reviews together.

---

## Open Risks to Watch

- Quality and maintenance of the standing brief (this is where continuity will be won or lost).
- Context size and performance with long threads.
- Tunnel support burden for users.

---

**Locked.**

Any change to Phase 1 scope, the approval model, or the listener decision after this point requires explicit re-approval from Doug.
