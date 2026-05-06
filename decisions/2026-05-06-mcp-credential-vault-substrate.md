---
title: "MCP credential vault: extend the self-hosted vault primitive, not Vaultwarden or HashiCorp Vault"
type: decision
status: accepted
date: 2026-05-06
tags: [security, managed-service, secrets, vault, epic-17, epic-9]
linked_docs:
  - "[[2026-05-05-managed-service]]"
  - "[[../conventions/security-architecture-hosted-mode]]"
  - "[[../epics/09-tool-system]]"
canonical_path: wiki/decisions/2026-05-06-mcp-credential-vault-substrate.md
---

# MCP credential vault: extend the self-hosted vault primitive

## Context

The 2026-05-05 managed-service decision locked the architectural principle for storing user-installed MCP credentials (OAuth tokens, API keys, etc.) on our hosted infrastructure: per-user encryption derived from account credentials, runtime references short-lived, audit logging, instant revocation. That decision deferred the substrate choice to "implementation," and called out three candidates: Vaultwarden self-hosted, HashiCorp Vault, or a custom encrypted-at-rest store.

I flagged this in my technical-feedback section of that decision: the vault is the riskiest piece of Epic 17 (it holds user OAuth tokens; a substrate vendor compromise is operationally significant), and the substrate choice should be locked before any build work begins.

This decision picks the substrate.

## Decision

**Extend the existing Epic 9 Phase B per-Agent credential vault primitive into a per-user, per-Agent vault for hosted mode.** Do NOT adopt Vaultwarden or HashiCorp Vault as a hosted-mode dependency.

## Why

### The existing vault is most of the way there

Epic 9 Phase B already shipped a credential vault on self-hosted instances:

- One JSON file per credential at `<home>/state/credentials/<agent>/<name>.json`
- AES-256-GCM seal over the credential value + metadata (provider, scopes, expires_at)
- Per-Agent wrapping key derived via HKDF-SHA256 from a per-instance master key + per-Agent salt + a credential-namespace info string
- Per-instance master key at `<home>/state/master.key` (32 random bytes, mode 0600)
- Mode-0600 files, mode-0700 directories
- Atomic writes via temp-and-rename

What hosted mode adds:

- A second key-derivation step: instead of a single per-instance master key, the wrapping key is derived from the user's account-credential-derived per-user master key. Compromise of the host filesystem still requires the user's auth to read their credentials.
- A per-user namespace under `<home>/state/credentials/<user_id>/<agent>/<name>.json` (the existing self-hosted layout collapses to a degenerate one-user case).
- An audit-logging hook: every credential resolution event writes to a per-user audit log.
- A revocation primitive: writing a tombstone file purges the credential immediately and the cached wrapping key is invalidated.

That is roughly **500 lines on top of the existing primitive**, including tests. The crypto primitives are unchanged; the new code is per-user key derivation plumbing + audit + revocation.

### Vaultwarden is the wrong shape

Vaultwarden is a self-hosted Bitwarden server. It is mature and battle-tested for the **password manager** use case: human-readable secrets, browser extensions, mobile app sync, file attachments, organizations.

It is the wrong shape for our use case:

- **Use-case mismatch.** We need machine-to-machine credential issuance with short-lived runtime references. Bitwarden's API was designed for browser-extension fetch-and-fill patterns. Forcing our flow through it is shoehorning.
- **Operational overhead.** Vaultwarden is a separate service we'd run as a sidecar or shared component: needs its own database (PostgreSQL or SQLite), its own ports, its own user management, its own backup story. At our 30-50-tenants-per-server scale, that's meaningful operational cost for no architectural win.
- **License surface.** Vaultwarden is GPLv3. Linking a GPLv3 service into our Elastic v2 codebase is fine at the network boundary (we'd talk to it over HTTP), but any SDK or shared-library lift would create a license-compatibility problem we don't need.
- **Dependency posture.** Per the operating thesis (`project_2200_operating_thesis`): lean, shippable, focused. Adding Vaultwarden adds a substrate we'd own forever. The custom path adds nothing we don't already understand.

### HashiCorp Vault is too heavy

HashiCorp Vault is purpose-built for secrets management at scale. It's the right answer for an enterprise with hundreds of services, dozens of teams, complex policy-as-code, dynamic secrets, and a dedicated secrets engineer.

It is too heavy for us:

- **Operational complexity.** Vault has a sealing/unsealing protocol, requires Shamir-secret-sharing key custodians, runs as an HA cluster for production reliability, has a dedicated configuration language for policies. Real operational ceremony.
- **Scale mismatch.** At 30-50 tenants per server, dynamic secrets and complex policy aren't a problem we have. We have one policy: "this user can read their own credentials." Vault is overkill.
- **License surface.** Vault recently moved to BUSL (Business Source License), which is in the same family as our Elastic v2 (good news, no compatibility problem) BUT means anyone we host the vault for has a separate license relationship with HashiCorp. Adds friction with no benefit.
- **Dependency posture.** Same operating-thesis argument as Vaultwarden: this is a substrate we'd own forever, and we don't need the capabilities it provides.

### The custom path is the operating-thesis answer

The 2200 operating thesis (`project_2200_operating_thesis`) explicitly favors lean, shippable, focused choices over importing complex external dependencies. The MCP-credential-vault is a concrete instance of that philosophy:

- We already understand the shape (Epic 9 Phase B shipped the primitive).
- The crypto is well-understood (AES-256-GCM, HKDF-SHA256; the same primitives the SCUT keystore uses).
- The new code is small and isolated to one module.
- There is no substrate-vendor-compromise risk to think about — we are the substrate.
- We can change anything we need to change about the security posture without negotiating with an upstream project.

The risks (custom crypto needs to be right) are real but bounded: AES-256-GCM is a one-line API call, HKDF-SHA256 is a one-line API call. We are not designing new primitives; we are stacking well-known ones with tests at every layer.

## Implementation outline

This is the implementation outline so Epic 17 has a concrete shape to consume. **Not implementation-ready** ... when Epic 17 starts and Hobby actually builds this, the shape may shift on review.

### Storage layout

```
<home>/state/credentials/
├── _users/
│   └── <user_id>/
│       ├── salt                # 32 random bytes, mode 0600
│       ├── audit.log            # append-only, mode 0600
│       └── agents/
│           └── <agent>/
│               └── <name>.json # sealed envelope, mode 0600
```

For self-hosted (Tier 1), the existing layout is preserved (`<home>/state/credentials/<agent>/<name>.json`); no `_users/` hierarchy. The vault module accepts a `mode` parameter (`'self-hosted'` vs `'hosted'`) and resolves paths accordingly.

### Key derivation

Per-user master key, derived at user-login time and never persisted to disk:

```
user_master_key = HKDF-SHA256(
  ikm  = account_credential_secret  // password hash, OAuth-derived secret, etc.
  salt = read_or_create('<home>/state/credentials/_users/<user_id>/salt')
  info = '2200-user-master-v1'
  L    = 32
)
```

Per-Agent wrapping key, derived per-credential-resolution from the per-user master:

```
wrapping_key = HKDF-SHA256(
  ikm  = user_master_key
  salt = '<agent>'                   // ascii-encoded agent name
  info = '2200-agent-wrap-v1'
  L    = 32
)
```

Per-credential seal: AES-256-GCM with a fresh random IV per write, 16-byte auth tag, additional-data field carries credential-name + provider for tamper resistance.

### Lifecycle

- **User login:** the API receives the user's account credential (password, OAuth code), derives `user_master_key` in-memory, holds it in the user's session. No persistent on-disk copy.
- **Agent reads a credential:** the runtime requests it through a session-scoped resolver. The resolver fetches the sealed envelope from disk, derives the wrapping key in-memory, opens the envelope, returns the plaintext to the Agent, writes an audit-log entry. The wrapping key + plaintext exist only for the resolution scope (no long-lived in-memory cache).
- **Agent runs in the background after the user logs out:** scheduled tasks need credentials. To support this, on first login the runtime persists a short-lived "session token" (24 hours) in the user's storage; long-lived background work re-derives keys via that token. When the token expires, scheduled tasks pause until next login (consistent with the proxy-token revocation pattern in `[[../conventions/security-architecture-hosted-mode]]`).
- **Revocation:** writing a `revoked` marker file in the credential's path causes the next read to throw and a tombstone to land in the audit log. Garbage collection (periodic, idempotent) reaps revoked entries after a retention window.

### Audit log shape

One JSONL line per resolution event:

```json
{
  "schema_version": 1,
  "ts": "2026-05-06T15:30:00.000Z",
  "user_id": "user_abc123",
  "agent": "hobby",
  "credential_name": "github-read-user",
  "event": "resolved",
  "provider": "github",
  "request_id": "req_..."
}
```

Append-only. 90-day retention (matches the proxy audit-log retention from the parent decision).

## Open questions

These are deferred to implementation, but flagged for visibility:

- **What is the user's "account credential secret"?** OAuth-derived from their identity provider (Google sign-in, GitHub sign-in)? A password hash if we offer email+password sign-in? Both? This decision feeds into how the user authenticates to the API and will be answered when Epic 17's auth substrate is designed.
- **Session-token lifetime for background work.** 24h matches the proxy token TTL, but background scheduled tasks may run for weeks. Does the user re-authenticate periodically to extend, or do we accept "scheduled tasks pause when the session expires"? Probably the latter for v1; the former is a UX-quality follow-up.
- **What happens when the user changes their account password?** All sealed envelopes need to be re-encrypted with a new user_master_key. Either we do it lazily (next read fails, falls through to a re-encrypt path) or eagerly (on password-change, scan + re-seal). Lazy is simpler; eager is more robust. Probably lazy with a cleanup job, but worth thinking through.
- **Backup architecture.** Sealed envelopes can be backed up safely (the wrapping key is not in the backup). But the per-user salt is in the backup, and any account-credential-secret leak combined with the salt allows decryption. The backup posture needs the same care as the live vault.
- **Self-hosted user-mode coexistence.** A self-hosted instance might want to support multiple "users" eventually (e.g., a family running 2200 with separate Agent fleets per person). The hosted vault layout supports this naturally; the self-hosted single-user shape is the degenerate case. No work needed at v1; the layout admits the future shape.

## What this isn't

- **Not a full Identity-and-Access-Management system.** This is the vault; the IAM (who is the user, how do they authenticate, what are their roles) is a separate piece of Epic 17 that this decision does not cover.
- **Not finalized on key-derivation parameters.** The KDF info strings, IV sizes, and tag lengths are documented best-current-practice values. They lock at implementation time; a security review before the alpha/beta of the managed service is appropriate.
- **Not a substitute for security review.** Per the parent decision: legal + security review before any paid managed service ships.

## Related decisions

- [[2026-05-05-managed-service]] § Secrets management for user MCP credentials ... the parent decision that scoped this work.
- [[../conventions/security-architecture-hosted-mode]] § 3 ... the convention doc that consolidates the vault pattern alongside the proxy + token-refresh + container-isolation invariants.
- The Epic 9 Phase B credential vault implementation in `src/runtime/storage/layout.ts` § agentCredentialsDir + the AES-256-GCM seal in `src/runtime/credentials/` ... the primitive this decision extends.

---

*Decision authored 2026-05-06 by Hobby off the back of the doc-integration work for the parent managed-service decision. Captures the substrate choice + rough implementation outline so Epic 17 has a concrete shape to consume when build work begins.*
