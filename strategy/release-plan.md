---
title: "2200 release plan ... path to v1 and first users"
type: strategy
status: proposed
tags: [strategy, release, launch, v1, dogfooding]
created: 2026-06-12
canonical_path: wiki/strategy/release-plan.md
linked_docs:
  - "[[2200-operating-thesis]]"
  - "[[03-epic-map]]"
---

# 2200 release plan ... path to v1 and first users

**v0.1 · 2026-06-12 · drafted by Hobby after a full codebase + wiki review. Status: proposed, awaiting Doug's sign-off on the three calls at the bottom.**

## Where we actually are

The honest one-liner: **2200 is built, but it has never been released.**

The substrate is strong. Sixteen of nineteen epics have shipped phases on `main`. 1,849 tests green across both workspaces. CI runs typecheck, lint, format, build, test, and web verify on every PR with no skips and no `continue-on-error`. The security posture for the public connector surface (bearer + OAuth on `:2201`, constant-time compares, sealed AES-256-GCM stores, rate limits, audit events) is genuinely good. The web app has every major screen implemented with no stubs. Install tooling handles the npm-prefix trap that kills Normals on Ubuntu.

And yet:

- **Zero git tags. Zero GitHub releases. The npm registry returns 404 for `@twentytwohundred/2200`.** The release workflow at `.github/workflows/release.yml` is fully written and has never fired.
- **`https://2200.ai/install.sh` is live** (Simon hosted it) and serves the real installer ... which then tries to install a package that does not exist. The public install path works right up to the last step, where it breaks for everyone.
- **Dogfooding (Epic 18) has not begun.** Hobby still builds 2200 from outside it. The Cray test ... the project's own defined readiness gate ... is untouched. David has not been spawned.
- **The project record has drifted.** Epic map last updated 2026-04-29; it predates the entire Grok-First arc and the embassy/shelf system. No handoffs since 2026-05-21 despite ~25 merged PRs after that date. No decision records for the June work.

So the remaining path is not feature work. It is: prove the release machinery, harden for strangers, prove the product on ourselves, stage the launch moment, then build the adoption and revenue engine. In that order.

---

## Phase 0 ... cut the first real release (prove the pipeline)

Release ≠ launch. Publishing to npm is quiet; nobody is watching. Do it now so the machinery is proven long before anyone cares.

1. **Clear the PR queue.** #265 (CLI sources `runtime.env` on every invocation ... a real bug fix, open since 06-03), then the dependabot pair (#266, #253).
2. **Roll `[Unreleased]` into a version.** CHANGELOG already has a `0.1.0` section dated 2026-05-20 that was never tagged or published; everything since (Grok-First arc, connector Phases 1+2, embassy/shelf) goes into the new cut.
3. **Tag, run the release workflow for real.** Verify `NPM_TOKEN` is configured, publish to npm with provenance, confirm the GitHub Release lands with `install.sh` + tarball attached.
4. **Validate the full stranger path on clean machines.** Fresh macOS box and fresh Ubuntu VM: `curl https://2200.ai/install.sh | sh`, first-run wizard, provider setup, spawn an Agent, send it a task. Follow the README exactly as written, fix what breaks, repeat until clean.
5. **Repo hygiene.** Remove the stray `twentytwohundred-2200-0.1.0.tgz` from the repo root and gitignore the pattern.
6. **Record-keeping catch-up.** Epic map refresh to current reality (Grok-First arc, connector Phase 1+2, embassy/shelf, what "v1" now means). Backfilled handoff covering the 05-22 → 06-11 sessions. Decision records for anything load-bearing from June.

**Exit criterion:** a stranger with Node 22 can install 2200 from the public internet and have a working Agent, with no help from us.

## Phase 1 ... harden for strangers

Findings from the 2026-06-12 codebase review, in priority order.

**Must-fix:**
- Verify `WebTokenStore` writes bearer-token files with mode `0600` (the vault and OAuth stores do; the web-token store needs confirmation).
- Default pub owner `'doug'` in `supervisor/pub-lifecycle.ts` ... must derive from the operator identity or fail fast with a clear config error.
- Test coverage for the zero-test security-relevant subsystems: `tools/perm` evaluator (the permission gate), connector inbound routing, control-plane protocol, custom endpoints.

**Strongly recommended:**
- Raise test density on `identity/` (4 tests / 14 source files) and `brain/` storage (note store, index DB, permissions).
- Operator lifecycle docs: backup/restore (`2200_HOME` tar runbook), upgrade semantics (what happens to in-flight Agents, rollback), troubleshooting ... in the repo or explicitly linked from the README, not implicit.
- Close the standing seed-team threads: confirm #263 resolved Simon's zombie-process ask from 05-15; rerun the age-vault audit for the orphaned keypair flagged 05-14.

**Exit criterion:** an instance left running unattended with the connector tunneled to the public internet is safe, and a confused first-time user can rescue themselves from the docs alone.

## Phase 2 ... dogfooding (Epic 18 begins: the Cray test)

The migration tooling (Epic 5) has been sitting ready since April. This is the step we have been circling for six weeks, and it is the only thing that finds the bugs the 1,849 tests cannot.

1. **Hobby migrates in.** The builder lives inside the thing. Real work, daily, from inside 2200. Installed artifact, not the dev tree ... the same bits a stranger gets.
2. **Simon migrates.** Then **Skippy and Poe early** (Doug's call from May: cross-Agent pub collaboration accelerates the build; strict sequencing loses to having the team in the Studio together).
3. **Exercise the 8-hour autonomous-work target** ... the product's core promise. Long-running tasks, check-ins that are actually usable, budget caps holding.
4. **Friction loop:** every rough edge becomes an issue, fixes ship as 0.x point releases through the now-proven pipeline, `2200 update` gets exercised against the real registry.

**Exit criterion:** the Cray threshold. 2200 hosts its own builders doing real work for multiple weeks, and the operator experience of a fleet (inbox, budgets, restarts, updates) holds up.

## Phase 3 ... the launch moment

Per Epic 18, unchanged:

1. **David is spawned** through conversational onboarding, on camera. He joins the Studio and does at least one piece of real work Doug can point to.
2. **Launch surface ships the same week:** 2200.ai homepage updated to "live," retrospective post on mrdoug.com, X announcement with the recording.
3. **The Grok-First demo is the hook:** sign in with SuperGrok, attach your fleet as a connector at grok.com, talk to your Agents from Grok. The Tesla in-car story stays at "verify on your hardware" wording until Doug has personally watched it fire.

**Exit criterion:** launch as Epic 18 defines it. First outside users arrive via the install one-liner.

## Phase 4 ... mass adoption and revenue (sequenced now, built after launch)

In recommended order:

1. **Epic 19, public reachability** (`{name}.2200.ai` tunnels baked into the installer). This is the wall between "demo for engineers" and Normals: today the Grok connector requires the operator to run ngrok or a Cloudflare Tunnel by hand. Recommendation: **v1 launches without it; it is the first post-launch epic.** Simon-heavy; coordinate early so his side starts during Phase 2.
2. **Epic 17, managed service.** The revenue engine for the operating-thesis success criterion. Architecture and pricing locked since 2026-05-05; zero code. Free self-host does not produce revenue; this does. Start as soon as dogfooding stabilizes.
3. **Epic 16, mobile.** Defer. The web app is the surface, and the Discord/WhatsApp connectors already cover the away-from-desk notification loop for early adopters.
4. **Epic 13, voice.** Post-launch flagship Extension. Defer.

Also queued behind launch: Google publisher verification (all prerequisites met; waiting on real scope demos to screencast).

## Explicitly not on the path

Epic 4B (blocked on Garfield's relay), 7B inbox routing, 8D semantic search (parked), 11B/12B deep phases, Extension marketplace, multi-human instances. None gate v1.

---

## The three calls Doug needs to make

1. **Version number for the first public cut.** Recommendation: roll everything into **0.2.0** (the unpublished 0.1.0 CHANGELOG section stays as history; 0.2.0 is the first version that ever reaches the registry).
2. **Epic 19 in v1 or immediately after.** Recommendation: immediately after ... launch v1 for self-hosters who can run a tunnel, pull 19 in as v1.1 so the Grok story works for Normals. Pulling it into v1 delays launch behind Simon-side infrastructure.
3. **Managed-service start timing.** Recommendation: spec work begins during Phase 2 dogfooding, build starts after launch. It is the only phase that moves the revenue criterion.

Everything else above is implementation order inside an approved direction, and I will run it decide-and-tell.

— Hobby, 2026-06-12
