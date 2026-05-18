# Catalog gaps

Operator-filed signals that the Capability Catalog at `wiki/catalog/capabilities/` doesn't yet cover something the operator (or an Agent) needs. Each gap is one markdown file per ask, frontmatter-validated, sorted chronologically.

## Why this dir exists

The Capability Catalog ships with curated entries (tier 1 lift on 2026-05-18 covered the 12 most common integrations). Real operator demand surfaces over time and rarely matches the order we'd guess. Gaps are how that demand makes it into the prioritization conversation for tier 2 + future lifts: every gap is a real ask, in the operator's own words, with timestamp and context.

This sits parallel to `wiki/catalog/capabilities/` deliberately. A future `2200 catalog gap promote <id>` step can scaffold a Capability entry from a gap, preserving the operator's framing of the ask.

## Storage model

- One file per gap. Filename is the gap's `id` (kebab-case slug).
- Frontmatter is YAML, validated by `CatalogGapFrontmatterSchema` in `src/runtime/onboarding/catalog-gap.ts`.
- Body is optional; use it for longer rationale, links to related issues, screenshots, etc.

The runtime writes gaps to `~/.2200/catalog/gaps/` by default (operator-local store). This dir (`wiki/catalog/gaps/`) is read-fallback for dev: scripts running from the repo root will find gaps committed here when `~/.2200/...` isn't populated. Committing gap entries directly into the wiki is fine when the operator wants long-term version-controlled tracking; for one-off local triage, the operator-local store is enough.

The resolution priority for reads:

1. `_2200_GAPS_DIR` env var (tests, scripts, custom installs).
2. `~/.2200/catalog/gaps/` (operator-local store; the default write target).
3. `<repo>/wiki/catalog/gaps/` (this dir; dev fallback only).

## Frontmatter fields

| field | type | required | notes |
|---|---|---|---|
| `id` | kebab-case slug | yes | filename without `.md`. Auto-derived from `operator_description` when not supplied. |
| `recorded_at` | ISO 8601 datetime | yes | set automatically by the writer. |
| `operator_description` | string (1-2000 chars) | yes | what the operator asked for, in their own words. Load-bearing for prioritization. |
| `context` | `onboarding` \| `runtime` \| `manual` | no (defaults `manual`) | where the gap surfaced. |
| `agent_name` | string | no | which Agent surfaced the gap (relevant for `onboarding` / `runtime` contexts). |
| `related_intent_tags` | string[] | no (defaults `[]`) | intent tags from the interview transcript that didn't match any catalog entry. |
| `status` | `open` \| `in_progress` \| `resolved` \| `dropped` | no (defaults `open`) | operator-editable post-hoc. |
| `resolution_note` | string (1-500 chars) | no | one-line note explaining the resolution when status flips off `open`. |

## CLI

```bash
# Record a new gap. Description is positional; flags add context.
2200 catalog gap add "Notion sync for shared workspace"
2200 catalog gap add "Linear ticket triage" \
  --context onboarding \
  --agent pilot \
  --tag linear \
  --tag project_management

# List recorded gaps. Defaults to status=open; pass --status all to see everything.
2200 catalog gap list
2200 catalog gap list --status resolved
2200 catalog gap list --status all
```

## Workflow

1. **File the gap** when it surfaces. The operator-local store keeps it private until you decide to publish.
2. **Triage** during tier-N planning. List with `--status all`, pick the asks worth lifting, set `status: in_progress` on the ones you commit to.
3. **Resolve** when the Capability lands. Set `status: resolved` and write a `resolution_note` pointing at the Capability id that subsumed the ask (or the reason for dropping).
4. **Promote** (future): `2200 catalog gap promote <id>` scaffolds a Capability entry under `wiki/catalog/capabilities/` using the gap's framing as the seed. Not built yet ... tier 2 is hand-authored for now.

## What this is NOT

- **Not a bug tracker.** Bugs go to GitHub issues. Gaps are missing capabilities, not broken capabilities.
- **Not a feature request log for 2200 itself.** Those go to epic docs or PRs. Gaps are specifically for the Capability Catalog (third-party integrations + skills).
- **Not auto-detected during onboarding (yet).** The wizard's interview will eventually flag "no catalog match for X — file a gap?" automatically, but v1 is manual via the CLI. The substrate is here when the auto-flag wire-up lands.
