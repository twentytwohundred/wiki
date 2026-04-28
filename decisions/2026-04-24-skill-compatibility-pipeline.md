---
title: "Decision: Skill Compatibility Pipeline"
type: decision
status: locked
tags: [decision, extensions, skills, ux, ingestion]
created: 2026-04-24
updated: 2026-04-24
linked_docs:
  - "[[03-epic-map]]"
  - "[[02-architecture]]"
  - "[[prior-art-analysis]]"
canonical_path: wiki/decisions/2026-04-24-skill-compatibility-pipeline.md
---

# Decision: Skill Compatibility Pipeline

## Context

2200's Epic 11 (Skills ingestion) needs a policy for handling SKILL.md files imported from the broader open-source Agent ecosystem. The ecosystem has thousands of existing Skills of varying quality. Some are well-formed and conform cleanly to spec; others have quirks, missing fields, version drift, or sketchy practices.

Three options were considered:

1. **Strict.** Only well-formed Skills are accepted. Ill-formed Skills are rejected with an error message telling the user what to fix.
2. **Lenient.** All Skills are accepted as-is, with whatever quirks they have. Ingestion does minimal processing.
3. **Take and normalize with disclosure.** All Skills are accepted, but ill-formed ones get actively normalized. Every change is logged and surfaced to the user with an explanation.

The decision was raised by [[prior-art-analysis]] v0.1 by Hobby, with the recommendation to go strict. Doug pushed back with option 3.

## Decision

**Option 3: Take and normalize with disclosure.**

The pipeline has five phases:

1. **Parse.** Read the SKILL.md file. Tolerate common format variants in the wild.
2. **Validate.** Check against the formal Skill spec. Flag every issue found.
3. **Normalize.** Apply known-good fixes for ill-formed Skills. Examples: add missing required fields with sensible defaults, reformat malformed YAML frontmatter, escape unsafe characters in instructions, downgrade dangerous tool requests to safer equivalents. Log every change.
4. **Notify.** Surface to the user what got changed and why. Format: "We imported `[skill-name]`. Here's what we cleaned up: [list of changes with explanations]. The Skill is installed and working. Click here if you want to review the modified version, or revert to the original."
5. **Install.** Wrap the (possibly normalized) Skill as a minimal Extension and make it available to Agents.

Users can override at any point: skip normalization and install raw, revert a change, refuse the import entirely. The default is normalize-and-disclose because that's the right behavior for the busy user who doesn't want to think about the format of files they're importing.

## Consequences

### What gets better

1. **Day-one ecosystem advantage preserved.** Thousands of existing Skills work out of the box. This was the whole point of Epic 11 and we keep it.
2. **Users get protected from bad Skills.** Sketchy patterns (over-broad permissions, malformed instructions, dangerous tool requests) get caught and surfaced rather than silently affecting Agent behavior.
3. **Users learn the format over time.** Every notification of "we cleaned up X because Y" is a free education. After a few imports, users start writing Skills natively in the right format.
4. **Quality bar without exclusion.** We can have opinions about what good Skills look like without rejecting Skills that don't meet the bar.

### What could get worse

1. **Normalization decisions are subjective.** What counts as a "fix" vs. a behavior change is a judgment call. We need a documented list of known-good normalizations and a process for adding new ones. Without that, normalization becomes inconsistent.
2. **Notification fatigue.** If every Skill import generates a notification, users tune it out. Mitigation: notifications are bundled and only shown when there are actual changes worth surfacing. Clean Skills install silently.
3. **Pipeline complexity.** Five phases is more than two. More code to write, test, and maintain. Acceptable cost.
4. **User trust depends on disclosure quality.** If the notifications are vague or hard to understand, users will think we're tampering with their Skills. Notifications must be specific and actionable.

## Implementation guidance for Epic 11

The pipeline shape is the architectural backbone of Epic 11. Hobby's Epic 11 spec should include:

- The five-phase pipeline as separate, testable components
- A documented list of known-good normalizations (versioned, extensible)
- A user-facing UI for reviewing changes (web app and mobile app)
- An API for users to override default behavior at install time
- Telemetry on what's getting normalized most often (informs future Skill spec evolution)
- Reversion capability (every normalization is reversible)

The pipeline should be a published spec so other systems can produce 2200-compatible Skills natively. We're setting a quality bar, not just consuming one.

## References

- [[prior-art-analysis]] (v0.1) raised the question
- [[03-epic-map]] Epic 11 (Skills ingestion) needs scope update to reflect the pipeline
- [[02-architecture]] gets a small note in the Extensions section about the ingestion model
- This decision was locked during Doug's reply to Hobby's first session, 2026-04-24

## Format provenance

This is the first decision record using the [[brain-format]] convention from the start. It establishes the pattern: Context, Decision, Consequences (with subsections for what gets better and what could get worse), Implementation guidance, References. Future decision records should follow this shape unless there's a reason to deviate.

---

*Decision recorded by Doug and Guppi during the Hobby session, 2026-04-24.*
