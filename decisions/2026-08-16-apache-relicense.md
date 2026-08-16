---
title: Relicense to Apache 2.0 and release 2200 to the wind
type: decision
status: locked
date: 2026-08-16
tags: [decision, licensing, open-source, positioning, strategy]
linked_docs:
  - "[[license-posture]]"
  - "[[01-vision]]"
  - "[[03-epic-map]]"
canonical_path: wiki/decisions/2026-08-16-apache-relicense.md
---

# Relicense to Apache 2.0 and release 2200 to the wind

**Date:** 2026-08-16
**Status:** Locked (relicense PR #379 up, auto-merges on CI green)
**Decided by:** Doug

## Context

xAI launched Grok Bot on 2026-08-11: always-on cloud Bots on a persistent shared cloud computer, bundled into SuperGrok Heavy and Cursor subscription tiers. It is the same product category as 2200, built with the opposite architectural bets ... shared credentials across all Bots, no isolation between Bots (xAI's own docs: "Do not use separate Bots as a security boundary"), opaque cloud memory, single vendor, someone else's computer.

That launch clarified two things at once. First, the commercial lane for a solo-operated paid product in this category got much harder ... competing against a first-party product bundled into subscriptions people already pay for. Second, the sovereign counter-position got much sharper: runs on your hardware, with your models, and your Agents cannot read each other's logins.

Doug's call: 2200 is better served as a thing we built and released than a product we try to monetize. The operating thesis (profit target, monetization scope) is retired. The build continues ... the fleet is still the daily tool, the epic map still describes the direction ... but the output is a released open-source project, not a product.

## Decision

1. **Relicense from Elastic License v2 to the Apache License 2.0.** Apache over MIT for the explicit patent grant; effort was identical. The managed-service restriction the Elastic license existed to protect no longer protects anything worth restricting.
2. **Open the contribution model.** Contributions welcome, maintenance is best-effort, no roadmap promises, forking is encouraged. The CLA stays (it already grants the LLC sublicensable rights, so this relicense and any future one are clean).
3. **Announce it.** Doug posts; positioning is the sovereign counter-position to cloud-custodial agent platforms. Then leave it to the wind.

Relicense authority is unambiguous: all 391 commits are Doug plus dependabot dependency bumps, and `THIRD_PARTY_NOTICES.md` records zero code-lifts.

## Consequences

### What gets better

- The positioning is honest and simple: this exists, it is yours, run it.
- Apache 2.0 removes every adoption objection the Elastic license invited. No license flame threads eating the announcement.
- Zero pressure to ship for revenue. The Cray threshold and the David launch moment remain the milestones, on their own clock.
- The clean-and-absorbable design posture ([[project_acquisition_thesis_design_posture]] discipline) now serves operators and forkers instead of a hypothetical acquirer.

### What could get worse

- Proprietary licensing is foreclosed for published versions ... Apache 2.0 grants are irrevocable. (Support, sponsorship, or a hosted offering remain possible later; the license does not foreclose those.)
- Someone could host 2200 as a managed service tomorrow. Under this decision, that is fine ... it was the point of removing the restriction.
- Announcement attention raises the security-researcher profile of a runtime that holds credentials. The runbook gates the announcement on hygiene, below.

## Implementation guidance ... the release runbook

### Phase 1: License (done)

- [x] `LICENSE` replaced with canonical Apache-2.0 text
- [x] `NOTICE` updated with relicense provenance
- [x] `package.json` (root + `apps/web`) license fields → `Apache-2.0`
- [x] `README.md` badge, license section, file map; stale rows fixed
- [x] `AGENTS.md` license posture section (lift discipline unchanged; AGPL still incompatible)
- [x] `CONTRIBUTING.md` rewritten for the open model; stale semver line corrected to calver
- [x] `SECURITY.md` report address → dh@2200.ai
- [x] PR #379 opened, auto-merge queued behind CI
- [x] Wiki `conventions/license-posture.md` updated (this record is the required decision record)
- [ ] Cut a release after merge so the npm registry metadata shows Apache-2.0 (registry reads the latest published `package.json`); full-fleet restart after, per discipline

### Phase 2: Pre-announcement hygiene (gates the post)

- [ ] Dependency advisory triage: 66 advisories at time of writing (6 low / 35 moderate / 25 high), mostly transitive `hono` via the MCP SDK; bump, `pnpm verify:all`, release
- [ ] Security posture sweep: confirm nothing category-tracked is open before raising the repo's profile (Doug + Hobby, handled privately per the redaction discipline)
- [x] Secrets scan of the working tree: clean (the repo has been public since May, so history was already exposed; nothing found)
- [ ] Fresh-clone install test in Docker (Linux): shell installer path and npm path, bare `2200` first-run through Agent creation ... never on a live instance
- [ ] README cold-visitor pass: a stranger arriving from the post should get from clone to first Agent without the wiki (screenshots or a short GIF are nice-to-have, not gating)

### Phase 3: Positioning surfaces

- [x] GitHub repo housekeeping: Discussions enabled, topics set, description style fixed
- [ ] 2200.ai repositioned from product page to project page ... the Normals rewrite with the sharper foil (Hobby drafts, Doug voices, Simon deploys)
- [ ] Post drafts: one short post plus a longer form (Hobby drafts, Doug owns voice and venues)

### Phase 4: Announcement and after

- [ ] Doug posts
- [ ] Best-effort issue triage in the days after; no cadence commitments
- [ ] Leave it to the wind

## References

- Grok Bot launch coverage and xAI security docs (assessed 2026-08-16; the shared-computer / no-isolation posture is first-party documented)
- [[license-posture]] ... updated by this record
- Relicense PR: twentytwohundred/2200#379
- CLA: `CLA.md` in the runtime repo (grants sublicensable rights; covers relicensing)

## Format provenance

Standard decision-record format per `CONTRIBUTING.md`: Context, Decision, Consequences, Implementation guidance, References.
