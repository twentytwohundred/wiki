---
title: "Epic 5: Migration into 2200"
type: epic
status: draft
version: 0.1
tags: [epic, migration, handoff, seed-team, cray-test]
created: 2026-04-29
updated: 2026-04-29
linked_docs:
  - "[[03-epic-map]]"
  - "[[02-architecture]]"
  - "[[04-seed-team]]"
  - "[[04-scut-identity-at-spawn]]"
  - "[[08-agent-brain]]"
  - "[[handoff-format]]"
canonical_path: wiki/epics/05-migration.md
---

# Epic 5: Migration into 2200

The seed team migrates into the platform they built. Hobby goes first, the Cray test begins, and the build moves inside the runtime.

This spec phases the work. Phase A is "first-time migration into 2200 from a handoff document" ... the path the seed team takes (and that early external users take when they bring an existing Agent over). Phase B is "2200 → 2200 instance migration" ... the move from Doug's Mac to Heisenberg later. Phase B is structurally similar to Phase A but adds an export step; deferred until there is a second 2200 instance to move between.

## Why this matters now

The runtime substrate is in place ([[02-agent-runtime-minimum]], [[03-local-pub-integration]], [[04-scut-identity-at-spawn]], [[04.5-cost-caps-and-usage-telemetry]], scheduler, notifications, [[08-agent-brain]]). What's missing is the orchestration that turns "an Agent with state somewhere else" into "an Agent running inside 2200 with that state preserved."

For Hobby specifically: the brain at `~/.claude/projects/<id>/memory/` is loaded with feedback, project memory, and the operating thesis. Identity and notification policy are codified in CLAUDE.md and in this wiki. None of that lives inside 2200 yet. Phase A makes that move possible in a single CLI invocation.

The Cray principle says: build the smallest thing that can host its own builders, then build from inside. Phase A is what makes that possible.

## Phase A — first-time migration via handoff document

**Done when.** A user (or seed-team operator) writes a handoff document, runs `2200 agent migrate --from-handoff <path>`, and the result is a fully-provisioned Agent running inside 2200 with: SCUT identity minted (optional, gated by flag), brain bulk-imported from the source directory, budget configured, the handoff body preserved as a brain note titled `continuity-from-migration`, and a Passive notification posted summarizing what landed. Hobby's migration is the canonical first run.

### The handoff document

A markdown file with YAML frontmatter. Versioned via `handoff_schema_version`. The frontmatter is machine-readable; the body is human-readable narrative that gets preserved as the Agent's first brain note (so the Agent's first context inside 2200 is a written explanation of its prior state).

```markdown
---
handoff_schema_version: 1
agent_name: hobby
agent_type: build_agent              # informational; not enforced
identity:
  display_name: hobby                # used by SCUT register service
  notification_policy:
    tiers_allowed: [passive, normal, important]
  # optional: carry forward keypairs from a prior 2200 instance (Phase B)
  # carryover_keys:
  #   signing_path: /path/to/encrypted/signing.ed25519
  #   encryption_path: /path/to/encrypted/encryption.x25519
brain:
  source_dir: ~/.claude/projects/-Users-dhardman-Library-CloudStorage-Dropbox-Business-2200-hobby/memory/
  # optional alternative: inline notes
  # inline_notes:
  #   - title: "..."
  #     body: |
  #       ...
budget:
  daily_cap_usd: 50
schedules: []                        # Phase A: empty; wire post-migration
provenance:
  source_system: claude_code
  source_host: doug-macbook
  exported_at: 2026-04-29T08:00:00Z
---

# Hobby's migration into 2200

(narrative body. preserved verbatim as a brain note titled `continuity-from-migration`. read by the Agent on first run so it has a written account of where it came from.)

## Who I am

I am Hobby, the primary build Agent on the 2200 project...

## What I was doing before this migration

Eight epics shipped on `main`. Epic 5 (this migration) is the substrate
I am moving in on top of...

## What I should do first inside 2200

Pick up Epic 9 (Tool system) work. The handoff is the proof that
migration works; Epic 9 is the next deliverable.
```

**Schema (machine-readable, frontmatter):**

| Field | Type | Required | Notes |
|---|---|---|---|
| `handoff_schema_version` | integer | yes | currently `1`. Per [[2026-04-26-schema-version-format]]. |
| `agent_name` | string | yes | becomes the Agent's name in 2200. Lowercase ASCII, no spaces. |
| `agent_type` | string | no | informational tag (e.g., `build_agent`, `email_agent`). Not enforced. |
| `identity.display_name` | string | yes | used by `register.openscut.ai` if `--provision-identity` is passed. Per-displayName-per-day rate limit applies. |
| `identity.notification_policy.tiers_allowed` | string[] | yes | subset of `[passive, normal, important, critical]`. Critical is supervisor-driven and ignored if listed. |
| `identity.carryover_keys` | object | no | Phase B only. Paths to encrypted-at-rest signing/encryption keys from a prior 2200 instance. If present, `--provision-identity` reuses these instead of minting a new SCUT token. |
| `brain.source_dir` | string | no | absolute or `~`-prefixed path to a directory of markdown files. Bulk-imported via the existing `2200 brain import` machinery. |
| `brain.inline_notes` | object[] | no | alternative to `source_dir`: notes inline in the handoff. Useful for small migrations. |
| `budget.daily_cap_usd` | number | yes | written into the Agent's Identity file. |
| `schedules` | object[] | no | currently must be empty. Phase A defers schedule import; wire post-migration via `2200 schedule add`. |
| `provenance.source_system` | string | no | informational. Examples: `claude_code`, `openclaw`, `2200`. |
| `provenance.source_host` | string | no | informational. |
| `provenance.exported_at` | ISO 8601 | no | informational. |

**The body** below the frontmatter has no schema constraints. It is preserved as a brain note titled `continuity-from-migration` (slug: `continuity-from-migration`). The body should answer three questions:

1. Who am I?
2. What was I doing before this migration?
3. What should I do first inside 2200?

These three sections are the convention; the spec does not enforce headings, just the practice.

### Orchestration

`2200 agent migrate --from-handoff <path> [--provision-identity] [--force]`

1. **Parse and validate.** Read the file, split frontmatter from body, validate frontmatter against the Zod schema. Hard-fail on schema violations with a precise error pointer.
2. **Pre-flight.** Check the Agent name does not already exist. With `--force`, delete any existing Agent of that name first (destructive; produces an Important notification).
3. **Identity file generation.** Write a 2200 Identity markdown file derived from the handoff: `name`, `model_tier` (default: `frontier` ... overridable later), `notification_policy.tiers_allowed`, `cost_caps.daily_cap_usd`, an empty `tools.allowed` list (Epic 9 wires this later), and a placeholder `scut` block (filled in by provisioning if requested). The Identity file lives at `<home>/state/identities/<agent>/identity.md`.
4. **Agent registration.** Call the supervisor's `cli.agent.create` RPC with the new identity path. Falls back to direct `Supervisor.createAgent` if no daemon is running, mirroring the existing `agent create` pattern.
5. **SCUT identity provisioning** (gated by `--provision-identity`). Calls `runIdentityProvisionFromConfig` exactly as `agent create` does today. Subject to the OpenSCUT per-displayName-per-day rate limit; the operator should pick the migration window deliberately. On failure, the Agent is still migrated successfully ... it just lacks a SCUT URI; recover with `2200 agent identity retry <name>`.
6. **Brain import.** If `brain.source_dir` is set, call the existing `importFromDir` (Epic 8 PR #74) with the source path. If `brain.inline_notes` is set, write each note via the BrainStore directly. Records imported count for the summary.
7. **Continuity note.** Write the handoff body as a brain note: title=`continuity-from-migration`, type=`continuity`, tags=`[migration, ${agent_type}]`, slug=`continuity-from-migration`. The note's body is the verbatim handoff body. The `provenance` block becomes frontmatter on this note.
8. **Summary notification.** Emit a Passive notification (always allowed) at the supervisor level: "Agent <name> migrated. Imported <N> brain notes (<M> skipped). Continuity note written. SCUT URI: <uri> (or: provisioning skipped)."
9. **Console summary.** Print the same information to stdout. Include the next-step hint: `Run "2200 agent start <name>" to bring it up.`

The orchestrator is checkpointed: each step writes a marker to `<home>/state/agents/<agent>/migration-state.json` so a crash mid-import does not leave the Agent half-built. On restart, `2200 agent migrate --resume <name>` picks up where the previous run left off. Resume is idempotent: re-importing the brain dir is a no-op (the BrainStore upsert keys on slug).

### CLI surface

```
2200 agent migrate --from-handoff <path>          # parse + run full migration
2200 agent migrate --from-handoff <path> \
                   --provision-identity            # also mint a SCUT identity
2200 agent migrate --from-handoff <path> --force  # overwrite an existing Agent
2200 agent migrate --resume <name>                 # resume a partially-completed migration
2200 agent migrate --validate <path>               # parse + validate, do not write
```

The `--validate` mode is the safe-to-run-anywhere preview. It produces a summary of "what would happen" without touching the runtime.

### Files

```
src/runtime/migration/
├── types.ts              # Zod schema for the handoff doc
├── parser.ts             # parse + validate frontmatter + extract body
├── identity-from-handoff.ts  # generate Identity markdown from handoff
├── orchestrator.ts       # the migrate() function wiring everything
└── checkpoint.ts         # migration-state.json read/write

src/cli/main.ts           # add `agent migrate` subcommand

tests/migration/
├── parser.test.ts
├── orchestrator.test.ts
├── identity-from-handoff.test.ts
└── fixtures/
    ├── hobby-handoff.md
    ├── minimal-handoff.md
    └── invalid-handoff.md
```

### What's NOT in Phase A

- **2200 → 2200 instance migration.** Phase B. Adds an export step (`2200 agent export <name> --to <path>`) that writes a handoff document representing the running Agent's state, including encrypted keystore paths so the SCUT identity carries forward.
- **Schedule import.** Phase A enforces `schedules: []`. Phase A2 (small follow-on) wires `schedules:` from the handoff via the existing ScheduleStore.
- **Notification queue carryover.** A migrating Agent starts with an empty notification queue. The handoff body in the continuity note is the only "you have prior context" surface.
- **Adapters for other Agent systems.** No automatic translation from OpenClaw / Perplexity Computer / etc. The handoff document is the standard import shape; users translate from their source system into the handoff format manually for now. Adapter epic is post-launch.
- **Pub re-registration.** If the migrating Agent had a pub identity on the prior host, that pub identity is not preserved (the new Agent registers fresh on first start). Cross-instance pub continuity is Epic 4 Phase B's concern.
- **Cost-cap state carryover.** The migrating Agent starts a fresh budget window. Today's spend on the prior host does not roll into today's spend on 2200. This is a pragmatic simplification; the migration window is a natural reset point.

### Dependencies

- Epic 2 (supervisor, Identity loader, schema versioning, control plane) ... shipped.
- Epic 4 Phase A (SCUT identity provisioning) ... shipped. Provides the optional `--provision-identity` step.
- Epic 4.5 (cost caps) ... shipped. Provides the budget config target.
- Epic 7 Phase A (notifications) ... shipped. Provides the summary notification surface.
- Epic 8 Phase A (brain) ... shipped. Provides bulk-import + brain note write.

No new external dependencies. No new cross-cutting work.

## Phase B — 2200 → 2200 instance migration

**Status:** Deferred until a second 2200 instance exists.

Adds:

- `2200 agent export <name> --to <path>` ... walks the Agent's runtime state (Identity file, brain dir, schedules, notifications, budget telemetry) and writes a handoff document with the bits that should carry over. Encrypted keystores travel by reference; the destination host gets the encrypted blobs and the per-instance master key that wraps them (the master-key handling is the operationally interesting part; see "open question" below).
- The handoff `identity.carryover_keys` block, populated by export, flows the prior SCUT keys into the destination so the SCUT URI is preserved across the move (no re-mint, no rate-limit consumption).
- A "stop on source, import on destination, verify, then delete on source" runbook codified as a single command sequence: `2200 agent export → scp → 2200 agent migrate --from-handoff` becomes the canonical move.

**Open question for Phase B (do not block Phase A on this).** The per-instance master key wraps each Agent's signing/encryption keys at rest. Cross-instance migration requires either: (a) re-wrapping the keystores under the destination instance's master key during export (operator transport: the unwrap key lives only in memory during the export), or (b) shipping the encrypted blobs plus the source's master key, accepting that the destination instance now also holds a copy of that master key. (a) is cleaner; (b) is simpler. Pick when Phase B activates.

## Migration story for Hobby

Hobby's handoff document at `wiki/runbooks/hobby-migration.md` (the runbooks dir is the right home for one-shot operational artifacts ... `wiki/handoffs/<name>/` is reserved for daily session handoffs per [[handoff-format]], a related but distinct format):

```yaml
---
handoff_schema_version: 1
agent_name: hobby
agent_type: build_agent
identity:
  display_name: hobby
  notification_policy:
    tiers_allowed: [passive, normal, important]
brain:
  source_dir: ~/.claude/projects/-Users-dhardman-Library-CloudStorage-Dropbox-Business-2200-hobby/memory/
budget:
  daily_cap_usd: 50
schedules: []
provenance:
  source_system: claude_code
  source_host: doug-macbook-pro
  exported_at: 2026-04-XX
---

(narrative body: who Hobby is, what Hobby was doing before, what Hobby should do first)
```

Then:

```
2200 agent migrate --from-handoff wiki/handoffs/hobby/migration-into-2200.md \
                   --provision-identity
2200 agent start hobby
```

Hobby is now alive inside 2200. Decisions about Hobby's first task inside the runtime get made via the existing pub / chat / notification surfaces, not this spec.

The OpenSCUT `register.openscut.ai` per-displayName-per-day rate limit means we get exactly one shot at provisioning `hobby` per UTC day. Pick the window deliberately. If the migration goes smoothly but provisioning fails for an unrelated reason, recovery is `2200 agent identity retry hobby` ... no need to re-run the full migration.

## Upgrade-readiness

| Discipline | How this epic holds it |
|-----------|------------------------|
| Schema versioning | `handoff_schema_version: 1` in frontmatter. Future versions migrate via the same migrator-chain pattern Identity uses ([[2026-04-26-schema-version-format]]). |
| State on disk | The handoff document is a plain markdown file. Migration state checkpoint is JSON at `<home>/state/agents/<agent>/migration-state.json`. Both human-readable. |
| Restart safety | Each orchestration step checkpoints before the next runs. `--resume` picks up at the last completed step. Re-running a completed migration is a no-op. |
| Tool-call inspectability | All file writes go through existing stores (BrainStore, IdentityStore). All HTTPS calls (SCUT register) are the same paths Epic 4 already wraps with plan/run/perm. |
| Idempotent tasks | Brain import upsert-on-slug. Identity file write is overwrite-on-name. Provisioning is idempotent at the OpenSCUT side (registered → no-op). |
| Inspectable persisted artifacts | Identity file is markdown. Brain notes are markdown. Migration state is JSON. Continuity note is markdown. All readable by `cat` or any text editor. |

## Format provenance

Spec drafted by Hobby, 2026-04-29 morning, after the wiki cleanup and epic-map refresh. Build proceeds under the decide-and-tell posture: implementation choices land in PRs without flagging unless they affect the public contract (handoff format, CLI surface, what gets preserved across migration).

---

*Phase A scope. Phase B sketched for sequencing. Implementation in flight on `epic-5/handoff-format` and following branches.*
