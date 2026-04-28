---
title: "Claude Code architecture: what we learned from the leak"
type: research-note
status: open
tags: [research, claude-code, anthropic, prior-art, architectural-patterns]
created: 2026-04-26
linked_docs:
  - "[[03-epic-map]]"
  - "[[02-architecture]]"
canonical_path: wiki/research/2026-04-26-claude-code-architecture.md
---

# Claude Code architecture: what we learned from the leak

In late April 2026, Claude Code's source code became visible to developers. The codebase is 512,000 lines of strict TypeScript running on Bun, with a stateful terminal UI built on React + Ink. The leak revealed a set of architectural patterns Anthropic uses internally that are worth understanding for 2200's own design work.

This is a research note, not a decision record. We're not basing 2200 decisions directly on what Claude Code does, but several patterns are concept-borrowable and could save us design cycles in future epics.

## What we are NOT doing

- **Not lifting any code.** The Anthropic terms of service crackdown a few weeks ago shut down subscription-mediated Agent runtimes; copying code from a leaked codebase would compound the legal exposure. Concepts and patterns are fair game; implementation is not.
- **Not pivoting 2200's architecture.** The patterns below are confirmation that our direction is sound, not signal that we should change course.

## What's interesting and why

### Self-Healing Memory (relates to Epic 8)

Claude Code addresses what they call "context entropy" — the gradual degradation of an Agent's working context over a long session. As the conversation grows, contradictions creep in, focus drifts, and the Agent's coherence weakens.

Their pattern (inferred): the Agent monitors its own context for signs of degradation (lost references, contradictory state, drift from task) and triggers a refresh from canonical memory before the degradation compounds.

**Implication for 2200's Brain epic (Epic 8):** Brain isn't just storage; it's the source of truth the Agent can re-anchor against when working context degrades. The Brain object should support a "rehydrate" operation that pulls canonical state back into context. This is a different shape than just FTS5 search; it's an active anti-entropy mechanism.

The current Brain spec mentions FTS5, graph storage, and the Brain object. It doesn't yet mention self-healing or context anti-entropy. Worth adding a section to Epic 8's spec when we get there.

### YOLO Classifier (relates to Epic 14, possibly its own epic)

A classifier model that predicts whether a tool call will succeed before it executes. Likely trained on Anthropic's massive dataset of real tool calls and outcomes.

**Implication for 2200:** Our plan/run/perm wrapping records intent (plan), execution (run), and authorization (perm) for every tool call. We could add a fourth concept: **predict** — a classifier that predicts the outcome before the tool runs and surfaces a warning if the prediction is failure. This would slot in between plan and perm in the wrapping flow.

This is probably its own epic, not a v1 feature. Tracking the concept here so it doesn't get lost. The data substrate to train such a classifier already exists by design (every plan/run pair on disk is training data). Worth knowing for the long term.

### KAIROS background daemon (relates to Epic 6)

Greek word for "the right moment." Suggests scheduled or triggered work happening outside the user's active session. The Agent does work autonomously when the conditions are right.

**Implication for 2200's Scheduler epic (Epic 6):** Schedules aren't just "run this at 9am every day." They're "run this when the right conditions exist." Conditions could be time-based, event-based (a pub message arrived, a file changed, an external trigger fired), or composite.

The current scheduler spec is probably too time-centric. Worth widening when Epic 6 opens to include event-based and condition-based triggers.

### ULTRAPLAN 30-minute remote reasoning (relates to Epic 10 or own epic)

A long-form planning mode where the Agent goes off and thinks deeply for an extended period before returning a plan. Different from rapid iteration; this is deliberate offline reasoning.

**Implication for 2200:** Some Agent task types benefit from long-form thinking that doesn't fit the tight loop pattern Hobby currently uses. A research Agent doing literature review, a strategy Agent doing scenario planning, an architecture Agent doing prior-art analysis — all benefit from "go think for 30 minutes" rather than "respond every 30 seconds."

This could be an Agent execution mode toggle (loop mode vs. deep-thought mode) or a specialized task type. The infrastructure exists in 2200 to support it (the AgentLoop, the task pipe, the cost-burst detector that would prevent runaway thinking). The shape is unclear; worth thinking about when a real workload demands it.

### Stateful terminal UI on React + Ink

Claude Code uses React with the Ink library to render a complex stateful UI in the terminal. This is the same library 2200's CLI could use when we get to the dashboard layer.

**Implication for 2200:** Ink is a confirmed-good choice for terminal UI in this domain. When we build the 2200 dashboard (Epic 13, Behavior visualization in Epic 14), Ink is a default choice rather than a research project.

## The bigger picture

Two strategic observations.

### Architectural convergence is signal

Anthropic and 2200 arrived at similar architectural patterns independently:

- Strict TypeScript runtime
- Stateful supervisor/daemon pattern
- Tool call wrapping for inspection and control
- Detection/classification of degraded behavior
- Context preservation across long-running work

That convergence means the shape is right. We're not copying; we're solving the same problems and reaching the same solutions. The fact that we arrived here ahead of seeing the leak is validation of the spec discipline.

### Acquisition is optional upside, not the target

*Reframed 2026-04-27 to align with the operating thesis at [[2200-operating-thesis]].*

The original draft of this section put acquisition front-and-center. That framing is incomplete. Per the operating thesis, the **primary** goal of 2200 is sustainable profitability — $10K/month, indefinitely, on the operator's labor budget. **Acquisition is optional upside that may or may not happen; it is not the target.**

The design discipline holds either way, but the primary reasons are operator-facing:

- **Keep the codebase clean and compact** — primarily because clean code is easier to operate solo for years; secondarily because clean code is easier for an acquirer to absorb if a sale ever comes up.
- **Don't take outside investment that complicates ownership** — primarily because the operating thesis requires the operator to own 100% of decisions about what 2200 becomes; secondarily because investors complicate any future transaction.
- **Document the architecture clearly** — primarily for operators (Doug, Hobby, future agents) and the users running 2200; secondarily as due-diligence material.
- **Build with the same stack the likely environment uses** — TypeScript + Node (or Bun) + React + Ink — primarily because standard tools mean standard tooling and easier solo maintenance; secondarily because the same stack is what any major model-provider acquirer would already be running.

The discipline is right; the framing is "build for sustainable operation, the acquisition path stays open as a side-effect." The MoltBook reference (small fast-shipped company, large exit) remains a useful pattern to keep in mind, but it is the bonus case, not the plan.

If 2200 hits $10K/month and runs profitably for years, the project has won — whether or not anyone ever offers to buy it. If an acquirer shows up, the conversation happens from a position of strength: profitable, sustainable, walk-away-able.

## Action items

None yet. This note exists so the patterns above are available when relevant epics open. Specific actions:

- **When Epic 8 (Brain) opens:** review self-healing memory pattern and consider adding context anti-entropy to scope.
- **When Epic 6 (Scheduler) opens:** widen scope from time-based to condition-based triggers.
- **When Epic 14 (Behavior dashboard) is in scope:** consider a predictor classifier as a future addition to plan/run/perm wrapping.
- **When dashboard work begins:** Ink + React is the default choice.
- **When considering execution mode variations:** ULTRAPLAN-style deep thinking is a known pattern.

## Sources

- General reporting on the Claude Code source visibility incident, late April 2026
- Industry analysis of converging Agent platform architecture
- (No code lifted; concepts only)

---

*Research note · 2026-04-26 · contributed by Doug Hardman + Guppi*
