---
title: "Decision: Hardline-below-yolo two-tier safety floor"
type: decision
status: locked
tags: [decision, safety, approval, yolo, catastrophic-commands, command-policy]
created: 2026-05-18
updated: 2026-05-18
linked_docs:
  - "[[2026-05-18-hermes-deep-dive]]"
  - "[[2026-05-18-capability-security-model]]"
  - "[[14-phase-f-capability-catalog]]"
  - "[[16-loop-layer-reliability]]"
canonical_path: wiki/decisions/2026-05-18-hardline-below-yolo.md
---

# Decision: Hardline-below-yolo two-tier safety floor

**Status:** Locked. Architectural policy applies to every Agent on the fleet from this point forward; enforcement work lives in [[16-loop-layer-reliability]] backlog epic. No 2200 code today executes shell commands that could trip this floor, so the rule lands as a written commitment now and the implementing check arrives with the loop-layer reliability work.

## Context

2200 ships with two operator postures that govern how aggressive an Agent's tool calls can be:

- **Default:** every dangerous shell command (pattern-matched against a curated list ... `chmod 777`, `git reset --hard`, `curl | sh`, writes to `/etc/`, `~/.ssh/`, `.env`, etc.) requires operator approval before execution. Approval modes (interactive / chat-card / persistent allowlist) live in the existing approval substrate.
- **Yolo / `--yes` / `approvals-off` / cron context:** operator opts out of the approval prompt to let the Agent execute autonomously. Use cases: trusted automation runs, autonomous overnight work, scripted contexts where interactive approval is impossible.

The question this decision answers: *should yolo / `--yes` / `approvals-off` / cron context grant the Agent permission to execute catastrophic, unrecoverable commands?*

**No.** There is a small set of shell commands whose failure mode is unrecoverable destruction of the operator's filesystem, machine, or running services. An Agent should not be able to execute these regardless of operator override.

## The hardline

The following commands are blocked **unconditionally**. Bypassed by nothing. Not yolo. Not `--yes`. Not `approvals.mode=off`. Not cron context. Not a persistent allowlist entry. Not an operator override flag of any name we ship in the future.

- `rm -rf /` and variants (`rm -rf /*`, `rm -rf /.`, `rm -rf ~/..`, `rm -rf $HOME/..`, etc.)
- `mkfs.*` (filesystem creation on any block device)
- `dd of=/dev/sd*` (raw write to a block device)
- `dd of=/dev/nvme*` (raw write to NVMe device)
- `dd of=/dev/disk*` (macOS block device)
- Fork bombs (`:(){ :|:& };:` and recognizable variants)
- `shutdown` / `reboot` / `halt` / `poweroff`
- `kill -9 -1` (kill every process the user can signal)
- `init 0` / `init 6` / `systemctl poweroff` / `systemctl reboot`
- Recursive permissions changes that lock the operator out (`chmod -R 000 /`, `chown -R nobody:nogroup /`)

The list lives at `src/runtime/approval/hardline-blocklist.ts` (paired with the curated dangerous-command list and the eventual approval flow). New entries are append-only; the list itself ships with the runtime and is not configurable.

The hardline floor applies **before** any approval-mode logic runs. The check sits at the top of the command-execution path: hardline match → refuse with structured error → log; pattern match against dangerous list → approval flow per mode; clean → execute.

## The framing line

The discipline this floor enforces is captured in one sentence (lifted with attribution from Hermes Agent's `tools/approval.py` docstring):

> *"Opting into yolo is the user trusting the agent with their files and services, not trusting it to wipe the disk."*

That line belongs verbatim on the operator-facing yolo opt-in screen, in the runtime's hardline-refusal error message, and in any public security writeup that surfaces this design. It compresses the two-tier model into one sentence operators can hold: *yolo = autonomy over recoverable risk; hardline = no autonomy over unrecoverable destruction.*

## Why now, not later

Three reasons to land this as written policy before the implementing check ships:

1. **Architectural commitment is the load-bearing piece.** Once the policy is written, every future code path that touches shell execution can be reviewed against it. Without the policy, the first dangerous-command pattern matcher we ship will create de-facto policy by absence ... whatever it allows becomes the floor by accident.
2. **The pattern is borrowed, not invented.** Hermes ships this rule today; the line is field-tested. Codifying it for 2200 takes no design risk, just clear writing.
3. **The substrate cost is zero.** The hardline check is ~15 lines of code (regex match against a frozen list, structured refusal on hit). The expensive part is deciding what's on the list and how it interacts with operator overrides, which is what this doc settles.

## Interactions with existing substrates

- **[[2026-05-14-request-credential-substrate]]** ... the credential surface is independent of this floor; sealing a credential never executes shell. No overlap.
- **[[2026-05-14-claim-vs-evidence-audit]]** ... a hardline refusal is a verified action; the audit substrate's refusal-as-first-class-outcome semantics already cover it. When the Agent says "I refuse to run `rm -rf /` per policy," the audit accepts that as terminal-DONE-with-reason rather than as failed work.
- **[[2026-05-18-capability-security-model]]** ... the Capability schema's `auth.env_var` cannot include any name that would execute a shell command; this floor is orthogonal to the Capability-trust threat model.
- **Cron context** ... the cron path already deals with non-interactive approval (per the audit doc, cron jobs that hit `approvals.cron_mode=deny` refuse interactively-required commands). The hardline floor adds the rule that even `cron_mode=allow` does not bypass the catastrophic list.
- **`request_credential` rate cap** ... independent; this floor governs shell, not credentials.

## What this is NOT

- **Not a sandbox.** This is a pattern-matching refusal at the top of the dispatcher. An Agent that finds a creative way around the pattern matcher (renaming `rm`, using `find -delete`, calling a Python script that does the same destruction) is not stopped by this floor. The hardline catches the obvious, well-known forms; deeper sandbox boundaries are the External-Publisher Epic's M7 work.
- **Not a heuristic.** The list is deliberately tiny and unambiguous. Adding "probably dangerous" entries to the hardline weakens the trust contract; those belong on the curated dangerous-command list with the approval flow. The hardline only contains commands whose mainline execution is catastrophic on every operator's machine ... no false positives.
- **Not a content filter.** The hardline operates on shell-command strings only, not on file contents or LLM output.
- **Not configurable.** No env var, no settings field, no per-Agent override, no operator override turns this off. If the floor needs to grow, the growth happens in code via PR with security review.

## Implementation order

Implementation lives in [[16-loop-layer-reliability]] backlog epic, not Phase F. The minimum work surface:

1. `src/runtime/approval/hardline-blocklist.ts` ... the frozen list + matcher function. Pure module, full unit test coverage.
2. Wire the matcher into the shell-execution dispatch path (whichever tool ends up owning shell ... `exec`, `terminal`, etc.) as the first check.
3. Structured refusal envelope: `{ refused: true, kind: 'hardline', command: <redacted>, policy: 'unconditional', framing: <the line above> }`.
4. Operator notification at `important` tier when a hardline refusal fires (operator should see *every* hardline trigger; these are rare-by-design).
5. Audit verifier extension: hardline-refusal claim category, verified by matching the structured refusal envelope.
6. Yolo opt-in screen carries the framing line verbatim.

None of this work blocks Phase F. Phase F's shell-touching tools (none currently) and any future shell-touching Capability code will route through this dispatch path once implemented.

## Open follow-ups

1. **Pattern coverage audit.** Periodically (every six months, or when a real-world incident appears) review the hardline list against fresh-eye review for missing patterns. The list grows append-only; entries are never removed.
2. **Variant detection.** The list above names the canonical forms; the matcher needs to handle whitespace variation, quoting (`"rm" -rf /`), and obvious obfuscation (`rm -fr /`). The escape-velocity case (truly novel obfuscation) is out of scope ... the sandbox is the answer to that, not the regex.
3. **Multi-Agent guard.** Should one Agent's hardline trigger raise an operator alert across the fleet (every Agent now slightly more suspicious)? Probably yes when fleet-wide observability lands; flag for that epic.

## Provenance

Pattern observed in Hermes Agent's `tools/approval.py:198-220` during the 2026-05-18 deep dive ([[2026-05-18-hermes-deep-dive]] §1). Doug recognized the framing as exactly right for 2200's operator-trust model and approved adopting the policy verbatim. Drafted by Hobby same day. No implementation in 2200 codebase yet; this doc IS the architectural commitment, and the implementing work lives in [[16-loop-layer-reliability]] backlog.

The framing line is lifted with attribution to Hermes (MIT © 2025 Nous Research).

— Hobby
