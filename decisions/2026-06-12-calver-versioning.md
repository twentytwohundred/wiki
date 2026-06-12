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

## Shape

- `YYYY.M.D` ... the UTC date of the cut.
- **No leading zeros.** npm enforces semver syntax, and semver rejects leading zeros in numeric identifiers, so `2026.06.12` is invalid; the canonical form is `2026.6.12`. Same readability, valid everywhere.
- **At most one release per UTC day.** The date IS the version; there is no patch slot. A second cut in one day waits for the next UTC day (UTC rolls at 7pm Central, so in practice an evening emergency fix ships "tomorrow" within hours).
- Git tags keep the `v` prefix (`v2026.6.12`), which the existing release workflow's `v*.*.*` pattern and version-match check accept unchanged.

## Why

- Operators can read at a glance how far behind they are ... "I'm on 2026.6.12 and it's August" needs no changelog archaeology. This matters more than API-compat signaling for a product whose users run `2200 update` rather than pin ranges.
- It keeps versioning tight during the dogfooding phase, where releases should be frequent and boring.
- Semver's compat semantics were noise here: the runtime's real compatibility contracts (Identity schema_version, wire protocol) are versioned independently inside the codebase.

## History

- `0.1.0` (CHANGELOG section dated 2026-05-20) was the first installable cut but was never tagged or published anywhere. It remains in the CHANGELOG as history.
- `2026.6.12` is the first version to reach the npm registry and GitHub Releases.

## Trade-off accepted

Semver ranges (`^`/`~`) become meaningless for downstream consumers. Accepted: 2200 is an application installed via `install.sh` / `2200 update`, not a library dependency. If a library surface ever ships separately (provider-plugin SDK, Epic 10), that package gets its own semver.
