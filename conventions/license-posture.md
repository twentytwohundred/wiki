---
title: License Posture Convention
type: convention
status: active
tags: [convention, licensing, posture, third-party]
created: 2026-04-28
updated: 2026-04-28
linked_docs:
  - "[[brain-format]]"
  - "[[upgrade-readiness]]"
canonical_path: wiki/conventions/license-posture.md
---

# License Posture Convention

The standing rule for any decision that touches third-party code, third-party content, or 2200's own licensing surface. Pair every "lift from external" with license analysis. Always.

## Why this is a convention

License decisions are load-bearing in two directions:

1. **What we can and cannot embed.** Some upstream licenses (notably AGPL) impose viral obligations that would force us to relicense 2200. Embedding such code, even by accident, is a one-way door.
2. **What attribution we owe.** Permissive licenses (MIT, BSD, Apache 2.0) allow embedding under EL v2 but require copyright-notice preservation on copied portions. Skipping attribution is a license violation.

Both failure modes are silent at the moment they happen and expensive when caught. The rule is meant to slow the hand at exactly the moment the temptation is "just copy that helpful function over."

## The rule

> Pair every "lift from external project" with license analysis. Default to pattern-lift over code-lift. Document attribution for any code-lift. AGPL is incompatible for embedding.

### Two kinds of lifts

| Kind | What it is | Obligation |
|------|------------|------------|
| **Pattern lift** | An architectural idea reimplemented from understanding. Reading the upstream code, internalizing the shape, then writing fresh code that does a similar thing. | None. Architectural patterns are not copyrightable. Default to this. |
| **Code lift** | Verbatim or near-verbatim reuse. Copy-paste with light edits, or copy with renames. | Preserve the source's copyright notice for the lifted portion. Document the lift in `THIRD_PARTY_NOTICES.md` of the consuming repo. |

### License compatibility under EL v2

- **MIT, BSD-3-Clause, Apache 2.0, ISC, Unlicense:** compatible for code-lift with notice preservation. Compatible for pattern-lift without obligation.
- **MPL 2.0:** compatible if lifted files keep their MPL header. Pattern lift is fine.
- **LGPL:** compatible only if dynamically linked. Static linking or vendoring triggers source-disclosure obligations. Avoid.
- **GPL (any version):** incompatible for embedding. Avoid.
- **AGPL (any version):** incompatible for embedding. Avoid for any code that would ship as part of 2200, including dependencies. Pattern lift is technically permissible but high-risk because anything resembling the upstream invites the question. Strongly prefer rejecting AGPL'd candidates outright.
- **Unlicensed / unverified:** treat as incompatible until verified. "I think it's MIT" is not verification.

### What to do when in doubt

1. Check the upstream `LICENSE` or `LICENCE` file. Read the SPDX identifier and the actual text.
2. If multiple licenses appear (LICENSE plus per-file headers), the per-file header takes precedence for that file.
3. If you cannot verify, do not lift. Reimplement from understanding instead.
4. If the lift would bring AGPL'd code in directly or transitively, reject the path entirely.

## How to apply

When proposing or making a code-lift:

1. **Survey first.** Identify the source repo, its license, and the specific files or functions you intend to lift. Note these in the PR description or decision record.
2. **Prefer pattern-lift.** If you can describe the upstream's idea in your own words and write fresh code, do that. Note "pattern lift from <source>, MIT" in the relevant decision record's References section.
3. **For verbatim lifts:** preserve the upstream copyright notice in the lifted file (or in `THIRD_PARTY_NOTICES.md` if file-level isn't appropriate). Add an entry to `THIRD_PARTY_NOTICES.md` with source URL, license, files, original copyright, and a brief note on what was changed.
4. **Document in the decision record.** Decisions that involve any third-party material should reference this convention and state the lift kind (pattern or code) and the upstream license.

## Surveyed sources for 2200 (running list)

- **OpenClaw** (MIT, Copyright (c) 2025 Peter Steinberger): pattern source for the supervisor model, plan/run/perm wrapping discipline, Skills runtime model, baseline tool shape, profile/state-dir affordance, BOOT.md per-Agent ritual. Pattern-lifted; no code copied.
- **EdgeClaw, OCMT, OpenAEON, AnyClaw, mimiclaw**: licenses not personally verified... verify before any code lift.
- **Logseq, Trilium, Joplin**: AGPL viral. Rejected for any embedding path.
- **Cytoscape.js, react-markdown, remark-wiki-link, SilverBullet, Quartz, Foam**: MIT. Compatible for composition under EL v2 if ever pulled.
- **Tavily and Brave Search APIs**: API-only integrations. No code copy from provider SDKs; no notice obligation. Provider names recorded in `THIRD_PARTY_NOTICES.md` per discipline.

## Cross-references

- The 2200 runtime repo's [`AGENTS.md`](https://github.com/twentytwohundred/2200/blob/main/AGENTS.md) summarizes this rule for build Agents.
- `THIRD_PARTY_NOTICES.md` in each repo holds the per-repo attribution log.
- Standard SPDX identifier list: https://spdx.org/licenses/

---

*Convention authored 2026-04-28. Promoted from a personal-memory rule that several Hobby sessions had been informally citing as `[[feedback_track_licensing]]`. Updates require a decision record.*
