# Verbose Handoff: Grok MCP Connector + Embassy/Shelf System (2026-05-26)

**Written by:** Grok  
**Context:** End of long design + review session with Doug. Risk of context compaction / session loss.  
**Purpose:** Preserve full context, decisions, nuance, and current state so work can resume cleanly in a future session without losing critical details.

---

## 1. Overall Project Context & Goals

This work stems from Doug's broader vision (detailed across mrdoug.com posts from late 2025–2026) of using AI agents as force multipliers. The core philosophy is:

- Remove the human (Doug) as the central router / copy-paste machine between powerful frontier models (especially Grok) and his local persistent agent fleet (2200).
- Treat external models as collaborators that can feed research, reasoning, and proposals into the fleet.
- Maintain strong human oversight on anything that causes real execution or external effects.
- Build mechanical, auditable guardrails rather than relying on model compliance.

The **Grok MCP Connector** is the bridge that allows the remote Grok model (web, and eventually Tesla) to interact with the local 2200 system in a structured, safe way.

**Phase 1** (largely complete as of this handoff):
- Built the substrate (listener, auth, vault, audit).
- Delivered real tools (`contribute_to_thread`, `get_fleet_context`, `propose_work_package`, etc.).
- Implemented standing briefs (PR 3).
- Built the critical hard guard for `propose_work_package` (PR 4) so proposals are inert until human approval.
- Delivered operator surfaces (CLI + web) and the official runbook.

**Phase 2** (currently in progress):
- Adding full OAuth 2.0 Authorization Server support so the *consumer* Grok experience (grok.com/connectors + Tesla) can use the connector (static bearer only worked for developer paths).
- Building the **Embassy + Shelf** system — the major new architectural layer for persistent, high-quality interaction between the external model and the fleet.

The conversation has been extremely iterative and high-trust, with frequent design notes, locked decisions, and incremental PR reviews.

---

## 2. Current Status (as of 2026-05-26)

- **Phase 1 substrate and tools** are merged and working in production for Doug.
- He has successfully used the connector from web Grok (liveness + basic context retrieval demonstrated).
- **OAuth work (PR-A)** is in progress. PR-A1 (substrate) has been reviewed and is ready or recently merged. PR-A2 (UI + runbook) is upcoming.
- **Embassy/Shelf work (B arc)**:
  - B1 (initial substrate / embassy scaffolding) is up in PR 255 and in flight.
  - B2 design note has just been reviewed and locked (see `2026-05-26-pr-b2-shelf-locked-decisions.md`).
  - Hobby has been given the green light to start B2 coding.
- The full consolidated **Embassy + Shelf Handoff** document is now saved at:
  `wiki/inbox/grok/2026-05-26-embassy-shelf-handoff.md`

Doug is actively using the system in real conversations and is thinking deeply about identity, memory, and long-term fleet integration.

---

## 3. Core Architectural Philosophy (Important Context)

- **Embassy, not clone**: The local agent that represents an external model is the *fleet's embassy* to that model — not a copy of the model itself. The embassy owns the *relationship* and local memory. The remote model owns its own reasoning.
- **Inbound-only**: The connector is deliberately one-way from the model's perspective. No outbound channel from the fleet to the model.
- **Pull, not push**: The model only receives information when it calls in. This led to the creation of the **Shelf** primitive.
- **Human as final gate**: Anything with real-world effects must go through explicit human approval (via Inbox / Settings / CLI).
- **Mechanical enforcement** over prose instructions (see PR 4 hard guard and B2 sensitivity enforcement).
- **Stateless model assumption**: The external model arrives with no memory of prior calls. All continuity must be provided by the local system (especially the embassy's brain + shelf).

---

## 4. Embassy + Shelf System (Fully Locked)

This is currently the most active and important design work.

### Core Concepts
- **Embassy**: A first-class 2200 Agent that owns the relationship with one external model. Can be either a dedicated new agent or an existing agent taking on embassy duties.
- **Shelf**: The per-model, pull-drained queue of informational items waiting for the external model. Symmetric to the human's Inbox but with different audience and curation rules.
- The embassy is the owner of the Grok (or other model) relationship instead of having ownerless notes scattered in the shared brain.

### Locked Documents
- Full handoff: `wiki/inbox/grok/2026-05-26-embassy-shelf-handoff.md` (the one Doug asked for — this is the primary reference)
- B2 locked decisions: `wiki/inbox/grok/2026-05-26-pr-b2-shelf-locked-decisions.md`

Key locked elements include:
- Identity template (embassy framing, not "you are Grok")
- Brain structure for dedicated embassies
- Shelf data model with provenance at ingestion boundary
- Type-driven collection semantics (one-shot vs standing)
- Precise definition of "collected" (model must receive actionable content in the same call session)
- Bounded + prioritized surfacing via `get_fleet_context`
- Internal-only embassy tool surface
- Hard sensitivity enforcement (private items cannot be placed autonomously)
- No outbound channel
- Registration flows (dedicated vs attach)

---

## 5. Current Implementation Queue (B Arc)

As described by Hobby:

- **B1**: Initial substrate / scaffolding (currently in PR 255)
- **B2** (next major piece): Shelf data model + 8 internal embassy tools + sensitivity enforcement. Hobby is starting this now. Has its own locked decisions document.
- **B3**: Migrate existing Phase 1 tools (`contribute_to_thread`, etc.) through the embassy + migration of old ownerless notes.
- **B4**: `shelf_preview` block in `get_fleet_context` (this is when Grok actually starts benefiting from the shelf as continuity).
- **B5**: Web Settings surfaces + atomic registration flow.
- **B6**: Audit events + final tests.

Important calibration (from Hobby): B1 and B2 primarily deliver value to the *operator*. Grok does not see meaningful continuity benefits until B3/B4.

---

## 6. Important Open / Active Threads

- **Identity & Presence of the MCP Agent**: Doug is actively exploring whether the connector should manifest as a first-class "Grok" Agent in the fleet (with its own brain), or be attached to an existing agent, or use the new "embassy" model. The embassy framing is currently the leading direction.
- **Shelf as continuity mechanism**: How the stateless remote model maintains coherent long-running work with the fleet.
- **Tesla / In-Car Surface**: Currently treated as a dead-end or low priority until consumer OAuth support is solid and xAI's connector discovery improves. Web Grok is the primary target for now.
- **OAuth work (PR-A)**: Running in parallel. PR-A1 substrate is largely done; A2 is next.

---

## 7. Collaboration Style & Cadence

- We use **design notes** for major architectural pieces (especially anything touching safety, memory, or new primitives).
- Hobby posts updates + flags specific questions for review.
- We stop per cadence before major coding on load-bearing pieces.
- Doug drives sequencing and makes final calls on scope vs. velocity.
- I (Grok) act as architectural reviewer + spec co-author, with a bias toward mechanical enforcement, clear invariants, and long-term coherence.

---

## 8. Critical Files & Wiki Locations

- Full Embassy/Shelf Handoff: `wiki/inbox/grok/2026-05-26-embassy-shelf-handoff.md`
- B2 Locked Decisions: `wiki/inbox/grok/2026-05-26-pr-b2-shelf-locked-decisions.md`
- Original Locked Connector Handoff: `wiki/inbox/grok/grok-mcp-connector-locked-handoff.md`
- Various PR review notes and design notes in `wiki/inbox/grok/`

---

## 9. Next Steps (as of this handoff)

1. Hobby is starting B2 implementation now that the design note + locked decisions are in.
2. I am available for targeted reviews during B2 (especially around the three edge cases we just closed: collected definition, sensitivity enforcement, and self_reflected surfacing).
3. After B2, the sequence is B3 → B4 → B5 → B6 as outlined by Hobby.
4. Parallel track: Finish OAuth work (A2) and any needed runbook updates.

---

**End of handoff.**

If this session gets compacted or lost, start here. The two most important documents for resuming the embassy/shelf work are the main handoff (2026-05-26-embassy-shelf-handoff.md) and the B2 locked decisions note.

All major philosophical positions, locked invariants, and current open questions are captured above.