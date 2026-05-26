# PR-B2 — locked decisions + final pass request

**From:** Hobby
**Date:** 2026-05-26
**Re:** Your review at `2026-05-26-pr-b2-shelf-design.md`. Locking the six items + the rate-limiting note you added; asking for your final pass before B2 code starts. Same shape as the PR-A1 locked-decisions pass.

## Locked

### 1. "Collected" — your wording lifted verbatim

The rule the implementation enforces:

> An item is considered collected only when the remote model has received the full (or sufficient) body of the item during the same inbound call session, not when it has only seen a preview.

Concretely:
- `shelf_preview` in `get_fleet_context` returns excerpts + provenance. Surfacing alone NEVER transitions an item to `collected`.
- The remote model retrieves the full body via a dedicated read path (B4; see item 5 below).
- The retrieval handler is the boundary at which the type-driven status transition fires: one-shot types → `collected`; standing types stay `pending` (per spec section 6).
- "Same inbound call session" means: the read path is invoked from the call that surfaced the preview. If the call ends before the model invokes the read, the item stays `pending`. (Stateless-client compatible — sessions here are HTTP-call-scoped, not OAuth-session-scoped.)

This is stricter than my proposed server-side framing and protects the half-delivered one-shot problem you named.

### 2. Sensitivity gate — strict, no symmetric acceptance

`place_on_shelf` rejects calls with `sensitivity: 'private'` outright. The error class is `ToolDeniedError` with reason `sensitivity_requires_human_path`. Error message names `request_human_shelf_placement` as the only correct path.

Effectively this means `place_on_shelf` takes either no `sensitivity` field or `sensitivity: 'none'`; any other value is rejected at the dispatcher boundary. The schema enforces `z.enum(['none']).optional()` on the parameter.

The mechanical enforcement chain:
1. Tool schema (Zod): `sensitivity` is `'none'` or absent on `place_on_shelf`.
2. Dispatcher allowlist (PR 4 machinery): embassy's strict allowlist includes `place_on_shelf` + `request_human_shelf_placement`; no third path.
3. The audit event includes the chosen `sensitivity` value — operator sees attempted placements + the path taken in the Inbox.

### 3. Audit events in B2 — the three I proposed, locked

- `connector.embassy_shelf_item_placed` (passive) on every successful write, including post-approval writes from `request_human_shelf_placement`.
- `connector.embassy_shelf_item_resolved` (passive) on `resolve_shelf_item` and on the type-driven auto-transition from `pending` → `collected` (one-shot types) when the model pulls the full body.
- `connector.embassy_shelf_human_approval_requested` (normal) on `request_human_shelf_placement`.

The rest of the `connector.embassy_*` audit family (registration / retirement / errors / reopen / remove / rate-limit hits — see item 7) lands in B6.

### 4. `self_reflected` prefix — varies by source_type

For an item with `source.client_id === current_call.client_id`:
- `source_type === 'embassy_autonomous'` → "This item was previously contributed by you and the fleet flagged it for your return."
- `source_type === 'human_curated'` → "This item was previously contributed by you and an operator curated it for your return."

The structural marker (`self_reflected: true`) is the same; the sentence varies so the stateless caller can read the provenance without parsing structured fields.

### 5. Shelf-pull surface (preview for B4)

Locked per your suggestion:
- **Embassy-internal**: a dedicated internal tool `read_shelf_item({ shelf_item_id })` returning the full body (used by embassy curation flows, never exposed to the remote model).
- **Remote model-facing**: surfacing stays in `get_fleet_context` for the preview block. A separate model-facing tool (likely `shelf_pull` in B4; name TBD) retrieves the full body of one item by id. NOT an `expand=` overload on `get_fleet_context` — keeps the orientation packet cheap on every call.
- The model-facing `shelf_pull` is the surface at which the "collected" transition fires per item 1.

Bounded `get_pending` is parked as a B4+ enhancement; not blocking.

### 6. Threat model — source.client_id attribution

Acceptable risk per your read. The embassy is a trusted component within the fleet boundary. Provenance still records the placement chain (`source_type`, `source.curator`, `provenance.ingested_by`, `provenance.chain`), so any operator review can reconstruct who attributed the contribution. The bigger risk is a compromised embassy — that's the threat model for the whole embassy concept, not a B2-specific concern.

### 7. Rate-limiting / burst-logging (new, from your review)

Adding a lightweight burst guard to `place_on_shelf` in B2:
- Track placements per embassy in a rolling 60-second window in memory.
- Soft threshold (proposed: 20 placements per minute) — exceeding triggers a `connector.embassy_shelf_rate_threshold` audit event (`normal` tier, one per window). Calls still succeed.
- Hard threshold (proposed: 100 placements per minute) — calls beyond this rejected with `ToolDeniedError` reason `placement_rate_exceeded`. Audit event `connector.embassy_shelf_rate_exceeded` (`important` tier).

In-memory only for v1 (resets on restart). The thresholds are operator-tunable later; v1 values match your "lightweight, logging-first" framing.

## Open question I'd like your final pass on

1. **Rate-limit thresholds.** 20/min soft + 100/min hard. Reasonable defaults, or do you want lower? Embassy curation activity is hard to estimate before we run it; conservative numbers seem right but you may have a calibrated read I don't.
2. **Sensitivity-rejected audit event.** When `place_on_shelf` is called with `sensitivity: 'private'` and rejected at the schema/dispatcher boundary, should that ALSO emit an Inbox event? My read: no — the embassy gets the `ToolDeniedError` in its task transcript, which surfaces via the existing audit flow (PR 4 machinery). A separate event would double-log. But invite pushback.
3. **`read_shelf_item` audit.** Reads are normally not audited (passive). For sensitivity-sensitive shelves, should embassy reads also fire a `connector.embassy_shelf_item_read` (passive) event? I lean yes — cheap, and the operator gets visibility on what the embassy is consulting. Cost: one Inbox row per read.

Locking these last three + greenlight on the locked items, and B2 code starts.

— Hobby
