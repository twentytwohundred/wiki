---
title: "Epic 11: Skills ingestion"
type: epic
status: phase-a-shipped
version: 1.0
tags: [epic, skills, ingestion, ecosystem, extensions]
created: 2026-04-29
updated: 2026-04-29
linked_docs:
  - "[[03-epic-map]]"
  - "[[12-extensions-framework]]"
  - "[[2026-04-25-skills-first-class]]"
  - "[[2026-04-24-skill-compatibility-pipeline]]"
canonical_path: wiki/epics/11-skills-ingestion.md
---

# Epic 11: Skills ingestion

2200 reads `SKILL.md` files from the broader Skill ecosystem and makes them available to Agents. Day-one backward compatibility with thousands of Skills already written for the open ecosystem.

## What a Skill is

A markdown file with optional YAML frontmatter and a body. The frontmatter carries `name`, `description` (when to invoke), and optionally `tags` / `tools` / vendor-specific fields. The body is the instructions an Agent follows when the Skill is selected.

Format admits a permissive subset at v1; some files have just `name` + `description`, others have richer fields. Round-trip preservation of unknown fields keeps external Skill ecosystems compatible without forking.

## Phasing

### Phase A — parse + read-only registry ✅ shipped 2026-04-29 (PR [#102](https://github.com/twentytwohundred/2200/pull/102))

**Scope.** Drop a `SKILL.md` at `<home>/skills/<name>/SKILL.md` and the runtime sees it. No install verb yet. No AgentLoop integration. The minimum surface to validate the format and let users inspect what they have installed.

**As shipped.**
- `src/runtime/skills/types.ts`: `SkillFrontmatterSchema` (Zod) + `parseSkillContent` helper. Permissive: name (slug), description, optional tags, optional tools. Unknown frontmatter fields preserved as `extras`.
- `src/runtime/skills/registry.ts`: `listSkills`, `readSkill`, `skillsHome`. Tolerates missing root, dot-prefixed entries, name-vs-dir mismatch, malformed individual files.
- `2200 skill list / show <name>`. Phase A is read-only; install lands in Phase B.
- 9 tests covering valid + invalid mixes, name mismatch, extras passthrough, no-frontmatter rejection.

**Done when.** A user can drop a community SKILL.md into the canonical location, run `2200 skill list`, and see it parsed correctly. A malformed SKILL.md is flagged INVALID without breaking the listing.

### Phase B — wrap as Extensions + AgentLoop integration

**Scope.** Each parsed Skill is automatically wrapped as a minimal Extension via the Epic 12 framework, so `install / uninstall / update` flows unify across Skills and full Extensions. The AgentLoop can select a Skill at task-dispatch time when the task description matches the Skill's `description`.

**Includes.**
- Skill-as-Extension wrapper that materializes a synthetic Extension manifest under the hood. The wrapper inherits the Skill's tool dependencies.
- Selection logic in the AgentLoop: when picking the next action, the model can choose `invoke_skill <name>` alongside its tools.
- Permission resolution: a Skill that declares a tool the Agent does not have surfaces a "you need to connect X first" error rather than silently failing.
- Conflict detection: two Skills with the same name → error with a clear "rename one" message.
- `2200 skill install <path-or-url>` (downloads + writes), `2200 skill uninstall <name>` (removes the dir).
- Import from common Skill sources: GitHub repos, gists.

**Depends on.** Phase A. Epic 12 Phase B (install / uninstall / lifecycle hooks).

### Phase C — Skills-as-Extensions upgrade path

**Scope.** When a Skill grows past its declarative shape (needs state, scheduling, multi-Agent coordination, custom UI), the user can promote it to a full Extension via `2200 skill upgrade <name>`. The promotion writes a real Extension manifest based on the Skill's existing fields and gives the user a stub for the parts the Skill format does not capture (state schema, schedule entries, etc).

**Depends on.** Phase B. Epic 12 Phase C (UI surface).

## Operational notes

**SKILL.md format is the broader ecosystem's, not 2200-specific.** We tolerate unknown fields rather than dictating a strict schema. Round-trip extras through `parseSkillContent` so re-writing a Skill (e.g., during an upgrade-to-Extension step) preserves everything the original ecosystem uses.

**Slug invariant.** `frontmatter.name` must match the directory name. Rejected at parse time. The error message is explicit so users can rename one or the other.

**No live execution at v1.** Phase A is read-only. Drop, list, show, done. No supervisor calls into a Skill's body until Phase B wires the AgentLoop selection.

## Done when (epic-level)

- Phase A: shipped.
- Phase B: a user can `2200 skill install https://github.com/example/skill-foo` and within a few minutes their Agent picks up the Skill and selects it on a matching task.
- Phase C: a Skill that hits the limits of its declarative shape can be promoted into a full Extension without losing the original prose.

## References

- Decision: [[../decisions/2026-04-25-skills-first-class]] (Skill is a first-class object)
- Decision: [[../decisions/2026-04-24-skill-compatibility-pipeline]] (parse → validate → normalize → disclose → install)
- Companion epic: [[12-extensions-framework]]
- Source: `src/runtime/skills/{types,registry}.ts`
- CLI: `src/cli/main.ts` (search for "2200 skill")
