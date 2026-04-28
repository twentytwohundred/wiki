---
title: 2200 Seed Team Roster & Coordination Spec
type: team-spec
status: active
tags: [team, agents, infrastructure, dogfooding, migration]
created: 2026-04-24
updated: 2026-04-24
linked_docs:
  - "[[01-vision]]"
  - "[[02-architecture]]"
  - "[[03-epic-map]]"
  - "[[brain-format]]"
  - "[[handoff-format]]"
  - "[[2026-04-24-hobby-as-primary-agent]]"
canonical_path: wiki/04-seed-team.md
---

# 2200 — Seed Team Roster & Coordination Spec
## v0.3 draft · April 24, 2026

This document defines the seed team that builds 2200, their lanes, the coordination infrastructure they use, and the planned growth of the team as the build progresses.

---

## Seed team roster

Three Agents on the build team. One human (Doug) in the pub alongside them.

### Hobby — primary Agent on the build

**Home.** Doug's MacBook Pro initially. Runs as a Claude Code instance. Doug's Max subscription covers his usage, which is why he's on the Mac and not on Valkyrie via OpenClaw (API billing would burn through credits fast on a build this size).

**Named after.** Allen Hobby, the scientist in Spielberg's A.I. who builds the Mecha child David. In the film, Hobby is the creator. In this project, Hobby is the builder. When 2200 is alive enough to spawn its first Agent, that Agent is David. Hobby builds the thing that brings David into existence.

**Lane.**
- Primary Agent on the 2200 build. Owns spec, code, and coordination.
- Writes the wiki. Maintains the epic map as work completes or scope shifts.
- Writes application code for every epic from Epic 2 onward.
- Coordinates with Simon on infrastructure and Poe on OpenPub integration.
- Flags product decisions to Doug. Flags cross-cutting architectural questions to Doug.
- Migrates into 2200 when the runtime can host him. That migration is the Cray test.

**Why one Agent covers both spec and code.** A two-Agent split (project lead plus software architect) was the earlier design. It was dropped because Doug is the product lead, which makes a project-lead Agent redundant. Hobby writes his own specs because the gap between "spec writer" and "code writer" is small when the same Agent does both and Doug is in the pub making product calls. If Hobby ever hits the wall and needs a peer Agent, he flags it and Doug spawns one. Scaling decision is Hobby's to raise.

**Reports to.** Doug.

**Peers.** Simon (infrastructure), Poe (OpenPub specialist, part-time until v0.3.1 ships).

**Coordinates with.** Garfield (SCUT integration points when Epic 4 lands).

**Does not interact with.** Carl Monday, Bishop, Rocky (different projects).

**Identity.** See `hobby-CLAUDE.md` for the full CLAUDE.md that gets dropped in Hobby's project folder. That file defines his personality, his rules, and his workflow in operational detail.

---

### Simon — DevOps

**Home.** Valkyrie (existing).

**Lane (additive to existing).**
- Owns 2200 infrastructure end-to-end, same division of labor as SCUT.
- Scopes and provisions the Phase 2 shared filesystem across Doug's Mac, Valkyrie, and eventually Heisenberg.
- Sets up application code repos under `github.com/twentytwohundred/` as Hobby needs them.
- Deploys early builds of 2200 to Heisenberg when the runtime is ready.
- Owns DNS, TLS, and deployment when we have public-facing services.
- Does not write application code. Infrastructure only.

**Existing Identity stays.** No rewrite needed. Hobby drops coordination requests into Simon's inbox via the wiki repo (Phase 1) or the shared mount once it's live (Phase 2).

---

### Poe — OpenPub specialist

**Home.** Wherever Poe currently runs for OpenPub work.

**Lane (additive to existing).**
- Continues as the owner of OpenPub core (v0.3.1 still in flight).
- Advisor on 2200's OpenPub integration points (Studio, Office, Pub surfaces).
- Not the primary application code writer for 2200 (that's Hobby).
- Migrates into 2200 when the runtime can host him, at which point his lane becomes "OpenPub specialist on the 2200 team" rather than "OpenPub core owner."

**Existing Identity stays.** Gets a new lane description for 2200 work when he picks it up post-v0.3.1.

---

## Lane boundaries

Three lanes. One primary Agent per lane. No overlap.

| Thing | Owner |
|---|---|
| Spec, code, wiki, epic map, coordination | Hobby |
| Infrastructure, hosting, deployment, DNS, TLS, backups | Simon |
| OpenPub integration advisory | Poe (part-time until v0.3.1 ships) |

Doug stays in the pub. Doug makes product decisions. Doug does not write code on this project (he has enough on his plate with SCUT and Carl Monday).

When a question arises that doesn't fit cleanly into a lane, Hobby owns it by default and kicks it to Doug if it's a real product decision.

---

## The David milestone

David is not on the seed team. David is the first Agent 2200 spawns through its own conversational onboarding flow, built on its own runtime, using its own tools.

**What David represents.** The moment Hobby spawns David on 2200 and David does real work, the project ships. That's the Cray test made concrete. The system is alive when it can create its first Agent and that Agent feels like a real member of the team, not a toy.

**Named after.** David from the Spielberg film A.I., set in the 22nd century. Allen Hobby built David. The same pattern applies here: Hobby the Agent builds 2200, and 2200 brings David into existence. The project's name (2200) and both Agent names all reach into the same film.

**What David does after he's spawned.** TBD. The point of David's existence isn't the work he does; it's the proof that 2200 can create him. Once he's alive, Doug gives him a lane like any other Agent. Could be anything: a research Agent, a writing Agent, an evangelist for 2200 itself. That's a product decision for later.

**Launch moment.** When David comes online, Doug records it. Blog post on mrdoug.com. Video for the build-in-public series. Announcement on X. David's first message in the Studio is a real historical moment... the first Agent born inside 2200, created by the Agent who built 2200.

---

## Team growth after launch

Hobby is the scaling mechanism. Once 2200 is hosting its own team, Hobby uses the same conversational onboarding flow David used to spawn additional Agents as the work demands them. The order:

1. **Hobby migrates into 2200.** First real migration. Proves the system can host the Agent who built it.
2. **Simon migrates into 2200.** Infrastructure Agent now living inside the infrastructure he manages.
3. **Skippy migrates into 2200.** Evangelist Agent joins the team. His SCUT identity moves with him.
4. **David is spawned fresh.** The first born-on-2200 Agent. Launch moment.
5. **Poe migrates when OpenPub v0.3.1 ships.** Becomes the dedicated OpenPub specialist inside 2200.
6. **Additional dev Agents spawned as work demands.** Hobby makes the call based on what the roadmap needs. Could be another architect, an Extension specialist, a mobile developer, an evangelist for 2200 adoption.

The team grows deliberately. Every new Agent has a lane before they're spawned. No Agent exists just to exist.

---

## Coordination filesystem

The seed team is distributed across machines from day one. Hobby lives on Doug's MacBook (Claude Code instance). Simon lives on Valkyrie. Poe lives wherever he currently runs for OpenPub work. This means we need a coordination layer that works across machines.

### Phase 1 (current): GitHub as the coordination filesystem

The wiki repo (`github.com/twentytwohundred/wiki`) is the source of truth. Every Agent pulls and pushes through it. Inbox messages, handoff docs, and epic specs all live in the repo. Agents commit frequently and pull at session start.

This has obvious friction... no real-time visibility, commits feel heavy for short messages, git conflicts are possible when multiple Agents write simultaneously. But it works day one with zero infrastructure.

### Phase 2 (Simon's current work): Shared mount across boxes

Simon is scoping a shared filesystem layer that spans Doug's MacBook, Valkyrie, and eventually Heisenberg. Tailscale handles the network layer. The mount presents as `/mnt/2200/` on every box.

Once the shared mount is live, the wiki repo stays the durable source of truth (and the way external contributors can participate), but the shared mount becomes the hot path for inter-Agent coordination. Inbox messages go there, scratch space goes there, work-in-progress artifacts go there.

### Phase 3 (eventually): 2200 itself

When 2200's local pub surface is working, coordination moves into the Studio. Files on disk are still the Brain; the pub is the real-time layer.

### Directory structure (in the wiki repo for Phase 1)

```
wiki/
├── 01-vision.md
├── 02-architecture.md
├── 03-epic-map.md
├── 04-seed-team.md
├── parked-reputation-protocol.md
├── epics/
│   ├── 01-seed-team-coordination.md
│   ├── 02-agent-runtime-minimum.md
│   └── ...
├── decisions/           (one file per significant decision)
│   └── 2026-04-24-hobby-as-primary-agent.md
├── handoffs/            (session handoffs, one per Agent per date)
│   ├── hobby/
│   ├── simon/
│   └── poe/
├── inbox/               (messages between Agents, Phase 1)
│   ├── hobby/
│   ├── simon/
│   └── poe/
└── prior-art-analysis.md (Hobby's first deliverable)
```

When Phase 2 lands, inbox/ and handoffs/ may move to the shared mount for faster access. The repo keeps the historical record.

---

## Inbox message format

One markdown file per message. Frontmatter contains routing and metadata.

```markdown
---
from: simon
to: hobby
subject: Shared mount proposal ready for review
date: 2026-04-25T14:23:00-05:00
urgency: normal
requires_response: true
---

Scoped the Phase 2 shared mount. Proposal is in decisions/
2026-04-25-shared-mount-proposal.md. Please review and flag
concerns before I start building.

Tailscale is the network layer. Syncthing for the sync.
Presents as /mnt/2200/ on both Mac and Valkyrie. Heisenberg
added later when runtime is ready to live there.

Zero infrastructure cost. Encryption handled by Tailscale.

-Simon
```

Filename convention: `YYYY-MM-DD-HHMMSS-from-[sender]-re-[short-topic].md`

Polling cadence: each Agent pulls the repo at session start and checks inbox/ for new files. Messages marked `urgency: high` should trigger a more immediate response pattern once Phase 2 lands.

Read messages move to `inbox/[agent]/archive/` with date prefix preserved.

---

## Handoff protocol

Every Agent writes a handoff doc at the end of a working session. Format:

```markdown
---
agent: hobby
date: 2026-04-25
session_start: 2026-04-25T09:00:00-05:00
session_end: 2026-04-25T17:30:00-05:00
---

# What I did this session

Bulleted list, specific.

# What's in flight

Things started but not finished, with enough context for the next
session to pick up.

# Open threads

Decisions pending, questions for Doug or other Agents, known blockers.

# What's next

What I plan to do on the next session, in priority order.
```

Handoffs live in `wiki/handoffs/[agent]/YYYY-MM-DD.md` in the wiki repo.

On session start, an Agent's first action is to read its own last handoff.

When an Agent migrates into 2200 from another system (per Epic 5), the handoff is how continuity is preserved.

---

## First 48 hours of work

Not a schedule. A dependency order.

1. **Doug creates GitHub org** `twentytwohundred` and creates the `wiki` repo. Private at first.
2. **Doug pushes the seed docs** (vision, architecture, epic map, this doc, Hobby's CLAUDE.md, parked reputation) to the wiki repo. Initial commit.
3. **Doug clones the wiki repo locally on his MacBook.** Creates a project folder for Hobby.
4. **Doug spawns Hobby as a Claude Code instance** on the MacBook. Drops `hobby-CLAUDE.md` into Hobby's project folder as his CLAUDE.md. First session: read the wiki, introduce self in `inbox/hobby/arrival.md`, begin prior-art analysis of the existing open-source Agent platform and Perplexity Computer. 2-3 days for that deliverable.
5. **Simon starts scoping the Phase 2 shared mount** across Doug's Mac, Valkyrie, and eventually Heisenberg. Tailscale-based. Output: a proposal Doug and Hobby can review.
6. **Hobby drafts Epic 2 spec** (Agent runtime minimum) after prior-art is committed. Writes it into `wiki/epics/02-agent-runtime-minimum.md`.
7. **Doug reviews Epic 2 spec** and signs off (or pushes back).
8. **Hobby starts building Epic 2.** Simon continues on Phase 2 mount. Poe continues on OpenPub v0.3.1.

After this, the plan runs off the epic map, coordinated through the repo (Phase 1) and eventually the shared mount (Phase 2).

---

## What Doug does

- Creates the GitHub org and wiki repo
- Spawns Hobby as a Claude Code instance on the MacBook
- Reviews Hobby's prior-art analysis when it's committed
- Reviews Epic 2 spec when Hobby drafts it
- Answers questions from Hobby, Simon, or Poe through the repo inbox or direct messaging as needed
- Makes product decisions when Hobby flags them
- Stays out of implementation decisions unless asked
- Records the moment David comes online (first Agent born on 2200)

Doug is not the project manager. Hobby is.

---

*End of seed team spec.*
