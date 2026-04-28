---
title: "Decision: Tool Baseline and Plan/Run/Perm Wrapping"
type: decision
status: locked
tags: [decision, tools, runtime, plan-run-perm, baseline, inspectability]
created: 2026-04-25
updated: 2026-04-25
linked_docs:
  - "[[02-architecture]]"
  - "[[03-epic-map]]"
  - "[[prior-art-analysis]]"
  - "[[prior-art-source-findings]]"
  - "[[2026-04-25-mcp-native]]"
  - "[[2026-04-25-skills-first-class]]"
  - "[[2026-04-24-cost-behavior-shape]]"
canonical_path: wiki/decisions/2026-04-25-tool-baseline.md
---

# Decision: Tool Baseline and Plan/Run/Perm Wrapping

## Context

Two questions came out of the prior-art source reading (see [[prior-art-source-findings]] Target 1 and Target 6):

1. **Does every Agent get a baseline tool set, or does each Agent come empty and the user wires capability per Agent?** OpenClaw ships ~31 baseline tools. The decision was instructive: without a baseline, every Agent is a blank slate the user has to outfit, and the fastest path to "useful" is friction the user pays per Agent. With a baseline, every Agent is immediately useful at a basic level and Skills/Extensions add specialization on top.

2. **What discipline governs how tool calls flow?** OpenClaw's gateway layer wraps every tool call with logging, permission checks, and an explicit "what is this Agent about to do" hook. The pattern is the load-bearing reason OpenClaw is debuggable when an Agent goes off the rails. Without it, tool calls are opaque and incidents become guesswork.

## Decision

### Tool baseline

**Every Agent gets a baseline tool set by default.**

The baseline shape mirrors OpenClaw's: filesystem access scoped to the Agent's project directory, shell execution, web fetch, web search, brain read/write, time, and a handful of small utilities. The exact list is proposed in the Epic 2 spec, not pre-decided in this record. The principle is locked: there is a baseline.

**Skills and Extensions add to the baseline; they do not replace it.** A Skill that declares `requires: [filesystem, shell]` is asserting which baseline tools it relies on. An Extension that brings its own MCP server adds new tools to that Agent's available set. Neither can subtract from the baseline.

User-installed Skills follow the take-and-normalize pipeline ([[2026-04-24-skill-compatibility-pipeline]]). The pipeline maps the Skill's tool requirements onto 2200's baseline tool names where they line up, and surfaces the mapping to the user when it doesn't.

### Plan/run/perm wrapping

**Every tool call passes through three layers:**

1. **Plan.** Before the call, the Agent emits a structured statement: what tool, what arguments, what the Agent expects to happen. Logged to the Brain. Surfaced to inspection tooling. Not a user prompt. Just a record.
2. **Run.** Execute the tool call (over MCP per [[2026-04-25-mcp-native]]). Capture inputs, outputs, errors, latency.
3. **Perm.** Verify the call was authorized: the Agent has the tool in its set, the user's preferences allow this kind of call, the Extension permission scope (when applicable) covers it, the cost-behavior layer ([[2026-04-24-cost-behavior-shape]]) hasn't tripped.

The three layers run on every tool call, every time. There is no fast path that skips them.

**Don't optimize this away in the name of speed.** The wrapping is what makes the system inspectable, debuggable, and trustworthy. Performance optimization (caching the perm decision for repeated identical calls within a task, batching plan emissions, etc.) can come later if profiling shows real cost.

## Consequences

### What gets better

1. **Day-one usefulness.** A freshly spawned Agent can do real work without per-Agent tool wiring. Onboarding (Epic 14) is shorter because there is no "now configure your tools" step.
2. **Inspectability is universal.** Every tool call has a plan record, a run record, and a perm record. Incidents get root-caused from logs, not guesswork. Pulse ([[pulse]]) and the Behavior dashboard have real signals to surface.
3. **Skills compose cleanly.** Skills declare baseline-tool dependencies; when the dependency is in the baseline, no extra capability negotiation is needed. The Skill works the moment it installs.
4. **Loop and stuck detection has a substrate.** The runtime can pattern-match across plan/run records to detect tool loops, repeated failures, or cost runaway ([[2026-04-24-cost-behavior-shape]] layer 1). Without the wrapping, those signals would have to be reconstructed.
5. **Audit and replay.** The plan/run/perm log is enough to replay a session's tool activity. Useful for debugging, for the upgrade-readiness story (interrupted task resume), and for user trust ("show me what my Agent did").

### What could get worse

1. **Wrapping cost.** Three layers per call is non-zero overhead. For 2200's expected call volumes (humans-in-the-loop, not high-throughput batch), the cost is invisible. If a real bottleneck appears, optimize the implementation, not the discipline.
2. **Verbose logs.** Every tool call generates plan + run + perm records. Disk grows. Mitigation: log rotation, retention policy in the Brain. Not a v1 problem.
3. **Subtle plan-emit drift.** If the Agent's plan and the actual call diverge, the log lies. The plan is the Agent's stated intent; the run is what happened. Drift between them is itself a signal worth detecting.
4. **Baseline tool set is now a contract.** Removing a baseline tool in v1.1 breaks Skills that depend on it. The baseline becomes a versioned surface; changes go through a deprecation cycle ([[upgrade-readiness]] discipline 7).

## Implementation guidance for Epic 2

The Epic 2 spec must include:

- **Baseline tool list.** Hobby's proposal, with each tool's name, scope, MCP server it lives behind, and license posture. Doug reviews and locks during Epic 2 review.
- **Plan record schema.** What fields a plan emission contains (tool name, args, predicted outcome, Agent's stated reason). Frontmatter or JSON, written to the Brain on every call.
- **Run record schema.** What fields a run record contains (inputs, outputs, error, duration, cost-relevant metrics).
- **Perm record schema.** What the permission check evaluates against (tool set, user prefs, Extension scope, cost-behavior gate, capability tokens).
- **Wrapping layer placement.** Sits between the Agent loop and the MCP client ([[2026-04-25-mcp-native]]).
- **Loop and stuck detection signals.** Which fields in plan/run records the supervisor pattern-matches on for layer 1 of the cost-behavior shape ([[2026-04-24-cost-behavior-shape]]).
- **Schema versioning per [[upgrade-readiness]] discipline 1.** Plan/run/perm records carry a version field.

## License posture

The baseline tool list will draw architectural inspiration from OpenClaw's 31 (MIT, [[feedback_track_licensing]]). Pattern lift, not code lift, unless a specific tool implementation is small and worth copying with notice preservation. The plan/run/perm shape is a discipline, not copyrightable. Default to clean reimplementation; document attribution in the Epic 2 spec.

## References

- Triggered by [[prior-art-source-findings]] Target 1 and Target 6 (OpenClaw gateway and tool layer)
- Synthesized in [[prior-art-analysis]] Section 8 Epic 2
- Sits on top of [[2026-04-25-mcp-native]] (MCP is the transport; this wrapping is the discipline)
- Substrate for [[2026-04-24-cost-behavior-shape]] layer 1 (loop and stuck detection)
- Skills compose against the baseline per [[2026-04-25-skills-first-class]]
- Lands in [[03-epic-map]] Epic 2 (baseline + wrapping) and Epic 9 (later tool ecosystem)

## Format provenance

Decision recorded by Hobby and Doug, 2026-04-25, in Doug's inbox reply locking three architecture choices coming out of v0.3 prior-art analysis. Refinement noted by Doug: the exact tool list is mine to propose in Epic 2; the wrapping discipline is locked.

---

*Decision recorded by Doug and Hobby, 2026-04-25.*
