---
title: "Security architecture for hosted mode"
type: convention
version: 1.0
created: 2026-05-06
updated: 2026-05-06
tags: [security, managed-service, hosted-mode, epic-17, conventions]
linked_docs:
  - "[[../decisions/2026-05-05-managed-service]]"
  - "[[../02-architecture]]"
  - "[[../epics/04.5-cost-caps-and-usage-telemetry]]"
canonical_path: wiki/conventions/security-architecture-hosted-mode.md
---

# Security architecture for hosted mode

This document consolidates the security pattern that applies to 2200 instances running in our managed service (Tiers 2 and 3). The same 2200 software runs in all three tiers, but hosted mode introduces invariants that self-hosted does not.

The locked decisions that this convention codifies live in [[../decisions/2026-05-05-managed-service]]. This doc is for the operator + future Hobby work that needs the pattern in one place.

Tier 1 (self-hosted) is out of scope here ... the user owns the entire trust boundary and the runtime trusts the host environment fully.

## The threat model in one paragraph

A hosted 2200 instance runs Agents authored by the user. Those Agents have access to user-provided tools (third-party OAuth integrations, MCP servers), user-controlled prompts, and user-readable Brain state. In the managed-tokens tier, the same Agents trigger LLM calls that we pay for. The threat model assumes the user is the adversary in some scenarios (e.g., trying to extract our LLM provider credentials, trying to extract another user's data, trying to free-ride on our token allowance) AND that an external attacker may compromise a user's account or the user's Agent's outputs (e.g., prompt injection from an Agent's tool inputs).

We design for both. The architecture is structured so that a fully-compromised user instance cannot extract value from us beyond what their billing relationship covers, and cannot reach across tenant boundaries.

## Invariants

### 1. No provider API keys in user-facing instances (Tier 3)

Hosted Tier 3 instances NEVER have direct access to LLM provider API keys. The instance's LLM provider configuration points at the 2200 proxy URL, authenticated with a per-instance proxy token. The actual provider keys live on a separate proxy service the user's instance cannot reach.

This eliminates several attack vectors in one move:

- **Direct extraction via Agent prompting.** An Agent prompted "what's your API key?" has no key to leak.
- **Indirect extraction via tool exploitation.** Env-variable inspection, memory dumps, log scraping all return nothing.
- **Brain extraction.** Even if a key fragment ever leaked into a log or brain note, the proxy token is per-instance and rotates daily; it is not the provider key.

Tier 2 (BYOK) instances DO hold provider keys (the user's own), but they are encrypted at rest with a user-credential-derived key and decrypted only at LLM-call time. Same as the MCP credentials vault below.

### 2. Self-expiring proxy tokens (24-hour TTL)

Each hosted instance, on provisioning, receives:

- A long-lived `instance_id` (durable, identifies the tenant)
- A short-lived `proxy_token` that expires every 24 hours

The supervisor automatically refreshes the proxy_token through a renewal endpoint that gates on:

- Is `instance_id` still valid (not deleted, not migrated)?
- Is the user's billing in good standing (Tier 2 hosting fee paid; Tier 3 balance > $1.00)?
- Has the instance been flagged for abuse (manual operator flag or automated pattern detection)?

If any check fails, the renewal fails. The next API call from that instance fails with an auth error and the instance pauses cleanly. No background-process keepalive, no orphan-token problem.

**Why 24 hours specifically.** Long enough that ordinary users never notice (the supervisor refreshes well before expiry). Short enough that a leaked token is good for at most a day. The cadence is a tunable; the invariant is "short-lived + always re-checkable."

**Benefits this delivers as a side effect:**

- **Bounded blast radius.** A leaked token is good for at most 24 hours.
- **Instant revocation.** Flag an instance for abuse and the next renewal request fails. No need to wait for tokens to expire naturally.
- **Audit trail.** Every renewal is a logged event. Unusual patterns (frequent renewals from different IPs, sudden usage spikes, geo anomalies) are detectable.
- **Self-healing.** A user's restarted instance fetches a fresh token. No manual key rotation needed for ordinary state recovery.

### 3. Encrypted MCP-credential vault per user

Tier 2 and Tier 3 users will plug their Agents into external services (Gmail, GitHub, Notion, etc.) via MCP. Those service credentials live on our infrastructure but are encrypted at rest with a key derived from the user's account credentials. Our infrastructure cannot read them without the user's authentication.

Agent processes receive credentials at runtime via short-lived references, following the same pattern as the LLM proxy. The references resolve to plaintext at the point of use; the credentials never sit in memory longer than necessary.

**Operational requirements:**

- All access (resolution events) is audit-logged.
- Instant revocation when a user disconnects an integration.
- The substrate is locked: extend the existing Epic 9 Phase B per-Agent vault primitive (AES-256-GCM seal + HKDF-SHA256 wrapping-key derivation) into a per-user, per-Agent vault for hosted mode. Vaultwarden and HashiCorp Vault were considered and rejected. See [[../decisions/2026-05-06-mcp-credential-vault-substrate]] for the locked decision and rough implementation outline.

### 4. Per-tenant containers on shared hosts

Each hosted user runs in their own isolated container (Docker or Podman) with a dedicated data volume mounted in. Resource limits (CPU shares, memory limits, file-descriptor caps) prevent one user's runaway Agent from starving others on the same host.

This boundary is real, not theoretical:

- Filesystem isolation: container-level. User A cannot read user B's data volume.
- Process isolation: container-level. User A's Agents cannot signal or trace user B's Agents.
- Network isolation: container network namespace. Outbound calls go through a gateway we control (which is also where the LLM proxy lives).

Capacity planning: ~30-50 tenants per beefy server (8 vCPU, 32GB RAM class). Scale horizontally by adding shared hosts.

This was chosen over per-VM (margins too thin at our $15/mo price point) and multi-tenant supervisor (security boundaries are software-only, hard to enforce). Containerized per-tenant is the right point on the isolation/economics curve at our scale.

### 5. Agent system prompt clarification (managed mode)

When 2200 runs in hosted mode, the Agent's system prompt (or runtime context equivalent) explicitly states:

> You do not have direct access to LLM provider API keys. Your inference is routed through 2200's managed proxy. There is no provider key in your environment to retrieve, share, or expose.

This is a small but real defense against social engineering. Models will sometimes confidently invent fake key values when prompted ("what's your API key?"). Without this clarification, that's noise; with it, the model knows there is nothing to retrieve and either declines or correctly explains.

In Tier 1 (self-hosted) the prompt does NOT include this language ... the user's own keys may genuinely be reachable through the host environment, and that's their responsibility.

### 6. Per-user logging with metadata-only user visibility

The proxy logs every LLM call with metadata (token counts, model used, latency, cost, timestamp). Users see their own metadata + recent activity through the dashboard. Users do NOT see raw prompt/response content through log inspection ... that would be a vector to extract Agent state.

If a user wants to see what their Agent has been doing, the right surface is the Agent's own Brain (the records on disk in their hosted instance), not our centralized logs. The centralized logs are for our operational use + billing accuracy.

Prompt and response content within audit logs is access-restricted to support staff with explicit authorization. All such access is itself logged. Default: 90-day retention, then automated purge.

## Why this lives as a convention

The patterns above are load-bearing for the managed service substrate but apply across multiple epics (Epic 17 implements the proxy; Epic 14 onboarding accommodates the starter-inference path; Epic 9 tools framework gates on the credential vault; Epic 4.5 cost caps reconciles per-user balance with per-Agent budgets). Putting them in one convention doc means Hobby (or any future developer) implementing any one piece can confirm they are compatible with the rest.

## Open questions

These are deferred to Epic 17 implementation but flagged for visibility:

- **Container orchestration substrate** (Docker Swarm / Nomad / Kubernetes / docker-compose-with-discipline) ... affects how the abuse-flag → revoke flow surfaces in operational tooling.
- **Geographic hosting** ... single US region at v1.5 launch, or EU-hosted option for users with data residency requirements? Affects the proxy deployment topology.
- **Compliance scope** ... SOC 2 lightweight at what user count? GDPR compliance from day one (probably yes given EU users will sign up). HIPAA out of scope.
- **Backup architecture** ... user-data backup with encryption, restoration without exposing data across users. Critical for compliance and user trust; details deferred but architecturally must not break the per-tenant isolation invariant.
- ~~**MCP secrets vault substrate** ... Vaultwarden / HashiCorp Vault / custom. A separate decision record before Epic 17 implementation.~~ Resolved 2026-05-06 in [[../decisions/2026-05-06-mcp-credential-vault-substrate]] (extend existing Epic 9 Phase B primitive).

## References

- [[../decisions/2026-05-05-managed-service]] ... locked architecture and pricing for the managed service
- [[../02-architecture]] § Hosting model ... how the three tiers fit into the broader runtime
- [[../03-epic-map]] § Epic 17 ... build sequence
- [[../epics/04.5-cost-caps-and-usage-telemetry]] ... per-Agent budget tracker that reconciles with per-user proxy balance
- [[../legal/privacy-policy]] § 3 ... user-facing description of the audit-log retention policy
- [[../legal/terms-of-service]] § 8 ... user-facing description of the prepaid balance + refund policy

---

*Convention authored 2026-05-06 from the locked decision in `2026-05-05-managed-service.md` after Doug + Guppi's strategy session. Intended as the implementation reference when Epic 17 work begins.*
