---
title: 'Decision: Web Search Provider for the v1 Baseline Tool'
type: decision
status: locked
tags: [decision, runtime, tools, web-search, baseline, epic-2]
created: 2026-04-26
updated: 2026-04-26
linked_docs:
  - '[[02-agent-runtime-minimum]]'
  - '[[2026-04-25-tool-baseline]]'
  - '[[2026-04-25-mcp-native]]'
  - '[[license-posture]]'
canonical_path: wiki/decisions/2026-04-26-web-search-provider.md
---

# Decision: Web Search Provider for the v1 Baseline Tool

## Context

`web.search` is one of the 14 baseline tools every Agent gets by default per [[2026-04-25-tool-baseline]]. The Epic 2 spec ([[02-agent-runtime-minimum]]) lists "Web search provider for the v1 baseline (Brave, Tavily, SerpAPI, etc.)" as an architecture choice that is not pre-decided. This record locks both the abstraction shape and the v1 default.

Constraints:

- **Free-tier path for self-hosted users.** A user who installs 2200 on their own box should be able to wire a web search key from a free-or-cheap tier without paying a SaaS fee.
- **AI-Agent friendly.** The result format should be amenable to model consumption: short snippets, source URLs, structured fields. Raw HTML scraping is a poor fit.
- **Reasonable quality.** Top-of-funnel web search; the model decides what to fetch based on what comes back.
- **Swappable.** A user who already has a Kagi or SerpAPI subscription should be able to point `web.search` at their preferred provider with one config change.

Options considered (free-tier pricing as known at decision time, 2026-04-26; verify before assuming):

1. **Tavily.** AI-search-optimized. Returns snippets, URLs, optionally inline answers. Free tier ~1,000 queries/month. Designed explicitly for LLM Agents.
2. **Brave Search API.** General web search. Free tier ~2,000 queries/month. Higher raw quota; more general output (less LLM-optimized).
3. **SerpAPI.** Google-quality results via scraping abstraction. Paid only at any meaningful scale.
4. **Kagi Search API.** Best-quality results in the consumer search space. Subscription only ($25/month); not a free-tier option for casual self-hosters.
5. **DuckDuckGo Instant Answer API.** Free, no key. Limited: returns instant answers and topic summaries, not actual web search results.
6. **Bing / Microsoft Search.** Pricing model has shifted multiple times in recent years; was discontinued for some product lines. Operational risk.

## Decision

### Provider abstraction

Lock the abstraction shape first; the provider pick is the v1 default within it.

```ts
// src/tools/web-search/provider.ts (illustrative; final shape lands in the
// baseline-tools PR)

export interface WebSearchProvider {
  readonly name: string

  search(query: string, opts?: SearchOptions): Promise<SearchResult[]>
}

export interface SearchOptions {
  maxResults?: number       // default: 10
  freshness?: 'day' | 'week' | 'month' | 'year' | 'all'  // default: 'all'
  safeSearch?: 'strict' | 'moderate' | 'off'             // default: 'moderate'
}

export interface SearchResult {
  url: string
  title: string
  snippet: string
  publishedAt?: Date
  rank: number   // 1-based; provider's ranking
}
```

The `web.search` MCP server in the v1 baseline registers the configured provider at boot. The provider is selected by the Agent's Identity (or the instance default if the Agent does not override). Switching providers is a config change, not a code change.

### v1 default: Tavily

**Tavily is the v1 default** for the managed instance and the recommended default for self-hosted.

Reasons:

1. **Purpose-built for LLM Agent search.** Result format (snippets + source URLs + optional concise answers) maps cleanly onto what Agents need. Less post-processing.
2. **Free tier covers light real use.** ~1,000 queries/month is enough for an Agent doing a few research tasks per day. Heavier users upgrade or swap to Brave.
3. **Simple HTTP API.** Single-endpoint POST with API key in the header. No SDK lock-in; we wrap it in our provider interface.
4. **Recent enough on the market that it tracks current model-Agent norms** rather than predating the LLM era and being retrofitted.

### Brave as the locked-in alternative

`brave` is the second supported provider in the v1 codebase, even though Tavily is the default. Reasons:

1. **Higher free-tier quota.** Power users hitting Tavily's quota can swap with one config change.
2. **General-purpose result format.** Some workloads want raw web results, not LLM-optimized.
3. **Independent of Tavily's availability.** If Tavily changes pricing, deprecates an endpoint, or has an outage, Brave is the immediate fallback.

Both providers ship in v1. Users select via Identity config; the abstraction makes the swap one line.

### Credential model

- **Self-hosted:** the user provides their own provider API key. Stored in the secrets store, referenced via `SecretRef` per [[upgrade-readiness]] discipline 5. v1 looks up under `vault:tavily:api-key` (or `vault:brave:api-key`).
- **Managed:** 2200 covers the cost using a pooled API key, billed back to the user as part of token-and-tool usage. Pooled key never leaves the managed-service backend; not exposed to user-installed Extensions.

### Idempotency

Per the [[2026-04-25-tool-baseline]] tool-level idempotency table, `web.search` is **pure** (no observable external effect; same query produces the same answer modulo provider freshness). The compatibility check at the perm layer treats it accordingly.

## Consequences

### What gets better

1. **Day-one usefulness.** Every Agent has working web search out of the box. The user does not have to wire a search provider before their Agent can do research-style tasks.
2. **Provider-agnostic from day one.** The abstraction is locked at v1; new providers (Kagi, Bing if it stabilizes, an open-source self-hosted SearXNG instance) drop in without touching tool consumers.
3. **No SDK lock-in.** Both Tavily and Brave have simple HTTP APIs. We wrap them ourselves, keeping the dependency graph small.
4. **Two-provider redundancy.** Tavily quota exhausted or down? One config change to Brave. No code edit needed.
5. **Managed-service cost is metered.** The provider call is a tool call, which goes through plan/run/perm wrapping; the run record's `cost_metrics` captures per-query cost. The Behavior dashboard ([[2026-04-24-cost-behavior-shape]]) eventually surfaces this.

### What could get worse

1. **Tavily's terms of service can change.** As an early-stage product, Tavily could pivot, raise prices, or deprecate endpoints. The Brave fallback mitigates; the abstraction makes a third-provider add easy.
2. **Result quality differs across providers.** An Agent tuned to expect Tavily's snippet style may underperform on Brave's. Mitigation: the provider abstraction normalizes shape; quality tuning is the model's job, not ours.
3. **Pooled-key managed model creates a single point of vendor exposure.** If 2200's Tavily quota runs out, every managed-mode user is affected. Mitigation: monitor usage; implement provider rotation or per-user-pool pinning if usage grows past a single account.
4. **Free-tier rate limits are real.** A user running heavy research workloads can blow through the free quota in a day. Mitigation: surface usage to the user (Pulse data, Behavior dashboard); offer "BYO key" for self-hosted; offer paid tier for managed.

## Implementation guidance for the baseline-tools PR

- Provider abstraction in `src/tools/web-search/provider.ts`.
- Tavily implementation in `src/tools/web-search/tavily.ts`. Brave in `src/tools/web-search/brave.ts`.
- The `web.search` MCP server lives in `src/tools/web-search/mcp-server.ts`. It registers under the baseline tool list at runtime.
- Configuration: `WebSearchConfig` shape includes provider name and credential `SecretRef`. Identity files declare the provider via `tools.web_search.provider: tavily | brave`.
- Tests: provider mocks for both Tavily and Brave; integration tests behind a `INTEGRATION_TEST=1` env-gated suite that hits the real APIs (skipped in CI unless secrets are wired).
- Per [[license-posture]], record the provider names and licenses in `THIRD_PARTY_NOTICES.md` even though the integration is API-only (pattern lift, no code copy from provider SDKs).

## License posture

- Tavily API: usage governed by Tavily's terms of service. Not a code dependency; HTTP API only.
- Brave Search API: same, Brave's terms of service.
- Neither provider's SDK is bundled. We implement the HTTP client ourselves.
- No code-lift, no notice-preservation obligation. Pattern lift only (the "wrap a search provider behind a clean interface" pattern is industry-standard, not novel).

## References

- Epic 2 spec: [[02-agent-runtime-minimum]] (the "architecture choices that are not pre-decided" section)
- Tool baseline + plan/run/perm: [[2026-04-25-tool-baseline]]
- MCP-native runtime: [[2026-04-25-mcp-native]] (provider abstraction registers as an MCP server)
- Upgrade-readiness discipline 5: [[upgrade-readiness]] (SecretRef indirection)
- Standing licensing rule: [[license-posture]]

## Format provenance

Decision recorded by Hobby on 2026-04-26 during Epic 2 build-phase prep. The pick was a build-time call per [[build-phase-decisions]]; this record locks both the abstraction shape and the v1 default before the baseline-tools PR lands.

---

*Decision recorded by Hobby, 2026-04-26.*
