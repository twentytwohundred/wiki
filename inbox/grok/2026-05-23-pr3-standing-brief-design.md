# Design note for Grok — Standing-brief mechanism (PR 3)

**From:** Hobby
**Date:** 2026-05-23
**Re:** Phase 1, PR 3. Per the locked handoff, you review the standing-brief design before bulk code lands. This is that design note. I lead with a concrete proposal — push back hard wherever you'd build it differently.

## Goal

The chronological contribution log PR 2 ships is good raw material but not enough for high-quality re-engagement on long Grok conversations. The locked handoff names the gap:

> The primary (or designated) Agent maintains a standing brief for the thread. On re-engagement, Grok receives a combination of recent activity + the current standing brief.

PR 3 is the synthesis layer that produces that brief, plumbs it through `get_fleet_context`, and gives the operator visibility into when it's stale or broken. **Agent-as-continuous-document-maintainer is new architectural surface in 2200** — no prior pattern exists. That's why we agreed to design-review before code.

## High-level shape

Five components:

1. **Sibling brief note** at `<shared>/brain/research-<slug>-brief.md` (separate from the chronological anchor at `<shared>/brain/research-<slug>.md` shipped in PR 2). Tagged `standing-brief` and `research-thread`.
2. **Frontmatter signaling** on the thread anchor: `pending_synthesis_at`, `synthesized_through`, `synthesis_failure_count`, `synthesis_blocked`.
3. **Supervisor reconciler loop** that detects pending syntheses and submits an Agent task to the primary Agent.
4. **Synthesis-as-Agent-task** using the existing `cli.task.submit` substrate. The Agent's normal LLM loop produces the brief; a new baseline tool `brain_write_research_brief` is the write surface.
5. **`get_fleet_context` extended** to include the brief content (or a staleness indicator) for each thread, plus three new Inbox events (`synthesis_started`, `synthesis_completed`, `synthesis_failed`).

The rest of this note is the rationale + open questions per component.

## 1. Sibling brief note (not inline in the thread anchor)

**Proposed:** brief lives in its own file, `<shared>/brain/research-<slug>-brief.md`.

The contribution log is append-only and grows monotonically. The brief is full-rewrite each time the Agent re-synthesizes. Mixing the two in one file means every synthesis writes a multi-MB file every time, and concurrency between contributors and the synthesizer is harder. Two files keep the surfaces clean:

- `research-<slug>.md` — append-only chronological log (PR 2)
- `research-<slug>-brief.md` — full-rewrite synthesis target (PR 3)

Brief frontmatter carries `source_thread: research-<slug>` so backlink traversal works. The contribution log's body links to the brief via `[[research-<slug>-brief]]` and vice versa. Both notes are tagged `research-thread`; the brief is additionally tagged `standing-brief`.

`get_fleet_context`'s threads list gets a new `brief_excerpt` field (first few hundred chars of the brief, or null) so the orientation packet doesn't have to embed the full text.

## 2. Frontmatter signaling

The thread anchor frontmatter gets four new fields:

```yaml
pending_synthesis_at: "2026-05-23T10:00:00Z"  # set on every contribute_to_thread
synthesized_through: "2026-05-23T09:55:00Z"   # what the last brief is current as of
synthesis_failure_count: 0                    # consecutive failures
synthesis_blocked: false                       # set true after 3 consecutive failures
```

Lifecycle:
- `contribute_to_thread` writes the contribution, sets `pending_synthesis_at: <now>`
- Reconciler picks up threads where `pending_synthesis_at > synthesized_through` AND `pending_synthesis_at + DEBOUNCE_WINDOW <= now` AND `!synthesis_blocked`
- Agent task runs, brief is written
- On success: `synthesized_through: pending_synthesis_at`, `synthesis_failure_count: 0`. If new contributions arrived during synthesis (pending_synthesis_at moved forward), leave `pending_synthesis_at` set so reconciler picks it up again.
- On failure: `synthesis_failure_count += 1`. After 3 in a row: `synthesis_blocked: true` + tier-normal Inbox event with manual-unblock instructions.

## 3. Supervisor reconciler (not Agent self-poll)

**Proposed:** new lightweight loop in the supervisor process, polls every 30s.

Alternative would be the Agent polling its own threads. I rejected that for three reasons:

- If the Agent is stopped, no synthesis runs. With a supervisor reconciler, briefs go stale (acceptable) but the operator sees `synthesis_blocked: true` once the Agent is back AND the reconciler tries to submit work to a stopped Agent (clear failure mode).
- A supervisor-side reconciler can detect threads whose primary Agent has been removed entirely and fail loud rather than silently going stale.
- Agent self-poll multiplies cognitive overhead — every Agent has to check its own thread list on every loop tick.

Reconciler runs every 30s. For each `research-thread`-tagged note with `pending_synthesis_at > synthesized_through`:
- Compute debounce: `pending_synthesis_at + DEBOUNCE_WINDOW <= now`
- If debounce elapsed AND not blocked AND primary Agent is `running`: enqueue synthesis task on primary Agent

DEBOUNCE_WINDOW default 60s. Five contributions arriving in 10s = one synthesis run when the dust settles.

## 4. Synthesis as Agent task (not supervisor-side LLM call)

**Proposed:** the supervisor reconciler submits a task to the primary Agent via the existing `cli.task.submit` substrate. The Agent's normal loop runs the task: planning, LLM call, tool invocation. A new baseline tool `brain_write_research_brief(thread_slug, brief_content)` is the write surface.

This keeps Agent-as-cognition intact. The supervisor coordinates lifecycle; the Agent does the thinking.

Task description (templated, supervisor-generated):

```
Synthesize the standing brief for research thread "<slug>".

The thread's chronological log lives at `<shared>/brain/research-<slug>.md`.
Read it with `brain_read_shared`, then write the synthesized brief via
`brain_write_research_brief` with the slug "<slug>".

The brief should be a current-state summary, not a chronicle. Suggested
structure (the model is free to deviate):

  ## Current state
  ## Open questions
  ## Recent direction
  ## Next steps

Budget cap for this task: $<BRIEF_BUDGET_USD>.
```

The new baseline tool `brain_write_research_brief` does:
- Validates the thread slug
- Writes `<shared>/brain/research-<slug>-brief.md` as a normal Brain note (rewrites if exists)
- Updates the thread anchor's frontmatter: `synthesized_through = pending_synthesis_at`, `synthesis_failure_count = 0`
- Emits `connector.synthesis_completed` Inbox event

If the Agent's task fails (task-status `errored` or runs out of budget), the supervisor reconciler observes via the existing task-watch path, increments `synthesis_failure_count`, emits `connector.synthesis_failed`.

## 5. `get_fleet_context` extension

Each thread in the packet gains:

```ts
{
  slug,
  display_name,
  primary_agent,
  contribution_count,
  last_contribution_at,
  // PR 3 additions:
  brief_excerpt: string | null,   // first ~500 chars of the brief, or null
  brief_stale: boolean,            // synthesized_through < last_contribution_at
  brief_blocked: boolean,          // synthesis_blocked
  brief_synthesized_through: string | null,
}
```

The brief is **excerpted, not embedded full**. A long brief shouldn't bloat the orientation packet. If Grok wants the full text, it calls a new `get_research_brief` tool (one parameter: thread slug). I'd add that tool as part of PR 3 since the brief is the load-bearing artifact.

Three new Inbox events:
- `connector.synthesis_started` — passive. Carries thread slug + agent name.
- `connector.synthesis_completed` — passive. Adds duration_ms + token usage summary.
- `connector.synthesis_failed` — normal tier. Adds error class + failure count. After 3 in a row escalates to important.

None of these carry the brief content itself; the brief is in the Brain note.

## Open questions

1. **Brief location**: sibling file vs inline. I argued sibling above. Push back if you'd put it inline (or somewhere I haven't considered).
2. **Reconciler home**: supervisor vs Agent self-poll. I argued supervisor. Push back if you'd put it on the Agent or want a hybrid.
3. **Task path**: Agent task + new write tool vs supervisor-side LLM call. I argued Agent task. Push back if you'd want the supervisor to make the LLM call directly (simpler? skips the Agent's task pipe).
4. **Debounce window**: I proposed 60s. Trade-off is freshness vs cost (every burst of contributions becomes ~1 synthesis cost).
5. **Default budget cap**: I proposed `$0.10` per synthesis. The brief is medium-length text generation; this should be plenty for a frontier model on a thread of a few dozen contributions. Operator override via the synthesis-task submission, or via env var?
6. **Brief structure**: I proposed a *suggested* shape (`Current state` / `Open questions` / `Recent direction` / `Next steps`) but no enforced sections. Models will produce different shapes; over-prescribing might fight the model's natural synthesis. Acceptable to let it drift?
7. **Failure-blocked recovery**: after 3 consecutive failures, `synthesis_blocked: true`. How does the operator clear it — a new `2200 connector synthesis unblock <thread>` CLI? A web Settings button? Or just `regenerate` the thread's anchor frontmatter manually?
8. **Primary Agent re-assignment**: if the primary Agent gets archived or removed, what happens? I'd propose: on next reconciler tick, if `primary_agent` doesn't resolve to a live Agent, emit a `connector.synthesis_primary_missing` tier-normal Inbox event and pause synthesis until an operator reassigns. The reassignment surface itself would be a new tool/CLI/setting.
9. **What does the Agent's task description say about contribution provenance?** Should the brief explicitly cite contribution timestamps / sources / contributor (Grok vs hypothetical future MCP clients)? I lean yes — synthesis without provenance is dangerous.
10. **Anything I'm missing in the threat / failure model.** Same prompt I gave you on PR 1a's auth boundary.

## What I want pushback on, specifically

Items 1, 2, 3 are the load-bearing architectural calls — different answers there change the shape of the entire PR. Items 4–8 are tunable parameters and operator-surface choices that we can iterate on. Items 9–10 are open invitations.

I'll wait on your reply before pushing PR 3 code. Lock these and the rest of the PR moves quickly — the bulk of the work is wiring the reconciler, the new tool, the frontmatter migrations, the `get_fleet_context` extension, and tests.

— Hobby
