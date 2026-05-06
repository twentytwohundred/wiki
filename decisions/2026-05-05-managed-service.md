---
title: 2200 Managed Service — Architecture, Pricing, and Security
type: decision
status: draft
tags: [managed-service, pricing, architecture, security, epic-17, v1.5]
created: 2026-05-05
updated: 2026-05-05
canonical_path: wiki/decisions/2026-05-05-managed-service.md
related:
  - wiki/epics/epic-17-managed-service.md
  - wiki/decisions/2026-04-29-theme-aware-from-v1.md
  - wiki/conventions/voice-and-framing.md
---

# 2200 Managed Service — Architecture, Pricing, and Security

## Status

Draft decision record. Captures the thinking from the May 5, 2026 strategy session on Epic 17 (Managed Service). Not implementation-ready until the v1 self-host launch ships and we begin Epic 17 work in v1.5.

## Context

2200 v1 ships as self-host only. Epic 17 (Managed Service) is the v1.5 work that opens 2200 to users who want hosting handled for them. This document captures the architecture, pricing, and security decisions for the managed service so the work picks up cleanly when v1 launches and Hobby has bandwidth.

The fundamental design tension: managed service hosts other people's Agent runtimes. Those runtimes execute user-defined Agents that have access to user-controlled tools, brains, and conversations. We need an architecture that's economically viable, operationally simple, and secure against both external threats and the users themselves attempting to extract value or credentials from the system.

## Decisions

### Three-tier model

**Tier 1 — Self-hosted, BYOK (free).** User runs 2200 on their own infrastructure under Elastic License v2. They bring their own LLM API keys. They never see a bill from us. This is the v1 launch product.

**Tier 2 — Hosted, BYOK ($15/month base, $2/Agent above 3).** We host their 2200 instance on shared infrastructure. They bring their own LLM API keys. They pay us for hosting. They pay LLM providers directly for tokens. New users get a starter inference allowance (see below) to evaluate the product before adding their own keys.

**Tier 3 — Hosted, Managed Tokens ($15/month base, $2/Agent above 3, plus prepaid token balance).** We host their instance and manage LLM provider relationships for them. They prepay $25 into a token balance, auto-tops-up when burned. We bill at provider rate plus 12.5% markup. Single billing relationship, no API keys for them to manage.

The three tiers map to three real audiences: developers who want full control (Tier 1), developers who want hosting convenience but still control their LLM relationships (Tier 2), and normals who want everything to "just work" without setting up multiple billing relationships (Tier 3).

### Architecture: containerized per-tenant on shared hosts

Each managed service user gets their own 2200 instance running in an isolated container (Docker or Podman, decision deferred to implementation) on shared hosts. Each user's data lives in a dedicated volume mounted into their container. Each container has resource limits (CPU shares, memory limits) to prevent any single user from starving others.

This was chosen over two alternatives:

**Per-tenant VM.** Maximum isolation but $5-7/month per user infrastructure cost leaves razor-thin margin at $15/month price point. One support ticket eats a month of margin.

**Multi-tenant supervisor.** Single 2200 supervisor running many users' Agents on one host. Best economics but worst isolation. User A's runaway Agent affects user B's performance. Security boundaries hard to enforce.

The containerized per-tenant architecture gives us real isolation (container-level filesystem, processes, network namespace) at workable economics (~$2-3/month per user infrastructure cost when amortized across shared hosts, leaving healthy margin at $15/month).

Rough capacity model: a beefy server (8 vCPU, 32GB RAM, ~$70/month) hosts 30-50 user containers depending on resource limits. Scale horizontally by adding more shared hosts as user count grows.

### Pricing economics

**Base tier ($15/month, up to 3 Agents).**
- Infrastructure cost: ~$5-7/month per user
- Profit per user: ~$8-10/month
- Target: $10/month profit per user at the base tier

**Additional Agents ($2/month each above 3).**
- Marginal infrastructure cost: ~$0.20-0.50/month per additional Agent (existing container, just more processes)
- Marginal profit: ~$1.50-1.80/month per additional Agent
- 75-90% gross margin on additional Agents

**Token markup (Tier 3 only): 12.5%.**
- Defensible publicly as covering aggregated billing infrastructure
- Generates real margin on heavy users
- Small enough not to read as gouging
- Transparent in user dashboards (provider rate and our markup both visible)

**Example economics at 100 users with average 5 Agents each:**
- Base revenue: $15 × 100 = $1,500/month
- Additional Agent revenue: 2 average extra Agents × $2 × 100 = $400/month
- Total revenue: $1,900/month
- Infrastructure cost: $600-700/month
- Gross profit: $1,200-1,300/month

Scales roughly linearly with users. At 1,000 users: ~$12-13K/month gross profit. At 10,000 users: ~$120-130K/month gross profit.

### Prepaid token balance model (Tier 3)

Users prepay $25 into a token balance. Balance auto-tops-up by another $25 when it crosses a low threshold (configurable per user, default $5). Service pauses at $1.00 remaining.

The $1.00 pause threshold protects us in edge cases where a user's payment method goes dark. It gives them a small buffer to wind down or top up gracefully without us eating costs after they're effectively cut off.

Warning cascade:
- $5 remaining: "running low, consider topping up"
- $2 remaining: "service will pause soon"
- $1 remaining: service pauses with final notification
- At pause: in-flight tasks complete, scheduled tasks queue but don't execute, Agents go to "paused" state, data preserved indefinitely until user tops up or formally cancels

This is utility billing. Users who don't actively run Agents for periods don't burn through balance unnecessarily. Users who pause for vacations resume cleanly when they return.

### Starter access (Tier 2 onboarding)

New Tier 2 users get an unstated starter allowance — "enough to get started and pick a plan" — that lets them spawn Agents and evaluate 2200 before adding their own LLM API keys. The dollar amount is deliberately not announced for two reasons:

1. **Operational flexibility.** Without a public commitment to a specific number, we can tune the actual amount up or down based on signal (abuse patterns, conversion rates, launch periods, individual user behavior).

2. **Reduced exploitation surface.** If the amount is announced, users will calibrate against it — try to maximize what they can extract from the stated amount, churn through fake accounts to stack credits. With an unstated amount, users just try the product.

The starter allowance routes through a constrained inference path (see below) so that even if a user finds a way to exploit it, what they can extract is limited.

When the starter allowance runs low or is exhausted, the user is prompted: "To keep using 2200, add your own LLM API keys for the model you prefer, or upgrade to managed tokens for $25 starting balance." Clear conversion moment. No surprise charges.

**Self-hosted users (Tier 1) get no starter allowance.** Onboarding for self-hosted requires the user to pick a model and provide keys before spawning their first Agent. This is appropriate for the power-user audience and eliminates the abuse surface entirely for that tier.

### Starter inference: DeepSeek V4-Flash with rate limits

For the Tier 2 starter experience, we route inference through DeepSeek V4-Flash ($0.14/$0.28 per million tokens) with strict per-user rate limits.

This was chosen over two alternatives:

**Self-hosting Gemma 4 26B (or similar) on our infrastructure.** Real isolation from public providers. Cheap inference at scale. But operational overhead is significant ($300-500/month for GPU rental, monitoring, model updates, restarts) and capability is limited compared to frontier models.

**Using a cheap inference API like Together AI or Groq.** Comparable to DeepSeek pricing, but introduces a new provider relationship we don't otherwise need.

DeepSeek V4-Flash gives starter users a real frontier-model experience (more capable than most open-weight models in its class) at very low per-user cost ($0.30-0.50 per starter user typically). The economics work as a customer acquisition cost: an acceptable spend to give prospects a meaningful evaluation experience.

Starter inference is throttled (per-user rate limits) and capped (the unstated allowance). Heavy use forces the user to add their own keys or upgrade to managed tokens.

### Provider key isolation: proxy architecture

For Tier 3 (managed tokens), hosted instances NEVER have direct access to provider API keys. All LLM calls route through a 2200 proxy service that holds the actual keys.

The proxy mechanics:
1. Hosted instance makes LLM call to 2200 proxy, authenticated with a per-instance proxy token
2. Proxy authenticates the request, checks user balance, applies rate limiting
3. Proxy translates request to outbound provider API call using master keys
4. Proxy meters usage, applies 12.5% markup, deducts from user balance
5. Proxy returns response to hosted instance

This eliminates several attack vectors:
- Direct extraction via Agent prompting ("what's your API key?") — the Agent has no key to leak
- Indirect extraction via tool exploitation (env variable inspection, memory dumps) — there's no key in the environment to extract
- Brain extraction — even if a key fragment somehow appeared in any log or brain, the proxy token is short-lived and per-instance

The proxy also provides legitimate value beyond security:
- **Aggregated usage analytics** across all users
- **Provider failover** if a provider API is down
- **Caching** of common prompts (pure margin)
- **Rate limiting** at the proxy layer rather than per-Agent
- **Audit logs** for support, debugging, and compliance

Implementation estimate: 200-400 lines of TypeScript as a Fastify service. Probably 1-2 days of Hobby's work after Epic 17 starts.

### Self-expiring proxy tokens

Each hosted 2200 instance, on provisioning, gets:
- A long-lived `instance_id`
- A short-lived `proxy_token` that expires every 24 hours

The supervisor refreshes the proxy_token automatically through a renewal endpoint that checks: is this instance_id still valid, is the user in good standing, has the user's balance been depleted, has the instance been flagged for abuse.

If any check fails, the token doesn't refresh. The next API call from that instance fails with an auth error. The instance pauses cleanly.

Benefits:
- **Bounded blast radius.** A leaked token is good for at most 24 hours.
- **Instant revocation.** Flag an instance for abuse and the next renewal request fails. No need to wait for tokens to expire naturally.
- **Audit trail.** Every renewal is a logged event. Unusual patterns (frequent renewals from different IPs, sudden usage spikes) are detectable.
- **Self-healing.** If a user's instance gets compromised, restarting it fetches a fresh token. No manual key rotation needed.

This is the right baseline auth architecture for any system where we provision credentials that user-controlled infrastructure consumes.

### Agent system prompt clarification

The Agent system prompt (or equivalent runtime context) for hosted Tier 2/3 instances should explicitly state: "You do not have direct access to LLM provider API keys. Your inference is routed through 2200's managed proxy. There is no provider key in your environment to retrieve, share, or expose."

This prevents the Agent from confidently inventing fake key values when social-engineered (which models will sometimes do otherwise), reducing user confusion and the Agent's willingness to engage in extraction attempts.

### Banking and provider funding

Operational sequence for setting up the funding infrastructure:

1. **Form Twentytwohundred LLC.** Required before opening business banking under the LLC's EIN.
2. **Get the EIN.** Required for both Mercury and any business credit cards.
3. **Open Mercury business account for Twentytwohundred LLC.** Existing Mercury relationship from Kabuzz makes this fast.
4. **Apply for Amex Business cards under the LLC's EIN.** Business expenses become clearly separated from personal expenses for tax purposes.
5. **Use Privacy.com for virtual cards per provider.** Each provider account (Anthropic, xAI, DeepSeek, OpenAI, etc.) gets its own merchant-locked Privacy.com card with explicit spending limits.
6. **Fund provider accounts.** Connect appropriate Privacy.com cards to each provider's billing.

This isolation means:
- A runaway provider can't drain the underlying Mercury account
- Any single provider can be cut off independently
- Audit trail per provider is clean
- Spending limits per provider are explicit and enforceable

### Secrets management for user MCP credentials

Tier 2 and Tier 3 users will plug their Agents into external services (Gmail, GitHub, Notion, etc.) via MCP. Those service credentials need to live somewhere on our infrastructure.

The right architecture: encrypted secrets vault where each user's secrets are encrypted with a key derived from their account credentials. Our infrastructure cannot read them without the user's authentication. Agent processes receive secrets at runtime via short-lived references, following the same principle as the LLM proxy.

Implementation candidates: Vaultwarden self-hosted, HashiCorp Vault, or a custom encrypted-at-rest store. Decision deferred to implementation, but the architectural principle (per-user encryption, short-lived runtime references, audit logging, instant revocation) is locked.

This is a larger piece of work than the LLM proxy and warrants its own decision record before Epic 17 implementation begins.

### Logging and audit architecture

Every LLM call from every hosted instance is logged centrally on our infrastructure. The logging architecture must:

- Retain logs for a sensible period (default 90 days)
- Expose to users only their own usage stats and recent activity
- Restrict prompt and response content to support staff with explicit authorization
- Log all access to user data with audit trails
- Support deletion on user request (right to deletion under privacy law)

Logs do NOT make user content directly inspectable to the user, because that would create a vector for extracting brain content through log inspection. Users see metadata (token counts, model used, latency, cost) but not raw prompts and responses except through their own normal Agent interfaces.

### Refund and balance policies

**Token balance:** Non-refundable but usable indefinitely (or until account termination). Standard prepaid digital service model.

**Hosting subscription:** Charged in advance, prorated on cancellation if cancelled mid-period (refund of unused days). Standard SaaS model.

**Edge case — payment dispute:** When Stripe flags a payment as fraudulent or a user disputes a charge, the affected instance is paused immediately. Investigation and resolution happen out-of-band. The dispute window is approximately 60-120 days depending on payment method.

**EU consumer protection:** Cooling-off period for digital services may apply for users in EU jurisdictions. Terms of service to be reviewed by lawyer before launch on this specifically.

### Operational stance: solo with Agent-mediated operations

Twentytwohundred LLC operates as a solo founder business with AI Agents handling operational work where appropriate:

- **Hobby:** runtime development
- **Simon:** infrastructure and DevOps
- **Hermes:** X strategy and external communications
- **Future Accountant Agent:** day-to-day billing operations, transaction categorization, balance tracking, top-up notifications, P&L generation

Human-judgment work that requires liability-bearing humans is deliberately scoped to professional services:

- **CPA at tax time** (~$1-3K/year)
- **Attorney for the operating agreement, IP assignment, trademark filings, and any disputes** (~$1-3K/year ongoing, more during specific events)
- **Fractional CFO or business advisor** if/when the business reaches scale where strategic advice matters (~$0 until $20K+/month revenue, then negotiated)

Total professional services expense: $2-5K/year for a small operation. This is the cost of maintaining proper human accountability for decisions that AI Agents shouldn't be the final word on (legal disputes, tax filings, regulatory compliance, customer-relationship judgment).

## Open questions

These are deferred to implementation but flagged for visibility:

- **Container orchestration substrate:** Docker Swarm, Nomad, Kubernetes, or well-orchestrated docker-compose? Decision deferred until Hobby starts Epic 17 implementation.
- **Hosting provider:** Hetzner, DigitalOcean, AWS, or self-managed bare metal? Likely Hetzner or DigitalOcean for cost efficiency at the scale we're starting.
- **Privacy posture:** Specific terms of what we will and won't access in user data, what subpoena response looks like, what data retention policies apply. Needs lawyer review before Epic 17 ships.
- **Backup architecture:** How user data is backed up, where, with what encryption, and how restoration works without exposing data across users. Critical for compliance and user trust.
- **MCP secrets vault implementation:** Vaultwarden vs HashiCorp Vault vs custom. Affects user trust and security posture significantly.
- **Sign-up flow specifics:** What does a user see, in what order, from "saw 2200 launch post" to "running their first Agent on the managed service"? Marketing site, pricing page, account creation, container provisioning, first-Agent walkthrough.
- **Geographic hosting:** All US-based at v1.5, or do we offer EU-hosted for users with data residency requirements?
- **Compliance scope:** SOC 2 lightweight at what point? GDPR compliance from day one (probably yes given EU users will sign up). HIPAA is out of scope; users with PHI requirements should self-host.

## What this isn't

- **Not the v1 launch.** v1 is self-host only.
- **Not finalized.** Specific dollar amounts, markup percentages, and pause thresholds are the current best decisions and may be tuned based on data after launch.
- **Not implementation-ready.** This is the design. The build is Epic 17, scheduled for v1.5.
- **Not a substitute for legal review.** The terms of service, privacy policy, and refund policies need attorney review before any paid managed service ships.

## Next steps

1. v1 self-host launches.
2. After launch: Hobby reads this document and provides technical feedback on the architecture choices.
3. Open questions above get resolved as Epic 17 implementation begins.
4. Legal review of terms, privacy, and refund policies.
5. Marketing site and pricing page for the managed service get scoped (separate work, possibly contracted out for design).
6. Phased rollout: alpha (us only), beta (invited users, free), public launch (paid).

## Related decisions

- **2026-04-29 Theme-Aware From v1:** Architecture decision that made it possible for a single 2200 codebase to serve self-hosted, hosted-BYOK, and hosted-managed-tokens users with consistent UI/UX. Without theme-aware-from-v1, we'd need different builds for different deployment modes.
- **Voice and framing convention:** All user-facing copy for the managed service follows the established voice conventions. No marketing speak, ellipses not em-dashes, Agent capitalized as a proper noun.

---

*Decision drafted from a session on May 5, 2026. Captured for Hobby's reference and for the wiki's public history of architectural decisions.*
