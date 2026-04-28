---
title: "Decision: 2200 Baseline Model Tier"
type: decision
status: locked
tags: [decision, model-layer, infrastructure, ux]
created: 2026-04-24
updated: 2026-04-24
linked_docs:
  - "[[01-vision]]"
  - "[[02-architecture]]"
  - "[[03-epic-map]]"
canonical_path: wiki/decisions/2026-04-24-baseline-model-tier.md
---

# Decision: 2200 Baseline Model Tier
## Date: April 24, 2026
## Status: Locked. Strategic shape locked April 24, 2026. Hobby's prior-art may refine implementation details but does not change the dropdown approach, uniform markup, tier classifications, or auto-update mechanism.

---

## Where to track this stuff

You asked where to go to see the latest. Here's the reliable list:

1. **Artificial Analysis** (`artificialanalysis.ai`). Independent, frequently updated, has price-per-token and speed data alongside quality. The Intelligence Index is the composite score the rest of the industry references. This is the single most useful site.
2. **Vellum LLM Leaderboard** (`vellum.ai/llm-leaderboard`). Clean presentation of benchmarks (GPQA, AIME, SWE-bench, Humanity's Last Exam) with pricing. Good for sanity-checking Artificial Analysis.
3. **LMArena** (via `llm-stats.com`). Human-preference Elo ratings from blind comparisons. Useful for "which one do people actually prefer" not "which one benchmarks well."
4. **BenchLM.ai**. 220+ models, 178 benchmarks. Best when you need breadth. Overwhelming if you just want a call.
5. **ofox.ai** or **tldl.io**. Pricing-focused. Good for cost calculations.
6. **OpenRouter** (`openrouter.ai`). Not a leaderboard but a single API key across most models. Good for testing without signing up for every provider.

Don't bookmark all of these. Bookmark Artificial Analysis and Vellum. Check them when you're making a real model decision, not when you're browsing.

---

## The landscape as of April 24, 2026

Three tiers that matter for 2200. Prices below are input/output per million tokens.

### Frontier tier (best quality, premium price)

These trade blows at the top of Artificial Analysis's Intelligence Index (all scoring around 54-57). Picking between them on pure quality is a coin flip. Tiebreakers are cost, context window, and task fit.

- **Claude Opus 4.7**. $5/$25. Leads SWE-bench at 82%, tops LMArena at 1504 Elo. Best at following nuanced instructions. 1M token context.
- **Claude Sonnet 4.6**. $3/$15. Close behind Opus on most benchmarks, meaningfully cheaper. Workhorse of the frontier.
- **GPT-5.4**. $2.50/$15. OpenAI's current flagship. Leads raw code-gen benchmarks. Cheapest of the frontier inputs.
- **Gemini 3.1 Pro**. $2/$12. Best price-per-intelligence in frontier. 1M token context. Google's strongest showing in a while.
- **DeepSeek V4-Pro**. $1.74/$3.48. Released April 24, 2026. Open-weight MIT license. 1.6T params, 49B active, 1M context. Scores 80.6% on SWE-bench Verified... within 0.2 points of Claude Opus 4.6. "Open-source SOTA in Agentic Coding benchmarks" per DeepSeek. 7x cheaper than Sonnet on output tokens, and on par with mid-tier pricing for frontier-class quality.
- **Kimi K2.6**. $0.95/$4.00. Released April 20, 2026. Open-weight Modified MIT license. 1T total params, 32B active, 256K context. Scores 54 on Intelligence Index. Particularly strong on coding (ranks #5 of 118 on BenchLM) and long-horizon autonomous work. "Very verbose" per Artificial Analysis, which costs more output tokens than the input price suggests.

**Note on frontier classification.** As of today (April 24, 2026), the line between "frontier" and "fast" is blurring. V4-Pro and Kimi K2.6 score within the frontier band on coding but below the frontier trio on general reasoning. They're classified as frontier here because their capability on the workloads Agents actually do is frontier-class, even if the composite scores are slightly lower.

### Mid tier (good enough for most agent work, 80-90% of frontier quality at 10-30% of cost)

This is where a product like 2200 should default for most Agent workloads. The gap between this tier and frontier is real but often doesn't matter for the work most Agents do.

- **DeepSeek V4-Flash**. $0.14/$0.28. Released April 24, 2026. 284B total params, 13B active, 1M context. Direct successor to V3.2 at the same price, better architecture, longer context. New cheap-tier default.
- **DeepSeek V3.2**. $0.14/$0.28. Being retired July 24, 2026. All traffic currently routing to V4-Flash via the same endpoints. Users on V3.2 should plan migration to V4-Flash or an alternative.
- **Gemini 3 Flash**. $0.50/$3. Google's balanced option. Fast, cheap, long context.
- **Gemini 3.1 Flash-Lite**. $0.10/$0.40. Cheapest proprietary option with solid quality. Good for high-volume simple tasks.
- **MiniMax M2.7**. $0.30/$1.20. The one you already use for Sam and Naavi. 90% cache discount via OpenRouter. Proven in your environment.
- **GLM-5** (Zhipu). Open weights. Competitive quality. Cheap API access; self-hostable for zero marginal cost if you have GPU.
- **Qwen 3.5 35B**. Open weights. Balanced reasoning. Cheap via API providers, self-hostable.

### Local tier (self-hostable, zero marginal token cost, you own the latency)

For users who self-host and point 2200 at their own LLM endpoint.

- **Llama 4 70B**. Open weights. Matches mid-tier on most tasks. Runs on your 3090 with quantization.
- **Gemma 4 26B MoE**. You already run this on Valkyrie at 133-150 tok/s. Proven.
- **Qwen 3.5 family**. Open weights across multiple sizes. Strong on agentic workflows.
- **GLM-5 smaller variants**. Open weights. Strong enough for most Agent work.
- **DeepSeek V3.2** (if you have the hardware). Not realistic on a 3090 at full size; quantized versions are possible.

### The economics in plain language

- Sonnet 4.6 at $3/$15 running an Agent that chews through 10M input and 1M output tokens per day costs $45/day or ~$1,350/month. For one Agent. For one user.
- MiniMax M2.7 at the same volume: $4.20/day or ~$126/month.
- DeepSeek V3.2 at the same volume: $1.68/day or ~$50/month.
- Local Gemma 4 26B: $0/day. You paid for the GPU once.

For 2200 to be viable as a product, the defaults cannot be Sonnet. Sonnet is a premium option users can select; it cannot be what every Agent runs by default. The math doesn't work.

---

## Proposed 2200 baseline tier

The product's model strategy needs to handle three user types and four workload classes.

### User types

1. **Self-hosted with local LLM.** User brings their own hardware and model. 2200 points at their endpoint. No token costs, user owns latency.
2. **Self-hosted with API key.** User self-hosts 2200 but uses a cloud LLM. User pays provider directly.
3. **Managed service.** User pays 2200 per token plus margin. 2200 picks a default model; user can upgrade or bring their own.

### Workload classes

1. **Conversational (user-facing).** The Agent talking directly to the user. Needs good instruction-following and natural prose. Latency matters.
2. **Agentic (tool use, planning, structured tasks).** The Agent's internal loop. Needs strong function calling and consistent structured output. Latency matters less.
3. **Long-context (reading, summarizing, analyzing).** Ingesting documents, reviewing codebases, summarizing the Brain. Needs big context windows and good retention.
4. **Generation (writing code, writing content).** Producing artifacts. Needs quality over speed. This is where Sonnet/Opus earn their price.

### The approach: dropdown, not routing

Updated decision (April 24, 2026). Earlier drafts tried to pick defaults per workload. Dropped that approach in favor of a simpler model: **we present the full dropdown of supported models, mark up tokens the same percentage across providers, and let users pick.**

Reasoning:

1. **Users have preferences.** Someone who wants Opus for everything should get Opus. Someone who wants V4-Flash for everything should get V4-Flash. 2200 shouldn't try to be smarter than the user about this.
2. **Defensive posture doesn't scale.** Every week a new model ships. Defending "why did you pick X for conversational" creates churn. Letting users pick sidesteps the whole argument.
3. **Uniform markup across providers is honest.** 2200 isn't playing arbitrage games or steering users toward high-margin models. Every token is marked up the same percentage regardless of provider. User knows the deal.
4. **It respects user agency.** Busy users can default to "Smart and Fast" and never think about it. Technical users can pick V4-Pro for coding, Opus for hard reasoning, and Flash for bulk work, per Agent.

### Proposed tier labels in the dropdown

Models are grouped visually but users can pick any specific model within or across tiers:

- **Frontier**: Opus 4.7, Sonnet 4.6, GPT-5.4, Gemini 3.1 Pro, DeepSeek V4-Pro, Kimi K2.6
- **Fast**: Gemini 3 Flash, V4-Flash, Flash-Lite, MiniMax M2.7, Gemini 3 mini variants
- **Economy**: cheapest in each provider's lineup for users prioritizing cost
- **Specialist**: coding-specific, reasoning-specific, voice-specific as those models appear
- **Bring your own** (advanced mode): point at any compatible endpoint, zero markup, flat hosting fee only

Each model in the dropdown shows: current price per 1M input/output tokens, context window, rough quality indicator (Artificial Analysis Intelligence Index or similar), and notable strengths ("strong at coding", "strong at long-context", etc.).

### Proposed defaults for self-hosted with local LLM

Users self-hosting with their own hardware still see the dropdown, but the default is "your local endpoint" configured at install. Suggested models depending on their hardware:

| Hardware | Suggested default |
|---|---|
| 3090/4090 class (24GB VRAM) | Gemma 4 26B MoE, Qwen 3.5 30B, V4-Flash quantized |
| 5090 / dual 3090 (48GB VRAM) | Larger Qwen, GLM-5 variants, Kimi K2.6 quantized |
| Serious multi-GPU setups | V4-Pro, full Kimi K2.6, frontier open-weight options |

---

## Auto-update and model lifecycle

This is the feature that differentiates 2200 from static platforms. New models ship weekly. Old models get retired. Users should not have to manually track which model their Agent is running and when to switch.

### Tier binding, not model binding

Every Agent is bound to a **tier** (Frontier, Fast, Economy, Specialist) with a specific current default model within that tier. When a better model arrives in the same tier at similar price, 2200 surfaces it to the user.

### Three event types

**1. New model arrives in a tier.** 2200 detects it via provider APIs and manual curation. User gets a notification: "Your Agent is on Gemini 3 Flash (Fast tier). A new model is available in the same tier: DeepSeek V4-Flash. Same price range, better benchmarks on [this Agent's workload]. Options: switch now, test on one task, keep current, remind me later."

**2. Model gets deprecated.** Provider announces retirement (like DeepSeek's V3.2 retirement on July 24, 2026). 2200 detects it. User gets notified 30 days out: "Your Agent's current model is being retired by its provider. We're automatically moving to [direct successor]. Override if you want a different choice."

**3. Provider quality diverges from tier.** One provider's quality noticeably falls behind others in the same tier. User gets an optional suggestion: "Models from [Provider X] have consistently scored lower than alternatives in the Fast tier over the past 30 days. Would you like to migrate to a different provider's Fast model?"

### User preference on upgrade aggressiveness

Users can set their default behavior:
- **Auto-upgrade within tier.** If a new model appears in my Agent's tier and benchmarks better at similar price, switch automatically. Notify me after.
- **Notify and ask.** Default. Tell me, I decide.
- **Never change.** My Agent stays on the specific model I chose. Deprecations still force migration with notification.

### Audit trail

Every model change is written to the Agent's Brain: "Migrated from DeepSeek V3.2 to V4-Flash on 2026-07-24 due to provider deprecation. Previous model retired by DeepSeek. Automatic migration." Users can see the full history of what model their Agent has been on and why it changed.

### Why this matters

Other platforms require users to manually configure model versions. That worked when new models came out every six months. It doesn't work when new models come out every week. Handling this gracefully is a real product advantage for 2200... it's the difference between a platform that ages and a platform that keeps pace.

This is an entire Epic. See [[03-epic-map]].

---

## Key design principles for the model layer

1. **Model provider abstraction.** 2200 talks to an LLM via a single interface. Underneath, the interface dispatches to Anthropic, OpenAI, Google, DeepSeek, MiniMax, Moonshot, or a user's own endpoint. Users changing models never requires code changes.

2. **Per-Agent, per-workload routing.** An Agent's Identity declares preferred models per workload class if the user wants that granularity. Most users pick one model. Advanced users can configure differently per workload. The system defaults to a single model per Agent.

3. **Cost visibility from day one.** Every API call is metered. Users see projected costs before they commit and actual costs after. No surprise bills. Soft caps and alerts baked in.

4. **Cache-aware.** DeepSeek's 90% cache discount, MiniMax's caching, and Anthropic's prompt caching all reward repeated context. The runtime should structure prompts to maximize cache hits. This is a real architectural decision, not a micro-optimization.

5. **No lock-in.** Self-hosters can bring any model. Managed users can switch models per Agent. Switching models does not require migrating data, losing context, or restarting Agents.

6. **Uniform markup across providers.** Same percentage markup on tokens regardless of provider. 2200 isn't trying to steer users toward high-margin models.

7. **Automatic lifecycle handling.** Users don't manually track deprecations or new releases. 2200 handles it, with user override at every step.

---

## What to tell Hobby

In prior-art analysis, Hobby should look at how existing platforms handle model selection. Specifically:

- Does OpenClaw (the existing open-source platform) have model abstraction, or is it Anthropic-only?
- What does Perplexity Computer default to? What do users complain about cost-wise?
- How do existing Skill/Extension systems handle model requirements? Do Skills declare which models they need, or are they model-agnostic?

The model layer architecture decision belongs to Hobby, with product-level input from Doug. This doc is the starting position, not the final answer. Hobby can propose deviations with reasoning.

---

## References

- Artificial Analysis: https://artificialanalysis.ai/leaderboards/models
- Vellum: https://www.vellum.ai/llm-leaderboard
- LMArena via llm-stats: https://llm-stats.com
- BenchLM: https://benchlm.ai/
- OpenRouter (for multi-model access): https://openrouter.ai/

---

*Decision draft by Doug and Guppi, April 24, 2026. Open for Hobby's review during prior-art phase.*
