---
title: "Migration vaults every OpenClaw credential; runtime.env→vault is deferred to a security pass"
type: decision
status: locked
tags: [decision, migration, vault, security, openclaw]
created: 2026-06-16
canonical_path: wiki/decisions/2026-06-16-secrets-to-vault.md
---

# Migration vaults every OpenClaw credential; runtime.env→vault is deferred

**Decision (Doug, 2026-06-16):** Secrets should live in the encrypted vault, not a plaintext `runtime.env`. Split into two moves, **done separately**:

- **Step 1 (shipped, `2026.616.1518`):** an OpenClaw migration captures *every* credential the user had ... not just the LLM/search keys 2200 uses today ... and seals each into the migrated Agent's encrypted per-Agent vault, so nothing is lost and a future integration can pull what it needs.
- **Step 2 (deferred):** make the vault 2200's single source of truth and demote `runtime.env`. Gated on master-key hardening; handed to a pre-public security pass.

## Step 1 ... what shipped

`collectOpenClawSecrets` sweeps the whole `env` block plus every secret-named leaf (`apiKey`/`token`/`secret`/`password`/`clientSecret`/`refreshToken`, exact key-name match so `maxTokens` etc. are not swept) anywhere in `openclaw.json` ... `models.providers.*`, `skills.entries.*`, `channels.*`, `gateway.auth`, `plugins.*`. A dry run against a real config also showed OpenClaw's `models.providers.*.apiKey` hold `${ENV_VAR}` *references*, not literal keys, so pure `${...}` placeholders are skipped (`2026.616.1702`). Each value is sealed into `CredentialVault(home, agent)` under an `oc-<source-path>` slug.

The functional keys (LLM, web search) still *also* go to `runtime.env` so they work immediately; the vault is the complete archive on top.

**Why it's safe today:** the vault is per-Agent AES-256-GCM, and **nothing exposes it to the Agent/LLM** ... there's no tool that reads arbitrary vault values (`credential_has` is existence-only; `credential_request` asks the operator). Vaulted secrets surface only when a configured `SecretRef` references one by name. So sweeping everything is preserve-for-later, not expose-now.

## Step 2 ... the part that actually matters, and why it's deferred

The honest caveat: the vault's master key currently lives in a **plaintext file on the same disk, same mode, same user** as `runtime.env` (a documented v1 limitation, same posture as the SCUT keystore). To a local attacker who can read `runtime.env`, "everything in the vault" changes almost nothing ... they read the master key sitting next to it and decrypt.

So encrypting leaf secrets buys real defense-in-depth (logs, swap, backups, an accidental sync of the wrong dir, screen-shares, a process that reads files but not the keystore) ... but it is **not** a new threat-model guarantee against a local attacker. That only comes from **protecting the master key**: macOS Keychain locally, a passphrase entered at `daemon start` for Linux/Heisenberg, TPM later.

**Doug's call:** ship step 1 now; let security-conscious people decide step 2 + key-hardening when we go public. Step 2 and master-key hardening go together ... shipping step 2 without it would be lipstick. "We've already done more than OpenClaw and most others have; that's not nothing."

See [[2026-06-16-connectors-dependency-free-gateways]] (connectors seal their tokens the same way) and the OpenClaw adapter spec [[../epics/05-phase-b-openclaw-adapter]].
