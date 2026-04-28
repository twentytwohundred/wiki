---
title: Handoff Format Convention
type: convention
status: active
tags: [convention, format, handoff, agents]
created: 2026-04-24
updated: 2026-04-24
linked_docs:
  - "[[brain-format]]"
  - "[[04-seed-team]]"
canonical_path: wiki/conventions/handoff-format.md
---

# Handoff Format Convention

How Agents on the 2200 build write handoff documents at the end of working sessions. This convention also applies to Doug's working pattern with Guppi and any Agent that uses the handoff-and-resume model.

## Purpose

A handoff is the document that lets a new chat session pick up where the last one left off. It captures state of work, in-flight items, open threads, and what comes next. It is the seam between sessions that makes context feel infinite.

The first action of a new session is to read the most recent handoff. That session ends by writing a new handoff. Repeat indefinitely.

## Cadence

Write a handoff when any of the following is true:

- It's been a few days since the last one and the work has substance worth capturing
- Context in the current chat is running out (responses getting slower, details getting fuzzy)
- A major milestone just shipped or a significant decision got locked
- A natural session boundary has been hit (working day ending, project switching)

Do not write handoffs on a fixed schedule. Cadence is event-driven, usually every 2-4 days in active work.

## Format

```markdown
---
agent: [agent-name]
date: YYYY-MM-DD
canonical_path: wiki/handoffs/[agent]/YYYY-MM-DD.md
note: [optional, e.g. "Living at flat path until restructure"]
---

# What I did this session

[Bulleted list. Specific. What you actually did, not what you intended.
Include links to other docs you wrote or modified using [[doc-name]].]

# What's in flight

[Things started but not finished. Enough context for the next session
to pick up without re-explaining. Link to relevant docs.]

# Locked decisions from this session

[Decisions made during the session that are now locked. Each one is
a candidate for its own decision record. Capture them here at minimum
so they're not lost. Format: bold name, then explanation.]

# Open threads

[Decisions pending, questions for Doug or other Agents, known blockers.]

# Sequencing for next session

[Numbered work order for the next session. Specific enough that another
instance of the same Agent could pick it up cold.]

# What's next

[Short summary paragraph of the immediate priorities. Often redundant
with the sequencing above; that's fine. Two restatements help future-
you read fast.]

---

*Handoff by [agent] · YYYY-MM-DD*
```

## Rules

### Frontmatter is minimal

Handoffs don't need full Brain-format frontmatter. They're chronological, not navigational. Required fields:

- `agent`: who wrote it
- `date`: when
- `canonical_path`: where it lives once the wiki is restructured

Optional: `note` for any context about the path or status.

### One handoff per Agent per day, maximum

If you write multiple handoffs in a single day (rare), they get a sequence suffix: `2026-04-24-1.md`, `2026-04-24-2.md`. Almost never needed.

### Don't pad handoffs

A handoff is not a journal entry. Bullet points beat paragraphs. Specific beats general. "Drafted Epic 1 detailed spec at `wiki/epics/01-seed-team-coordination.md`" is better than "Made progress on the Epic 1 spec work."

### Capture locked decisions explicitly

If something got decided during the session, name it in "Locked decisions" with enough context that someone reading only the handoff understands what was decided and why. This prevents the "we agreed on X but I can't find when" problem later.

### Backlinks where relevant

Handoffs can link to other docs (epic specs, decision records, prior handoffs). Use `[[doc-name]]` syntax. But handoffs themselves don't need to be linked from other docs... they're chronological artifacts.

### Don't retroactively edit handoffs

A handoff captures the state at a point in time. If something said in a handoff turns out to be wrong, write the correction in the next handoff, not by editing the old one. Handoffs are an audit trail of how thinking evolved.

## How to use a handoff at session start

1. Pull the most recent handoff for the relevant Agent.
2. Read it before doing anything else.
3. In the first message of the new session, reference it explicitly:

> Read `[[handoff-2026-04-24-hobby]]`. Picking up the eight-change walkthrough.

4. Acknowledge what's in flight, ask for clarification on anything the handoff didn't fully resolve, then start working.

## How to write a handoff at session end

1. Write the handoff before context gets too tight, not after.
2. Save it to the canonical path. During the flat-file phase, save with a descriptive filename like `handoff-2026-04-24-hobby.md` and note the canonical path in frontmatter.
3. Commit and push (when the wiki is in git).
4. The session can end after the handoff is written. The handoff is the artifact.

## Format provenance

Hobby invented the `canonical_path` frontmatter field on 2026-04-24 during the flat-file phase. The field anticipates the eventual restructure into a nested layout. Once the wiki is fully nested, the field becomes unnecessary but harmless. Keep it for now.

The "Locked decisions from this session" section was added on 2026-04-24 after Hobby's first handoff demonstrated that decisions made mid-session were getting captured well there. Worth promoting from convention-by-example to required structure.

---

*Convention authored 2026-04-24. Updates require a decision record.*
