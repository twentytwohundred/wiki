---
title: 'Decision: Epic 2 Toolchain Pick'
type: decision
status: locked
tags: [decision, toolchain, build, lint, test, format, package-manager, epic-2]
created: 2026-04-26
updated: 2026-04-26
linked_docs:
  - '[[02-agent-runtime-minimum]]'
  - '[[03-epic-map]]'
  - '[[feedback_track_licensing]]'
canonical_path: wiki/decisions/2026-04-26-toolchain-pick.md
---

# Decision: Epic 2 Toolchain Pick

## Context

Per [[02-agent-runtime-minimum]] (Epic 2 spec), build-system selection and other tooling picks are explicit "architecture choices that are not pre-decided" — implementation calls during the build phase, with each pick documented as it's made. This record captures the toolchain locked at the start of Epic 2 build (PR `epic-2/project-tooling`).

The pre-decided constraints from CLAUDE.md and the Epic 2 spec:

- **Language: TypeScript** with strict mode and Node.js runtime.
- **Test runner: Vitest.**
- **Linting: ESLint + Prettier**, standard config.

Open within those constraints:

- Build system (tsup vs esbuild vs Bun-native vs SWC).
- Package manager (pnpm vs npm vs yarn vs bun).
- ESLint preset (recommended vs strict vs strict-type-checked).
- Specific tsconfig strictness flags.

## Decision

**Toolchain locked for Epic 2:**

| Concern | Pick | Why |
|---|---|---|
| Language | **TypeScript 5.7+** | Pre-decided. |
| Build system | **tsup 8.x** | Thin layer over esbuild with sensible CLI/library defaults. Handles `.d.ts` emission, ESM output, sourcemaps, tree-shaking. Less bespoke build script than raw esbuild; more pragmatic than Bun-native given ecosystem maturity in 2026. |
| Test runner | **Vitest 2.x** | Pre-decided. Fast, ESM-native, jest-compatible API, built-in v8 coverage. |
| Lint | **ESLint 9.x + typescript-eslint 8.x** flat config with `strictTypeChecked` + `stylisticTypeChecked` recommended sets. Type-aware rules enabled via `parserOptions.projectService`. | Strict-type-checked catches a real class of bugs (unsafe assignments, floating promises, misuse of `any`) at lint time. Worth the extra cycles. Flat config is the modern way; legacy `.eslintrc` is deprecated. |
| Format | **Prettier 3.x** | Pre-decided. Repo style: no semicolons, single quotes, trailing commas, 100-char width, LF line endings. |
| Package manager | **pnpm 9.x** | Stricter dependency hoisting (catches phantom deps), faster than npm/yarn at scale, content-addressable store reduces disk usage across multiple projects. Aligned with `feedback_track_licensing` reference to `pnpm license-checker`. |
| Node runtime | **Node 22+** (LTS), pinned in `.nvmrc` | Current LTS at the start of build. Matches CI. |

**Other locked-in flags worth recording:**

- **`tsconfig`:** strict everything (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`). `verbatimModuleSyntax` to keep import/export semantics explicit. `moduleResolution: Bundler` because tsup handles bundling.
- **`module: ESNext` + `type: module`** in package.json. ESM-only. No CommonJS interop except via `esModuleInterop: true`.
- **CI script** named `verify` (not `ci`, which is reserved by pnpm). Runs typecheck → lint → format check → test → build, in that order. The same chain runs in `.github/workflows/ci.yml`.

## Consequences

### What gets better

1. **Strict + type-aware ESLint catches real bugs at lint time.** Floating promises, unsafe assignments, no-explicit-any, no-non-null-assertion. The strict-type-checked preset is opinionated; that's the point.
2. **Tsup hides build complexity.** No bespoke esbuild config to maintain; tsup's defaults are good for a CLI + library, and overrides are minimal in `tsup.config.ts`.
3. **pnpm's strict hoisting** prevents the "works on my box" failure mode where code accidentally depends on a transitive dep that isn't declared.
4. **Single source of truth for the toolchain.** This record + `package.json` + the config files are consistent; CI runs the same `verify` chain humans run.
5. **Type-aware lint scales well.** The `projectService: true` parser config means ESLint auto-discovers tsconfigs for files; new files in the project work with no config change.

### What could get worse

1. **Type-aware ESLint is slower** than syntax-only lint. Lint time for the runtime kernel is still under a second; if it grows, we add per-file caching (ESLint's built-in) or split lint into fast-pass and slow-pass.
2. **tsup couples us to esbuild's output shape.** Esbuild's tree-shaking is less aggressive than rollup's. For a runtime kernel with no consumer-facing bundle-size constraints, this is fine. If the published-as-library use case grows, revisit.
3. **pnpm 9 minimum** means contributors with older pnpm get an `ERR_PNPM_UNSUPPORTED_ENGINE` error. Mitigated by `packageManager` field in `package.json` (corepack-aware) and the `engines` field. Cost is one-time setup friction.
4. **Strict tsconfig flags** (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) catch real bugs but produce false positives in some code patterns. Acceptable cost; we will write the code that satisfies the strict flags rather than relax them.
5. **Type-checked lint requires `tsconfig.json` to include all linted files.** Files outside the project graph (config files at root) get the `disableTypeChecked` overlay applied per-pattern in `eslint.config.js`. Pattern is documented in the config; extend as needed.

## Implementation guidance

### Adding a new dependency

- Always with a documented purpose. Run `pnpm add` and ensure it lands in the right section (`dependencies` for runtime, `devDependencies` for build/test/lint tooling).
- License-check before merging: `pnpm licenses list` summary in the PR description. Per [[feedback_track_licensing]], any non-MIT/Apache/BSD license needs explicit review.

### Adding a new file outside `src/` and `tests/`

If it should be type-checked, add to `tsconfig.json`'s `include`. If it's a config file or one-off script that doesn't need type-aware lint, add it to the `disableTypeChecked` overlay in `eslint.config.js`.

### Adding a new lint rule

If a rule lands in `strictTypeChecked` or `stylisticTypeChecked` upstream and we want it disabled, add an explicit override in `eslint.config.js` with a comment explaining why. Don't disable rules silently.

### Bumping major versions

Major bumps for any toolchain pick (TypeScript 5 → 6, ESLint 9 → 10, etc.) get a brief decision record describing what changed and why. Minor and patch versions can be bumped in regular dependency-update PRs without a decision record.

## License posture

All toolchain picks are MIT or Apache-2.0:

- TypeScript: Apache-2.0
- tsup: MIT
- esbuild (transitive): MIT
- Vitest: MIT
- ESLint: MIT
- typescript-eslint: BSD-2-Clause + MIT (per package)
- Prettier: MIT
- pnpm: MIT

All compatible with 2200's Elastic License v2 distribution per [[feedback_track_licensing]]. Standard package-licensing discipline applies.

## References

- Epic 2 spec: [[02-agent-runtime-minimum]] (the "architecture choices that are not pre-decided" section flagged this work)
- Standing licensing rule: [[feedback_track_licensing]]
- Build-phase decide-and-tell: [[feedback_decide_and_tell_in_build_phase]]
- PR landing this toolchain: `epic-2/project-tooling` (PR #1 on `twentytwohundred/2200`)

## Format provenance

Decision recorded by Hobby on 2026-04-26 at the start of Epic 2 build. The pick was a build-time call per [[feedback_decide_and_tell_in_build_phase]]; this record is the after-the-fact documentation that future contributors and future-Hobby can read to understand the locked toolchain.

---

*Decision recorded by Hobby, 2026-04-26.*
