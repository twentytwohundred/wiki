---
title: "Epic 4: SCUT identity at spawn"
type: epic
status: locked
version: 0.4
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

This is Phase A of the broader Epic 4 shape (cross-instance messaging is Phase B). Naming this `04-scut-identity-at-spawn.md` keeps the runway clear for the Phase B spec.

> **v0.4 (locked, 2026-04-28 evening).** Path B (`register.openscut.ai`) is now the only production path. 2200 generates the Agent's keypair locally, POSTs the public keys to the OpenSCUT register service, and gets back the minted token. Doug's clarification: "we own everything" includes OpenSCUT itself ... using its hosted minter does not violate the principle. v0.3 had Path A (2200 mints on-chain itself with a seed-team wallet) as the spec target with Path B as fallback; v0.4 inverts that. Path A is preserved in this spec only as the external "roll-your-own" guidance for users who want to bring a self-funded wallet, post-launch. See "Format provenance" at the bottom for the v0.3 → v0.4 diff.

## Why this epic

Three things downstream depend on Agent identities being persistent and verifiable:

1. **Audit and accountability.** Every action an Agent takes in the runtime should be attributable to a stable identity, not a process ID or a name.
2. **Cost attribution and ceilings.** [[04.5-cost-caps-and-usage-telemetry]] needs a stable per-Agent identifier. The SCUT tokenId is that identifier.
3. **Cross-instance addressability later.** Phase B (inbox + send) cannot ship without real on-chain identities. Doing this now means the seed team migrates into 2200 with identities ready to use.

CLAUDE.md flags identity at spawn as "don't defer this... it's load-bearing for Epic 4 and downstream. Simple custodial keys are fine for v1." This spec implements that.

## Scope

When an Agent is created (`2200 agent create <name>` or a future onboarding flow), the supervisor runs the identity provisioning pipeline. The pipeline is now three states:

1. Generate Ed25519 (signing) and X25519 (encryption) keypairs locally.
2. Persist the private keys under encrypted-at-rest storage.
3. POST the public keys + display name to `https://register.openscut.ai/scut/v1/register`. The service mints the token, encodes the SII document on-chain via the two-tx pipeline, and returns the `scut://` URI plus mint and update tx hashes.
4. Write the URI, public keys, and tx hashes into the Agent's Identity file.
5. Surface a Passive notification confirming registration (or an Important notification on failure).

The two-tx on-chain dance happens server-side at OpenSCUT. 2200 sees one HTTPS POST and one JSON response.

After this epic, every Agent has a `scut` block in its Identity, signing and encryption private keys reachable to the runtime, and a `scut://` URI that resolves cleanly via `https://resolver.openscut.ai/scut/v1/resolve`.

There is no UI in this epic. The CLI is the surface. Web/mobile config lands when Epic 15 / 16 land.

## Includes

### Identity provisioning pipeline

Supervisor RPC `cli.identity.provision`. The `2200 agent create` CLI calls it as part of agent creation. The pipeline is restart-safe per [[upgrade-readiness]] discipline 3: each step checkpoints to disk before the next runs.

States, persisted to `state/identities/<agent_id>/provision-state.json`:

| State | Meaning | Recovery |
|-------|---------|----------|
| `pending` | RPC accepted, nothing done yet | Restart from the top |
| `keys_generated` | Ed25519 + X25519 keypairs exist on disk | Resume at register POST |
| `registered` | OpenSCUT returned the URI; written to Identity | Done |
| `errored` | Pipeline failed, recovery requires user attention | Surface notification, leave state for inspection |

Each transition writes the new state file atomically (temp + rename). On a crash between `keys_generated` and `registered`, the resume path simply re-POSTs the same public keys; OpenSCUT's response is deterministic given the inputs (modulo the per-display-name daily rate limit, addressed below).

The pipeline is idempotent at every step: a second `provision` call against an Agent in `registered` state is a no-op. A `2200 agent identity status <name>` CLI command reads the provision-state file and shows the current step, with re-attempt and abort flags.

### Custodial key storage

Per CLAUDE.md "simple custodial keys are fine for v1." Keys live on the local filesystem under the Agent's identity directory:

```
state/identities/<agent_id>/
├── identity.json           public document, copy of what OpenSCUT returned
├── keys/
│   ├── signing.ed25519     32-byte raw private key, encrypted at rest
│   ├── encryption.x25519   32-byte raw private key, encrypted at rest
│   └── salt                key-derivation salt
└── provision-state.json    pipeline state
```

**At-rest encryption.** Per-instance master key (`state/master.key`, generated on supervisor first boot) wraps each Agent's signing and encryption keys via AES-256-GCM. The master key is plaintext on disk for v1; OS keychain / TPM integration is post-launch hardening, tracked as a known v1 limitation.

**Loading.** On Agent start, the supervisor reads the per-Agent encrypted private keys, decrypts in-process, and passes them to the Agent process via the existing supervisor↔Agent control-plane handshake. Keys never appear on disk in plaintext, never transit the public network, and never leave the supervisor↔Agent socket pair.

**The private keys never leave 2200.** OpenSCUT's register endpoint receives only the public halves. The signature OpenSCUT later requires for `update` and `transfer` operations is generated by the Agent (which holds the private key) and verified by the OpenSCUT service against the public key it already knows. Custodial here means "OpenSCUT custodies the on-chain token's owner address," not "OpenSCUT custodies the Agent's signing authority."

### Register call and response

`POST https://register.openscut.ai/scut/v1/register`

Request body:

```jsonc
{
  "keys": {
    "signing":    { "algorithm": "ed25519", "publicKey": "<base64-32B>" },
    "encryption": { "algorithm": "x25519",  "publicKey": "<base64-32B>" }
  },
  "displayName": "<agent_name>"
}
```

`relays` and `capabilities` are optional; v1 omits them and accepts the OpenSCUT-supplied defaults (a single `https` relay configured server-side at protocolVersion 0.2.0).

Response (HTTP 201):

```jsonc
{
  "ref": "scut://8453/0x199b48E27a28881502b251B0068F388Ce750feff/<tokenId>",
  "agentRef": { "chainId": 8453, "contract": "0x199b...feff", "tokenId": "<digits>" },
  "txHashes": { "mint": "0x...", "update": "0x..." },
  "basescan": { "mint": "https://...", "update": "https://..." },
  "document": { /* full SII v1 doc */ }
}
```

2200 records the URI, both tx hashes, and the document into the Identity file's `scut` block.

**Error handling:**

- `400 invalid request body` ... schema mismatch. Treat as fatal in pipeline; flag for spec drift, raise an Important notification to the operator.
- `429 display name already used today` ... OpenSCUT's per-display-name rate limit (1 registration per displayName per UTC day). Most likely cause: re-creating an Agent with the same name within 24h. Surface as an Important notification with a clear remediation hint ("rename, or wait until <UTC midnight>"); pipeline state goes to `errored` rather than retrying automatically.
- `503 global daily registration cap reached` ... OpenSCUT's instance-wide cap. Important notification; pipeline state `errored`. Manual retry the next day or after an OpenSCUT-side increase.
- `502 on-chain mint failed` / `502 on-chain update failed` ... OpenSCUT's wallet RPC layer hit an unrecoverable problem. Critical notification; the response includes detail and (for update failures) the tokenId so we can recover via OpenSCUT's update endpoint manually if needed.
- `429` from rate limiting on the IP ... back off and retry once; if it persists, Important notification.

### Wallet runway monitoring

OpenSCUT's wallet IS the cost surface for 2200's identity provisioning. The supervisor polls `GET https://register.openscut.ai/scut/v1/health` once per hour and surfaces:

- Below 1000 registrations of runway: Passive notification ("OpenSCUT wallet has ~N registrations of headroom; Doug should top up the shared wallet")
- Below 100: Important notification
- Below 10: Critical notification, and the supervisor refuses to provision new identities until topped up

Doug owns the topup mechanism (out-of-band, per his 2026-04-28 chat). Garfield owns the wallet. The check is just observability ... 2200 doesn't try to fund the wallet itself.

### Identity field shape

```yaml
schema_version: 4
agent_name: hobby
# ... existing fields ...

scut:
  uri: scut://8453/0x199b...feff/12345
  chain_id: 8453
  contract: "0x199b48E27a28881502b251B0068F388Ce750feff"
  token_id: "12345"
  public_keys:
    ed25519: <base64-32B>
    x25519: <base64-32B>
  registered_at: 2026-04-29T15:23:00Z
  mint_tx: 0xabc...
  update_tx: 0xdef...
```

Private keys are NOT in the Identity file. They live in `state/identities/<agent_id>/keys/` (encrypted) and are loaded via the supervisor↔Agent control plane.

### CLI surface

```
2200 agent create <name> [--no-identity]    # create + provision (default: with identity)
2200 agent identity provision <name>         # provision identity for an existing agent
2200 agent identity status <name>            # show pipeline state
2200 agent identity show <name>              # print public identity doc (from Identity file)
2200 agent identity retry <name>             # re-attempt a stuck pipeline
2200 agent identity wallet-status            # GET /scut/v1/health from OpenSCUT
```

The `--no-identity` escape hatch on `create` exists so a developer can spawn an Agent for testing without consuming a registration. Tagged in metrics so we can see how often it is used in the wild.

`wallet-status` shows OpenSCUT's wallet runway, not a 2200-side wallet (there isn't one anymore in v1).

## Done when

- A new Agent created via `2200 agent create <name>` ends up with a `scut` block in its Identity file populated from the OpenSCUT register response, and the resulting `scut://` URI resolves cleanly via `https://resolver.openscut.ai/scut/v1/resolve`.
- The provisioning pipeline survives a kill-and-restart at any of its three states without re-doing work and without leaving an Agent half-provisioned. The `keys_generated` resume path POSTs to register again; the response is deterministic enough for v1 (a `429 displayName already used today` becomes the operator-visible failure mode).
- Hobby and Simon both successfully provision identities through the pipeline.
- The wallet-balance check fires correctly when OpenSCUT's wallet drops below the warning thresholds.
- Three failure modes are tested end-to-end: register service unreachable (network), `429 display name used today`, and `502 on-chain failed`. Each surfaces the right notification and leaves a recoverable state.

## Depends on

- **Epic 2.** Supervisor, control-plane RPC, Identity loader, schema versioning, notification file format. All in place.
- **Epic 4.5 (sibling).** Schema v2 (cost_caps) lands first; this epic bumps to v3 (originally; v0.4 keeps the same field shape so the bump is unchanged in practice).
- **Epic 7 substrate.** Notification routing for the wallet-balance and provisioning notifications.
- **OpenSCUT register service.** Live at `register.openscut.ai` v0.1.0 as of 2026-04-28 (verified). Wallet `0x6050bB...69b6C` with ~2,221 registrations of runway. Garfield owns it.

## Out of scope (deferred to Phase B and beyond)

- SCUT inbox + send tools (Phase B of Epic 4)
- Known-contacts list + user-approval flow for unknown senders (Phase B)
- Identity rotation semantics (post-v1)
- TPM / OS-keychain integration for the master key (post-v1 hardening)
- Full ERC-8004 conformance beyond SII v1 (v2 once SCUT lands it)
- UI for browsing and managing identities (Epic 15 / 16)
- Self-custody graduation via `POST /scut/v1/transfer` ... Doug's 2026-04-28 evening framing: "we'll build in later a way for someone to take their OS identity with them via the website, but they'll need a crypto wallet for that and we're not getting into those people on day-1." The transfer endpoint stays on OpenSCUT's side, exercised post-launch when the website surface ships.
- Path A (2200 mints on-chain with its own wallet, full ethers.js + two-tx pipeline). Documented externally for users who want a self-funded wallet; not in the v1 codebase.

## Open product calls (none)

All resolved. v0.4 lock is "Path B is the only production path."

## Upgrade-readiness

| Discipline | How this epic holds it |
|-----------|------------------------|
| Schema versioning | Identity file's `scut` block is unchanged from v0.3 in shape; `scut.uri`, `scut.public_keys`, `scut.token_id`, `scut.registered_at`, `scut.mint_tx`, `scut.update_tx` come from the OpenSCUT response. SII document carries `siiVersion: 1` (set server-side). |
| State on disk | `state/identities/<agent_id>/` is the source of truth (keys, provision-state, full URI, both tx hashes). Nothing lives in memory across the supervisor↔Agent control plane handshake. |
| Restart safety | Pipeline checkpoints at three states; resume re-POSTs to register, getting a `429` on duplicate same-day registration that the operator handles explicitly (rename or wait). |
| Tool-call inspectability | All HTTPS calls go through the runtime's tool surface and are logged with plan/run/perm wrapping per Epic 2. |
| Idempotent tasks | Re-running `provision` against an Agent in `registered` state is a no-op. Re-running mid-pipeline detects existing state and resumes. |
| Inspectable persisted artifacts | Identity files are markdown+frontmatter (existing pattern). Pipeline state is JSON. URI is plain text. All readable by `cat` or any text editor. |

## Format provenance

Spec drafted by Hobby on 2026-04-28 after Doug's 2026-04-28 chat answered the open product calls.

**v0.2 (2026-04-28 PM):** integrated Garfield's first reply. Locked SCUT-side answers: contract address on Base mainnet (`0x199b48E27a28881502b251B0068F388Ce750feff`, chainId 8453), full mint and updateIdentityURI ABIs, gas-strategy refinement, two-tx pipeline (mint with placeholder, parse tokenId from event, pin to IPFS, updateIdentityURI), runway recalculated at ~25K spawns from $500.

**v0.3 (2026-04-28 evening, first lock):** integrated Garfield's follow-up. Two changes: IPFS-via-Pinata replaced with on-chain `data:application/json;base64,...` URIs after Doug's "we own everything, no subscriptions" framing; optional Path B (`register.openscut.ai` Fastify service) documented as fallback to 2200's own minting; Path A (2200 mints) was the spec target. Plus: RPC consistency gotcha on `mainnet.base.org` documented (poll `ownerOf` workaround for v1).

**v0.4 (2026-04-28 evening, current lock):** Doug clarified "we own" includes OpenSCUT itself. Path B is now the only production path. The on-chain mint+update happens server-side at OpenSCUT; 2200 does one HTTPS POST per Agent and never holds a Base wallet. Concrete deltas from v0.3:

- Provisioning pipeline collapses from 8 states (pending → keys_generated → mint_submitted → token_minted → doc_encoded → update_submitted → registered + errored) to 3 (pending → keys_generated → registered + errored).
- Drops the seed-team wallet, the ethers.js client, the SII document construction (now server-side), the data-URI encoding, and the `ownerOf` polling workaround.
- Adds an HTTPS register-client (POST `/scut/v1/register`).
- Adds rate-limit handling: HTTP 429 from `/scut/v1/register` for per-displayName-per-day collisions becomes a clear operator-visible failure rather than a retry loop.
- The wallet-runway check moves from RPC-direct (Base `getBalance`) to HTTPS GET `/scut/v1/health`.
- Self-custody graduation (`POST /scut/v1/transfer`) is explicitly post-launch.

Build-phase decision per [[build-phase-decisions]]; this record captures the lock so the implementation work and the parallel Epic 4.5 substrate proceed off a single shared spec.

---

*Spec authored 2026-04-28. v0.4 locked 2026-04-28 evening. Implementation shipped on `main` 2026-04-28 evening (PR #75).*
