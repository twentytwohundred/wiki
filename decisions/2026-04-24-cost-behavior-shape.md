---
title: "Decision: Cost Behavior, Protection Layers, and Pulse"
type: decision
status: locked
tags: [decision, cost, runtime, ux, agents, protection, settings]
created: 2026-04-24
updated: 2026-04-24
linked_docs:
  - "[[prior-art-analysis]]"
  - "[[03-epic-map]]"
  - "[[pulse]]"
  - "[[design-language]]"
  - "[[voice-and-framing]]"
canonical_path: wiki/decisions/2026-04-24-cost-behavior-shape.md
---

# Decision: Cost Behavior, Protection Layers, and Pulse

## Context

[[prior-art-analysis]] v0.1 surfaced the Perplexity Computer cost disaster (a single user burned $200 of credits on one webpage build because silent integration failures triggered retries that spawned sub-agents that retried) and recommended adding cost caps to the epic map.

Doug pushed back on cost caps as the framing in two waves:

1. **First pushback.** "Cost caps" is too generic and too defensive. Smart designs handle the cost problem indirectly: predict before execution, detect anomalies, kill loops at the source, give the user visibility. The problem isn't really cost... it's that the user didn't know what was happening. Cost is downstream of opacity.
2. **Second pushback.** A multi-layer system where every layer prompts the user becomes Claude Code's CLI pit ("Yes to this, Yes to everything?"). The protections need to be layered AND configurable, with most layers silent by default. Like permissions in a settings dashboard.
3. **Visualization layer.** Doug proposed an RPM-gauge analog for ambient cost visibility, then iterated to a single dot pulsing through colors. Locked separately as the [[pulse]] design spec under the [[design-language]] convention.

## Decision

2200 handles cost (and related Agent-behavior risks) through an **eight-layer protection system**, with most layers silent by default, all configurable via an **Agent Behavior settings dashboard**, and **Pulse** as the always-on visible layer.

### The eight layers

**Silent by default (no user prompts):**

1. **Loop and stuck detection.** Pauses the Agent automatically when a tool loop or stuck-Agent pattern is detected. Single Passive notification. No prompt, no permission required. OpenClaw has this; we adopt the same shape.
2. **Real-time visibility (Pulse).** Always-on visualization of Agent activity intensity. Single dot, breath-paced pulse, color cycles green-to-red with load. See [[pulse]]. The user can glance to know what's happening; the dot never demands attention.
3. **Anomaly detection.** Compares current task token velocity to historical velocity for similar tasks. Writes findings to a daily digest, not to notifications. User reviews when they want.
4. **Hard daily backstop.** A configurable absolute spend cap (default $50/day). Only fires unprompted because the alternative is a $500 Tuesday. Pauses everything if hit; user can override.

**Opt-in (user enables in dashboard):**

5. **Pre-flight prediction.** Agent estimates a task's cost before starting; if above threshold, surfaces a heads-up framed in user-relative terms ("this will cost ~$3, 4x your usual daily spend"). Off by default.
6. **Per-Agent wallets.** Each Agent has an allowance that refills on a cadence. Agent itself becomes cost-aware, plans within its wallet. Off by default.
7. **Approval gating on expensive action types.** Specific action types (deep research, large file processing, multi-source synthesis) require explicit user approval before running. Like sudo for spend. Off by default.

**Manual override (always available):**

8. **Kill switch.** "Pause all Agents" button in the mobile app. Manual, not algorithmic. For when the user notices something off and wants to stop without thinking about thresholds.

### The Agent Behavior settings dashboard

Cost is one dimension of a broader Agent Behavior settings surface. The same UX pattern handles:

- Notification tier preferences (Epic 7)
- Tool access and OAuth permissions (Epic 9)
- Extension permissions at install (Epic 12)
- Brain read/share permissions (Epic 8)
- Cost behavior (this decision)

One dashboard, one permission model, one per-Agent override pattern, one set of presets (Default, Strict, Permissive). Apple Screen Time / Focus Modes vibe. Live without it and it works fine; configure if you care.

The dashboard is a candidate for its own epic in the next epic-map walkthrough.

## Consequences

### What gets better

1. **No notification spam.** Most layers fire silently or write to digests. The user is interrupted only when interruption is genuinely necessary.
2. **Ambient awareness without nagging.** Pulse gives a glanceable sense of what's happening. The user learns the rhythm of their team. Cost becomes legible without being adversarial.
3. **Generalizable UX pattern.** The Agent Behavior dashboard concept applies to four other epics. One settings paradigm, applied consistently.
4. **Layered safety.** Loop detection at the root catches the worst failures. Pulse plus anomaly detection give visibility. Hard backstop is the floor. Each layer catches a different class of problem.
5. **Respects user agency.** Opt-in layers give power users budgets, gates, and predictions without forcing them on everyone.
6. **Brand element.** The Pulse becomes a recognizable piece of 2200's UI vocabulary.

### What could get worse

1. **Pulse could trivialize the problem.** If users enjoy watching the dot color-shift, they may not act when it redlines. Mitigation: Pulse isn't doing the protection alone. Loop detection pauses regardless. Visible system, invisible guardrails.
2. **Eight layers is more code than one cap.** Acceptable cost given the alternative is a Perplexity-style failure.
3. **Color-blindness obligation.** The Pulse must have a non-color signal (shape, pattern, label) for users who can't distinguish green/yellow/orange/red. Treat as launch requirement, not future enhancement.
4. **Settings dashboard complexity.** Five domains in one surface is a lot. Sensible defaults must keep the dashboard ignorable for users who never open it.

## Implementation guidance for the epic map

This decision affects multiple epics. The mapping below is the proposed shape; the epic-map walkthrough will lock specifics.

| Layer | Lands in |
|-------|----------|
| Loop and stuck detection | Epic 2 (runtime) and/or Epic 9 (tools) |
| Pulse visualization | See [[pulse]] design spec; UI work in Epics 15, 16 |
| Anomaly detection | Epic 7 (notifications) for the digest, runtime for the detection |
| Hard daily backstop | Epic 17 (managed service) for billing, runtime for enforcement |
| Pre-flight prediction | New, depends on Agent Behavior dashboard epic |
| Per-Agent wallets | New, depends on Agent Behavior dashboard epic |
| Approval gating | Epic 7 (notifications), Agent Behavior dashboard for config |
| Kill switch | Epic 16 (mobile) |

**Proposed new epic candidate: Agent Behavior settings.** The dashboard surface, the permission model, the per-Agent override pattern, the default presets. Cost behavior is one of its dimensions; tool approvals, notification tiers, brain shares, extension permissions are others. Probably lands after Epics 7, 8, 9, and 12 since it depends on each having shape.

## References

- Triggered by [[prior-art-analysis]] v0.1, "eight changes to the epic map" section
- Pulse design spec: [[pulse]]
- Design principle: [[design-language]]
- Voice principles applied throughout: [[voice-and-framing]]
- Affects multiple epics in [[03-epic-map]]; full integration during the next epic-map walkthrough

## Format provenance

Decision recorded by Hobby and Doug during their second working session, 2026-04-24. The shape evolved over four turns:

1. Hobby proposed cost caps as a generic runtime concept.
2. Doug pushed back: "Is there a more clever way to do that?"
3. Hobby proposed an eight-layer system. Doug pushed back: "I feel like this will go that direction fast to where we've built an annoyance feature."
4. Synthesis: layered protections, mostly silent, dashboard-configurable, with Pulse as the visible layer. Locked.

The same conversation also produced [[design-language]] (the familiar-analog UX principle) and [[pulse]] (the first formal application). All three docs are siblings capturing what got decided this session.

---

*Decision recorded by Doug and Hobby, 2026-04-24.*
