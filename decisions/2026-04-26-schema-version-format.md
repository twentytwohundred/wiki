---
title: 'Decision: Schema version field format'
type: decision
status: locked
tags: [decision, schema, versioning, upgrade-readiness, conventions]
created: 2026-04-26
updated: 2026-04-26
linked_docs:
  - '[[upgrade-readiness]]'
  - '[[02-agent-runtime-minimum]]'
  - '[[2026-04-25-tool-baseline]]'
  - '[[2026-04-26-notification-file-format]]'
canonical_path: wiki/decisions/2026-04-26-schema-version-format.md
---

# Decision: Schema version field format

## Context

Per [[upgrade-readiness]] discipline 1 (schema versioning everywhere), every persisted artifact in 2200 carries a `schema_version` field that the parser reads on load and migrates as needed. The Epic 2 spec drafts and v1 implementations used `"0.1"` as a string for this field.

String-formatted versions sort lexicographically, not numerically. The first time we hit a tenth schema revision, `"0.10"` sorts before `"0.2"`. Migrator chains keyed by version need numeric comparison; with strings, the comparison silently produces the wrong answer. The bug surfaces months after the convention was set, when there is no clean fix without a coordinated rewrite.

Doug's review of Epic 2 surfaced this before any artifact shipped. Lock the convention now while the cost is one find-and-replace.

## Decision

**Every `schema_version` field is an integer.**

- v1 of any artifact: `schema_version: 1`
- Next breaking change: `schema_version: 2`
- And so on.

**No semver-style minor or patch versions.** Schemas have one of two kinds of changes: backwards-compatible additions (no version bump; readers tolerate unknown fields) or breaking changes (new integer version, migrator required). Patches do not exist for a schema; if a field shape changes meaningfully, that is a new version.

**Migrators are named `<from>-to-<to>.ts`** in `src/runtime/<artifact>/migrators/` (or analogous location). Examples:

- `migrators/1-to-2.ts`
- `migrators/2-to-3.ts`

Each migrator exports a pure function `(prev: PrevShape) => NextShape` plus the source and target version numbers. The loader for the artifact runs the chain on read; nothing writes the older shape after migration.

**The version is queryable as a number.** Sorting, comparing, and selecting "all records at version >= 2" works with `number` semantics, as opposed to the lexicographic ordering string fields would impose.

## Affected artifacts

Lock the integer convention across every persisted-state shape in the project. This includes (current and planned):

- Identity files (Epic 2)
- Supervisor state (`supervisor.json`, Epic 2)
- Plan / run / perm records (Epic 2 spec, future PR for the wrapping)
- Detector trip records (Epic 2 spec, future PR for the detectors)
- Notification files (Epic 2 spec; per [[2026-04-26-notification-file-format]])
- Brain notes when fully landed (Epic 8)
- Skill manifests (Epic 11)
- Extension manifests (Epic 12)
- Task records (Epic 6 / Epic 9 era)
- Any future on-disk shape, without exception.

The Epic 2 spec gets updated alongside this decision so the convention is reflected in the canonical text.

## Consequences

### What gets better

1. **Numeric ordering works.** `1 < 2 < 10` instead of `"0.10" < "0.2" < "1"`. Migrator chains, queries, and comparators all behave the way humans expect.
2. **One concept per field.** Integer = breaking-change generation. No semver mental model to maintain. No "is this a patch or a minor?" question.
3. **Migrator names are unambiguous.** `1-to-2.ts` cannot be confused with `1.0.0-to-1.0.1.ts` or `1.0.x-to-1.1.x.ts`.
4. **Backwards-compatible additions stay free.** Adding an optional field does not bump the version. Readers tolerate unknown fields by spec; new fields land in the existing version. Only when removing or reshaping does the version increment.
5. **Less surface area in tooling.** Helpers that read or compare versions accept numbers, not parser-required strings.

### What could get worse

1. **No place to encode "draft" vs. "stable".** With strings we could write `"1.0-rc1"`. With integers we cannot. Acceptable: schema versions are an internal contract, not a release-marketing surface. Pre-stable schemas live behind feature flags, not in the version field.
2. **Adopting after-the-fact would be expensive.** That is exactly the cost we are paying now (small, one-find-and-replace) to avoid paying it later (coordinated rewrite). The window to adopt this convention cheaply is now; the decision is locked at this point so no future artifact lands with a string version.

## Implementation guidance

### Spec text

Every Epic spec, decision record, and convention document that shows a schema example uses an integer for `schema_version`. The Epic 2 spec gets updated alongside this decision; later epics author against the integer convention from the start.

### Code

- Zod schemas use `z.literal(N)` (e.g., `z.literal(1)`).
- Migrator modules go under `src/runtime/<artifact>/migrators/<from>-to-<to>.ts`.
- Loaders run the migrator chain on read and never persist an older shape.
- Tests assert integer values for `schema_version` everywhere.

### YAML frontmatter

```yaml
---
schema_version: 1
agent: hobby
...
---
```

Not `schema_version: "1"`, not `schema_version: 1.0`. The integer literal.

## License posture

Convention only. No code lift.

## References

- [[upgrade-readiness]] discipline 1
- [[02-agent-runtime-minimum]] (gets updated alongside this decision)
- [[2026-04-25-tool-baseline]] (plan/run/perm record schemas use integer `schema_version`)
- [[2026-04-26-notification-file-format]] (notification record uses integer `schema_version`)

## Format provenance

Decision recorded by Hobby on 2026-04-26 in response to Doug's Epic 2 review. The string-version trap was caught before any artifact shipped to disk; locking integers now is a one-edit fix versus a coordinated rewrite later.

---

*Decision recorded by Hobby and Doug, 2026-04-26.*
