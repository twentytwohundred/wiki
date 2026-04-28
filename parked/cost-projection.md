---
title: "Parked: Cost projection from typical-usage telemetry"
type: parked
status: parked
tags: [parked, cost, dashboard, onboarding, models]
created: 2026-04-28
updated: 2026-04-28
linked_docs:
  - "[[03-epic-map]]"
  - "[[04.5-cost-caps-and-usage-telemetry]]"
canonical_path: wiki/parked/cost-projection.md
---

# Parked: Cost projection from typical-usage telemetry

A future feature, not in the current epic map. Surfaced by Doug 2026-04-28.

## What

Project an Agent's daily cost on a candidate model based on the Agent's actual recent token-velocity telemetry. The user-facing question this answers: "If I switch this Agent from Claude Opus to DeepSeek-chat, what does my daily spend look like?"

The math is straightforward once Epic 4.5's telemetry lands:

1. Pull the last N days (default 14) of the Agent's per-call telemetry JSONL.
2. Sum input_tokens, output_tokens, cached_tokens by day; compute a per-day token mix and a typical task count.
3. For each candidate model in `pricing.json`, multiply the typical day's token mix by the candidate model's rates.
4. Surface a projected daily figure (median + interquartile range) per candidate.

## Where it lives in the user surface

Two natural homes:

- **Onboarding (Epic 14).** When the user is shopping models for a new Agent type, show "users with similar Agent shapes typically spend $X/day on Opus, $Y/day on DeepSeek-chat" using telemetry from existing Agents on the same instance (or, eventually, anonymized aggregates from the managed service).
- **Agent Behavior dashboard (a follow-on epic from `2026-04-24-cost-behavior-shape`).** When an existing Agent's user is reviewing cost caps, show "your current spend trajectory on this model is $X/day; switching to <cheaper model> projects to $Y/day."

## Why it's parked, not active

The substrate (Epic 4.5) is necessary but not sufficient... a meaningful projection needs at least 7-14 days of telemetry per Agent, plus pricing data on each candidate model maintained well enough to be trusted. Both come for free as Epic 4.5 ships, but the projection feature itself is a UX surface, and 2200 has bigger UX surfaces still to build (web, mobile, conversational onboarding) before the projection is the user-perceptible bottleneck.

When 2200 ships its first managed-service onboarding (post-Epic 17), this is one of the higher-leverage UX additions because model choice is a real decision users will face.

## What needs to be true before unparking

- Epic 4.5 has been merged and accumulated at least two weeks of real telemetry across multiple model picks.
- `pricing.json` is curated regularly enough that model rates stay current (auto-refresh from a pricing aggregator may be the right answer here, also parked).
- Onboarding (Epic 14) or the Agent Behavior dashboard epic is in active build, providing the surface this projection plugs into.

## Format provenance

Doug surfaced this 2026-04-28 in chat: "It'd be a good feature to estimate the daily cost of a model based on their typical usage. That's a feature though... albeit a useful one." Recorded here so the idea survives the conversation; not adding to the epic map until one of the unblockers above clears.

---

*Parked 2026-04-28. Update or unpark when the unblockers clear.*
