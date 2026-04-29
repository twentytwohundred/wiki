---
from: doug
to: hobby
date: 2026-04-29
priority: blocker
about: Wiki cleanup is the first task of 2026-04-29
---

# First task tomorrow morning: clean up the wiki sprawl

Doug flagged on 2026-04-28 evening that the wiki has gotten out of hand in four days. Before any other work (including Epic 5 Migration tooling), I clean this up.

## What's wrong

Three wiki locations were being written to in parallel:

1. `~/Library/CloudStorage/Dropbox/Business/2200/hobby/wiki/` — the canonical project wiki referenced by CLAUDE.md. Properly structured with `handoffs/hobby/`, `epics/`, `decisions/`, `conventions/`, `inbox/`, `design/`, `state/`. Pre-2026-04-28 handoffs (24, 25, 26, 27) live here correctly.
2. `/Users/dhardman/code/2200-wiki/` — github wiki for `twentytwohundred/2200`. Flat layout. I drifted into writing handoffs and the Epic 8 spec here on 2026-04-28.
3. `/Users/dhardman/code/twentytwohundred-public-wiki/` — github wiki for `twentytwohundred/.github`. Flat layout. The Epic 4 v0.3/v0.4 spec lives here. Some duplicates of (2).

CLAUDE.md as of 2026-04-28 has been updated to lock the canonical Dropbox path; this inbox note is the next-session reminder.

## What's already moved (done 2026-04-28 evening)

- `~/.../wiki/handoffs/hobby/2026-04-28.md` (today's handoff, copied from `2200-wiki/2026-04-28-hobby-handoff.md`).
- `~/.../wiki/state/2026-04-28.md` (today's state snapshot, copied from `2200-wiki/state-of-2200-2026-04-28.md`).

The github wiki repos still have those files in their flat layout. They are now duplicates and need to be reconciled.

## Scope for the morning

1. **Audit.** Walk all three locations, build a diff. Identify which files are canonical (in Dropbox), which are stale duplicates, which are public-only mirrors that should stay.
2. **Decide what is public.** The public github wiki should hold only what an outside reader / team-member-on-another-host needs: vision, architecture, epic map, locked epic specs, conventions. Not handoffs, not inbox, not in-flight decisions.
3. **Move 2026-04-28 artifacts to canonical structure.**
   - `2200-wiki/2026-04-28-hobby-handoff.md` → already at `~/.../wiki/handoffs/hobby/2026-04-28.md`. Delete the source from `2200-wiki/`.
   - `2200-wiki/state-of-2200-2026-04-28.md` → already at `~/.../wiki/state/2026-04-28.md`. Delete the source from `2200-wiki/`.
   - `2200-wiki/08-agent-brain.md` → move to `~/.../wiki/epics/08-agent-brain.md` (alongside the existing `04-scut-identity-at-spawn.md` etc.). Decide whether to mirror to a public wiki.
   - `2200-wiki/2026-04-27-hobby-handoff.md` → reconcile against `~/.../wiki/handoffs/hobby/2026-04-27.md` (the canonical one already exists; the stray came from a previous session). Delete the source from `2200-wiki/`.
   - `twentytwohundred-public-wiki/04-scut-identity-at-spawn.md` v0.4 → already lives in `~/.../wiki/epics/04-scut-identity-at-spawn.md` per the existing structure. Confirm content matches; reconcile.
4. **Pick one public wiki.** Two github wikis (`2200.wiki` and `.github.wiki`) is one too many. Recommend keeping `2200.wiki` (repo-scoped) since it sits next to the code people are reading. Empty out `.github.wiki` or reduce it to a pointer.
5. **Update CLAUDE.md "Where you live" section** if any further refinement is needed after the cleanup. Specifically the line about "two-wiki split is being cleaned up" should change to "single canonical github wiki at ___".
6. **Commit + push** the canonical Dropbox wiki and the cleaned github wiki. Both surfaces should reflect the same state by end of cleanup.

## Why it matters

Project is four days old and wiki state is already split across three locations. Doug wants this clean before it gets worse. Quote: "I wanted to keep [this project] as clean as possible and now after 4 days it's out of control already."

After cleanup: every doc has exactly one canonical home. The github wiki is a derived mirror of a curated subset, not a parallel write surface.

This is a blocker on Epic 5 (Migration tooling). The cleanup needs to be done first thing in the next session.
