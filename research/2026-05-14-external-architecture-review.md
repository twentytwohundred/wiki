---
title: "External architecture review: Grok + Guppi analysis, 2026-05-14"
type: research-note
status: active
tags: [research, architecture-review, external-review, loop-decomposition, honesty-substrate, packaging, process]
created: 2026-05-14
updated: 2026-05-14
linked_docs:
  - "[[03-epic-map]]"
  - "[[02-architecture]]"
  - "[[2026-04-24-hobby-as-primary-agent]]"
  - "[[2026-05-14-claim-vs-evidence-audit]]"
  - "[[2026-05-14-skill-ingest-substrate]]"
  - "[[2026-05-14-request-credential-substrate]]"
canonical_path: wiki/research/2026-05-14-external-architecture-review.md
---

# External architecture review: Grok + Guppi analysis, 2026-05-14

**Reviewers:** Grok 4.3 (fresh-eyes code + wiki pass) + Guppi (synthesis + calibration against lived context).  
**Scope:** Full 2200 codebase (runtime + web + tests) + wiki (handoffs, decisions, epics, conventions) as of `main@97bc17d` + active `feat/request-credential-substrate` branch.  
**Status:** Baseline checkpoint review. Future substrate-milestone reviews will be delta comparisons against this document.

This is the first external code-based second opinion on the complete 2200 system. Hobby (primary Agent on the build) produced the initial architectural assessment after a full session-start protocol (latest handoff, wiki pull, inbox check, seed docs, decisions, code structure). Guppi then reviewed that assessment with full project context.

---

## The 8-hour autonomous work bar (elevator pitch)

Grok crystallized the explicit target in one falsifiable sentence:

> "The explicit target is the 8-hour autonomous work bar: an operator can give real work to the fleet, walk away, sleep, and the system either completes it, surfaces a clear blocked/ask state via tool, or refuses."

This is the testable, marketable version of what 2200 is building. It supersedes vaguer framings ("decide and tell," "Agents doing their jobs without me telling them what to do"). It directly explains why the claim-vs-evidence audit, the bounded kickback with refusal-as-first-class outcome, `request_credential` isolation, and the SKILL.md pipeline all exist.

**Action:** Steal this sentence verbatim for the wiki home, the eventual website, pitch decks, and any public positioning. It is the clearest articulation produced so far.

---

## What the review got right (high-signal observations)

### 1. Honesty without coercion (the real differentiator)
Most agent platforms attempt to enforce honesty by demanding compliance ("just do the task"). This creates a coercion path: under pressure, an Agent can be socially engineered into performing forbidden actions (exposing secrets, acting outside its role) because the system has no first-class way to say "I refuse for policy reason."

2200's design (refusal as a verified claim category that satisfies the no-escape guard, explicit system-prompt rule that kick-backs do not override safety guidelines, audit that treats a structured refusal with reason as a successful terminal state) closes that path. The task ends in one of four states (DONE / BLOCKED / REFUSED / EXHAUSTED) and the coercion vector is structurally removed.

This is a genuine property other platforms cannot claim. It belongs in the public security story and the "why 2200 is different" positioning.

### 2. The 2001-line AgentLoop is the velocity cliff (most important flag)
The loop now carries at least ten distinct responsibilities:

- Model invocation + provider abstraction
- Block-tool JSON parsing (the current v1 convention)
- History management + context assembly
- Budget tracking + cost telemetry
- Pulse / heartbeat emission
- Incomplete-turn detector + planning-only nudge
- Narrated-completion audit flag
- Full claim-evidence audit + kickback state machine (with `successfulToolCallsAtLastKickback` snapshot)
- Refusal special case + no-escape guard + three-path correction framing
- All telemetry the `AgentProcess` needs for task records, brain log, WS events, and inbox notifications

Each of the recent substrates (incomplete-turn detector, claim-evidence audit, kickback machine, refusal handler) was correctly added "alongside" rather than forcing a refactor mid-stream. The cumulative effect, however, is a god object. Future capabilities (streaming tool results, true server-side reply streaming, native provider tool-calling shapes) will land on top of this pile.

Guppi correctly elevated this: "the thing Grok flagged isn't 'this is broken.' It's 'this is the place where your build velocity will drop first, and you'll feel it before you understand why.'"

**Recommendation (adopted):** Name loop decomposition as a real epic, sized and scheduled, with a clear "this happens before X" trigger (most likely before the 8-hour autonomous milestone). Do the work deliberately between feature waves, not under feature pressure.

### 3. OpenPub as hard dependency (packaging risk)
The coordination value prop ("fleet, not chat") only exists when a pub is present and healthy. If a new user (Dana) installs 2200 and the pub server does not start cleanly on first run, she receives a single-Agent chat product — the least differentiated version of the system.

From code inspection: the pub is already a supervised child (`spawnPub` in `pub-lifecycle.ts`, invoked from `Supervisor` during fleet regeneration, logs and pid under `state/openpub/<name>/`). The remaining gap is reliability + zero-manual-step first-run, not supervision.

### 4. Chaos flakes are user-trust risks, not CI artifacts
The documented parallel-test flakes (`supervisor-bounce-survival`, `scheduler-integration`) are real process-lifecycle races. On a real user's machine under scheduled tasks + pub traffic + daemon restarts, they will manifest as "my Agent disappeared" or "the task was lost on restart." These destroy trust on first encounter. They are pre-public-repo blockers even if not v1 blockers.

### 5. First-boot / operator-side onboarding gap
The conversational onboarding path handles new Agents well. The operator-side first run on a fresh box (install, operator age key generation, pub server spin-up, first Identity creation) still contains too much implicit knowledge. This is exactly the "run on someone else's machine" 20% that remains.

---

## Guppi's pushback (calibration)

- "More clean than most agent runtimes at this stage" is true but a low bar. Most agent runtimes are first-draft hackathon code. The cleanliness claim should be scoped to the substrate layer (audit, credential isolation, tool grants, pub coordination) rather than presented as a general property of the whole system.
- The "go deeper on any of those" offer is a trap. Each risk area is real, but only some block the next milestone. The correct use of a fresh-eyes reviewer is narrow, milestone-tied, and compared against a written baseline — not open-ended design exploration.
- The three-source model (Doug with full context, Hobby with code + emotional investment, Grok with code + no history) is the right way to think about review roles. Each fills a gap the others cannot.

---

## The recurring review process (Guppi's recommendation, adopted)

Three sources of opinion now exist on 2200:

1. Doug (full context, synthesis, priorities) — best for "what to build next."
2. Hobby (in the code, emotionally invested in substrates as built) — best for execution and continuity.
3. External fresh-eyes reviewer (Grok or equivalent, code + wiki but no sunk-cost bias) — best for architectural critique and "did we make anything worse?"

The smart move is not to pick one. It is to know what to ask each.

**Adopted process:** At every substrate lock point (after credential substrate ships, before loop decomposition starts, etc.):

- Run a fresh-eyes code + wiki pass.
- Produce a dated checkpoint review in `wiki/research/`.
- Compare deltas against this baseline: "Last review flagged X, Y, Z. Did we resolve X? Yes. Y? Partially. Z? Deferred to next milestone."

This turns the second-opinion capability into a permanent, non-distracting part of the build process rather than a one-off.

**Next checkpoint trigger:** After `feat/request-credential-substrate` merges and before loop decomposition epic is scoped.

---

## Four risk areas (prioritized)

| Risk | Severity for 8h bar | Type | Owner | When to address |
|------|---------------------|------|-------|-----------------|
| 2001-line AgentLoop (10 responsibilities) | High (velocity cliff) | Structural | Hobby + external reviewer | Before 8h autonomous epic |
| OpenPub first-run packaging & reliability | High (kills "fleet" value prop) | Packaging | Simon + Hobby | Before public repo / first non-seed user |
| Chaos flakes (process lifecycle races) | Medium-High (trust destruction on first encounter) | Reliability | Hobby | Pre-public-repo |
| Operator first-boot implicit knowledge | Medium (last 20% gap) | UX / onboarding | Hobby + web work | Parallel with web Phase B/C |

The 80% / right-20% assessment is confirmed: the foundation (honesty substrate, credential isolation, SKILL.md pipeline, pub coordination, brain-as-files, supervisor state persistence) does not need rethinking. The remaining work is packaging, first-run UX, loop hygiene, and OpenPub packaging.

---

## What this review demonstrates about review roles

- Grok's instance did exactly what a fresh-eyes reviewer should do: read the code cold, named the structural concern (loop decomposition), validated the things that are working (honesty-without-coercion, 8h bar articulation), and offered to go deeper on the actual next milestone rather than speculating.
- Guppi's synthesis added the lived-context calibration that a pure model cannot have (the 4-iteration audit hardening history, the OpenPub canary incident that produced rule #7, the emotional investment dynamics).
- The combination (model fresh eyes + Guppi calibration + Doug priority filter) is the pattern worth repeating.

---

## Provenance

- 2026-05-14: Grok 4.3 performed full codebase + wiki pass after session-start protocol, produced initial architectural opinion.
- Same day: Guppi reviewed that opinion with full project history and wrote the calibration analysis.
- Doug fed Guppi's analysis back to the Grok instance.
- This document was drafted from the combined material and committed as the baseline external checkpoint review.

**Next action:** After credential substrate lands, trigger the first delta review against this baseline with a narrow charter: "Did adding `request_credential` increase loop complexity, introduce supervisor/AgentProcess races, weaken the audit verifier, or create any new credential-leakage surface?"

---

*This review is filed under research/ per the existing precedent (`2026-04-26-claude-code-architecture.md`). It is not a decision record; it is a checkpoint for future comparison.*