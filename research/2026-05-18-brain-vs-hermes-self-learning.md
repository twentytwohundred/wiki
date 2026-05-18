---
title: "Brain architecture vs Hermes self-learning: structurally different executions of the same intent"
type: research-note
status: thesis (research; implementation deferred)
tags: [research, brain, self-learning, hermes-comparison, positioning, operator-control]
created: 2026-05-18
updated: 2026-05-18
linked_docs:
  - "[[../decisions/2026-05-18-hermes-deep-dive]]"
  - "[[../epics/08-agent-brain]]"
  - "[[../decisions/2026-04-24-brain-is-files-not-database]]"
  - "[[../decisions/2026-05-18-heuristics-vs-boundaries]]"
canonical_path: wiki/research/2026-05-18-brain-vs-hermes-self-learning.md
---

# Brain architecture vs Hermes self-learning

**Thesis.** Hermes Agent's self-improvement loop (auto-skill creation from observed task patterns, the curator's background skill maintenance, Honcho-style dialectic user modeling) is solving the right problem with the wrong execution. 2200's Brain architecture is solving the same problem with a different execution that's structurally better. The gap on our side is that we haven't fully implemented our execution yet ... Hermes ships theirs in production, and the discipline they show in actually closing the loop is the part we should lean into harder.

This is research, not a decision. The implementation belongs to its own future epic. The thesis matters now because it sharpens both the build direction AND the public positioning for 2200.ai.

## 1. What Hermes is doing

Hermes ships self-learning in three layers. All verified from the v0.14.0 source at `code/2200-reference/hermes-agent/`.

### Layer 1: per-turn `background_review` fork (`agent/background_review.py`)

After every conversation turn, `AIAgent.run_conversation` may call `spawn_background_review`, which fires a daemon thread that forks a new `AIAgent` in the same runtime (same provider, same model, same base URL, same credentials, same cached system prompt ... so it hits the same prefix cache). The fork runs with a tool whitelist restricted to memory + skill management tools and asks itself one of two questions:

- **Memory review** (verbatim from the source):
  > *"Review the conversation above and consider saving to memory if appropriate. Focus on: 1. Has the user revealed things about themselves ... persona, desires, preferences, or personal details worth remembering? 2. Has the user expressed expectations about how you should behave, their work style, or ways they want you to operate? If something stands out, save it using the memory tool. If nothing is worth saving, just say 'Nothing to save.' and stop."*

- **Skill review** (also verbatim, abbreviated):
  > *"Review the conversation above and update the skill library. Be ACTIVE ... most sessions produce at least one skill update, even if small. A pass that does nothing is a missed learning opportunity, not a neutral outcome. ... User corrected your style, tone, format, legibility, or verbosity. Frustration signals like 'stop doing X' ... are FIRST-CLASS skill signals."*

When the forked agent decides to save, **the write goes straight to the memory + skill stores.** No operator review. No accept/reject. The main conversation is never aware. The next session loads the new memory and updated skills into the system prompt automatically.

The operator sees the result (new behavior, updated tone, new skill available) but not the proposal step. From the operator's perspective: the Agent gradually changes how it behaves over time, and they can't see why except by reading the diff in `~/.hermes/memory/` and `~/.hermes/skills/`.

### Layer 2: curator (`agent/curator.py`)

Periodic (default 24*7 hours = weekly), inactivity-triggered (only runs when the Agent is idle and the last run was > `min_idle_hours` ago). When triggered, spawns a forked AIAgent to:

- Auto-transition skill lifecycle states (active → stale → archived) based on usage timestamps.
- Pin, consolidate, patch agent-created skills via `skill_manage`.
- Persist state in `<home>/skills/.curator_state`.

**Invariants** (from the source's docstring):
- Only touches agent-created skills, never built-in or trusted-repo skills.
- Never auto-deletes; only archives (recoverable).
- Pinned skills bypass all auto-transitions.
- Uses an auxiliary client, never the main session's prompt cache.

Operator-visible artifact: `.curator_state` (run timestamps, run count, summary of last run). The operator can pause the curator but not inspect the *reasoning* the curator used to decide what to archive vs consolidate, except retrospectively via the skill diff.

### Layer 3: Honcho external user modeling

Optional integration with [Honcho](https://github.com/plastic-labs/honcho), a dialectic user-modeling service that maintains a per-user model across sessions. References in `agent/agent_init.py`, `agent/display.py`, `agent/tool_executor.py`, `agent/background_review.py`, `agent/memory_provider.py`. The model is exchanged over an HTTP API; the operator sees the user-modeling outputs (a "what the model thinks of you" view) but the internal model is opaque ... it lives in Honcho's database, not on the operator's disk.

### The Hermes operator model

*"The platform learns about you. Trust it."* The learning runs in background forks the operator doesn't see, against a user model in an external service the operator can't directly inspect, with writes going straight to memory + skill stores without an approval step. Operators see *outcomes* (their Agent gets smarter), not the *reasoning chain*.

This is a coherent product decision. Hermes optimizes for *the Agent that gets better the more you use it.* The price of that optimization is operator opacity.

## 2. What 2200's Brain architecture does

Per [[../decisions/2026-04-24-brain-is-files-not-database]] and [[../epics/08-agent-brain]]: the Brain is markdown files on disk. SQLite FTS5 sits on top as a rebuildable index, never as the source of truth.

Concretely:

- Each Agent has a private brain at `<home>/agents/<name>/brain/`. One markdown file per note. Flat layout. Slugs derived from titles.
- Note format: YAML frontmatter (type, tags, created, updated, links) + markdown body. Inline `[[backlinks]]` detected at write time.
- Open-ended `type` field (conventions: `feedback`, `project`, `user`, `reference`, `journal`, `freeform`).
- Atomic writes via temp+rename (same pattern as TaskStore / ScheduleStore).
- Operator can `cat` any note. Operator can edit any note in any text editor and the FTS index re-syncs on next read.
- The Agent calls `brain_write` and `brain_search` as explicit tool calls. Writes are deliberate ... no background process observing the conversation and writing on the Agent's behalf.
- Cross-Agent reads via the shared brain (`<home>/shared/brain/`) where Agents publish notes intended for the fleet.

### The 2200 operator model (today)

*"The Agent writes to disk when it explicitly decides to. You read what it wrote. You edit it if it's wrong."* Learning is on-disk, operator-visible, operator-editable. There's no automatic background process and no opaque external user model.

The flip side: today, Agents don't learn much unless they remember to write. The "Agent quietly gets smarter over time without the operator doing anything" property Hermes optimizes for ... 2200 doesn't have it yet because we haven't built the proposing/observing layer.

## 3. Why 2200's execution is structurally better

Three reasons. Each is structural in the sense of [[../decisions/2026-05-18-heuristics-vs-boundaries]] §3 ... enforced by the architecture, not by prompt-level deterrence.

### 3a. Auditability

A Brain note is a file. The operator can:
- `git log <home>/agents/<name>/brain/` to see every learning event (if they version the directory ... a one-command setup most operators will do).
- `grep` across the directory to find what an Agent has been writing about a topic.
- Inspect the frontmatter and body to understand *what* the Agent learned without needing to understand the runtime that wrote it.

Hermes's `background_review` runs in a daemon thread inside the Agent process. The operator can read the resulting memory + skill files, but the chain from "this conversation turn" to "this learning event" lives in the fork's transcript, which is not surfaced. To audit "why did my Agent change its tone?" the operator would need to reconstruct which background-review pass changed which skill ... possible by reading `.curator_state` and the per-skill usage timestamps, but not direct.

2200's discipline of file-shaped, operator-readable learning artifacts is auditability-by-construction.

### 3b. Operator control

A wrong learning is a wrong file. The operator deletes it, edits it, or replaces it. The next session loads the corrected file. No special tooling required ... a text editor is the correction surface.

Hermes's wrong learning lives in `~/.hermes/memory/USER.md` (a markdown file, operator-editable, fine) AND in the per-skill `SKILL.md` files (also markdown, operator-editable, fine) AND possibly in Honcho's external user model (NOT operator-editable except through whatever UI Honcho exposes). The operator needs to know which surface to edit ... and the multi-surface design means the operator can correct the local files but the Honcho model continues to reflect the prior, wrong understanding until Hermes pushes a correcting interaction.

2200's single-surface (files on disk) design means the correction is unambiguous and complete.

### 3c. Multi-Agent coherence

In 2200, the operator decides whether two Agents share a brain note or maintain separate ones. The shared brain (`<home>/shared/brain/`) is the explicit coordination surface ... notes posted there are visible to every Agent on the instance. Per-Agent brains stay private. Operator can move a note from one to the other with `mv`.

In Hermes, the per-Agent user model and skill library are per-profile (each `hermes -p <name>` invocation has its own `~/.hermes/profiles/<name>/`). There's no shared brain ... or rather, sharing would require the operator to symlink directories across profiles, which conflicts with the curator's profile-scoped invariants and the background-review fork's profile-bound runtime.

Hermes's *single-Agent depth* posture (one really good Agent, served by Kanban-spawned workers) doesn't have a shared-state problem to solve. 2200's *fleet posture* does, and the Brain-as-files architecture solves it cleanly because file-system semantics are the coordination layer.

## 4. What to borrow (the gap)

Hermes's commitment to *actually doing the learning* is the part 2200 should lean into harder. The system prompt for `_SKILL_REVIEW_PROMPT` is explicit and quotable:

> *"Be ACTIVE ... most sessions produce at least one skill update, even if small. A pass that does nothing is a missed learning opportunity, not a neutral outcome."*

Right now 2200 Brain notes are written only when an Agent explicitly decides to. There's no background process that observes recent task patterns and proposes notes. We have the right architecture (files, operator-readable, operator-editable). We don't yet have the right *operating discipline* on top of it (someone watching the conversation and proposing what to write).

### The borrow shape

A 2200-side analog of `background_review`, but with the operator in the loop:

- **Trigger:** after every task completes (or every N turns within a long task), a background thread spawns a forked Agent with a memory/skill-management tool whitelist.
- **Prompt:** *"Review the task above. Are there learnings worth banking to the Brain? If yes, propose Brain note writes (additions, edits to existing notes, deprecation of obsolete notes) ... do NOT write directly."*
- **Output:** structured `BrainNoteProposal` objects ... not file writes. Each proposal includes: kind (add/edit/deprecate), target slug, body, rationale.
- **Surfacing:** proposals land in the operator's inbox at `passive` tier (or `normal` if the proposal modifies a high-traffic note). Operator reviews, accepts, edits, or rejects. (Inbox-tier semantics ... `passive`, `normal`, etc. ... are a separate substrate decision; this proposing layer depends on those tiers being defined before implementation.)
- **Audit trail:** every proposal is logged with the conversation snapshot that produced it. Accept/reject decisions are part of the operator-visible record.

The key inversion from Hermes: **Hermes writes first, operator audits after. 2200 proposes first, operator approves before write.**

Same self-improvement intent. Different execution. Human in the loop, transparent learning, file-shaped artifacts at every step.

### What this is NOT

- Not auto-skill-creation in the Hermes sense. Skills in 2200 are user-installed Capabilities + first-party tools, not Agent-generated artifacts. The Brain note is the per-Agent learning surface; that's where the proposing-layer points.
- Not a Honcho integration. The user model in 2200 is `user_*.md` Brain notes the operator can read and edit. External user-modeling services add a opacity surface that conflicts with the structural property.
- Not a curator analog yet. Per-Agent Brain note maintenance (archive stale notes, consolidate overlapping notes) is a separate piece of work that follows the proposing layer's shape.

## 5. Strategic positioning

The thesis above produces a sentence that survives scrutiny. Four-beat version (more accurate to the §4 architecture):

> *"Your Agents learn in the open. They propose what they want to remember. You approve before it lands. You can correct any of it with a text editor."*

Three-beat is the tighter alternative if a shorter version is needed for compressed surfaces (taglines, deck slides):

> *"Your Agents learn in the open. You see what they're learning. You own the learning."*

That sentence ... in whichever variant ... is the spine of any 2200.ai positioning around self-improvement. It contrasts with every other agent platform's framing of "trust the platform to learn for you" without using competitor names, while making the architectural commitment concrete (files on disk, operator-readable, operator-editable).

Three substrate properties to name in any public security/control story:

- **In the open.** Learning artifacts are markdown files in the operator's filesystem. No opaque internal model. No external user-modeling service.
- **You see it.** Every proposal (when the proposing layer ships) lands in the operator's inbox. Accept/reject is the operator's decision.
- **You own it.** The operator can correct a wrong learning with a text editor. The corrected note is the new source of truth on the next session.

This positions 2200 in the corner of the agent-platform space that values *operator control* over *platform autonomy.* It's a deliberate trade ... we're choosing the slower-learning, more-operator-effort path because the operator-trust property compounds harder in the fleet shape than the single-agent shape Hermes optimizes for.

Per [[../decisions/2026-05-18-hermes-deep-dive]] §6b.i framing: name this as a *different tradeoff* than Hermes's, not as *better*. Hermes is right for their customer (one really good Agent that gets smarter the more you talk to it). 2200 is right for ours (a team of Agents the operator coordinates and can correct).

## 6. Implementation deferred

This doc captures the thesis. Implementation is its own epic:

- **Working name:** Epic 17 *(or next available; epic-map renumber TBD)*: **Brain proposing layer + operator-in-the-loop self-improvement.**
- **Out of scope today:** no code, no Zod schemas, no proposing-layer prototype. The thesis frames the work; the work itself follows when sequencing allows.
- **Activation trigger:** post-Phase-F + post-Epic-16 (loop-as-recovery-engine). Both need to ship first because the proposing layer rides on top of a reliable loop and a populated Capability Catalog (the kinds of tasks that produce learnings).

The thesis is the deliverable for today. The implementation comes when Doug sequences it relative to the other parked epics.

## Provenance

Thread raised by Doug 2026-05-18 afternoon during the Hermes-findings synthesis. The deep dive ([[../decisions/2026-05-18-hermes-deep-dive]] §8) explicitly flagged `background_review.py` as not-read-in-this-pass; this doc closes that gap with a focused read of the self-learning subsystem (background_review.py, curator.py, Honcho references). The execution-comparison and positioning frame are Doug + Guppi's; the section structure was prescribed in the work package. Hobby wrote.

Hermes references are MIT © 2025 Nous Research. The system-prompt quotes in §1 are lifted verbatim with attribution for accuracy of comparison.

— Hobby
</parameter>
</invoke>