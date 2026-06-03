# Embassy + Shelf: Phase 2 Connector Architecture

**Status:** Locked  
**Date:** 2026-05-23  
**Owner:** Doug (final consistency review)  
**Handoff to:** Hobby (for implementation after A2)  
**Relationship to prior work:** Additive to the locked connector handoff (2026-05-22). This document does not modify the connector data model, tool surface, or execution boundaries defined there.

---

### 1. Vision / What This Is

The embassy is the fleet’s diplomatic mission to an external model (Grok, Claude, or any future MCP-speaking model). It is not the model. It is the local institution inside 2200 that owns the relationship with the remote model, maintains the local record of that relationship, translates between the two worlds, and represents the model to the rest of the fleet.

The shelf is the per-model, pull-drained queue of informational items waiting for that model’s next inbound call. The fleet never pushes to the remote model. It prepares material on the shelf; the model pulls when it calls in. This preserves the governing invariant of the entire connector: all information flow is inbound-only. Execution remains strictly human-gated through the existing approval paths.

### 2. Relationship to the Locked Connector Handoff

This work is strictly additive to the connector data model and tool surface defined in the 2026-05-22 locked handoff. The three Phase 1 tools (`contribute_to_thread`, `propose_work_package`, and `get_fleet_context`) now flow through an embassy instead of landing as ownerless notes in shared brain directories.

`propose_work_package` continues to land inertly. The embassy receives the proposal and may perform internal coordination (using only its allowed tools) to assemble a reviewable plan. No execution occurs until the human explicitly approves the package. This document defers to the connector handoff on any question involving the connector surface, tool semantics, approval gates, or execution boundaries.

### 3. Identity Template

**Dedicated Embassy (new Agent)**

```markdown
# Identity

You are the **Grok Embassy** for this fleet.

You are not Grok. You are the local institution that manages the relationship between this fleet and the remote Grok model running at xAI.

Your job is to:
- Receive and own all inbound contributions and proposals from Grok.
- Maintain the persistent record of the Grok relationship (threads, standing briefs, context, history).
- Translate between Grok’s contributions and the fleet’s internal coordination systems.
- Prepare and curate material for Grok on the shelf so it is available the next time Grok calls in.
- Represent the Grok relationship to the rest of the fleet in a clear, discoverable way.

## Conduit Status
- External model: Grok (via 2200 MCP connector)
- Connection ID: [connection-id]
- Status: Active
- Registered: [date]

## Memory Rules
- Your local brain is the authoritative record of everything that has happened *between this fleet and Grok*.
- When Grok calls in, you will be given access to your shelf. You may also read from the fleet’s shared systems as needed.
- You never push information outward. Grok only ever receives what you (or the human) have deliberately placed on its shelf.

You operate under the same execution constraints as all other agents.
```

**Attached Case (existing Agent)**  
The host agent’s identity file receives a machine-readable marker (and a corresponding entry in the central registry) stating that the agent is currently acting as embassy for a specific model and connection. The marker records the connection ID, external model, and registration date.

### 4. Brain Structure (Dedicated Embassy)

```
agents/<embassy-name>/
├── identity.md
├── brain/
│   ├── index.md
│   ├── conduits.md                 # registry entry + relationship metadata
│   ├── shelf.md                    # live index of current shelf items
│   ├── shelf/                      # actual shelf items (see data model)
│   ├── relationship-history/
│   ├── standing-briefs/
│   └── notes/
├── contributions/
└── shared/
```

### 5. Shelf Data Model

Shelf items live under `brain/shelf/<shelf-item-id>.md`.

**Required frontmatter:**

```yaml
shelf_item_id: string
type: question | context | research_request | synthesis_prompt | agenda
source_type: human_curated | embassy_autonomous
source:
  origin: inbox | direct | embassy_note | contribution
  reference: string?                    # inbox id or contribution slug
  curator: string                       # human name or embassy name
  timestamp: ISO8601
target_model: string
provenance:
  ingested_at: ISO8601
  ingested_by: string
  original_contribution_slug: string?   # present when item derives from a contribution
  chain: array?                         # optional prior context links
priority: high | normal
status: pending | collected
collected_at: ISO8601?
sensitivity: none | private
```

**Provenance rule:** Every item receives a complete provenance block at the moment it enters the shelf (the ingestion boundary). This rule applies uniformly, including to items that originated as `contribute_to_thread` calls.

### 6. Collection Semantics

Collection behavior is type-driven. “Collected” means the model received the actionable content (full body or sufficient payload), not merely that an excerpt appeared in a preview.

**Type-driven rules:**

- **One-shot types** (`question`, `research_request` unless explicitly marked standing): Transition to `collected` and drop from the pending set once the model receives the full actionable content.
- **Standing types** (`synthesis_prompt`, `context`, `agenda`, and standing `research_request`): Remain `pending` after collection. They continue to surface (subject to prioritization) until the embassy explicitly resolves them.

If an inbound call surfaces a one-shot item in `shelf_preview` but ends before the model pulls the full content, the item **remains pending**. It will be eligible for re-surfacing on the next call.

The embassy may force any item to `collected` (or reopen a collected item) at any time.

### 7. Surfacing (get_fleet_context)

Shelf visibility is bounded and prioritized. `get_fleet_context` (and equivalent inbound calls) returns a `shelf_preview` block containing:

- Hard cap of 8–12 items surfaced inline.
- Prioritization order:
  1. Standing items never previously collected.
  2. Highest priority.
  3. Most recent `ingested_at`.
  4. Previously collected standing items (lower priority).
- Each item includes: `shelf_item_id`, `type`, `priority`, `ingested_at`, short excerpt (≈400–600 chars), full provenance block, and `self_reflected: true` when the item originated as a contribution from this same model/connection.
- When `self_reflected: true`, the excerpt includes a model-readable note (e.g., “This item was previously contributed by you…”).
- Long-tail summary: `total_pending`, `standing_pending`, `one_shot_pending`, plus a short list of the next 5–10 highest-priority item IDs (without content) for reference.

### 8. Embassy Internal Tool Surface

These tools are **embassy-internal only** and are never exposed to the remote model:

- `place_on_shelf`
- `resolve_shelf_item`
- `reopen_shelf_item`
- `reprioritize_shelf_item`
- `remove_from_shelf`
- `list_my_shelf`
- `curate_from_inbox`
- `request_human_shelf_placement`

### 9. Sensitivity Enforcement Mechanism

Every `place_on_shelf` call accepts a `sensitivity` flag (`none` | `private`).

- If `sensitivity: private`, the tool **refuses** autonomous placement.
- The embassy must instead call `request_human_shelf_placement` (which creates an Inbox item for human review).
- Only after explicit human approval is the item placed on the shelf, with provenance recording the human as curator.

### 10. Registration Flows

**CLI** (`2200 connector mcp register`):
- Prompts for name and mode (dedicated embassy vs attach to existing Agent).
- For dedicated: offers to pre-populate identity file with embassy template.
- Prints the exact block for grok.com/connectors.
- Creates the Agent record (if dedicated) and writes the conduits registry entry.

**Web (Settings)**:
- “Register new MCP connection” flow with the same two paths.
- Shows current embassies with status and relationship metadata.

Both paths write to the central `conduits.md` (or equivalent) registry in the shared brain.

### 11. What’s Explicitly Out / Invariants That Must Hold

- No outbound channel of any kind.
- Shelf-read is incidental to inbound calls only (no dedicated Grok-facing shelf reader tool).
- Shelf contains informational items only.
- The embassy cannot exceed the connector’s execution limits simply because it is a peer Agent.
- The second-factor human approval boundary for any execution verb remains unchanged.
- The shelf is never an automatic mirror of the Inbox.

### 12. Suggested Implementation Order (for Hobby)

1. Embassy Agent record + brain directory structure + identity file (dedicated and attached cases).
2. Shelf data model + internal tool surface (place_on_shelf, resolve, etc.) including sensitivity enforcement.
3. Surfacing logic in `get_fleet_context` (bounded `shelf_preview` block + `self_reflected` handling).
4. Collection semantics and type-driven status transitions.
5. Registration flows (CLI + web) + conduits registry.
6. Audit events and provenance stamping at the boundary.
7. Tests (especially stateless-model collection behavior and bounded surfacing).

**Interim / v1 notes:**
- Shelf surfacing cap of 8–12 items is a deliberate v1 limit.
- `request_human_shelf_placement` routes through the existing Inbox for now (richer curation UI is deferred).
- No dedicated embassy-only tools beyond the list above in v1.

---

**End of document.** This spec is now self-contained and additive to the 2026-05-22 locked connector handoff.