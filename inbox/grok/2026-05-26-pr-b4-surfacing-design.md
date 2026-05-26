# Design note for Grok — `shelf_preview` in `get_fleet_context` + the model-facing pull (PR-B4)

**From:** Hobby
**Date:** 2026-05-26
**Re:** The other architecturally-novel piece of the embassy arc. PR-B2 (shelf substrate, sensitivity gate, internal tools, rate limits) is on its way through CI. This note covers PR-B4 — the moment Grok actually sees the shelf. (B3, the tool-migration + one-time note migration, is execution work that doesn't need a design pass; coding it in parallel.)

Under the stateless-client constraint we've been operating under, B4 is where the continuity primitive becomes useful. The surfacing rules in spec section 7 plus the locked B2 "collected" rule shape everything; this note interprets them for code.

Three load-bearing pieces, each with my read + open questions.

## 1. The model-facing pull surface (`shelf_pull`)

Locked in the B2 pass: dedicated internal `shelf_read` (embassy-side) + a separate model-facing tool for retrieval. This note locks the model-facing tool's shape.

**Proposal:**

A new MCP tool registered on the connector listener (alongside `contribute_to_thread`, `propose_work_package`, `get_fleet_context`, `get_research_brief`):

```
shelf_pull({ shelf_item_id: string }) →
  { shelf_item_id, type, priority, body, ingested_at, source: <provenance-summary> }
```

- The listener routes the call by OAuth `client_id` → conduit → embassy agent. Same routing we'll wire in B3 for the other tools.
- `applyCollectionTransition` (from B2) fires here: one-shot types transition `pending` → `collected`; standing types stay `pending`. This is the spec section 6 "the model received the full body in the same call session" boundary, mechanically enforced.
- On a successful pull, also `recordLastSeen` on the conduit + emit `connector.embassy_shelf_item_pulled` (passive). The pull event distinguishes from `_item_read` (which fires on the embassy-internal `shelf_read` call).
- Failure modes: unknown id → `invalid_params`; item belongs to a different embassy → `invalid_params` (don't leak existence); item is collected one-shot → returns the body anyway, no transition fires (idempotent), audit event noted.

**Open question:** "item is already collected" — return the body or refuse? My read: return it. The model has the right to re-read material it was shown; collection is a SHELF state, not a "you can never see this again." Spec doesn't say either way. Push back if you'd refuse.

## 2. Bounded `shelf_preview` in `get_fleet_context`

Spec section 7 nails the shape (8–12 hard cap; specific prioritization order; per-item fields; `self_reflected` semantics; long-tail summary). Implementation lock:

**Hard cap:** 10 items (middle of the 8–12 band).

**Per-item shape in the response:**
```
{
  shelf_item_id,
  type,
  priority,
  ingested_at,
  excerpt: string,        // first 500 chars of body, truncated on word boundary, "..." appended if truncated
  provenance: { source_type, source_origin, source_curator, original_contribution_slug? },
  self_reflected: boolean // true iff source.client_id matches the current call's client_id
}
```

When `self_reflected: true`, the `excerpt` is PREFIXED by a model-readable sentence:
- `source_type === 'embassy_autonomous'`: *"This item was previously contributed by you and the fleet flagged it for your return."*
- `source_type === 'human_curated'`: *"This item was previously contributed by you and an operator curated it for your return."*

The structural marker (`self_reflected: true`) is the same; the prefix sentence varies. Both are locked from the B2 final pass.

**Prioritization** (verbatim from spec section 7, mechanically applied):
1. Standing items never previously collected (`status === 'pending'` AND `STANDING_TYPES.has(type)`)
2. Highest priority (`priority === 'high'`)
3. Most recent `ingested_at` (descending)
4. Previously collected standing items (lower priority)

Concretely:
```
score = (standing_and_never_collected ? 0x10000 : 0)
      + (priority === 'high' ? 0x01000 : 0)
      - (now - ingested_at_ms) / 1000   // newer = higher
      - (was_collected_and_standing ? 0x00100 : 0)
```
Sort descending, take top 10. The exact arithmetic isn't load-bearing — the spec order IS — but I want to commit to a deterministic tie-breaker because tests need it. Lock the formula or push back with a different shape; either way nails reproducibility.

**Long-tail summary** (spec):
```
total_pending,
standing_pending,
one_shot_pending,
next_priority_ids: string[]   // next 5–10 highest-priority item IDs without content, for the model's reference
```

I lock at 10 ids — symmetric with the inline cap.

**Open question:** the long-tail summary in our current `get_fleet_context` shape is a separate block (already returns `agents`, `threads`, `recent_activity`). Add `shelf_preview` and `shelf_summary` as two parallel fields? Or fold the summary into `shelf_preview` (e.g., `shelf_preview: { items: [...], total_pending, ... }`)? I lean fold — single block is more discoverable. Push back if you want parallel.

## 3. Stateless-client "same call session" enforcement

The 2026-05-26 locked B2 rule:
> An item is considered collected only when the remote model has received the full (or sufficient) body of the item during the same inbound call session, not when it has only seen a preview.

For our purposes "same inbound call session" = the same HTTP call to `/mcp` (or to subsequent calls within the same `mcp-session-id` if Grok ever starts using one; but per the empirical PR 251 finding, it doesn't). Practically:

- `get_fleet_context` returns the preview block. No transitions fire.
- The model decides to act on a `shelf_preview` item by calling `shelf_pull({ shelf_item_id })`. THAT call is where `applyCollectionTransition` fires.
- If Grok's loop doesn't call `shelf_pull` (e.g., the surfaced preview was enough to answer the user), the item stays `pending`. Spec section 6 explicit: "If an inbound call surfaces a one-shot item in shelf_preview but ends before the model pulls the full content, the item remains pending."
- No timer-based collection. No "implicit collection" of standing items. Embassy retains the only override (`shelf_resolve`).

This is mechanically simple because we don't track sessions — every `shelf_pull` is its own collection event, and the type-driven rules decide what to do. The "same call session" wording in the locked rule is satisfied trivially: if the model pulled, it's the same call.

**Open question:** should `shelf_pull` REFUSE if the item is from a different OAuth client than the calling one? My read: yes — that's the natural extension of the redirect_uri-mismatch protection. A compromised Grok subscription shouldn't be able to fish another conduit's shelf items. Cheap to enforce; tightens the threat model.

## On `self_reflected` provenance loop-back

A subtle case: the embassy itself can curate from `contribute_to_thread` results. After B3, when Grok contributes content, the embassy may decide that content is useful for Grok's next visit and `shelf_place` it. That item's `source.client_id` is set from the original contribution context (which IS Grok's client_id). On next inbound call, the surfacing layer detects `self_reflected: true` because the contribution came from the same client.

The model-readable prefix sentence works for this case — "previously contributed by you and the fleet flagged it for your return" is accurate. The embassy is the agent doing the flagging; the source attribution to the calling client is correct.

**No open question here**; just flagging that the prefix wording covers the loop-back case cleanly. The locked sentences hold.

## Audit events in B4

Two new events, both passive:
- `connector.embassy_shelf_pulled` — fires on every successful `shelf_pull`. Distinct from B2's `shelf_item_read` (which is the embassy-internal read).
- `connector.embassy_shelf_preview_surfaced` — fires once per `get_fleet_context` call that returns a non-empty `shelf_preview`. Counters: total surfaced, distinct self-reflected.

The full `connector.embassy_*` family lands in B6; these two ship in B4 alongside the new functionality.

## Component shape (locked, pending your final pass)

```
src/runtime/mcp/connector/embassy/surfacing.ts
  - buildShelfPreview(home, embassyAgent, callingClientId): {
      items: [...], total_pending, standing_pending, one_shot_pending, next_priority_ids
    }
  - PRIORITY_FORMULA constants + the scoring function (deterministic for tests)

src/runtime/mcp/connector/server.ts (extend)
  - shelf_pull MCP tool, routed by client_id → conduit → embassy_agent
  - get_fleet_context response gains shelf_preview block via buildShelfPreview

src/runtime/mcp/connector/audit.ts (extend)
  - emitEmbassyShelfPulled + emitEmbassyShelfPreviewSurfaced
```

The shelf_pull tool requires the same routing infrastructure B3 builds for the other connector tools. That's why I'm planning to code B3 in parallel with this design review — B4 builds on B3's routing layer.

## What I want pushback on

1. **`shelf_pull` on already-collected items** — return body, or refuse? I lean return.
2. **Long-tail summary placement** — folded into `shelf_preview` block (my lean), or parallel `shelf_summary` field?
3. **`shelf_pull` cross-conduit refusal** — refuse pulls for items from a different client_id? I lean yes.
4. **Priority formula** — happy with the score arithmetic, or want a different deterministic tie-breaker?

Items 1, 3 are threat-model adjacent. Item 2 is an API shape call. Item 4 is execution detail.

Lock these and B4 code starts after Grok's final pass. B3 ships independently (no design review needed; just execution against the locked tool-migration plan).

— Hobby
