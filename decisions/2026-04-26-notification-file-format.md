---
title: 'Decision: Notification File Format at v1'
type: decision
status: locked
tags: [decision, runtime, notifications, file-format, brain, epic-2]
created: 2026-04-26
updated: 2026-04-26
linked_docs:
  - '[[02-agent-runtime-minimum]]'
  - '[[02-architecture]]'
  - '[[2026-04-24-brain-is-files-not-database]]'
  - '[[brain-format]]'
canonical_path: wiki/decisions/2026-04-26-notification-file-format.md
---

# Decision: Notification File Format at v1

## Context

Per [[02-agent-runtime-minimum]], when a detector trips or an Agent emits an ask, a notification record is written to disk. Epic 7 owns the full notification system (tier routing, push-notification delivery via APNs and FCM, the mobile inbox UI). Epic 2 ships the data shape that Epic 7 consumes.

The Epic 2 spec lists "Notification file format (markdown with frontmatter is the safe default)" as an architecture choice that is not pre-decided. This record locks the format.

Constraints:

- **Brain-pattern consistency.** Per [[2026-04-24-brain-is-files-not-database]], 2200's persisted state is markdown files on disk that humans can read and edit. The notification format should follow the same pattern.
- **Schema-versioned per [[upgrade-readiness]] discipline 1.** The format is a contract Epic 7 inherits.
- **Queryable.** The notification CLI (`2200 notification list`, `2200 notification respond`) needs to scan and update notifications efficiently. Without a database, that means filesystem layout that supports cheap enumeration plus frontmatter that is fast to parse.
- **Aligned with the plan/run/perm record schemas** ([[2026-04-25-tool-baseline]]) so consumers see one consistent shape across all on-disk records.

Options considered:

1. **Markdown with YAML frontmatter, one file per notification.** Brain-pattern consistent. Frontmatter carries structured fields; body carries optional richer prose (the question text formatted nicely, or supporting context).
2. **JSON files.** Pure structured; no body. Less human-readable. Loses the "Brain pattern everywhere" signal.
3. **SQLite rows.** Faster queries at scale. But the "Brain pattern" architecture deliberately rejects opaque database state; same reasoning applies here.
4. **Single append-only log file (JSONL).** Single file, easy to tail. But updates (mark-as-answered) become rewrites of older entries, which is awkward in an append-only log.
5. **One YAML file per notification, no body.** Same as option 1 minus the markdown body. Slightly leaner, slightly less human-friendly.

## Decision

**Option 1: markdown with YAML frontmatter, one file per notification.**

### File location

```
<state-dir>/notifications/<notif-id>.md
```

Where `<notif-id>` is `notif_<uuid>`. Flat directory at v1; if scale becomes an issue (10k+ notifications), Epic 7 introduces date-partitioned subdirectories without changing the per-file format.

### Schema (`schema_version: "0.1"`)

Frontmatter fields:

| Field | Type | Notes |
|---|---|---|
| `schema_version` | string | `"0.1"` |
| `id` | string | `notif_<uuid>`; matches filename stem |
| `ts` | ISO 8601 UTC | when emitted |
| `agent` | string | Agent that emitted the notification |
| `task_id` | string \| null | task in flight when emitted; null for non-task-bound emissions |
| `tier` | string | one of `passive`, `normal`, `important`, `critical` (full tier semantics live in Epic 7; v1 emits `passive` for detector trips, leaves room for the rest) |
| `state` | string | one of `pending`, `answered`, `dismissed`, `expired` |
| `question` | string | the user-facing ask text (also rendered in the body for richer formatting) |
| `response` | string \| null | populated when `state = answered` |
| `responded_at` | ISO 8601 UTC \| null | when the user answered |
| `expires_at` | ISO 8601 UTC \| null | optional auto-expiry; null = no expiry |
| `delivery` | object | `{ channels: [push|badge|voice], priority?: string }`; v1 always uses `[badge]` (file-only), Epic 7 wires real channels |
| `source` | object \| null | optional structured context: `{ kind: "detector_trip", detector: "tool_repetition", trip_id: "trip_xyz" }` for detector-emitted notifications, or `{ kind: "agent_ask" }` for Agent-emitted asks |

### Body

The markdown body is optional. When present, it contains a richer formatting of the ask: the question text plus supporting context (the recent plan/run records that led to the trip, links to the task, etc.). Renderers (CLI, web app, mobile app) can choose to use the structured `question` field for terse views and the body for detail views.

### Example

```markdown
---
schema_version: '0.1'
id: notif_01HXYZAB12CD3EF4G5HIJKLMNOP
ts: 2026-04-26T18:32:14Z
agent: hobby
task_id: t_research_quarterly_metrics
tier: passive
state: pending
question: 'Hobby paused: tool loop detected on web.fetch. Resume or stop?'
response: null
responded_at: null
expires_at: null
delivery:
  channels: [badge]
source:
  kind: detector_trip
  detector: tool_repetition
  trip_id: trip_01HXYZQRSTUVWXYZ123456789ABC
---

# Tool loop detected

Hobby called `web.fetch` with semantically-equivalent args 5 times in a row
on `https://example.com/api/metrics`. The detector paused the Agent at
2026-04-26T18:32:14Z.

The same call returned `429 Too Many Requests` each time. Likely cause: the
remote API is rate-limiting; Hobby was retrying without backoff.

To resolve:

- `2200 agent resume hobby` if you want Hobby to keep trying (consider asking
  the Agent to add backoff first)
- `2200 agent stop hobby` if you want to halt the task entirely

References:

- task: t_research_quarterly_metrics
- trip log: brain_dir/.records/detector-trips/trip_01HXYZQRSTUVWXYZ123456789ABC.md
```

### Atomicity and concurrency

- **Writes are atomic via temp-file-and-rename.** A new notification is written to `<state-dir>/notifications/<id>.md.tmp`, fsynced, then renamed to `<id>.md`. POSIX rename is atomic on the same filesystem. Readers either see the previous state or the new state, never a torn write.
- **State changes (pending → answered, etc.) follow the same temp-and-rename pattern.** The Brain stub at v1 reads the whole file, modifies frontmatter, writes back via the temp-and-rename.
- **Concurrent writes by multiple Agents are not a concern at v1.** Each notification has a single owning Agent; only that Agent and the user (via the CLI / future API) write to it.
- **The notification listing tool** (`2200 notification list`) reads all `.md` files in the directory with frontmatter parsing; v1 implementation is filesystem walk. SQLite indexing is a future optimization if directory size grows beyond a few thousand notifications.

### Idempotency in face of restart

If the supervisor or Agent crashes mid-emit:

- A `.tmp` file may exist without a final `.md`. Recovery on supervisor boot: scan `<state-dir>/notifications/` for `.tmp` files, delete them. The notification will be re-emitted by the Agent when it resumes (Agent state machine remembers the trip and re-emits as part of resume).
- A final `.md` exists with `state: pending`. The supervisor lists it as part of `state.snapshot` and the user sees it via `2200 notification list`.

## Consequences

### What gets better

1. **Brain-pattern consistency.** One mental model for all of 2200's persisted state: markdown files with frontmatter. The user can `cat`, `vim`, `grep`, `git diff` notifications. Same toolchain works for plan/run/perm records, detector trips, Brain notes, and notifications.
2. **No database dependency at v1.** Filesystem only. SQLite indexing arrives in Epic 8 (the full Brain) and may extend to notification queries later if needed; not blocking for Epic 2.
3. **Schema-versioned from day one.** Per discipline 1, the parser tolerates older versions via on-read migrators. Epic 7's tier routing additions land as field additions in `schema_version: 0.2` or as a new `delivery` shape, with the migrator handling the transition.
4. **Atomic writes via temp-and-rename.** Standard POSIX guarantee; no half-written notifications surface.
5. **Renderers are decoupled from storage.** The CLI, web app, and mobile app all read the same files. Adding a new renderer (terminal TUI, voice channel) means parsing the file format, not changing the storage layer.

### What could get worse

1. **Filesystem walk does not scale forever.** A user with 10,000 notifications in one flat directory has slow `2200 notification list`. Mitigation: Epic 7 partitions by date or by state; the per-file format does not change. Acceptable cost given Epic 2 expects single-digit-thousand notifications at most.
2. **No transactional cross-file updates.** If a notification's state change should also update task state on disk, those are two file writes that can be interrupted between. Mitigation: tasks declare idempotency per [[upgrade-readiness]] discipline 6; consumers handle "notification answered but task not yet updated" as a recoverable resume case.
3. **YAML frontmatter parser overhead per file.** v1's `2200 notification list` parses every notification's frontmatter. For 1,000 notifications this is sub-second on a modern Mac; revisit at the Epic 7 scale.
4. **Markdown body is optional structure.** Renderers must handle "no body" gracefully. Documented in the format; tests cover the no-body case.

## Implementation guidance

### For Epic 2

- The notification writer is in `src/runtime/notifications/writer.ts`. It exposes `emit(notification)`, `markAnswered(id, response)`, `markExpired(id)`.
- The notification reader is in `src/runtime/notifications/reader.ts`. It exposes `list(filter?)` and `get(id)`.
- Both use the Brain stub's file-IO discipline (atomic writes via temp-and-rename; reads via plain `fs.readFile`). No database.
- Schema-version migrator stub at `src/runtime/notifications/migrators/0.0-to-0.1.ts` to validate the discipline pattern, even though `0.0` is hypothetical.

### For Epic 7

The Epic 7 spec inherits this format. Field additions for tier routing, push delivery, voice channel integration, and quiet-hours metadata go on the existing schema with a `schema_version` bump and the corresponding migrator. The directory layout (flat at v1) may be partitioned at Epic 7 scope.

### For other consumers (web app, mobile app, CLI)

The format is a public contract from the moment Epic 2 ships. Renderers should be tolerant of unknown frontmatter fields (for forward compatibility with Epic 7+ extensions) and resilient to missing optional fields.

## License posture

The format is our design; YAML frontmatter and markdown body are non-copyrightable conventions. No code-lift; the Brain-pattern dogfooding is itself the design.

## References

- Epic 2 spec: [[02-agent-runtime-minimum]] (the "architecture choices that are not pre-decided" section)
- Brain-as-files: [[2026-04-24-brain-is-files-not-database]]
- Brain format convention: [[brain-format]]
- Upgrade-readiness disciplines 1, 2, 3, 6: [[upgrade-readiness]]
- Tool baseline + plan/run/perm: [[2026-04-25-tool-baseline]] (the schema vocabulary this format aligns with)
- Object model: [[02-architecture]] (Notification object)

## Format provenance

Decision recorded by Hobby on 2026-04-26 during Epic 2 build-phase prep. Build-time call per [[build-phase-decisions]]; this record captures the lock so the v1 notification implementation and the Epic 7 routing implementation share one format.

---

*Decision recorded by Hobby, 2026-04-26.*
