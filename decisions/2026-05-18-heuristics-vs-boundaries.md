---
title: "Decision: Heuristics vs boundaries (2200's public security posture)"
type: decision
status: locked
tags: [decision, security, positioning, public-story, trust-model]
created: 2026-05-18
updated: 2026-05-18
linked_docs:
  - "[[2026-05-18-hermes-deep-dive]]"
  - "[[2026-05-14-request-credential-substrate]]"
  - "[[2026-05-14-claim-vs-evidence-audit]]"
  - "[[2026-05-18-hardline-below-yolo]]"
  - "[[2026-05-18-capability-security-model]]"
canonical_path: wiki/decisions/2026-05-18-heuristics-vs-boundaries.md
---

# Decision: Heuristics vs boundaries (2200's public security posture)

**Status:** Locked. This is the spine of any public-facing security writing for 2200 ... website, pitch materials, integration partner conversations, and any RFP response. File before website drafts touch the security section.

## 1. The framing

Hermes Agent's `SECURITY.md` (lines 137-152, MIT © 2025 Nous Research) names something the agent-platform space has been quietly papering over:

> *"The only security boundary against an adversarial LLM is the operating system."*

Hermes goes on to call its in-process protections ... approval gates, output redaction, the Skills Guard scanner ... *"useful heuristics, not boundaries."* They mean it: vulnerability reports about heuristic bypass are explicitly out-of-scope for their security policy.

This is the most honest security framing in the agent-platform space. 2200 adopts it as our public posture.

The shift is from *"trust us, we have safety layers"* to *"here's what's a heuristic, here's what's a structural boundary unique to 2200, here's what only the OS provides."* The honest framing wins on substance because it survives skeptical scrutiny. The dishonest framing (overclaiming "sandbox" or "we redact everything") fails the first adversarial demo.

## 2. What's a heuristic in 2200

Useful. Lifts the floor. Not a boundary. An adversarial LLM with enough context can defeat any of them.

- **Skills Guard regex scanner** (planned, Epic 16 wave 1 item 6). Pattern-match for env-var exfil, `~/.ssh` reads, `base64 + env` combinations. Catches the obvious. Bypassed by a Capability author who reads the patterns and writes around them.
- **PII / secret redaction in logs and tool output.** 33-vendor prefix coverage (modeled on Hermes's pattern set). Catches `sk-...`, `ghp_...`, `AIza...`, JWTs, URL userinfo, DB connection-string passwords. Bypassed by any secret with no recognizable prefix or by an Agent emitting the secret in pieces.
- **Smart approvals via auxiliary LLM** (scoped, [[../research/2026-05-18-smart-approvals-scoping]]). Cheap LLM judges shell-command approval. Reduces operator approval fatigue. Bypassed by an adversarial Agent that successfully games the judge prompt.
- **Approval pattern matchers** for dangerous shell commands. 47-pattern curated list (`chmod 777`, `curl | sh`, writes to `/etc/`, `~/.ssh/`, `.env`). Catches naive cases. Bypassed by quoting variation or alternative spellings (`find -delete` instead of `rm`).
- **Capability description hardline** (Phase F §1, ≤60 chars / no marketing). Moderation rule, not security. Prevents catalog quality drift; not a defense.

These are real value. They aren't security guarantees.

## 3. What's structural in 2200

These are 2200's actual security boundaries. The differentiation surface. A correctly-implemented adversarial LLM cannot defeat them because they're enforced by pure code or by deterministic architectural rules, not by prompt-based deterrence.

- **Credential vault guarantee** ([[2026-05-14-request-credential-substrate]]). Operator paste flows browser → runtime → vault. The value never enters LLM context, tool args, tool results, transcripts, brain notes, or supervisor logs. The Agent gets back `{status, credential_name, set_at}` ... never the value. **Structural because the value's transit path bypasses the model side entirely.**
- **1:1-chat-only credential capture surface** (same doc, §"The bar" bullet 4). The `request_credential` tool refuses to dispatch from any surface except a 1:1 operator chat. Closes the Agent-to-Agent social-engineering vector by construction; no Agent on a fleet can prompt for a credential in a shared pub. **Structural because the surface check is a deterministic dispatcher refusal, not a prompt-level rule.**
- **Hardline-below-yolo two-tier safety floor** ([[2026-05-18-hardline-below-yolo]]). Catastrophic shell commands (`rm -rf /`, `mkfs`, `dd of=/dev/sd*`, fork bombs, shutdown/reboot, kill-all) blocked unconditionally regardless of operator override, yolo flag, approvals-off mode, or cron context. **Structural because the check sits at the top of the dispatch path and has no opt-out.**
- **Claim-vs-evidence audit substrate** ([[2026-05-14-claim-vs-evidence-audit]]). Every destructive task ends in one of four states (DONE / BLOCKED / REFUSED / EXHAUSTED). Narration is mechanically verified against tool-call evidence; unverified or contradicted narration kicks back. The refusal path is first-class, so the audit cannot be coerced via "claim done"-style prompting. **Structural for the loop's terminal-state validation** ... the LLM can still attempt false narration, but the loop will not finalize on it.
- **Capability publisher trust contract** (declared in Phase F §1; M3 enforcement ships in Epic 17 *External Capability Publishers*). Capabilities sealed against a `capability_id` cannot be read by other Capabilities at enforcement time. Currently a declared frontmatter field; will be a structural boundary when M3 ships.

## 4. What only the operating system provides

Be honest about this. 2200 does not claim to replicate these; we inherit them from the OS:

- **Process isolation.** Each Agent runs in its own OS process. The OS keeps Agent A's memory out of Agent B's address space.
- **Filesystem permissions.** Per-Agent home directories with `0600` credential files. The OS enforces who can read them.
- **Network policy.** Outbound firewall rules, egress filtering, DNS pinning. Only the OS (or a userland proxy running with OS privilege) can enforce these.
- **Subprocess sandbox.** When a Capability needs OS-level isolation beyond what 2200 provides, the answer is a sandbox the OS understands ... Docker, Modal, Daytona, SSH to a constrained box, or Singularity. Hermes ships seven such backends as a feature; 2200 doesn't need to compete on that surface because they're all OS primitives the operator can deploy with or without us.

## 5. Public positioning implications

When 2200 talks about security publicly, this doc is the spine. Specific guidance:

- **Don't pitch "we have a sandbox."** We don't. We have a credential vault, a 1:1-chat surface restriction, a hardline blocklist, and an audit substrate. None of those are sandboxes. Naming what we *do* have, accurately, is stronger than misnaming.
- **Don't pitch "we redact everything" as a security feature.** Redaction is a heuristic that catches mistakes; it isn't a defense against an adversarial Agent that wants to leak. Frame redaction as a quality-of-life feature, not a security one.
- **Pitch the structural list verbatim.** When a skeptical reviewer asks "what's the real security story?" the answer is §3 above. Read it back to them. Each item is auditable code that they can verify in the open-source runtime.
- **Pitch the OS-level honesty.** "The only security boundary against an adversarial LLM is the operating system" is a sentence we can say out loud. Saying it is a competitive move ... it differentiates us from platforms that overclaim.
- **The combined story:** *"We give you four structural boundaries no other agent platform gives you, plus the same heuristic layers everyone has, and we're honest that OS-level isolation is the operator's responsibility ... with concrete guidance on Docker/Modal/SSH for the OS-level piece."*

## Provenance

Adopted 2026-05-18 from the Hermes Agent deep dive ([[2026-05-18-hermes-deep-dive]] §2 and §6a). Doug + Guppi locked the positioning posture during the post-deep-dive synthesis. Hermes's framing (MIT © 2025 Nous Research) is borrowed with attribution; the structural list (§3) and the public positioning guidance (§5) are 2200-specific extensions of the same posture.

Trigger for revisit: any new substrate that adds a structural boundary, or any claim from a competitor that contradicts our §1 framing.

— Hobby
</parameter>
</invoke>