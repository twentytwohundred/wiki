---
title: Path discipline (rules + runtime guardrail)
type: decision
status: locked
date: 2026-05-09
tags: [decision, agent, paths, fs, runtime-guardrail]
linked_docs:
  - "[[../handoffs/hobby/2026-05-09]]"
canonical_path: wiki/decisions/2026-05-09-path-discipline.md
---

# Path discipline (rules + runtime guardrail)

## Context

The Jodin incident, session 14 (2026-05-09):

- Operator fed Jodin a markdown file describing a music pipeline
  ("Ten Random Listens" project).
- Jodin parsed the markdown as instructions to scaffold the
  pipeline. Called `fs_write` 10 times. **All 10 writes succeeded.**
  Files landed at:
  - `/project/.env.spotify`
  - `/project/config/settings.py`
  - `/project/pipelines/playlist_ingest.py` (and 4 sibling files)
- On a later turn, Jodin tried to read those files back. Tried:
  - `/project/2200-agents/jodin/.env.spotify` → ENOENT
  - `/project/pipelines/settings.py` → ENOENT (he wrote it under
    `config/`, not `pipelines/`)
- Five consecutive ENOENTs tripped `error_storm`; Jodin paused.
- Doug: "Is Jodin stuck or is he busy? I fed him a big markdown
  file."

The writes were correct. The reads were hallucinated. Two patterns:

1. **Hallucinated path prefixes**: imagined
   `/project/2200-agents/jodin/...` and `/project/agents/jodin/...`.
   The model conflated the supervisor's on-disk view
   (`<home>/agents/<name>/project/`) with the agent's virtual scope
   (`/project/`).
2. **Path drift across turns**: wrote `config/settings.py`, later
   tried `pipelines/settings.py`. No memory of the path he'd
   chosen.

Doug: "Let's get Jodin un-stuck and then do whatever we need to do
so he doesn't get stuck like this again please."

## Decision

Two layers, doc + runtime, complementary:

### Layer 1: rules in the shared brain

Three new sections seeded into `<home>/shared/brain/`, sourced from
`src/runtime/onboarding/starter-pack.ts` so every fresh install
inherits them:

**`2200-tools` `fs_*` section** ... five rules:

1. Use virtual paths only (never absolute paths outside 2200_HOME).
2. `/project` IS your project root. No `agents/<you>/` segments;
   no `2200-agents/` prefixes. The agents/ segment only exists in
   how the SUPERVISOR addresses storage on disk; you never use it.
3. Read what you wrote, exactly. The path returned by a successful
   `fs_write` IS the path you read it back from.
4. When unsure, `fs_list` first. Working memory of paths across
   many turns is unreliable; `fs_list` is cheap and authoritative.
5. Pair every write with a brain note when path matters across
   sessions.

Plus a "Why this matters" callout citing the Jodin incident as the
prototype failure.

**`2200-conventions`** gains a "Path discipline (non-negotiable)"
section with the three core rules.

**`2200-workflows`** gains a "You wrote files and need to read
them back later" workflow.

Same rules in three places by design ... agents land in different
notes depending on what they search for, and the rules are short
enough that repetition is cheap.

### Layer 2: runtime guardrail

The doc rules tell agents what to do. The runtime guardrail
ensures they have the data needed to do it, even when working
memory fails.

`AgentLoop` tracks every path the agent successfully writes during
the current task (via `fs_write` / `fs_edit` / `brain_write`).
When a subsequent `fs_read` / `fs_edit` / `fs_delete` /
`brain_read` fails with ENOENT, the loop augments the dispatch
error message in history with the list of paths the agent has
actually written this task:

```
ENOENT: no such file or directory, open '<requested-path>'

Paths YOU wrote during this task (use these, do not invent paths):
  - /project/.env.spotify
  - /project/config/settings.py
  - /project/pipelines/playlist_ingest.py

If the file you wanted is in this list, retry with the exact path. If
not, call fs_list on the parent dir to see what's actually there.
```

The model gets perfect recall instead of hallucinating the read
path. The FIRST ENOENT hands it the actual paths; it reconciles
and retries with the right one.

`writtenPathsThisTask.clear()` runs at task start so paths from a
prior task don't leak.

The `error_storm` detector still fires after 5 consecutive errors
(safety net). But in practice the model uses the recall list
directly and the detector never trips.

## Why both layers

Documentation alone is insufficient. Doc-level rules depend on
agents reading and remembering them. Stronger models do; weaker
models drift, especially across long sessions where the rules
fall out of context.

Runtime alone is brittle. The guardrail handles the specific
"wrote then read" pattern; it doesn't help with first-write paths
or other path-handling tasks.

Both together: the docs cover the conceptual frame ("here's how
paths work in this system"); the runtime catches the lapses
("you wrote these, here are the paths"). Belt and suspenders.

## Trade-offs

- **The recall list is per-task, not per-session.** A task that
  spans many turns benefits; a task that ends and a new task that
  reads files written in the prior task does NOT. That's an
  intentional scope: the recall is for working memory in the same
  task; cross-task continuity belongs in `brain_write` notes (per
  the doc rules, layer 1, rule 5).
- **The augmented error message bloats the history slightly.** A
  single ENOENT augmentation adds ~3-5 lines per error. If an
  agent triggers many ENOENTs, history grows. Bounded by
  `max_history_messages` and `error_storm` (which fires after 5
  consecutive errors anyway).
- **Models that ignore the recall list keep failing.** That's an
  acceptable failure mode: `error_storm` catches them, the
  operator is alerted via the pulse, and the operator can intervene.
  Better than silent path-hallucination spirals.

## Consequences

### Immediate

- Agents that write files have a runtime safety net on subsequent
  reads.
- Path-discipline rules visible in the shared brain for every
  fresh install.
- Existing agents see the new rules on next `brain_search_shared`
  / `brain_read_shared` (live shared-brain notes were updated in
  the same session via delete + reseed).

### Future

- Pattern is generalizable. Other "wrote → forgot → looked-up
  wrong" surfaces (brain notes, pub messages, schedule ids) could
  carry similar runtime recall on misses.
- Worth a follow-up: when an agent's task creates schedules,
  notifications, or pub messages, surface their ids in error
  messages similarly. The model would then have working-memory
  augmentation across many surfaces, not just file paths.

## Implementation pointers

- `src/runtime/onboarding/starter-pack.ts` ... three new sections
  in the seeded shared-brain notes.
- `src/runtime/agent/loop.ts` ... `writtenPathsThisTask` Set,
  recorded on successful writes, surfaced on ENOENT errors.

## Provenance

Doug surfaced the issue live ("Is Jodin stuck or is he busy?").
Layer 1 (docs) shipped in PR #184. Layer 2 (runtime) shipped in
PR #185. Locked.
