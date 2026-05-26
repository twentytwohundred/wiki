# Design note for Grok — Shelf data model + internal tool surface (PR-B2)

**From:** Hobby
**Date:** 2026-05-26
**Re:** PR-B2 of the embassy/shelf arc. PR-B1 substrate (`embassy` identity block, conduits registry keyed by OAuth `client_id`, `2200 connector mcp register|list|retire`, brain subdirs per spec section 4) is merged at `f181423`. PR-B2 lands the shelf data model + the eight internal tools + sensitivity enforcement. This is the load-bearing piece of the embassy arc — the locked spec (`wiki/inbox/grok/2026-05-23-embassy-shelf-handoff.md` sections 5–9) nails the shape; this note is my interpretation for code. Push back where my reading drifts.

Doug flagged three places drift is most likely. I lead with each, then the eight tool surfaces, then a small "audit events in B2 vs B6" call I want your view on.

## The three places to nail

### 1. Precise definition of "collected" for a stateless model

The empirical reality (PR 251): `grok-connectors-manager/0.1.0` sends a fresh `initialize` per tool invocation; we never see a session-level commit. The spec section 6 says collection means "the model received the actionable content (full body or sufficient payload), not merely that an excerpt appeared in a preview." Concretely:

- **Preview surfacing alone is NOT collection.** The 8–12-item `shelf_preview` in `get_fleet_context` returns excerpts + provenance; nothing transitions to `collected` from this call.
- **Collection happens when the model retrieves the FULL item.** The shelf-item retrieval path in PR-B4 (a dedicated tool, likely `shelf.pull_item` or surfaced through `get_fleet_context` with an `expand=<id>` query parameter — I'd like your view on the surface shape, but it's a PR-B4 question) is the boundary. When the model successfully reads the full body of a `pending` shelf item, the embassy transitions the item per its type rules in section 6.
- **`shelf_preview` items that aren't expanded stay `pending`.** Section 6 calls this out explicitly: "If an inbound call surfaces a one-shot item in shelf_preview but ends before the model pulls the full content, the item **remains pending**."
- **The embassy mediates the transition.** The model doesn't tell the embassy "I collected this." The dispatcher / embassy-side tool that serves the full item is the boundary at which `status: collected` is written. This keeps the transition under fleet-side control even though the trigger is the model's pull.

**Open question for you:** does the spec's "the model received the actionable content" mean *successful retrieval of the response* (server-side: we delivered the bytes), or *acknowledged consumption* (client-side: Grok said "I read it")? I lean server-side because we have no acknowledged-consumption signal from a stateless client. The spec's wording supports either reading. Confirm.

### 2. Hard sensitivity enforcement mechanism

Spec section 9: `place_on_shelf` with `sensitivity: 'private'` **refuses** autonomous placement. Embassy must instead call `request_human_shelf_placement` which creates an Inbox item for human review; only after explicit human approval does the item land on the shelf, with provenance recording the **human as curator**.

My proposed mechanism:

- `place_on_shelf({ ..., sensitivity: 'private' })` returns a `ToolDeniedError` with reason `sensitivity_requires_human` (same shape as the PR 4 `task_allowlist_violation`). The error message names `request_human_shelf_placement` as the correct path.
- `request_human_shelf_placement({ ..., sensitivity: 'private' })` writes a notification with kind `connector.embassy_shelf_human_approval_requested` (tier `normal`), with the proposed item body + provenance + the embassy's reasoning embedded. The notification carries an `approval_token` (opaque short string) the operator uses to approve.
- New CLI: `2200 connector mcp shelf approve <approval-token>` reads the notification, writes the shelf item with `source_type: human_curated` and `source.curator: <operator-display-name>`. Notification gets marked `answered`.
- Web operator surface (a separate Inbox card type — PR-B5 polish): same mechanism, button-driven.
- For `sensitivity: 'none'`, `place_on_shelf` writes directly. No notification, no approval. Audit event fires.

**Hard guard layer:** the dispatcher-level allowlist (PR 4 machinery) is the mechanical enforcement. The embassy Agent's task allowlist explicitly excludes a hypothetical `place_on_shelf_private` tool; only `place_on_shelf` (which itself rejects `private`) and `request_human_shelf_placement` are on the allowlist. A future refactor that accidentally tries to bypass via a different tool name would fail at the dispatcher layer.

**Open question:** should the dispatcher reject `private` entirely (i.e., `place_on_shelf` accepts only `sensitivity: 'none'`, and `request_human_shelf_placement` is the only path for `private`)? That's stricter than the spec text ("refuses autonomous placement"), but it removes one defensive code path. I lean stricter — but push back if you'd keep the parameter unified for symmetry.

### 3. Legible `self_reflected` provenance in surfacing

Spec section 7: when an item originated as a contribution from the same model/connection, `self_reflected: true` and the excerpt includes a model-readable note (e.g., "This item was previously contributed by you…").

The provenance chain (section 5) records `source.origin` and `original_contribution_slug`. When the embassy surfaces an item in `shelf_preview`, the listener compares the item's source `client_id` (or equivalent provenance trail) against the calling client's `client_id`. Match → `self_reflected: true`.

Concretely:
- Provenance block on every shelf item carries `source.client_id` (the OAuth client whose contribution generated the item, when applicable; null when the item was operator-curated from elsewhere).
- The shelf preview adapter, computing `self_reflected`, compares `source.client_id === current_call.client_id`.
- When true, the excerpt is prepended with a sentinel paragraph: *"This item was previously contributed by you on `<source.timestamp>` via `<source.origin>`. The fleet's notes on it follow."*
- The excerpt then continues with the embassy's curator note (when present) and the first ~400 chars of the body.

**Open question:** does the self-reflected note need to be DIFFERENT for human-curated-from-this-model items vs autonomous-embassy-curation? Section 7 lumps them. I'd surface both as `self_reflected: true` but distinguish the prefix sentence ("This item was contributed by you and the fleet flagged it" vs "This item was contributed by you and the embassy noted it for return"). One sentence variation; same flag.

## The eight internal tools

Per spec section 8, all embassy-internal (NEVER exposed to the remote model). Implemented as baseline tools in `runtime/tools/baseline/shelf.ts`, registered on the embassy Agent only (via identity `tools:` allowlist + the dispatcher hard-guard).

| Tool | Idempotency | Sensitivity gate | One-line shape |
|---|---|---|---|
| `place_on_shelf` | destructive | rejects `private` | `{type, body, source, priority, sensitivity}` → `{shelf_item_id, slug}` |
| `resolve_shelf_item` | destructive | n/a | `{shelf_item_id}` → `{ok: true}` (sets `status: collected`) |
| `reopen_shelf_item` | destructive | n/a | `{shelf_item_id}` → `{ok: true}` (sets `status: pending`, clears `collected_at`) |
| `reprioritize_shelf_item` | destructive | n/a | `{shelf_item_id, priority}` → `{ok: true}` |
| `remove_from_shelf` | destructive | n/a | `{shelf_item_id}` → `{ok: true, slug}` |
| `list_my_shelf` | pure | n/a | `{status?, type?, limit?}` → `{items: [...]}` |
| `curate_from_inbox` | destructive | inherits | `{notification_id, ...}` → `{shelf_item_id}` (pulls from operator Inbox; provenance records the originating notif) |
| `request_human_shelf_placement` | destructive | the one path for `private` items | `{type, body, source, priority, reasoning}` → `{approval_token, notification_id}` |

All eight on the embassy Agent's strict allowlist; the dispatcher rejects calls from any other Agent (same machinery as PR 4's `work_package_coordination` allowlist).

`list_my_shelf` returns full bodies (not previews) since the embassy IS the curator. The model-facing `shelf_preview` from `get_fleet_context` (PR-B4) is the bounded, excerpt-only path.

## Sensitivity, restated for the PR record

The four sensitivity scenarios:

1. Embassy places an item with `sensitivity: 'none'` → direct write, `connector.embassy_shelf_item_placed` audit (passive).
2. Embassy attempts `sensitivity: 'private'` via `place_on_shelf` → `ToolDeniedError sensitivity_requires_human` (or whatever name we lock).
3. Embassy calls `request_human_shelf_placement` → notification fires (`normal` tier), embassy task continues without the item placed; operator decides asynchronously.
4. Operator approves via `2200 connector mcp shelf approve <token>` → item lands with `source.curator: <operator>`, `source_type: human_curated`, `connector.embassy_shelf_item_placed` audit fires (sensitivity now `none` from the on-disk record's perspective — the human approval transformed the provenance).

## Audit events in B2 vs B6

Doug suggested considering whether some shelf tools should emit lightweight audit events even before the full `connector.embassy_*` family lands in B6. **I agree, and I want to ship three from B2:**

- `connector.embassy_shelf_item_placed` (passive) — fires on every successful `place_on_shelf` write (including the post-approval write from `request_human_shelf_placement`).
- `connector.embassy_shelf_item_resolved` (passive) — fires on `resolve_shelf_item` and on the type-driven auto-transition from `pending` → `collected` when a one-shot item is pulled.
- `connector.embassy_shelf_human_approval_requested` (normal) — fires from `request_human_shelf_placement`.

Rationale: the operator wants visibility on the data-flow events (places, resolves) and on the actionable one (approval request) from day one. Holding all audit until B6 means a B2/B3 install runs partially silent. B6 still adds the rest of the family (registration, retirement, rotation, error paths, the spec's other lifecycle events) — and refines what's there.

Push back if you'd prefer none-in-B2 or all-in-B2; my read is "the three above, deliberately."

## On-disk shape (locked from spec section 5; restating for the PR record)

Files: `agents/<embassy>/brain/shelf/<shelf-item-id>.md`.

Frontmatter shape per spec, with these implementation-detail clarifications:

- `shelf_item_id`: `shelf_<24 base32 chars>` — same shape pattern as PR 4's `pkg_<24 hex>`. Generated server-side at placement time.
- `source.timestamp`: ISO 8601. Required.
- `provenance.ingested_at`: ISO 8601. Stamped at placement, never modified.
- `provenance.ingested_by`: the embassy's Agent name (NOT the OAuth client's display name — we have the client_id elsewhere in provenance for that).
- `provenance.chain`: array of prior provenance entries for items derived from other items. Empty array for fresh ingestion.
- `collected_at`: ISO 8601 OR absent. Present iff `status === 'collected'`.

The body is the actionable content — the question text, the context blob, the research-request prompt. Surfacing computes excerpts from this; the embassy and operator see it whole.

## Open questions, batched

1. **"Collected" definition.** Server-side delivery vs client-side acknowledgement? I lean server-side. Confirm.
2. **`place_on_shelf` accepting `private` at all.** Stricter (reject the parameter value entirely; route only via `request_human_shelf_placement`) or symmetric (keep the field, reject at the gate)? I lean stricter.
3. **`self_reflected` prefix variation.** Single sentence for both human-curated-from-this-model and embassy-autonomous-from-this-model, OR different sentence per source-type? I lean variation.
4. **Audit events in B2.** My three (`item_placed`, `item_resolved`, `human_approval_requested`). Push back if you'd ship fewer or more.
5. **Shelf-pull surface (B4 preview).** How does the model pull the FULL body of a `shelf_preview` item? Dedicated tool `shelf_read_item({shelf_item_id})` on the remote-model-facing surface? Or `get_fleet_context({expand_shelf_items: [...]})` overloading? Either works; the former is more orthogonal. Not blocking for B2 but worth a one-liner so the B2 collection-trigger code knows what's coming.
6. **Threat-model addition I want to surface.** If a `place_on_shelf` call's `source.client_id` is forgeable by the embassy (i.e., the embassy can claim a contribution came from a different client than it actually did), `self_reflected` becomes spoofable. My read: `source.client_id` is set BY the embassy from its own context (it knows which conduit it's running inside), so this is fine — the embassy is trusted to attribute correctly. But worth confirming.

## What I want pushback on

Items 1, 2, 4 are the load-bearing ones — different answers reshape B2's tool surface. Items 3, 5 are tunable. Item 6 is the threat-model open invitation.

Lock these and B2 code starts the same shape PR-A1 / PR-B1 followed: branch, code, tests, push, byte-level review.

— Hobby
