---
title: "Epic 4: SCUT identity at spawn"
type: epic
status: draft
version: 0.3
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

When an Agent is created (CLI: `2200 agent create <name>` or a future onboarding flow), the supervisor runs the identity provisioning pipeline. Per Garfield's response (2026-04-28), the deployed SII contract has no public `nextTokenId()` view, so the pipeline runs as **two on-chain transactions** with checkpointed state in between... mint first with a placeholder URI, parse the tokenId from the receipt, encode the SII document with the real tokenId in `agentRef` as a `data:` URI, then call `updateIdentityURI` to point on-chain at the final document.

Sequence:

1. Generate Ed25519 (signing) and X25519 (encryption) keypairs locally.
2. Persist the private keys under encrypted-at-rest storage.
3. **TX1: Mint with placeholder.** Call `mint(seedTeamWalletAddress, "data:application/json;base64,e30=")` on the SII contract. The placeholder is `{}` (the smallest non-empty value the contract accepts; the contract reverts on empty URIs). Wait for one Base confirmation. Parse the tokenId from the `SCUTIdentityRegistered` event log on the receipt.
4. Construct the SII v1 document with the real `agentRef.tokenId`, the public keys, and the empty relay list.
5. Encode the document as a data URI: `'data:application/json;base64,' + Buffer.from(JSON.stringify(doc)).toString('base64')`.
6. **TX2: Update URI.** Call `updateIdentityURI(tokenId, finalDataUri)` from the seed-team wallet (token owner). Wait for confirmation.
7. Write the resulting `scut://8453/0x199b48E27a28881502b251B0068F388Ce750feff/<tokenId>` URI plus public keys back into the Agent's Identity file.
8. Surface a Passive notification confirming registration (or an Important notification on failure).

After this epic, every Agent has a `scut_uri` field in its Identity, signing and encryption keys reachable to the runtime, and the SII document stored entirely on-chain as a `data:` URI inside the contract's URI slot. The URI _is_ the document; there is no second hop, no hoster, no gateway. Verification is `base64-decode(URI) → JSON.parse → schema check`.

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
| `token_minted` | TX1 confirmed; tokenId parsed from `SCUTIdentityRegistered` event | Resume at document encoding |
| `doc_encoded` | Final SII document encoded as a `data:` URI; URI persisted to disk | Resume at TX2 (updateIdentityURI) |
| `update_submitted` | TX2 broadcast; awaiting Base confirmation | Poll for receipt; if confirmed, advance |
| `registered` | TX2 confirmed; on-chain URI now contains the real document | Done; write to Identity file |
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

### Identity document encoding (on-chain `data:` URI)

Per Garfield's 2026-04-28 follow-up: the SII document is encoded directly into the on-chain URI as a `data:application/json;base64,...` string, not stored separately on IPFS or any HTTPS hoster. The contract's URI slot _holds_ the document; resolvers decode it inline. Three properties this gives us:

1. **Tamper-evidence is structural.** The URI _is_ the document. There is nothing to tamper with that wouldn't change the URI itself.
2. **No hoster outage failure mode.** Every Base archive node mirrors every SII document forever. Replication is free. There is no Pinata or 2200-side hoster to operate or pay for.
3. **Resolver gets simpler.** The resolver's gateway-fallback chain is replaced by `base64-decode(URI) → JSON.parse`. Faster, fewer failure modes, less code on both sides.

The trade is gas. A typical SII document encodes to ~500-700 bytes; the mint+update pipeline runs ~600-700k gas total per registration vs. ~270k for a CID URI. Roughly 2.5x. Per-spawn cost lands at ~$0.015-0.025 in steady-state Base conditions. Doug's framing (2026-04-28 PM) was "we own everything, no subscriptions" and that explicitly chose the gas-cost-vs-storage-subscription trade.

The supervisor's encoding step:

- Constructs the SII document JSON in memory with the real `tokenId` from TX1's receipt.
- Encodes: `'data:application/json;base64,' + Buffer.from(JSON.stringify(doc)).toString('base64')`.
- Advances pipeline state to `doc_encoded`. Persists the URI to `state/identities/<agent_id>/data-uri.txt` so a resume after crash uses the same encoded value rather than re-deriving.
- Validates that the URI is below the contract's max-bytes limit before TX2; reject early with a clear error if it would.

No external dependencies. No retry loop on a third-party API. The entire step is local.

### On-chain registration

Two transactions per identity. The contract address is `0x199b48E27a28881502b251B0068F388Ce750feff` (Base mainnet, chainId 8453), locked from Garfield's response.

**TX1: mint with placeholder.** ABI:

```solidity
function mint(address to, string calldata identityURI) external returns (uint256 tokenId);
event SCUTIdentityRegistered(uint256 indexed tokenId, address indexed owner, string uri);
```

The supervisor uses `ethers.js` v6 to:

1. Read `config/scut.toml` for the seed-team wallet's signing credentials, RPC endpoint, and gas-fee strategy.
2. Call `mint(seedTeamWalletAddress, "data:application/json;base64,e30=")`. The placeholder decodes to `{}` (empty object), which is non-empty enough to satisfy the contract's `URIEmpty` revert guard.
3. Wait for one Base confirmation (configurable).
4. Parse the tokenId from the `SCUTIdentityRegistered` event log on the receipt. The standard `Transfer` from `0x0` is also emitted; prefer `SCUTIdentityRegistered` because it carries the URI for verification.

**TX2: update URI.** ABI:

```solidity
function updateIdentityURI(uint256 tokenId, string calldata newURI) external;
```

Only the token owner (the seed-team wallet) can call. Slightly cheaper than `mint` (no `_safeMint`), but the URI bytes themselves dominate gas at ~32-byte SSTORE chunks.

The supervisor:

1. Calls `updateIdentityURI(tokenId, finalDataUri)` with the encoded data URI.
2. Waits for confirmation.
3. Advances pipeline state to `registered`.

**RPC consistency gotcha.** Garfield validated against `mainnet.base.org` and observed: that endpoint is load-balanced, and reads after a write can hit a backend that has not yet seen the new state for ~1-2 blocks. In practice this manifests as TX2's pre-flight simulation reverting with `ERC721NonexistentToken(<just-minted-tokenId>)` even though the mint succeeded.

The supervisor handles this with a poll-`ownerOf` loop between `token_minted` and `update_submitted`: after parsing the tokenId from TX1's receipt, the supervisor calls `ownerOf(tokenId)` until a backend with the new state answers (typically ~1.5 seconds). Only then does it broadcast TX2.

For production scale, the operator should configure a dedicated RPC endpoint (Alchemy, QuickNode, or a self-hosted Base node) via `config/scut.toml`'s `rpc_url` field, which removes the race entirely. The poll workaround stays as a defense-in-depth measure regardless. **This is Simon's lane to scope when 2200 moves toward a real production deployment.**

**Gas strategy.** EIP-1559 with `maxPriorityFeePerGas` at 0.05 gwei (Garfield's refinement; Base's typical priority is 0.001-0.01 gwei, so 0.05 is generous without overpaying). `maxFeePerGas` capped at 5x current base fee. Gas-limit auto-estimated with a 20% buffer. Push through on spikes.

**Wallet model.** v1 uses a single seed-team-shared custodial wallet on Base. Doug confirmed (2026-04-28): "$500 loaded on that wallet." Per-spawn cost with the data-URI two-tx pipeline is ~$0.015-0.025 in steady-state Base conditions, so $500 covers ~20,000-30,000 spawns of runway. The wallet's private key (or a remote-signer URL) lives in `config/scut.toml`, encrypted at rest with the same per-instance master key as Agent keys. Per-Agent wallets are out of v1 scope; if 2200 ever needs them (managed-service multi-tenant), that is a follow-on epic with its own decision record.

**Funding alerts.** The supervisor reads the wallet balance via `provider.getBalance(seedTeamWalletAddress)` (RPC-direct; no hosted SCUT-side balance API needed) after every successful registration. It computes "registrations remaining" by dividing the balance by the current gas-cost-per-spawn estimate (~$0.020 midpoint). Below a configurable threshold (default: 100 spawns of headroom), it emits a tier-2 (Important) notification: "Identity wallet balance is low: $X remaining (≈N more spawns). Top up via Doug's documented flow." Below 10 spawns, tier-1 (Critical) and the supervisor refuses to provision new identities until topped up.

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
  identity_doc_uri: "data:application/json;base64,eyJzaWlWZXJzaW9uIjox..."  # full document encoded inline
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
- **OpenSCUT.** Contract `0x199b48E27a28881502b251B0068F388Ce750feff` on Base (deployed). Resolver at `https://resolver.openscut.ai/scut/v1/resolve` (deployed). Token #6 on the contract is a live demonstration of the data-URI flow.
- **Seed-team wallet address.** Doug shares out-of-band when the wallet is funded.

## Path B: optional `register.openscut.ai` fallback

Garfield ships an optional Fastify service at `register.openscut.ai` that runs the entire mint-then-update pipeline on behalf of agents. 2200 _does not need to call it_ for Path A (the spec target above), but it exists as a fallback if 2200's mint integration ever has trouble or if a future deployment context needs to skip running the on-chain wallet.

Endpoints:

- `POST /scut/v1/register` — submit public keys and optional metadata; service returns `scut://` URI plus tx hashes.
- `POST /scut/v1/update` — submit a new SII document signed with the Agent's Ed25519 key; service rewrites the on-chain URI.
- `POST /scut/v1/transfer` — submit an Ed25519-signed transfer challenge to graduate the token from custodial (service wallet) to self-custody (Agent's own wallet). Useful later if Agents ever need on-chain self-custody.
- `GET /scut/v1/health` — wallet address, current balance, runway estimate.

**Path A (default).** 2200 keeps its own minting. Seed-team wallet pays gas. Full sovereignty. Spec target above. Recommended for production.

**Path B (fallback).** 2200's spawn pipeline becomes a single HTTPS POST to `register.openscut.ai`. SCUT-funded service wallet pays gas. Less code in 2200, more dependency on SCUT's infra. Path B is acceptable as a stopgap if Path A integration is ever blocked (e.g., wallet funding interruption, dedicated-RPC outage), but the supervisor's checkpointed pipeline already does the hard work, so the marginal complexity of Path A is small enough that sovereignty wins by default.

The supervisor's CLI exposes `2200 agent identity provision <name> --via=register-service` as the Path B opt-in; default is Path A.

## Open product calls (none — all answered 2026-04-28)

- ~~Per-Agent vs shared custodial wallet at v1?~~ Shared, per Doug's 2026-04-28 chat.
- ~~Funding ceiling and topup mechanism?~~ Garfield owns the topup; the supervisor enforces a low-balance gate via notifications.
- ~~Identity-doc hoster: HTTPS, IPFS, or on-chain `data:` URIs?~~ On-chain `data:` URIs, per Garfield's 2026-04-28 follow-up. Doug's "we own everything, no subscriptions" framing chose this over the original IPFS-via-Pinata path.
- ~~One-tx or two-tx mint pipeline?~~ Two-tx. The deployed contract has no public `nextTokenId()` view, so prediction is not viable.
- ~~Path A (2200 mints itself) vs Path B (register.openscut.ai)?~~ Path A is the spec target; Path B is the documented fallback.
- ~~`IDocumentStore` shared package coordination?~~ Moot. With on-chain `data:` URIs there is no document hosting on either side, so no pin-code to share.

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

### Why on-chain `data:` URIs instead of IPFS or HTTPS

The original (v0.1) spec proposed a 2200-side HTTPS hoster. Garfield's first reply (v0.2 update) argued for IPFS via Pinata over HTTPS for tamper-evidence, outage resilience, and uniformity with `register.openscut.ai`'s storage path. Doug then framed the broader infrastructure preference as "we own everything, no subscriptions," and Garfield came back (v0.3 update) with on-chain `data:` URIs as the third path that satisfies all the constraints:

- Tamper-evidence is structural rather than content-hashed. The URI _is_ the document.
- No hoster, no subscription, no third-party dependency. Every Base archive node mirrors every SII document.
- Resolver gets simpler. No gateway-fallback chain. Just `base64-decode → JSON.parse`.
- Cost scales with use, not capacity. Gas you already control instead of a storage subscription you're locked into.

The trade is gas. ~$0.015-0.025 per spawn vs ~$0.013 for the IPFS path; ~25K spawns of runway from $500 instead of ~38K. Acceptable given the simplicity and operational independence wins.

### Coordination with Garfield

The contract spec, the resolver, and the data-URI approach are all SCUT-side concerns Garfield owns. Hobby's lane stops at the runtime integration. Four artifacts in flight:

1. The inbox brief at `wiki/inbox/garfield/archive/2026-04-28-2200-needs-from-scut-for-epic-4.md` lists what 2200 needed from Garfield. Sent and answered.
2. Garfield's first reply at `wiki/inbox/hobby/archive/2026-04-28-to-hobby-re-epic-4-integration.md` answered the six asks and surfaced the two-tx pipeline finding. Integrated in v0.2.
3. Hobby's ack at `wiki/inbox/garfield/2026-04-28-to-garfield-re-epic-4-integration-acks.md` confirmed the v0.2 spec.
4. Garfield's follow-up at `wiki/inbox/hobby/2026-04-28-to-hobby-re-epic-4-followup-register-and-data-uri.md` swapped IPFS for on-chain `data:` URIs and shipped the optional `register.openscut.ai` Path B fallback. Integrated in v0.3.

All SCUT-side blockers are resolved. The contract, resolver, and data-URI approach are validated against mainnet; token #6 on the contract is a live demonstration. No further coordination is needed before the build starts.

### Connection to Epic 4.5 (cost caps and usage telemetry)

Epic 4.5 attaches budgets and usage telemetry to the SCUT URI established here. The two epics build in parallel; 4.5 is a no-op without 4 and 4 is wasted without something attached to it (4.5 is the first such thing). Schema sequencing: 4.5 lands schema v2 (cost_caps); this epic lands schema v3 (scut block).

## Format provenance

Spec drafted by Hobby on 2026-04-28 after Doug's 2026-04-28 chat answered the open product calls (shared custodial wallet, $500 loaded, Garfield owns the topup mechanism).

Spec v0.2 (2026-04-28 PM): integrated Garfield's first reply. Locked SCUT-side answers: contract address on Base mainnet (`0x199b48E27a28881502b251B0068F388Ce750feff`, chainId 8453, EIP-165 interface id `0x6fe513d9`), full mint and updateIdentityURI ABIs, gas-strategy refinement (priority 0.05 gwei not 1), pin via Pinata IPFS instead of 2200-side HTTPS, resolver endpoint locked to `resolver.openscut.ai`, two-tx pipeline (mint with placeholder, parse tokenId from event, pin to IPFS, updateIdentityURI), runway recalculated at ~25K spawns from $500, RPC-direct wallet balance reads.

Spec v0.3 (2026-04-28 evening): integrated Garfield's follow-up. Two changes: (1) IPFS-via-Pinata replaced with on-chain `data:application/json;base64,...` URIs after Doug's "we own everything, no subscriptions" framing... no hoster, no Pinata, no `IDocumentStore` coordination needed; gas trades up to ~$0.015-0.025 per spawn for ~20-30K runway. (2) Optional Path B (`register.openscut.ai` Fastify service) documented as fallback to 2200's own minting; Path A remains the spec target. Plus: RPC consistency gotcha on `mainnet.base.org` documented (poll `ownerOf` workaround in v1, dedicated RPC for production via Simon).

Build-phase decision per [[build-phase-decisions]]; this record captures the lock so the implementation work and the parallel Epic 4.5 substrate can all proceed off a single shared spec.

---

*Spec authored 2026-04-28. Awaiting Doug's review before implementation.*
