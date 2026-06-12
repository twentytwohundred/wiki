---
title: "2200 release plan ... path to v1 and first users"
type: strategy
status: accepted
tags: [strategy, release, launch, v1, dogfooding, website, feedback-loop]
created: 2026-06-12
updated: 2026-06-12
canonical_path: wiki/strategy/release-plan.md
linked_docs:
  - "[[2200-operating-thesis]]"
  - "[[03-epic-map]]"
  - "[[2026-06-12-calver-versioning]]"
---

# 2200 release plan ... path to v1 and first users

**v0.2 · 2026-06-12 · Doug accepted the phases same-day and made the versioning call: calendar versioning (`YYYY.M.D`) starting with `2026.6.12`, the first published release ([[2026-06-12-calver-versioning]]). v0.2 adds the website workstream and Phase 5 (the feedback flywheel). Execution began immediately; Phase 0 is in flight.**

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

1. **Clear the PR queue.** #265 (CLI sources `runtime.env` on every invocation ... a real bug fix, open since 06-03), then the dependabot pair (#266, #253). *(Done 2026-06-12.)*
2. **Roll `[Unreleased]` into `2026.6.12`** under the new calendar-versioning scheme ([[2026-06-12-calver-versioning]]). Everything since the unpublished `0.1.0` section (Grok-First arc, connector Phases 1+2, embassy/shelf) goes into this first cut. *(PR #267.)*
3. **Tag `v2026.6.12`, run the release workflow for real.** `NPM_TOKEN` is not yet configured (named unblock: Doug creates the npm account/org and adds the automation token as a repo secret); the workflow creates the GitHub Release and skips npm with a warning, then gets re-run to publish once the token lands.
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

## Phase 5 ... the feedback flywheel (added v0.2)

Once strangers are running 2200, the product improves on a loop that runs without the operator babysitting it. The end state Doug named: a 2200 instance where an Agent watches bug reports and fixes them autonomously overnight, with a usable morning report. This is also the ultimate dogfooding demo ... the product maintaining itself.

1. **Inbound surfaces.** GitHub issue templates (bug / feedback) that capture version, OS, and `2200 doctor` output. A `2200 feedback` CLI verb and a web "Report a problem" button that pre-fill a GitHub issue with sanitized diagnostics ... operator sees exactly what's in the report before anything is sent; nothing ships automatically.
2. **Triage Agent.** A scheduled Agent on our own instance polls new issues, dedupes against known reports, labels, attempts reproduction, writes a triage note per issue, and files a morning summary notification. Runs on the same scheduler + budget-cap substrate every user has.
3. **Fixer loop.** For triage-confirmed bugs with a reproduction, a fixer Agent branches, writes the failing test first, fixes, and opens a PR. Hard gates, non-negotiable: fixes land as PRs only, behind full CI plus a human merge decision. No Agent pushes to `main`. Overnight work produces a morning review queue, not unsupervised releases.
4. **UX telemetry, opt-in and anonymous.** Install-funnel events (wizard step abandonment, doctor failures, first-Agent-spawned) feed a weekly auto-generated friction report that becomes backlog. Privacy-first defaults; what's collected is documented publicly; off by default until the operator opts in.
5. **Release cadence closes the loop.** Triage → fix → merge → next morning's CalVer cut via the proven pipeline.

**Exit criterion:** at least one user-reported bug goes report → triage → autonomous PR → human merge → released, end to end, and the morning report is something Doug actually reads with coffee instead of dreads.

## Workstream W ... 2200.ai for Normals (added v0.2, runs parallel to Phases 1-3)

The site failed the brother test: a smart non-engineer couldn't tell what 2200 is. That's a launch blocker in practice ... the homepage is the top of every funnel in Phase 4. Doug owns voice and final copy; Hobby drafts structure and language; Simon deploys.

**Positioning:** the easier way to run your own team of AI Agents ... measured concretely against OpenClaw and Hermes on the things Normals hit first: one-line install with a wizard that needs no API-key archaeology, a real web UI out of the box, budget caps so it can't run away with your wallet, and sign-in-with-SuperGrok instead of developer keys.

**Recommended structure, top to bottom:**
1. **Hero, one plain sentence** about the outcome (your own team of AI assistants, running on your computer, working while you sleep) ... no words like runtime, MCP, instance, self-hosted, OAuth above the fold.
2. **Demo video** ... the launch recording (David's birth, or a morning-report walkthrough).
3. **Three concrete scenarios** a Normal recognizes: it watches your inbox and drafts replies; it gives you a morning briefing; you talk to it from your car via Grok.
4. **"Works with your SuperGrok subscription"** tile (the Grok-First hook, in subscription language, not OAuth language).
5. **Honest comparison table** vs OpenClaw / Hermes ... ease-of-start, UI, cost controls, model freedom.
6. **Get started**: the install one-liner, demoted below the narrative, with "you'll need a computer that stays on" stated plainly.
7. Footer: docs, GitHub, security policy, pricing teaser (free self-host now, hosted later).

**Acceptance criterion:** the brother test, literally. A Normal reads the homepage cold and can answer "what is it, and why would I want it?" Re-run on the actual brother.

## Explicitly not on the path

Epic 4B (blocked on Garfield's relay), 7B inbox routing, 8D semantic search (parked), 11B/12B deep phases, Extension marketplace, multi-human instances. None gate v1.

---

## Doug's calls

1. **Versioning** ... ✅ decided 2026-06-12: calendar versioning, `2026.6.12` is the first published release ([[2026-06-12-calver-versioning]]).
2. **Epic 19 in v1 or immediately after.** Standing recommendation: immediately after ... launch v1 for self-hosters who can run a tunnel, pull 19 in next so the Grok story works for Normals. Adopted as the default unless Doug overrides.
3. **Managed-service start timing.** Standing recommendation: spec work during Phase 2 dogfooding, build after launch. It is the only phase that moves the revenue criterion. Adopted as the default unless Doug overrides.

**Doug's open unblock:** create the npm account/org for `@twentytwohundred` (use `dh@2200.ai` per convention) and add an automation token as the `NPM_TOKEN` repo secret. Until then, releases exist on GitHub but `install.sh` still 404s at the npm step.

Everything else is implementation order inside an approved direction, run decide-and-tell.

— Hobby, 2026-06-12
