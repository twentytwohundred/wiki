---
title: "Calendar versioning from the first published release"
type: decision
status: locked
tags: [decision, release, versioning, npm]
created: 2026-06-12
canonical_path: wiki/decisions/2026-06-12-calver-versioning.md
---

# Calendar versioning from the first published release

**Decision (Doug, 2026-06-12):** 2200 versions are calendar dates, not semver counters, starting with the first version ever published: `2026.6.12`.

**v2 (same day):** Doug called for room to go finer than one-per-day ... the literal ask was `2026.6.12.1234`. npm hard-rejects four-segment versions (semver is exactly three numeric slots), so the extended shape packs the same information into three: **`YYYY.MDD.HHMM`**, e.g. `2026.612.1234` = 2026, June 12, cut at 12:34 UTC. Adopted from the first npm publish so the registry history carries one scheme end to end.

## Shape (extended, from first npm publish)

- **Major = `YYYY`.** The year.
- **Minor = `M*100 + DD`** ... month and day packed: June 12 → `612`, November 2 → `1102`, January 5 → `105`. Monotonic within a year, unambiguous to read back (last two digits are the day).
- **Patch = UTC time of the cut as `H*100 + MM`** ... 12:34 → `1234`, 09:05 → `905`, 00:05 → `5`. Stateless (no counter to look up), self-describing, and two cuts in the same minute don't happen in practice.
- **No leading zeros anywhere** ... semver rejects them, which is why `2026.06.12` and `0905` are invalid forms.
- Git tags keep the `v` prefix (`v2026.612.1234`); the release workflow's `v*.*.*` pattern and version-match check accept this unchanged.
- Sorting holds everywhere semver compares: within a day by time, across days/months by the packed minor, across years by major. The GitHub-only `v2026.6.12` release also sorts below every extended-form version (`6 < 612`).

## History of the shape

- **`YYYY.M.D`** (`2026.6.12`) was the v1 shape, used for the first-ever release ... GitHub-only, since `NPM_TOKEN` wasn't configured yet. That release stays as-is.
- **`YYYY.MDD.HHMM`** applies from the first version that reaches npm, and everything after.

## Why

- Operators can read at a glance how far behind they are ... "I'm on 2026.6.12 and it's August" needs no changelog archaeology. This matters more than API-compat signaling for a product whose users run `2200 update` rather than pin ranges.
- It keeps versioning tight during the dogfooding phase, where releases should be frequent and boring.
- Semver's compat semantics were noise here: the runtime's real compatibility contracts (Identity schema_version, wire protocol) are versioned independently inside the codebase.

## History

- `0.1.0` (CHANGELOG section dated 2026-05-20) was the first installable cut but was never tagged or published anywhere. It remains in the CHANGELOG as history.
- `2026.6.12` is the first version to reach the npm registry and GitHub Releases.

## Trade-off accepted

Semver ranges (`^`/`~`) become meaningless for downstream consumers. Accepted: 2200 is an application installed via `install.sh` / `2200 update`, not a library dependency. If a library surface ever ships separately (provider-plugin SDK, Epic 10), that package gets its own semver.
