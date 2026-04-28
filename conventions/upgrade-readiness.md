---
title: Upgrade Readiness Convention
type: convention
status: active
tags: [convention, runtime, upgrade, migration, architecture]
created: 2026-04-24
updated: 2026-04-24
linked_docs:
  - "[[brain-format]]"
  - "[[02-architecture]]"
  - "[[03-epic-map]]"
  - "[[2026-04-24-runtime-upgrade-shape]]"
canonical_path: wiki/conventions/upgrade-readiness.md
---

# Upgrade Readiness Convention

The disciplines every 2200 epic must respect so that runtime upgrade is a solved problem when v1.1 ships, not a retroactive scramble. Required reading before drafting any epic spec.

---

## Why this exists

When 2200 v1.0 ships and v1.1 arrives, the user's running Agents, in-flight tasks, Brain notes, Identity files, installed Extensions, and stored credentials all have to survive the upgrade. If the early epics were designed without upgrade in mind, every later upgrade becomes a retrofit. By the time the user notices, the cost of fixing it is enormous.

The fix is discipline now, not heroics later. This convention captures the disciplines.

---

## The framing

**Upgrade is a degenerate case of migration.**

Epic 5 (Migration from other Agent systems) builds the primitives: portable handoff doc format, Identity portability, Brain-as-files. Moving an Agent from system A to system B is migration. Moving an Agent from runtime version N to N+1 on the same box is upgrade. Same primitives, narrower scope, system-initiated instead of user-initiated.

If the migration story is real, upgrade is mostly the application of it.

The disciplines below are what every epic must do so the migration primitives can do double duty as upgrade primitives.

---

## The seven disciplines

### 1. Schema versioning everywhere

**Principle.** Every persisted artifact has a `version` field in its frontmatter or schema. Every parser tolerates earlier versions, either by reading them as-is or by running a migrator on read.

**Why it matters.** When v1.1 changes a file format, v1.0's files don't break. The user opens 2200 after the upgrade and everything still works.

**Applies to.** Epic 2 (Identity files), Epic 5 (handoff format), Epic 8 (Brain notes, Brain index schema), Epic 9 (tool credentials), Epic 12 (Extension manifests).

**How to know you got it right.** Write a v0.1 file. Bump the schema to v0.2. The parser still reads the v0.1 file without error.

### 2. State on disk, not in memory

**Principle.** Any Agent state worth surviving a restart must be on disk before the operation that produced it completes. In-memory caches are allowed, but they are caches, not the source of truth.

**Why it matters.** Upgrade involves restarting the runtime (and every Agent process). Anything held only in memory is lost. The Brain pattern already enforces this for memory; the same discipline applies to task state, tool call results, conversation context.

**Applies to.** Epic 2 (runtime loop, task state), Epic 8 (Brain), Epic 9 (tool call results that other Agents may need).

**How to know you got it right.** Kill the runtime mid-task. Restart it. The task picks up where it was, no data lost.

### 3. Graceful Agent restart

**Principle.** The process supervisor is designed so any Agent can be restarted at any time. The Agent's first action on (re)start is to read its state from disk and resume. There is no hot-reload of Agent code; restart is the supported upgrade path.

**Why it matters.** Upgrade swaps the runtime binary. Existing Agent processes are killed and restarted on the new binary. If restart works cleanly, upgrade works cleanly.

**Applies to.** Epic 2 (supervisor and Agent process model).

**How to know you got it right.** SIGTERM an Agent process during a task. Supervisor restarts it. Agent reads its state and continues without any user-visible glitch beyond a brief Pulse pause.

### 4. Extension version compatibility declared in manifest

**Principle.** Every Extension and Skill manifest declares the runtime version range it supports. The runtime refuses to load incompatible Extensions and surfaces the incompatibility to the user with a clear path forward (update the Extension, downgrade the runtime, or disable the Extension).

**Why it matters.** When the runtime upgrades, Extensions written for the old version may break. Without this discipline, the user discovers it as a runtime crash. With it, the user sees "Email Triage Extension is compatible with 2200 v1.0; v1.1 needs an update from the author."

**Applies to.** Epic 11 (Skills ingestion), Epic 12 (Extensions framework).

**How to know you got it right.** Install an Extension declared compatible with v1.0 only. Upgrade the runtime to v1.1. The Extension is disabled with a clear notification, not crashed.

### 5. Credential indirection (SecretRef)

**Principle.** Every credential is referenced indirectly through a SecretRef abstraction (the same pattern OpenClaw uses). The credential lookup happens at use time. Tools and Extensions never hold the literal credential.

**Why it matters.** Upgrade should never touch the secrets store. SecretRef indirection means credentials survive upgrades automatically and can be rotated without changing Extension or tool configuration.

**Applies to.** Epic 9 (Tool system), Epic 12 (Extensions framework).

**How to know you got it right.** Rotate a credential. Tools that reference it via SecretRef pick up the new value on the next call without code changes or restarts.

### 6. Idempotent task handling

**Principle.** Any task interrupted mid-execution can be safely re-run from the start without producing duplicate side effects. Tasks declare their idempotency model: pure (always safe to retry), checkpointed (resumes from last checkpoint), or destructive (must not retry without user confirmation).

**Why it matters.** Upgrade can interrupt a task in flight. After restart, the task may resume from where it was, restart from the beginning, or pause for user input. The task's declared idempotency model determines which.

**Applies to.** Epic 2 (runtime loop), Epic 9 (tool call patterns), Epic 12 (Extensions that initiate tasks).

**How to know you got it right.** A "send email" task interrupted mid-send does not result in a duplicate email after restart. A "research a topic" task interrupted mid-research resumes from the last checkpoint.

### 7. Versioned internal APIs

**Principle.** Any internal API that crosses a version boundary (runtime ↔ Extensions, runtime ↔ UI, runtime ↔ CLI) is versioned and supports the previous version for at least one upgrade cycle. Breaking changes get a deprecation period.

**Why it matters.** When the runtime upgrades, the mobile app or web UI may not have updated yet. Same for installed Extensions. Cross-boundary APIs need to handle version mismatch gracefully.

**Applies to.** Epic 9 (tool API), Epic 12 (Extension API), Epic 15 (web app API), Epic 16 (mobile app API).

**How to know you got it right.** Run a v1.0 mobile app against a v1.1 runtime. Either everything works (backward compat) or the user sees a clear "please update your app" message, not a crash.

---

## What this convention is NOT

- **Not the upgrade mechanism itself.** That's the future Runtime Upgrade epic. This convention is what other epics must do so the upgrade epic has something to work with.
- **Not the user-facing upgrade UX.** Notification, approval, rollback UI all live in the upgrade epic.
- **Not a detailed migration spec.** Epic 5 owns migration. This convention assumes migration is real and applies its primitives to upgrade.
- **Not optional.** Every epic spec must include an "Upgrade-readiness" section that addresses each applicable discipline. No exceptions during initial drafting; deviations require a decision record.

---

## Cross-references

- Decision: [[2026-04-24-runtime-upgrade-shape]]
- Future epic: Runtime Upgrade (placement TBD during epic-map walkthrough)
- Architectural foundation: [[02-architecture]]
- Migration foundation: [[03-epic-map]] Epic 5
- Doc format: [[brain-format]]

---

## Format provenance

Authored by Hobby on 2026-04-24 as one of two artifacts locking the runtime-upgrade shape. The other is the decision record [[2026-04-24-runtime-upgrade-shape]]. Together they capture the call: discipline now via this convention, user-facing mechanism later via a dedicated epic.

This is v0.1. Disciplines may evolve as we hit real-world cases. Updates require a decision record per [[brain-format]].

---

*Convention authored 2026-04-24 by Hobby. Living doc.*
