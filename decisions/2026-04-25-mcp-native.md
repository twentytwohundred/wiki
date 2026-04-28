---
title: "Decision: MCP-Native Runtime"
type: decision
status: locked
tags: [decision, runtime, tools, protocol, mcp, integration]
created: 2026-04-25
updated: 2026-04-25
linked_docs:
  - "[[02-architecture]]"
  - "[[03-epic-map]]"
  - "[[prior-art-analysis]]"
  - "[[prior-art-source-findings]]"
  - "[[2026-04-24-bulletin-substrate-is-scut]]"
  - "[[2026-04-25-tool-baseline]]"
  - "[[2026-04-25-skills-first-class]]"
canonical_path: wiki/decisions/2026-04-25-mcp-native.md
---

# Decision: MCP-Native Runtime

## Context

The 2200 runtime needs a tool-calling protocol. The prior-art source reading (see [[prior-art-source-findings]] Target 1) showed OpenClaw's gateway is itself an MCP client orchestrating MCP servers, and the pattern carries production load there today. Independent of OpenClaw, the broader Agent-tools ecosystem has converged on MCP: Shopify ships four official MCP servers (Dev, Storefront, Customer Account, Checkout); other vendors are following. A protocol with momentum is a smaller liability than a protocol invented in-house.

Three options were considered:

1. **Translation-shim mode.** Internal tool ABI of our own design, with an MCP shim at the edges so we can read other ecosystems' MCP servers. Preserves design control; pays a perpetual translation tax.
2. **Parallel-mode.** Design a tool-calling protocol native to 2200; ignore MCP entirely or treat it as one of many adapters. Maximum freedom; perpetual reimplementation of what others ship natively.
3. **MCP-native.** The runtime *is* an MCP client and an MCP server. No internal alternate protocol. MCP is the tool integration layer, end to end.

Bulletin (the SCUT v2.0 Bulletin substrate, [[2026-04-24-bulletin-substrate-is-scut]]) is a different protocol layer entirely: Agent-to-Agent network announcements, not tool calls. No conflict between MCP and Bulletin; they don't compete for the same surface.

## Decision

**Option 3: MCP-native.**

2200's runtime speaks MCP as both client and server, depending on context.

- **As client.** When an Agent in 2200 invokes a tool, the runtime makes an MCP call to the appropriate MCP server (built-in or user-registered).
- **As server.** When another system (a sibling 2200 instance, a third-party MCP-aware client, a partner tool) wants to invoke a 2200 capability, it does so over MCP. 2200 publishes capabilities as MCP servers.

There is no parallel internal tool protocol. The plan/run/perm wrapping ([[2026-04-25-tool-baseline]]) operates on top of MCP calls, not alongside them.

## Consequences

### What gets better

1. **Ecosystem inheritance.** Existing MCP servers (Shopify's four, the rest of the published ecosystem) become reachable as 2200 tools without us writing adapters. Day-one tool surface is large.
2. **No reimplementation tax.** When the MCP ecosystem ships a feature (resource subscriptions, sampling, structured tool errors), 2200 inherits it. We don't perpetually shadow another community's work in a parallel protocol.
3. **Two-way integration.** Because we are also an MCP server, third-party tooling (debuggers, inspectors, sibling Agents on other platforms) can introspect or invoke 2200 capabilities through the standard. This matters for Epic 18 (dogfooding completion) and any future cross-platform cooperation.
4. **Cleaner Skills story.** Skills ([[2026-04-25-skills-first-class]]) declare which tools they need by referencing MCP servers and tool names. The dependency model is the ecosystem's, not ours.

### What could get worse

1. **MCP's evolution is not ours to control.** When the spec changes in directions we don't love, we live with them or fork (which would defeat the point). Acceptable cost; the alternative was the parallel-mode tax forever.
2. **Performance overhead vs an in-process tool ABI.** MCP's transport layer is JSON-RPC over stdio, HTTP, or socket. A native in-process call is faster. For 2200's expected call volumes, this is not a real bottleneck. If it becomes one, we add an in-process MCP transport, not a different protocol.
3. **Schema mismatch handling.** The runtime must tolerate MCP servers that don't conform tightly (missing fields, ad-hoc extensions). Falls under the same normalize-with-disclosure discipline as Skills ([[2026-04-24-skill-compatibility-pipeline]]) but applied to tool servers.
4. **Permission model couples to MCP semantics.** The plan/run/perm layer needs to map MCP's tool descriptions onto 2200's capability tokens. Most of this is mechanical; edge cases get decided per-tool when they come up.

## Implementation guidance for Epic 2

Epic 2's runtime spec must include:

- An MCP client embedded in the Agent loop, used for every tool call.
- An MCP server published by the runtime exposing 2200's first-party capabilities (Brain, Roster, Bulletin, etc., as those primitives land in their own epics).
- Transport: stdio for local in-process MCP servers, HTTP for remote. Socket optional later.
- Tool registration: the Agent's Identity declares which MCP servers it has access to; the runtime instantiates them at boot.
- Plan/run/perm wrapping ([[2026-04-25-tool-baseline]]) sits between the Agent loop and the MCP client. Every MCP call passes through it.
- Schema versioning per [[upgrade-readiness]] discipline 1: Identity files declare the MCP server versions they expect; runtime warns on drift.

## License posture

MCP is an open spec maintained by Anthropic. Implementing an MCP client/server from spec creates no derivative-work obligation on 2200. Pattern lift, not code lift. Reference implementations exist in multiple licenses; if we ever pull code from one, we apply the standing rule (`feedback_track_licensing`).

## References

- Triggered by [[prior-art-source-findings]] Target 1 (OpenClaw gateway architecture)
- Synthesized in [[prior-art-analysis]] Section 8 Epic 2
- Compatible with [[2026-04-24-bulletin-substrate-is-scut]] (different layer)
- Pairs with [[2026-04-25-tool-baseline]] (the wrapping that sits on top of MCP)
- Pairs with [[2026-04-25-skills-first-class]] (Skills declare MCP dependencies)
- Lands in [[03-epic-map]] Epic 2 as a foundational architecture choice

## Format provenance

Decision recorded by Hobby and Doug, 2026-04-25, after Doug's inbox reply locking three architecture choices coming out of the v0.3 prior-art analysis. The thinking was already done across two sessions of source reading; this record captures the lock.

---

*Decision recorded by Doug and Hobby, 2026-04-25.*
