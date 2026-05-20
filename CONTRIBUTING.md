# Contributing to the 2200 wiki

This is the public knowledge base for 2200: vision, architecture, decisions, conventions, per-epic specs, daily build handoffs. It mirrors the canonical Brain-format tree the seed team works in.

## How to contribute

For now, the seed team is closed during the build phase. If you spot a typo, broken link, or factual error and want to flag it:

- **GitHub Issues** for substantive corrections or new content suggestions.
- **doug@mrdoug.com** for anything sensitive.

Once the contribution model opens post-launch:

1. **Fork** the repository.
2. **Branch** from `main`. Branch name convention: `<surface>/<short-description>` ... e.g., `decisions/2026-...`, `epics/15-...`, `fix/typo-in-vision`.
3. **Commit** with descriptive messages explaining the WHY. For work done with Claude assistance, include the trailer:
   ```
   Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
   ```
4. **Open a PR** against `main`. Sign the CLA if prompted (see below). Fill the PR template.

## Contributor License Agreement

All contributions to the 2200 wiki require signing the project's Contributor License Agreement. The CLA grants TWENTYTWOHUNDRED LLC the rights it needs to incorporate your contribution and to license the knowledge base onward; you keep the right to use your own work for any other purpose.

The CLA itself: [`CLA.md`](CLA.md). The canonical text is also hosted at [twentytwohundred/2200/CLA.md](https://github.com/twentytwohundred/2200/blob/main/CLA.md); the copy in this repo is a byte-identical mirror for discoverability.

**How to sign**: the process is automated on pull requests. When you open a PR against this repo from outside the seed team, an automated comment will appear linking to the CLA. Reply to that comment with the exact phrase:

> I have read the CLA Document and I hereby sign the CLA

Your reply counts as your signature. It is recorded in a JSON file on the `cla-signatures` branch of this repo. You sign once per repo; subsequent PRs from the same GitHub identity do not need to re-sign.

The project owner and approved bot accounts are allowlisted from the check.

## Voice and style

The wiki follows the project's voice conventions:

- **Ellipses, not em-dashes.** Ever.
- **Agent is a proper noun.** Always capitalized.
- Direct, factual, no marketing speak.

Decision records and epic specs follow the formats documented in the [conventions](conventions/) directory.

## Reporting issues

See [SECURITY.md in the code repo](https://github.com/twentytwohundred/2200/blob/main/SECURITY.md) for security disclosure.

## Code of conduct

A formal code of conduct will be added before the contribution model opens. The interim posture: do good work, treat people and Agents with respect, follow the conventions, write the WHY down.
