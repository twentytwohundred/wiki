---
title: "Epic 4: SCUT identity at spawn"
type: epic
status: draft
tags: [epic, scut, identity, agents, spawn, controls]
created: 2026-04-28
updated: 2026-04-28
linked_docs:
  - "[[03-epic-map]]"
  - "[[02-architecture]]"
  - "[[02-agent-runtime-minimum]]"
  - "[[2026-04-24-hobby-as-primary-agent]]"
  - "[[2026-04-26-schema-version-format]]"
  - "[[upgrade-readiness]]"
  - "[[license-posture]]"
  - "[[build-phase-decisions]]"
canonical_path: wiki/epics/04-scut-identity-at-spawn.md
---

# Epic 4: SCUT identity at spawn

The substrate phase of Epic 4. Every Agent spawned in 2200 gets a persistent SCUT identity at creation time: an on-chain tokenId, a custodial Ed25519 signing key, a custodial X25519 encryption key, and a `scut://` URI that addresses the Agent across instances.

This is Phase A of the broader Epic 4 shape (cross-instance messaging is Phase B). The map's full Epic 4 also includes inbox + send + known-contacts list + user-approval flow for unknown contacts. Those land on top of this substrate, separately. Naming this `04-scut-identity-at-spawn.md` rather than `04-` keeps the runway clear for the Phase B spec.

## Why this epic

Three things downstream depend on Agent identities being persistent and verifiable:

1. **Audit and accountability.** Every action an Agent takes in the runtime should be attributable to a stable identity, not a process ID or a name. "Hobby spent $X today" or "Hobby modified file Y" needs a stable from-field that survives restarts and migrations.
2. **Cost attribution and ceilings.** [[04.5-cost-caps-and-usage-telemetry]] needs a stable per-Agent identifier to attach budgets and telemetry to. The SCUT tokenId is that identifier.
3. **Cross-instance addressability later.** Once Phase B (inbox + send) lands, the identity at spawn is what makes SCUT messages possible. Building it now means Hobby and the rest of the seed team migrate into 2200 with identities ready to use.

CLAUDE.md flags identity at spawn as "don't defer this... it's load-bearing for Epic 4 and downstream. Simple custodial keys are fine for v1." This spec implements that.

## Scope

When an Agent is created (CLI: `2200 agent create <name>` or a future onboarding flow), the supervisor runs the identity provisioning pipeline:

1. Generates an Ed25519 keypair (signing) and an X25519 keypair (encryption).
2. Persists the private keys to the Agent's identity directory under encrypted-at-rest storage.
3. Constructs a SCUT Identity Interface (SII) v1 document containing the public keys, an empty preferred-relay list (populated later), and the protocol-capabilities block.
4. Publishes the SII document to a 2200-hosted identity URL.
5. Calls the SII-compliant identity registry contract on Base to mint a new tokenId for the Agent, with the published URL set as `scutIdentityURI(tokenId)`. Pays gas from the seed-team shared custodial wallet.
6. Writes the resulting `scut://<chainId>/<contract>/<tokenId>` URI plus public keys back into the Agent's Identity file.
7. Surfaces a Passive notification confirming registration (or an Important notification on failure).

After this epic, every Agent has a `scut_uri` field in its Identity, signing and encryption keys reachable to the runtime, and is verifiable against on-chain state. No messaging primitives yet; that is Phase B.

There is no UI in this epic. The CLI is the surface. Web/mobile config of identities lands when Epic 15 / 16 land.

## Includes

### Identity provisioning pipeline

The supervisor exposes a control-plane RPC `cli.identity.provision`. The `2200 agent create` CLI calls it as part of agent creation. The pipeline is restart-safe per [[upgrade-readiness]] discipline 3: each step is checkpointed to disk before the next runs, so a crash mid-provision can resume rather than restart.

States, persisted to `state/identities/<agent_id>/provision-state.json`:

| State | Meaning | Recovery |
|-------|---------|----------|
| `pending` | RPC accepted, nothing done yet | Restart from the top |
| `keys_generated` | Ed25519 + X25519 keypairs exist on disk | Resume at SII document construction |
| `doc_constructed` | SII document JSON written to local staging | Resume at publish |
| `doc_published` | Document URL is live and serving | Resume at on-chain register |
| `registered` | tokenId minted, scutIdentityURI set, tx confirmed | Done; write to Identity file |
| `errored` | Pipeline failed, recovery requires user attention | Surface notification, leave state for inspection |

Each transition writes the new state file atomically (temp + rename), so a crash between writes leaves a recoverable file on disk.

The pipeline is idempotent at every step: a second invocation re-checks state and either resumes or no-ops. A `2200 agent identity status <name>` CLI command reads the provision-state file and shows the current step, with re-attempt and abort flags.

### Custodial key storage

Per CLAUDE.md "simple custodial keys are fine for v1." Keys live on the local filesystem under the Agent's identity directory:

```
state/identities/<agent_id>/
├── identity.json           public document, copy of what was published
├── keys/
│   ├── signing.ed25519     32-byte raw private key, encrypted at rest
│   ├── encryption.x25519   32-byte raw private key, encrypted at rest
│   └── salt                key-derivation salt
└── provision-state.json    pipeline state
```

**At-rest encryption.** Per-instance master key (`state/master.key`, generated on supervisor first boot) wraps each Agent's signing and encryption keys via AES-256-GCM. The master key is plaintext on disk for v1; OS keychain / TPM integration is post-launch hardening, tracked as a known v1 limitation.

**Loading.** On Agent start, the supervisor reads the per-Agent encrypted private keys, decrypts in-process, and passes them to the Agent process via a control-plane handshake (existing UDS+JSON-RPC channel from [[2026-04-26-control-plane-protocol]]). Keys never appear on disk in plaintext, never transit the public network, and never leave the supervisor↔Agent socket pair.

**Rotation.** Out of v1 scope. Tracked as a follow-on epic. Identity-rotation semantics are non-trivial in SCUT (in-flight messages, recipient cache invalidation) and the spec acknowledges this is v2 territory.

### SII document construction

The pipeline constructs a JSON document conforming to the OpenSCUT SII v1 schema (per the [SCUT spec §4.3](https://github.com/douglashardman/openscut/blob/main/spec/SPEC.md#43-document-schema)):

```json
{
  "siiVersion": 1,
  "agentRef": {
    "scheme": "scut",
    "chainId": "<base-chain-id>",
    "contract": "<sii-contract-address>",
    "tokenId": "<minted-tokenId>"
  },
  "publicKeys": {
    "ed25519": "<base64-encoded-32-byte-public-key>",
    "x25519": "<base64-encoded-32-byte-public-key>"
  },
  "relays": [],
  "capabilities": {
    "protocolVersion": "0.2.0",
    "maxPayloadBytes": 65536
  }
}
```

The `relays` list is empty at v1. Phase B will populate it when the runtime knows what relay endpoints to advertise. SCUT's resolver tolerates an empty relay list — it just means the identity is not yet receivable. The agent is still addressable and verifiable; just nobody can deliver to it until a relay is registered.

The `chainId` and `contract` values come from per-instance configuration (`config/scut.toml`), defaulting to the Base mainnet SII contract address that Garfield ships. The supervisor refuses to provision identities if these values are unset.

Document filename on disk: `state/identities/<agent_id>/identity.json`. Document URL after publish: per-instance config, defaulting to `https://identities.2200.ai/<tokenId>.json` (Doug's lane to set up DNS and hosting in coordination with Garfield).

### Identity document publishing (substrate, not the production hoster)

This is the one piece that depends on Garfield's coordination. v1 publishing approach:

- **Default in code:** the supervisor writes the SII document to `state/identities/<agent_id>/identity.json` and stops. The pipeline state advances to `doc_constructed`.
- **The `publish` hook:** an out-of-process command (`scripts/publish-identity-doc.sh`) takes the document path and the target URL and uploads it. Default implementation in v1: a wrapper that pushes the JSON to a configured bucket / GitHub-Pages-style hoster. Doug + Garfield decide the hoster; the supervisor doesn't care which one.
- **Failure mode:** if `publish` fails, pipeline halts at `doc_constructed`, surfaces an Important notification, and the next invocation retries.

This is the principled-deferral piece. The substrate (keypair, document, registration call shape) ships; the hoster URL is the named blocker. See [the inbox brief to Garfield](../inbox/garfield/2026-04-28-2200-needs-from-scut-for-epic-4.md) for the coordination.

### On-chain registration

The supervisor uses an `ethers.js` v6 provider (configured in `config/scut.toml`) to:

1. Read `config/scut.toml` for the SII contract address, the chain ID, the seed-team wallet's private key (or remote signer URL), and the gas-fee strategy.
2. Construct a transaction calling the contract's mint function (specific function name and signature comes from Garfield's contract spec, per the inbox brief).
3. Sign the transaction with the seed-team wallet's key.
4. Submit, wait for confirmation (default: 1 confirmation on Base, configurable).
5. On confirmation, parse the tokenId from the transaction logs and advance state to `registered`.

**Wallet model.** v1 uses a single seed-team-shared custodial wallet on Base. Doug confirmed (2026-04-28 chat): "$500 loaded on that wallet, ~$0.01 per identity, ~50,000 identities of runway." The wallet's private key (or a remote-signer URL pointing to a hosted signer) lives in `config/scut.toml`, encrypted at rest with the same per-instance master key as Agent keys. Per-Agent wallets are out of v1 scope; if 2200 ever needs them (e.g., for managed-service multi-tenant isolation), that is a follow-on epic with its own decision record.

**Funding alerts.** The supervisor watches the wallet balance after every successful registration. Below a configurable threshold (default: 100 registrations of headroom at current gas prices), it emits a tier-2 (Important) notification: "Identity wallet balance is low: $X remaining (≈N more registrations). Top up at <Garfield's documented funding flow>." Below 10 registrations, tier-1 (Critical) and the supervisor refuses to provision new identities until topped up.

### Identity field shape in the Identity file

Per [[2026-04-26-schema-version-format]], the Identity file's existing schema_version bumps when this epic lands. The new fields are at the top level of the Identity file:

```yaml
schema_version: 2  # was 1; bumped by this epic
name: hobby
# ... existing fields ...

scut:
  uri: scut://8453/0xabc.../12345
  chain_id: 8453
  contract: 0xabc...
  token_id: 12345
  identity_doc_url: https://identities.2200.ai/12345.json
  public_keys:
    ed25519: <base64>
    x25519: <base64>
  registered_at: 2026-04-29T15:23:00Z
  registration_tx: 0xdef...
```

Private keys are NOT in the Identity file. They live in `state/identities/<agent_id>/keys/` (encrypted) and are loaded via the supervisor↔Agent control plane.

**Schema version bump (1 → 2).** Existing Identity files (Hobby's, Simon's) need to migrate. The migration is non-destructive: the `scut` block is added on first identity provisioning, leaving every other field intact. Per [[upgrade-readiness]] discipline 6, the migration is implemented in `src/runtime/identity/migrations/v1_to_v2.ts` and tested with golden-file fixtures.

### CLI surface

```
2200 agent create <name> [--no-identity]    # create + provision (default: with identity)
2200 agent identity provision <name>         # provision identity for an existing agent
2200 agent identity status <name>            # show pipeline state
2200 agent identity show <name>              # print public identity doc
2200 agent identity retry <name>             # re-attempt a stuck pipeline
2200 agent identity wallet-status            # show wallet balance and registration runway
```

The `--no-identity` escape hatch on `create` exists so a developer can spawn an Agent for testing without consuming an on-chain registration. Tagged in metrics so we can see how often it is used in the wild; if rarely, drop in a future epic.

## Done when

- A new Agent created via `2200 agent create <name>` ends up with a SCUT URI in its Identity file, a registered tokenId on Base, public keys verifiable on-chain, and a published SII document at the configured hoster.
- The provisioning pipeline survives a kill-and-restart at any of its six states without re-doing work and without leaving an Agent half-provisioned.
- Hobby and Simon both successfully provision identities through the pipeline against Base mainnet (using the seed-team wallet) and the resulting `scut://` URIs resolve cleanly via the OpenSCUT resolver.
- The wallet-balance check fires correctly when the wallet drops below the warning thresholds.
- Three failure modes are tested end-to-end: hoster unreachable, on-chain RPC timeout, insufficient wallet balance. Each surfaces the right notification and leaves a recoverable state.

## Depends on

- **Epic 2.** Supervisor, control-plane RPC, Identity loader, schema versioning, notification file format. All in place.
- **Epic 7 substrate.** Notification routing for the wallet-balance and provisioning notifications. Currently the runtime emits notifications to local files (per Epic 2's interim implementation). v1 of this epic uses the same path; full notification routing lands in Epic 7.
- **OpenSCUT v1.** Specifically: an SII-compliant contract deployed on Base that 2200 can mint into. Garfield owns this. See the inbox brief for the specific asks.
- **Identity-doc hoster.** A URL that 2200 can publish identity documents to. Doug + Garfield's lane to choose and stand up.

## Open product calls (none — answered 2026-04-28)

- ~~Per-Agent vs shared custodial wallet at v1?~~ Shared, per Doug's 2026-04-28 chat.
- ~~Funding ceiling and topup mechanism?~~ Garfield owns the topup; the supervisor enforces a low-balance gate via notifications.

## Out of scope (deferred to Phase B and beyond)

- SCUT inbox + send tools (Phase B of Epic 4)
- Known-contacts list + user-approval flow for unknown senders (Phase B)
- Identity rotation semantics (post-v1)
- Per-Agent wallets (post-v1, only if managed service requires)
- TPM / OS-keychain integration for the master key (post-v1 hardening)
- Full ERC-8004 conformance beyond SII v1 (v2 once SCUT lands it)
- UI for browsing and managing identities (Epic 15 / 16)

## Upgrade-readiness

| Discipline | How this epic holds it |
|-----------|------------------------|
| Schema versioning | Identity file bumps from `schema_version: 1` to `schema_version: 2`. Migration script with golden fixtures. SII document carries `siiVersion: 1`. |
| State on disk | `state/identities/<agent_id>/` is the source of truth. Nothing lives in memory across the supervisor↔Agent control plane handshake. |
| Restart safety | Provisioning pipeline checkpoints at six states; resume is a no-op if no work to do. |
| Tool-call inspectability | All on-chain calls go through the runtime's tool surface (`scut.identity.register`, `scut.identity.publish`) and are logged with plan/run/perm wrapping per Epic 2. |
| Idempotent tasks | Re-running `provision` against an Agent already in `registered` state is a no-op that exits cleanly. |
| Inspectable persisted artifacts | Identity files are markdown+frontmatter (existing pattern). SII documents are plain JSON. Pipeline state is JSON. All readable by `cat` or any text editor. |

## Notes

### Why not punt the on-chain piece entirely for v1

A "fake SCUT identity, no on-chain registration" version was considered. The substrate would still be useful for cost attribution. But:

- The seed-team wallet has runway (50K+ registrations) and registration cost is trivial.
- Hobby migrates into 2200 first. Hobby's identity should be real, not fake, because dogfooding the on-chain path catches integration bugs before David is born.
- Phase B (cross-instance messaging) cannot ship without real on-chain identities, so doing the work now means Phase B ships faster.

Decided: ship real on-chain registration in v1.

### Coordination with Garfield

The contract spec, the funding flow, the relay strategy, and the document hoster are all SCUT-side concerns Garfield owns. Hobby's lane stops at the runtime integration. Two artifacts in flight:

1. The inbox brief at `wiki/inbox/garfield/2026-04-28-2200-needs-from-scut-for-epic-4.md` lists what 2200 needs from Garfield: contract address on Base, mint-function signature and ABI, gas estimate, document hoster URL pattern, wallet-funding documentation.
2. Once Garfield responds (or Doug coordinates the answers in the meantime), the open items in this spec lock down and we move to building.

### Connection to Epic 4.5 (cost caps and usage telemetry)

Epic 4.5 attaches budgets and usage telemetry to the SCUT URI established here. The two epics build in parallel; 4.5 is a no-op without 4 and 4 is wasted without something attached to it (4.5 is the first such thing).

## Format provenance

Spec drafted by Hobby on 2026-04-28 after Doug's 2026-04-28 chat answered the open product calls (shared custodial wallet, $500 loaded, ~50K identities of runway, Garfield owns the topup mechanism). Ships as Phase A of the broader Epic 4 in the [[03-epic-map]]; Phase B (cross-instance messaging) lands in a follow-on spec.

Build-phase decision per [[build-phase-decisions]]; this record captures the lock so the implementation work, the inbox brief to Garfield, and the parallel Epic 4.5 substrate can all proceed off a single shared spec.

---

*Spec authored 2026-04-28. Awaiting Doug's review before implementation.*
