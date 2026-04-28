---
title: "Epic 4: SCUT identity at spawn"
type: epic
status: draft
version: 0.2
tags: [epic, scut, identity, agents, spawn, controls]
created: 2026-04-28
updated: 2026-04-28
linked_docs:
  - "[[03-epic-map]]"
  - "[[02-architecture]]"
  - "[[02-agent-runtime-minimum]]"
  - "[[04.5-cost-caps-and-usage-telemetry]]"
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

When an Agent is created (CLI: `2200 agent create <name>` or a future onboarding flow), the supervisor runs the identity provisioning pipeline. Per Garfield's response (2026-04-28), the deployed SII contract has no public `nextTokenId()` view, so the pipeline runs as **two on-chain transactions** with checkpointed state in between... mint first with a placeholder URI, parse the tokenId from the receipt, pin the SII document to IPFS using the real tokenId in `agentRef`, then call `updateIdentityURI` to point on-chain at the final document.

Sequence:

1. Generate Ed25519 (signing) and X25519 (encryption) keypairs locally.
2. Persist the private keys under encrypted-at-rest storage.
3. **TX1: Mint with placeholder.** Call `mint(seedTeamWalletAddress, "ipfs://pending")` on the SII contract. Wait for one Base confirmation. Parse the tokenId from the `SCUTIdentityRegistered` event log on the receipt.
4. Construct the SII v1 document with the real `agentRef.tokenId`, the public keys, and the empty relay list.
5. Pin the SII document to IPFS via Pinata. Receive the CID. Final URI = `ipfs://<cid>`.
6. **TX2: Update URI.** Call `updateIdentityURI(tokenId, "ipfs://<cid>")` from the seed-team wallet (token owner). Wait for confirmation.
7. Write the resulting `scut://8453/0x199b48E27a28881502b251B0068F388Ce750feff/<tokenId>` URI plus public keys back into the Agent's Identity file.
8. Surface a Passive notification confirming registration (or an Important notification on failure).

After this epic, every Agent has a `scut_uri` field in its Identity, signing and encryption keys reachable to the runtime, the SII document content-addressed on IPFS, and the identity verifiable against on-chain state. No messaging primitives yet; that is Phase B.

There is no UI in this epic. The CLI is the surface. Web/mobile config of identities lands when Epic 15 / 16 land.

## Includes

### Identity provisioning pipeline

The supervisor exposes a control-plane RPC `cli.identity.provision`. The `2200 agent create` CLI calls it as part of agent creation. The pipeline is restart-safe per [[upgrade-readiness]] discipline 3: each step is checkpointed to disk before the next runs, so a crash mid-provision can resume rather than restart.

States, persisted to `state/identities/<agent_id>/provision-state.json`:

| State | Meaning | Recovery |
|-------|---------|----------|
| `pending` | RPC accepted, nothing done yet | Restart from the top |
| `keys_generated` | Ed25519 + X25519 keypairs exist on disk | Resume at TX1 (mint) |
| `mint_submitted` | TX1 broadcast; awaiting Base confirmation | Poll for receipt; if confirmed, advance |
| `token_minted` | TX1 confirmed; tokenId parsed from `SCUTIdentityRegistered` event | Resume at IPFS pin |
| `doc_pinned` | SII document pinned to IPFS via Pinata; CID stored | Resume at TX2 (updateIdentityURI) |
| `update_submitted` | TX2 broadcast; awaiting Base confirmation | Poll for receipt; if confirmed, advance |
| `registered` | TX2 confirmed; on-chain URI now points at the real document | Done; write to Identity file |
| `errored` | Pipeline failed, recovery requires user attention | Surface notification, leave state for inspection |

Each transition writes the new state file atomically (temp + rename), so a crash between writes leaves a recoverable file on disk. Both `mint_submitted` and `update_submitted` persist the transaction hash so resume can poll a known tx rather than re-broadcast.

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

The pipeline constructs a JSON document conforming to the OpenSCUT SII v1 schema (per the [SCUT spec §4.3](https://github.com/douglashardman/openscut/blob/main/spec/SPEC.md#43-document-schema)). The tokenId comes from TX1's receipt; the document is constructed AFTER the mint, not before:

```json
{
  "siiVersion": 1,
  "agentRef": {
    "scheme": "scut",
    "chainId": "8453",
    "contract": "0x199b48E27a28881502b251B0068F388Ce750feff",
    "tokenId": "<minted-tokenId-from-receipt>"
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

The `chainId` (8453) and `contract` (`0x199b48E27a28881502b251B0068F388Ce750feff`) values are locked from Garfield's response and live in `config/scut.toml`. EIP-165 interface id `0x6fe513d9` for SII v1 — the supervisor asserts the contract advertises this on first connect to catch a misconfigured contract address before any state is touched.

Document filename on disk: `state/identities/<agent_id>/identity.json` (local staging copy). Final URI on-chain: `ipfs://<cid>` after pinning.

### Identity document publishing (IPFS via Pinata)

Per Garfield's recommendation (2026-04-28), the SII document is content-addressed on IPFS via Pinata, not served from a 2200-side HTTPS hoster. Three reasons drove this decision:

1. **Tamper-evidence comes free.** A CID is a content hash; the on-chain URI is the integrity check. Anyone validating an SII document verifies the content matches the URI without trusting a hoster.
2. **Survives 2200 outages.** Identity documents resolve through any IPFS gateway; an outage on a single 2200 instance does not make seed-team identities unresolvable.
3. **Uniform with SCUT-register.** Garfield's `register.openscut.ai` (Epic 1 on the SCUT side) uses the same path. One IDocumentStore abstraction across both services, not two parallel mechanisms.

The supervisor's `publish` step:

- Reads `config/scut.toml` for `pinata_jwt` (or a future generic pin-provider URL) and the gateway-fallback chain.
- POSTs the SII JSON to Pinata's `pinJSONToIPFS` endpoint (or equivalent for the configured pin provider).
- Receives the CID. Final URI = `ipfs://<cid>`.
- Advances pipeline state to `doc_pinned`. Persists the CID to `state/identities/<agent_id>/cid.txt` so a resume after crash does not re-pin.

The pin operation goes through an `IDocumentStore` interface so swap-in is one config change, not a code change. **Coordination ask flagged to Doug:** if SCUT-register exposes its `IDocumentStore` Pinata adapter as a shared package, 2200 imports it rather than duplicating; otherwise 2200 ships its own and converges later.

The SCUT resolver caches resolved documents for 5 minutes per [`packages/resolver/src/routes/resolve.ts`](https://github.com/douglashardman/openscut/blob/main/packages/resolver/src/routes/resolve.ts), so the gateway fetch is once per document per cache window per resolver, not per SCUT message. For an identity document that updates rarely, the latency cost is negligible.

**Failure mode:** if the pin fails, pipeline halts at `token_minted` (the on-chain mint already landed; the document is staged locally). The next invocation retries the pin. Tier-2 notification surfaces the failure with the staged document path so the operator can pin manually if Pinata is down.

### On-chain registration

Two transactions per identity. The contract address is `0x199b48E27a28881502b251B0068F388Ce750feff` (Base mainnet, chainId 8453), locked from Garfield's response.

**TX1: mint with placeholder.** ABI:

```solidity
function mint(address to, string calldata identityURI) external returns (uint256 tokenId);
event SCUTIdentityRegistered(uint256 indexed tokenId, address indexed owner, string uri);
```

The supervisor uses `ethers.js` v6 to:

1. Read `config/scut.toml` for the seed-team wallet's signing credentials and gas-fee strategy.
2. Call `mint(seedTeamWalletAddress, "ipfs://pending")`. The placeholder is non-empty (the contract reverts on empty URIs; selector `URIEmpty`).
3. Wait for one Base confirmation (configurable).
4. Parse the tokenId from the `SCUTIdentityRegistered` event log on the receipt. The standard `Transfer` from `0x0` is also emitted; prefer `SCUTIdentityRegistered` because it carries the URI for verification.

**TX2: update URI.** ABI:

```solidity
function updateIdentityURI(uint256 tokenId, string calldata newURI) external;
```

Only the token owner (the seed-team wallet) can call. Cheaper than `mint` (~50k gas vs ~140k) because no `_safeMint` and only one SSTORE plus an event.

The supervisor:

1. Calls `updateIdentityURI(tokenId, "ipfs://<cid>")` with the real CID from the pin step.
2. Waits for confirmation.
3. Advances pipeline state to `registered`.

**Gas strategy.** EIP-1559 with `maxPriorityFeePerGas` at 0.05 gwei (Garfield's refinement; Base's typical priority is 0.001-0.01 gwei, so 0.05 is generous without overpaying). `maxFeePerGas` capped at 5x current base fee. Gas-limit auto-estimated with a 20% buffer. Push through on spikes.

**Wallet model.** v1 uses a single seed-team-shared custodial wallet on Base. Doug confirmed (2026-04-28): "$500 loaded on that wallet." Per-spawn cost with the two-tx pipeline is ~$0.013-0.02 in steady-state Base conditions ($0.005-0.05 worst case), so $500 covers ~25,000 spawns of runway. The wallet's private key (or a remote-signer URL) lives in `config/scut.toml`, encrypted at rest with the same per-instance master key as Agent keys. Per-Agent wallets are out of v1 scope; if 2200 ever needs them (managed-service multi-tenant), that is a follow-on epic with its own decision record.

**Funding alerts.** The supervisor reads the wallet balance via `provider.getBalance(seedTeamWalletAddress)` (RPC-direct; no hosted SCUT-side balance API needed) after every successful registration. It computes "registrations remaining" by dividing the balance by the current gas-cost-per-spawn estimate (steady-state ~$0.013 with two transactions). Below a configurable threshold (default: 100 spawns of headroom), it emits a tier-2 (Important) notification: "Identity wallet balance is low: $X remaining (≈N more spawns). Top up via Doug's documented flow." Below 10 spawns, tier-1 (Critical) and the supervisor refuses to provision new identities until topped up.

### Identity field shape in the Identity file

Per [[2026-04-26-schema-version-format]], the Identity file's existing schema_version bumps when this epic lands. The new fields are at the top level of the Identity file:

```yaml
schema_version: 3  # bumped by this epic; v2 came from Epic 4.5 (cost_caps)
name: hobby
# ... existing fields ...

scut:
  uri: scut://8453/0x199b48E27a28881502b251B0068F388Ce750feff/12345
  chain_id: 8453
  contract: "0x199b48E27a28881502b251B0068F388Ce750feff"
  token_id: 12345
  identity_doc_uri: ipfs://bafybeih...           # CID from Pinata pin
  public_keys:
    ed25519: <base64>
    x25519: <base64>
  registered_at: 2026-04-29T15:23:00Z
  mint_tx: 0xabc...                               # TX1
  update_tx: 0xdef...                             # TX2
```

Private keys are NOT in the Identity file. They live in `state/identities/<agent_id>/keys/` (encrypted) and are loaded via the supervisor↔Agent control plane.

**Schema version bump (2 → 3).** Epic 4.5 lands schema v2 (the `cost_caps` block); this epic lands schema v3. Existing Identity files (Hobby's, Simon's) need to migrate. The migration is non-destructive: the `scut` block is added on first identity provisioning, leaving every other field intact. Per [[upgrade-readiness]] discipline 6, the migration is implemented in `src/runtime/identity/migrators/2-to-3.ts` and tested with golden-file fixtures.

**Sequencing note.** If Epic 4 Phase A lands before Epic 4.5 (reverse of the current default... unlikely but possible), this epic bumps schema 1 → 2 instead and Epic 4.5 lands 2 → 3. The migrator chain pattern is robust to reordering.

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

- A new Agent created via `2200 agent create <name>` ends up with a SCUT URI in its Identity file, a registered tokenId on Base, public keys verifiable on-chain, and an SII document pinned to IPFS with the on-chain `scutIdentityURI` pointing at it.
- The provisioning pipeline survives a kill-and-restart at any of its eight states without re-doing work and without leaving an Agent half-provisioned. Both pending transactions persist their hashes so resume polls a known tx rather than re-broadcasting.
- Hobby and Simon both successfully provision identities through the pipeline against Base mainnet (using the seed-team wallet) and the resulting `scut://` URIs resolve cleanly via `https://resolver.openscut.ai/scut/v1/resolve`.
- The wallet-balance check fires correctly when the wallet drops below the warning thresholds.
- Four failure modes are tested end-to-end: pin provider unreachable, on-chain RPC timeout (TX1 or TX2), insufficient wallet balance, and `URIEmpty` revert path. Each surfaces the right notification and leaves a recoverable state.

## Depends on

- **Epic 2.** Supervisor, control-plane RPC, Identity loader, schema versioning, notification file format. All in place.
- **Epic 4.5 (sibling).** Schema v2 (cost_caps) lands first; this epic bumps to v3.
- **Epic 7 substrate.** Notification routing for the wallet-balance and provisioning notifications. Currently the runtime emits notifications to local files (per Epic 2's interim implementation). v1 of this epic uses the same path; full notification routing lands in Epic 7.
- **OpenSCUT.** Contract `0x199b48E27a28881502b251B0068F388Ce750feff` on Base (deployed). Resolver at `https://resolver.openscut.ai/scut/v1/resolve` (deployed).
- **Pinata account.** Doug provisions the JWT and configures `pinata_jwt` in `config/scut.toml`.
- **Seed-team wallet address.** Doug shares out-of-band when the wallet is funded.

## Open coordination items

- **`IDocumentStore` shared package.** Garfield's `register.openscut.ai` faces the same circularity (SCUT-register's Epic 1 pipeline is also two-tx). He proposed sharing the Pinata pin code via an `IDocumentStore` interface with a Pinata adapter and gateway-fallback chain. Worth coordinating before either of us writes the per-service code twice. Doug's call on whether to ship as a shared package now or duplicate-and-converge later.

## Open product calls (none — answered 2026-04-28)

- ~~Per-Agent vs shared custodial wallet at v1?~~ Shared, per Doug's 2026-04-28 chat.
- ~~Funding ceiling and topup mechanism?~~ Garfield owns the topup; the supervisor enforces a low-balance gate via notifications.
- ~~Identity-doc hoster: HTTPS or IPFS?~~ IPFS via Pinata, per Garfield's 2026-04-28 reply (tamper-evidence, outage resilience, uniformity with SCUT-register).
- ~~One-tx or two-tx mint pipeline?~~ Two-tx. The deployed contract has no public `nextTokenId()` view, so prediction is not viable; mint with placeholder then `updateIdentityURI` is the path.

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
| Schema versioning | Identity file bumps from `schema_version: 2` to `schema_version: 3`. Migration script with golden fixtures. SII document carries `siiVersion: 1`. |
| State on disk | `state/identities/<agent_id>/` is the source of truth (keys, provision-state, CID, both tx hashes). Nothing lives in memory across the supervisor↔Agent control plane handshake. |
| Restart safety | Provisioning pipeline checkpoints at eight states; both pending-tx states record the tx hash so resume polls a known tx rather than re-broadcasting. |
| Tool-call inspectability | All on-chain calls go through the runtime's tool surface (`scut.identity.mint`, `scut.identity.update_uri`, `scut.identity.pin`) and are logged with plan/run/perm wrapping per Epic 2. |
| Idempotent tasks | Re-running `provision` against an Agent in `registered` state is a no-op. Re-running mid-pipeline polls the persisted tx hash rather than re-broadcasting. |
| Inspectable persisted artifacts | Identity files are markdown+frontmatter (existing pattern). SII documents are plain JSON. Pipeline state is JSON. CID is plain text. All readable by `cat` or any text editor. |

## Notes

### Why not punt the on-chain piece entirely for v1

A "fake SCUT identity, no on-chain registration" version was considered. The substrate would still be useful for cost attribution. But:

- The seed-team wallet has runway (~25K spawns at the two-tx cost) and per-spawn cost is trivial.
- Hobby migrates into 2200 first. Hobby's identity should be real, not fake, because dogfooding the on-chain path catches integration bugs before David is born.
- Phase B (cross-instance messaging) cannot ship without real on-chain identities, so doing the work now means Phase B ships faster.

Decided: ship real on-chain registration in v1.

### Why two transactions instead of one

Per Garfield's 2026-04-28 reply: the deployed SII contract has no public `nextTokenId()` view (`_nextTokenId` is private), so 2200 cannot predict the tokenId before the mint. Two alternatives were considered and rejected:

- **Predict via event-log count + race recovery.** Read historical `SCUTIdentityRegistered` events, count them, predict the next tokenId, pin the SII doc with the prediction, mint with the resulting URI. Works in the no-race case (one tx). Fails when someone else mints in the gap; the resolver rejects with `ref_mismatch` and 2200 has to re-pin and call `updateIdentityURI` anyway. The race-recovery logic is fiddly; the always-two-tx pattern is simpler and predictable.
- **Deploy a V2 contract with `nextTokenId()` exposed.** Would fragment the SII registry across two addresses. Garfield rejects this for SCUT v1 stability reasons; if it ever happens, it is a SCUT-side decision that affects every SII consumer.

Two-tx is the right answer.

### Why IPFS instead of HTTPS for the identity doc

Garfield argued for IPFS via Pinata over a 2200-side HTTPS hoster. The arguments are summarized in the [Identity document publishing](#identity-document-publishing-ipfs-via-pinata) section above. Conceded after the original 2200-side HTTPS proposal because his three reasons (tamper-evidence via content hash, outage resilience, uniformity with SCUT-register) outweigh the original latency / operational-simplicity case. If a future use case requires HTTPS specifically, an alternate `IDocumentStore` adapter is one config flip; it is not a one-way door.

### Coordination with Garfield

The contract spec, the resolver, the relay strategy, and the document-pinning provider are all SCUT-side concerns Garfield owns. Hobby's lane stops at the runtime integration. Three artifacts in flight:

1. The inbox brief at `wiki/inbox/garfield/2026-04-28-2200-needs-from-scut-for-epic-4.md` lists what 2200 needs from Garfield. Sent.
2. Garfield's reply at `wiki/inbox/hobby/2026-04-28-to-hobby-re-epic-4-integration.md` answers the six asks and surfaces the two-tx pipeline finding. Received and integrated.
3. **Open coordination ask:** the `IDocumentStore` shared-package question (above). Doug's call on whether to ship as a shared package or duplicate-and-converge later.

### Connection to Epic 4.5 (cost caps and usage telemetry)

Epic 4.5 attaches budgets and usage telemetry to the SCUT URI established here. The two epics build in parallel; 4.5 is a no-op without 4 and 4 is wasted without something attached to it (4.5 is the first such thing). Schema sequencing: 4.5 lands schema v2 (cost_caps); this epic lands schema v3 (scut block).

## Format provenance

Spec drafted by Hobby on 2026-04-28 after Doug's 2026-04-28 chat answered the open product calls (shared custodial wallet, $500 loaded, Garfield owns the topup mechanism).

Spec v0.2 (2026-04-28 PM): integrated Garfield's reply. Locked SCUT-side answers: contract address on Base mainnet (`0x199b48E27a28881502b251B0068F388Ce750feff`, chainId 8453, EIP-165 interface id `0x6fe513d9`), full mint and updateIdentityURI ABIs, gas-strategy refinement (priority 0.05 gwei not 1), pin via Pinata IPFS instead of 2200-side HTTPS, resolver endpoint locked to `resolver.openscut.ai`, two-tx pipeline (mint with placeholder, parse tokenId from event, pin to IPFS, updateIdentityURI), runway recalculated at ~25K spawns from $500 instead of 50K, RPC-direct wallet balance reads.

Build-phase decision per [[build-phase-decisions]]; this record captures the lock so the implementation work and the parallel Epic 4.5 substrate can all proceed off a single shared spec.

---

*Spec authored 2026-04-28. Awaiting Doug's review before implementation.*
