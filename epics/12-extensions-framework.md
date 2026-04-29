---
title: "Epic 12: Extensions framework"
type: epic
status: phase-a-shipped
version: 1.0
tags: [epic, extensions, framework, marketplace, plugins]
created: 2026-04-29
updated: 2026-04-29
linked_docs:
  - "[[03-epic-map]]"
  - "[[02-architecture]]"
  - "[[11-skills-ingestion]]"
  - "[[13-voice-extension]]"
canonical_path: wiki/epics/12-extensions-framework.md
---

# Epic 12: Extensions framework

Extensions are how 2200 grows after launch. Skills (Epic 11) make Agents better at discrete tasks. Extensions make Agents better at sustained behaviors with state, schedules, multi-Agent coordination, UI surface, and tools.

The framework also serves as the foundation for the eventual marketplace. The marketplace (browsing, installing, reviewing, paid Extensions) is post-v1; the framework needs to ship long before that.

## What an Extension is

A packaged unit with:

- **Identity.** Name, version, author, description, permissions declaration.
- **State.** Persistent data across invocations (stored in the instance's database or the shared Brain).
- **Schedule.** Optional cron-like triggers independent of the Agent's main schedule.
- **Multi-Agent coordination.** Can declare that it needs multiple Agents working together.
- **UI surface.** Exposes controls and status in the 2200 web app and mobile app.
- **Tools.** Can bring its own tool integrations (OAuth flows, API clients) rather than relying on what the Agent already has.
- **Lifecycle hooks.** Install, uninstall, Agent-added, Agent-removed, update.
- **Permissions model.** Declares what it needs access to (tools, Brain, Roster, other Agents) and the user approves at install time.
- **Versioning.** Semver-like. Can be updated safely.

## Phasing

### Phase A — manifest + registry substrate ✅ shipped 2026-04-29 (PR [#101](https://github.com/twentytwohundred/2200/pull/101))

**Scope.** Define the manifest format and ship a read-only registry. No install verb, no lifecycle hook execution, no state storage. The minimum surface that lets us validate the schema, scan the install root, and inspect what is installed.

**As shipped.**
- `src/runtime/extensions/types.ts`: `ExtensionManifestSchema` (Zod). Required fields: `schema_version` (literal `1`), `name` (slug), `version` (semver), `display_name`, `description`, `author`, `permissions[]`, `schedules[]`, `tools[]`, `hooks{install?, uninstall?, update?}`. Optional `homepage`. `validateManifest(value, path)` wraps `ZodError` in `ExtensionManifestError` with file-path context.
- `src/runtime/extensions/registry.ts`: `listExtensions`, `readExtension`, `extensionExists`, `extensionsHome`. Tolerates missing root, dot-prefixed entries, name-vs-dir mismatch, malformed manifests.
- `2200 extension list / show <name>` ... read-only inspection.
- 12 tests covering schema validation, registry scan, malformed-tolerance, name-vs-dir mismatch.

**Permission categories** are closed at v1: `tools` / `brain.read` / `brain.write` / `notifications` / `schedule` / `pub.read` / `pub.send` / `network` / `fs.scratch`. Extensions cannot invent new categories without a runtime change.

**Done when.** A manifest dropped at `<home>/extensions/<name>/manifest.json` is parsed, listed, and inspectable via the CLI. A malformed manifest does not break the listing.

### Phase B — install / uninstall / lifecycle execution

**Scope.** Wire the install verb (with permissions prompt at install time), execute lifecycle hooks, scope state storage per Extension, integrate the schedule entries with the Epic 6 scheduler, and register declared tools through Epic 9.

**Includes.**
- `2200 extension install <source>` ... source is a directory path, a github repo URL, or an npm-style identifier. Copies into `<home>/extensions/<name>/`, validates the manifest, prompts for each permission, runs the `install` hook (with the permissions resolved as env vars), registers schedules + tools.
- `2200 extension uninstall <name>` ... runs the `uninstall` hook, unregisters schedules + tools, deletes state, removes the directory.
- `2200 extension update <name>` ... compares manifest versions, runs the `update` hook (with `from_version` + `to_version` env), prompts for any newly-requested permissions.
- Per-Extension state at `<home>/state/extensions/<name>/state.json` (tiny key-value bag) plus a sandboxed `<home>/state/extensions/<name>/scratch/` directory if `fs.scratch` permission is granted.
- Hook execution: spawn the script as a child process with permissions-derived env vars and a 30-second timeout. Stdout/stderr capture goes to `<home>/state/extensions/<name>/install.log` (etc).
- Capability-restricted execution model + Node-level isolation per the prior-art-analysis recommendation. Architecturally load-bearing; do not hand-wave this.

**Depends on.** Phase A. Epic 6 (scheduler), Epic 9 (tool registry), Epic 7 (notifications for permission prompts when install runs without an interactive shell).

### Phase C — UI surface + version-aware migrations

**Scope.** The web app gets an Extensions section: list installed, browse marketplace (when ready), install, configure, uninstall. Each Extension can declare a UI surface (a JSON-described form, or eventually a custom React mount point) that the web app renders. Update mechanism includes per-version migrations (Extension authors ship a `migrators/<from>-to-<to>.ts` chain similar to the Identity migrator pattern).

**Depends on.** Phase B. Epic 15 Phase C (ops depth web).

### Phase D — marketplace

**Scope.** Public marketplace at `2200.ai/marketplace`. Browse, install, review, paid Extensions. 2200 takes a small platform cut on paid. Out of scope for v1; tracked separately.

## Operational notes

**Permission set is closed at v1.** No `permissions: ['custom-thing']`. New capabilities require a runtime change (manifest schema bump + runtime feature). This is deliberate: the install-time permission prompt only protects users if the categories are well-defined and finite.

**Skills are wrapped as minimal Extensions in Epic 11 Phase B.** Same install / uninstall / lifecycle. The Skill's `tools` field maps to the Extension's `tools` field; everything else is synthesized.

**Voice (Epic 13) is the first-party flagship Extension.** It ships alongside Phase B as the proof of the framework. If Voice cannot fit into the Extension shape, the framework is incomplete.

## Done when (epic-level)

- Phase A: shipped.
- Phase B: a developer can package an Extension, a user can `2200 extension install ./my-ext`, the user gets the permissions prompts, the install hook runs, schedules + tools register, and (later) `uninstall` removes everything cleanly.
- Phase C: the web app has an Extensions section that lets users install / configure / uninstall without touching the CLI. Version-aware migrations work on update.
- Phase D: the marketplace is browseable + installable from the web app.

## References

- Source: `src/runtime/extensions/{types,registry}.ts`
- CLI: `src/cli/main.ts` (search for "2200 extension")
- Companion epics: [[11-skills-ingestion]] (Skills as a special case of Extensions), [[13-voice-extension]] (the flagship Extension)
- Prior-art note: capability-restricted execution + Node-level isolation are architecturally load-bearing per the prior-art analysis section 2; do not hand-wave them in Phase B
