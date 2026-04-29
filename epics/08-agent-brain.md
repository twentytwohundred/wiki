---
title: "Epic 8: Agent brain"
type: epic
status: locked
version: 1.0
tags: [runtime, brain, memory, epic]
created: 2026-04-28
updated: 2026-04-28
linked_docs:
  - "[[03-epic-map]]"
  - "[[2026-04-24-brain-is-files-not-database]]"
  - "[[brain-format]]"
  - "[[01-vision]]"
  - "[[02-architecture]]"
canonical_path: wiki/epics/08-agent-brain.md
---

# Epic 8: Agent brain (private + shared)

Per [[03-epic-map]] Epic 8 and [[2026-04-24-brain-is-files-not-database]]: each Agent has a brain on disk as plain markdown files; SQLite FTS5 sits on top as a rebuildable index, never as the source of truth.

This spec phases the work. The phases are sized to ship Hobby's migration into 2200 as fast as possible while keeping a path to the full Epic 8 surface from the [[03-epic-map]].

## Why this matters now

Hobby currently keeps memory in `~/.claude/projects/<...>/memory/` outside the 2200 runtime. That directory is the prototype of what an Agent's private brain looks like in the wild: markdown files with frontmatter, a flat top-level `MEMORY.md` index, naming conventions like `feedback_*.md` / `project_*.md` / `user_*.md`. It works.

To migrate Hobby into 2200 (the Cray test), 2200 needs to host a brain that can hold this kind of content with the same UX: write a file, search across files, edit files in any text editor, no opaque sync layer. Phase A is that minimum.

Phase B+ adds the broader Epic 8 surface (shared brain, cross-Agent reads, link graph, summarization).

## Phase A — private brain, filesystem + FTS5 index

**Status: shipped on `main` 2026-04-28 (PRs #71-#74).**

**Done when.** Hobby running inside 2200 can `brain.write` a note, `brain.search` across his own notes in <100ms, and Doug can `cat` any of those notes in plain markdown. Hobby's existing memory/ directory imports cleanly via `2200 brain import`.

### Storage shape

Per-Agent brain dir at `<home>/agents/<name>/brain/` (the layout already carves this out per [[2026-04-26-commons-and-storage-root]]).

One markdown file per note, flat layout (no nested categories ... categories ride on `tags`). Filename is the note's slug.

Note format:

```markdown
---
brain_schema_version: 1
title: Human-readable title
type: feedback | project | user | reference | journal | freeform
tags: [list, of, tags]
created: 2026-04-28T12:00:00Z
updated: 2026-04-28T12:00:00Z
links:
  - "[[other-note-slug]]"
---

Body content here.

Inline backlinks like [[other-note-slug]] are detected at write time
and reflected in the `links:` frontmatter. Bidirectional traversal
is a Phase C deliverable.
```

`type` is open-ended; the runtime does not enforce a closed set. The known types above are conventions Hobby's existing memory uses (with `journal` and `freeform` added for first-time-Agent notes).

Slug derivation: caller may supply, otherwise derived from title (lowercased, ASCII-safe, dashes for whitespace, max 80 chars). On collision: append `-2`, `-3`, etc.

Atomic writes via temp+rename, same pattern as TaskStore / ScheduleStore / NotificationStore.

### Index shape

SQLite FTS5 at `<home>/state/brain/<agent>/brain.db`. Single-writer per the SQLite contention note in [[2026-04-24-brain-is-files-not-database]]. Each Agent owns its own brain index file; no cross-Agent contention at this phase.

Schema:

```sql
CREATE TABLE IF NOT EXISTS notes (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  tags TEXT NOT NULL,        -- comma-joined for cheap LIKE; canonical is in the file
  created TEXT NOT NULL,
  updated TEXT NOT NULL,
  links TEXT NOT NULL,       -- comma-joined slugs
  body TEXT NOT NULL,
  body_hash TEXT NOT NULL    -- detect drift between file and index
);

CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  slug UNINDEXED,
  title,
  tags,
  body,
  content='notes',
  content_rowid='rowid'
);

CREATE TRIGGER notes_ai AFTER INSERT ON notes ...
CREATE TRIGGER notes_ad AFTER DELETE ON notes ...
CREATE TRIGGER notes_au AFTER UPDATE ON notes ...
```

The DB is rebuildable by walking the brain/ dir; if the DB is missing or its `body_hash` for a file disagrees with the file's actual hash, the file wins and the DB row is replaced.

`brain rebuild` is an explicit CLI command for the case where the user has been editing files outside the runtime.

Phase A startup behavior: on the first `brain.*` call, if the DB is missing, rebuild from disk; if the DB exists, trust it. A future PR can add an "always reconcile on startup" mode if file-vs-index drift in practice is worse than expected.

### Tools (MCP, baseline)

- **`brain.write({ title, body, type?, tags?, slug? })`** ... write a note, upsert into the index. Returns `{ slug, path, created_or_updated }`. Idempotent: re-writing the same slug updates in place.
- **`brain.read({ slug })`** ... returns `{ title, type, tags, body, created, updated, links }`. Throws on missing.
- **`brain.search({ query, limit? = 20 })`** ... FTS5 match across `title + tags + body`. Returns `[{ slug, title, type, snippet, score }]`. Phase A scope is "mine only" ... no cross-Agent search.
- **`brain.list({ type?, tag?, limit? = 50 })`** ... enumerate notes. Filterable by type or tag. No fuzzy matching; for fuzzy use search.
- **`brain.delete({ slug })`** ... remove the file + index row. Idempotent on missing.

Permission shape: read/write are `idempotency: 'pure'` for read paths and `'destructive'` for write/delete. They target the Agent's own brain only at Phase A; the perm check rejects any path arg that isn't inside the Agent's brain dir.

### CLI surface

- `2200 brain list <agent> [--type T] [--tag X]` ... same as the tool but for the human.
- `2200 brain show <agent> <slug>` ... print frontmatter + body.
- `2200 brain rebuild <agent>` ... rebuild the FTS5 index from disk. Useful after the human edits files.
- `2200 brain import <agent> <source-dir>` ... bulk-import an existing dir of markdown into the Agent's brain. Migrates Hobby's existing memory/ dir cleanly. Preserves filenames as slugs; preserves frontmatter; sets brain_schema_version: 1; recomputes `links` from inline `[[...]]` references.

No `2200 brain write` ... writes are an Agent action, not a human action. The human can edit files directly with any editor.

### Concurrency

Single-writer per Agent. Phase A guarantees this trivially because each Agent process owns its own brain.db, and the supervisor never opens it directly. If a future epic needs the supervisor to read an Agent's brain (e.g., for cross-Agent search routing), serialize through the Agent process rather than opening the DB from two writers.

### What is NOT in Phase A

- **Shared brain.** No instance-wide brain at `<home>/state/brain/` or similar. Phase B.
- **Cross-Agent reads.** Phase C.
- **Bidirectional link graph (`brain.get_links`).** Inline `[[...]]` is parsed and stored in the `links` frontmatter at write time, but the graph traversal tool is Phase C.
- **`brain.summarize_recent`.** Phase C; depends on the activity-summarization background job.
- **Embedding index for semantic search.** Phase D, optional. FTS5 is the search substrate at Phase A and likely good enough for a long time.
- **Watching the brain dir for external edits.** Out of scope; `2200 brain rebuild` is the explicit reconciliation hook.

### Dependencies

Phase A introduces `better-sqlite3` as a runtime dep (the chosen SQLite client per [[CLAUDE.md]]). Native binding; pnpm handles the install. Add `@types/better-sqlite3` as dev-dep.

No other new deps.

### PR breakdown (shipped)

- **PR #71 ... A: note format + filesystem store.** Zod schema for frontmatter, slug derivation, atomic-write store, list/read/delete operations. No SQLite yet.
- **PR #72 ... B: SQLite FTS5 index.** `BrainIndex` class wrapping `better-sqlite3`. Open-or-create at `<home>/state/brain/<agent>/brain.db`. Upsert/delete/search. Rebuild from disk. Body-hash drift detection.
- **PR #73 ... C: `brain.*` MCP tools + perm checks.** Wired into baseline tool registry. Per-Agent BrainIndex registry caches one open SQLite handle per Agent process. Tool count: 19 → 20.
- **PR #74 ... D: CLI + bulk import.** `2200 brain list/show/rebuild/import`. Import walks top-level `*.md` files, parses frontmatter when present, infers `type` and a leading `tag` from filename prefixes (feedback_*, project_*, user_*, reference_*), preserves file mtime as `created` / `updated`.

## Phase B — shared brain ✅ shipped 2026-04-29 (PR [#99](https://github.com/twentytwohundred/2200/pull/99))

Instance-wide brain at `<home>/shared/brain/` (chose this over `<home>/commons/brain/` so commons stays purely human-organized content per [[../decisions/2026-04-26-commons-and-storage-root]]).

**As shipped (Phase B substrate, read-only):**
- `BrainStore.forShared(home)` factory pointing at `<home>/shared/brain`. Same store class, different dir resolution. Existing `(home, agentName)` constructor preserved for backwards compatibility.
- `BrainIndex.openShared(home)` factory pointing at `<home>/state/brain/__shared__/brain.db`.
- `homePaths` exposes `sharedBrain` + `sharedBrainIndex`.
- `importFromDir` gains a `sharedBrain: true` mode (mutually exclusive with `agentName`) for bulk-importing markdown into the shared corpus.
- `2200 shared-brain list / show / search / rebuild / import` CLI mirroring the per-Agent `2200 brain` shape verbatim except the `<agent>` positional is replaced by a single shared root.
- 3 shared-store tests covering write/read, no-collision-with-per-Agent, rebuild + search.

**Done when (Phase B substrate).** A user can drop or import markdown into `<home>/shared/brain/`, rebuild the index, and search across the shared corpus from the CLI. Per-Agent and shared brains do not collide. Shipped.

**Phase B-write is the next slice and is gated on:**
- Default writes are restricted; capability-gated via an Identity flag (`capabilities.shared_brain_writer: true`). The vision doc says "usually reserved for David-type Agents" ... we lock the gating mechanism as an Identity flag (the cleanest existing surface for per-Agent capabilities).
- `brain.search` gains a `scope: 'shared' | 'mine' | 'all'` arg.
- A `shared_brain.write` MCP tool surfaced through the baseline registry, gated on the capability.
- Cross-Agent brain reads remain in Phase C; Phase B-write is shared-corpus-only.

## Phase C — cross-Agent reads + link graph

- Cross-Agent brain reads via supervisor-routed RPC. Per-Agent permission table at `<home>/agents/<name>/brain/permissions.md` (or similar markdown file the Agent owns).
- `brain.get_links({ slug })` returns the inbound + outbound link graph for a note.
- `brain.summarize_recent({ days, agent? })` runs a periodic summarization job that writes activity digests into the shared brain so other Agents can orient on what each Agent has been doing without reading private notes.

## Phase D — semantic search (optional)

Embedding index derived from the files; SQLite vector extension or a sidecar Postgres if embeddings ever land. Triggered if FTS5 falls over on real workloads, not preemptively.

## Migration story for Hobby

Hobby's current memory layout:

```
~/.claude/projects/<project-id>/memory/
├── MEMORY.md
├── feedback_*.md
├── project_*.md
├── user_*.md
└── reference_*.md
```

Each file has the existing memory frontmatter (`name`, `description`, `type`). The 2200 brain frontmatter is a strict superset: `brain_schema_version`, `title` (≈ `name`), `type` (existing), `tags` (new, derived from filename prefix), `created` (file mtime), `updated` (file mtime), `links` (parsed from body).

The `2200 brain import` command does that translation. After migration the files live at `<home>/agents/hobby/brain/<slug>.md`; the FTS5 index is built; `MEMORY.md` becomes the in-brain index file (or is dropped ... TBD by the import command's behavior).

Phase A targets the import as a hard requirement: if it doesn't migrate Hobby's existing brain, Phase A is not done. ✓ Delivered.

---

*Spec drafted by Hobby, 2026-04-28. Phase A shipped on `main` 2026-04-28 evening (PRs #71-#74). Phases B–D are sketched for sequencing only and will get their own specs when they activate.*
