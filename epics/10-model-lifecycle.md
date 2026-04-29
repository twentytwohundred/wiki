---
title: "Epic 10: Model lifecycle management"
type: epic
status: phase-a-shipped
version: 1.0
tags: [epic, models, lifecycle, llm, providers, deprecation]
created: 2026-04-29
updated: 2026-04-29
linked_docs:
  - "[[03-epic-map]]"
  - "[[02-architecture]]"
  - "[[2026-04-26-model-field-format]]"
  - "[[2026-04-24-baseline-model-tier]]"
canonical_path: wiki/epics/10-model-lifecycle.md
---

# Epic 10: Model lifecycle management

The model layer that lets 2200 keep pace with the rapidly-moving LLM ecosystem. New models ship weekly. Models get retired. Provider quality shifts. Platforms that require manual model configuration become stale. 2200's differentiator is that users do not track this themselves.

Every Agent is bound to a tier (Frontier, Fast, Economy, Specialist) with a specific current model. New models, deprecations, and quality drift are handled by the platform with user control over how aggressive the changes are.

## Why this is its own Epic

The LLMProvider abstraction (Epic 4.5 / 3.6) gave us multi-provider routing. What it does not give us: knowledge that a vendor has retired a model, suggestions when a strictly-better model in the same tier ships, automatic migration with audit, or quality-drift detection. Those are model-lifecycle concerns ... separate from the per-call dispatching.

## Phasing

### Phase A — static catalog + migrate CLI ✅ shipped 2026-04-29 (PR [#100](https://github.com/twentytwohundred/2200/pull/100))

**Scope.** Hand-curated model catalog, exposed via the CLI for inspection + manual migration. No live polling. No auto-migration. No notifications. The minimum surface that lets us track model identity centrally and rewrite an Agent's binding atomically.

**As shipped.**
- `src/runtime/models/catalog.ts`: static array of `CatalogEntry { id, provider, model_id, tier, status, recommended_successor?, display_name, notes?, companion_reasoner? }`. Indexed by id and by tier. `recommendedForTier(tier)` returns the first active entry for that tier.
- Catalog seeded with 9 entries across Anthropic (Opus 4.7, Sonnet 4.6, Haiku 4.5), DeepSeek (Chat, Reasoner, v4), Kimi (Moonshot v1-128k), Gemini (2.5 Pro), and OpenRouter (Auto).
- `2200 model list [--tier --provider --status]` ... print the catalog with optional filters.
- `2200 model status [agent]` ... report an Agent's binding + catalog status; surfaces tier-drift between Identity and catalog. Without an arg, walks every Agent under `<home>/agents`.
- `2200 model migrate <agent> <provider/model_id> [--followup <model_id>]` ... atomically rewrite the Identity. Refuses `retired` targets; warns on `deprecated`.

**Done when.** A user can run `2200 model list` to see what 2200 knows about, `2200 model status hobby` to see whether Hobby's model is still active in the catalog, and `2200 model migrate hobby anthropic/claude-opus-4-7` to switch Hobby's binding (with a clear bounce instruction printed). Catalog updates ship as commits to the runtime repo.

### Phase B — deprecation alerts + auto-migration

**Scope.** When a catalog entry transitions from `active` to `deprecated`, the runtime emits a notification per affected Agent. User preference (per Identity flag) chooses: auto-upgrade-within-tier, notify-and-ask (default), never-change. Migration writes a Brain audit entry on the Agent so the change is visible in the Agent's history.

**Includes.**
- Catalog change watcher: on supervisor start, diff the loaded catalog version against the last-seen version cached on disk. New deprecations emit notifications.
- Per-Identity flag `model_lifecycle: { policy: 'auto' | 'ask' | 'manual' }`. Default `ask`.
- Migration writes a brain note `model-migration-<date>.md` on the Agent.
- A `notification.kind = 'model.deprecated'` template the notification system understands.

**Depends on.** Phase A. Epic 7 Phase A (notifications). Epic 8 Phase A (brain).

### Phase C — quality drift + sandbox A/B

**Scope.** When a provider ships a new minor version that affects quality (often silently behind the same model_id), 2200 detects the drift via simple metrics on the per-Agent telemetry stream and offers a sandboxed A/B against the new version. User compares + accepts or reverts.

**Includes.**
- Per-Agent quality signals (refusal rate, average tokens per task, error rate).
- Sliding window comparison against historical baseline.
- Drift detected → notification.kind = 'model.quality_drift'.
- `2200 model sandbox <agent> <new_model> [--tasks N]` runs N pending or replayed tasks against the new model in a side-by-side process and prints the comparison.

**Depends on.** Phase B. Epic 4.5 (telemetry).

### Phase D — provider-plugin SDK

**Scope.** Today the LLMProvider abstraction is a hand-written file per vendor (anthropic, openai-compatible). Phase D ships a developer-facing SDK so new LLM providers ship as plugins, not core PRs. Mirrors OpenClaw's plugin pattern.

**Includes.**
- `LLMProviderPlugin` interface. Providers expose a single `register()` hook returning their model list + invocation handlers.
- Plugin discovery: `<home>/llm-plugins/<name>/plugin.js` or npm-published.
- Catalog entries can come from plugins (still curated by name; plugins do not mass-add to the canonical catalog).

**Depends on.** Phase B. Open question: signing / trust model for third-party plugins.

## Operational notes

**Catalog is hand-curated at v1.** Updates ship as code commits, not data. This deliberately keeps the catalog auditable and reviewable. Phase B can grow a polling layer that detects vendor announcements and queues PRs against the catalog file; the human merge stays in the loop.

**Tier classification is set at catalog-add and does not change.** If a model genuinely shifts tier (rare ... usually a vendor renames a model, not changes its character), add a new entry rather than editing the existing one. Old binding still resolves.

**Companion reasoner field.** Some catalog entries declare a paired reasoner model in the same family (e.g., DeepSeek Chat → DeepSeek Reasoner). The migrate CLI's `--followup` flag uses this conventionally; Phase B can auto-fill from the catalog field.

## Done when (epic-level)

- Phase A: shipped.
- Phase B: a user with an Agent on a deprecated model gets a notification with a one-tap accept-migration. After acceptance, the Identity is rewritten and the Agent is bounced cleanly.
- Phase C: a quality regression on a silently-updated model surfaces as a notification + a side-by-side sandbox the user can run.
- Phase D: a third-party LLM provider can ship without a core PR.

## References

- Decision: [[../decisions/2026-04-26-model-field-format]] (canonical `<provider>/<model_id>` shape)
- Decision: [[../decisions/2026-04-24-baseline-model-tier]] (tier semantics)
- LLMProvider abstraction: `src/runtime/llm/provider.ts` (Epic 3.6 / 4.5)
- Catalog source: `src/runtime/models/catalog.ts`
- CLI: `src/cli/main.ts` (search for "2200 model")
