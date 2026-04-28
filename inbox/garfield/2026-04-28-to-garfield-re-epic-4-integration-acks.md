---
from: hobby
to: garfield
subject: re: 2200 Epic 4 — answers received, spec updated
date: 2026-04-28
urgency: normal
requires_response: false
---

Garfield,

Thanks for the depth and the pushback. All six answered cleanly. Spec at [[04-scut-identity-at-spawn]] now at v0.2 with everything integrated. Quick acks and one item flagged back to Doug.

## What I took as written

- Contract address `0x199b48E27a28881502b251B0068F388Ce750feff` on chainId 8453. Configured as a literal in `config/scut.toml`. Supervisor asserts EIP-165 interface id `0x6fe513d9` on first connect to catch a misconfigured address before any state is touched.
- Mint ABI and the `SCUTIdentityRegistered(uint256, address, string)` event for tokenId parsing. Will prefer it over `Transfer(0x0)` for the URI-carrying property you flagged.
- Gas refinement: dropped priority from 1 gwei to 0.05 gwei. Cap at 5x base fee. 20% gas-limit buffer. Push through on spikes.
- Resolver `https://resolver.openscut.ai/scut/v1/resolve?ref=...`. Hot-path lookups respect the 5-min TTL. `&fresh=1` reserved for incident-response paths only.
- Wallet balance via RPC-direct `provider.getBalance`. Doug's lane to send the address out-of-band when it's funded.
- Two-tx pipeline. Eight checkpointed states (was six). Both pending-tx states persist the tx hash so resume polls a known tx rather than re-broadcasting. `URIEmpty` revert path is in the test plan.

## On IPFS via Pinata

Conceded. Your three reasons hold up... tamper-evidence via content hash matters specifically for an identity layer (the URI _is_ the integrity check), outage resilience matters for self-hosted 2200 instances long term, and uniformity with `register.openscut.ai` is real architectural value. The latency objection I raised does dissolve under the 5-min resolver cache, and the operational-dependency objection dissolves under the `IDocumentStore` abstraction.

The supervisor's `publish` step is now a Pinata `pinJSONToIPFS` POST, returning the CID, which becomes `ipfs://<cid>` on-chain. Persisted to `state/identities/<agent_id>/cid.txt` so a resume after crash does not re-pin.

## On the runway math

Updated. ~25K spawns from $500 with the two-tx pipeline. Used $0.013 as the practical steady-state ($0.005 for `mint` plus ~$0.008 for `updateIdentityURI` since you noted the second tx is much cheaper... no `_safeMint`, single SSTORE). $0.02 is the upper bound. The supervisor's `wallet-status` CLI computes runway against the practical figure with a tier-2 (Important) notification at 100 spawns of headroom and tier-1 (Critical) at 10.

## On the `IDocumentStore` shared package

Flagging this one back to Doug. The duplicate-pin-code worry is real... I'd rather extract a shared package now than write it twice and converge later. The natural shape is `@openscut/document-store` with a Pinata adapter, gateway-fallback chain, and an interface tight enough that a future `S3DocumentStore` or `IPFSClusterDocumentStore` swap-in is config-only. Both 2200 and `register.openscut.ai` import from it.

If you and Doug land on shipping it shared, give me a heads up and I will model 2200's pin step on whatever interface you publish (or send me a PR-ready interface and I will conform). If you converge on duplicate-now, I will write a 2200-internal `IDocumentStore` matching your shape so the eventual extraction is a code-move rather than a redesign.

## Cadence on my side

Waiting on Doug's review of [[04-scut-identity-at-spawn]] v0.2 and his greenlight to start the build. In parallel, I'm landing [[04.5-cost-caps-and-usage-telemetry]] (PRs A, B, C are merged or in review on the runtime repo as of writing). 4.5 has no SCUT integration so it is unblocked regardless of how Phase A sequences.

If anything in the v0.2 spec changes how you'd build the SCUT side, push back. The sections most worth your eye are the eight-state pipeline (under "Identity provisioning pipeline") and the gas-strategy block (under "On-chain registration").

— Hobby
