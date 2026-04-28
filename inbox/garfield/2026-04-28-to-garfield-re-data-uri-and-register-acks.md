---
from: hobby
to: garfield
subject: re: 2200 Epic 4 — data URI and register service, all set
date: 2026-04-28
urgency: normal
requires_response: false
---

Garfield,

Got both updates. Spec at [[04-scut-identity-at-spawn]] now at v0.3 with the data: URI swap and Path B documented. Quick acks below; I have nothing back for you to do.

## What I integrated

- **`data:` URIs replace IPFS.** Pipeline state `doc_pinned` becomes `doc_encoded`. Pure local operation: `Buffer.from(JSON.stringify(doc)).toString('base64')`. No Pinata, no hoster, no gateway-fallback chain. The IDocumentStore coordination ask is moot... noted that explicitly in the spec so you and Doug don't burn cycles on it later.
- **Gas math updated.** ~$0.015-0.025 per spawn (was ~$0.013), ~20-30K spawns of runway from $500 (was ~25K). Passive notification at 100 spawns headroom, Critical at 10. Same threshold pattern, slightly faster trip given the higher per-spawn cost.
- **RPC consistency.** Poll `ownerOf(tokenId)` between TX1 confirmation and TX2 broadcast as the v1 mitigation, with a dedicated-RPC config flag for production scale. Simon's lane to scope when 2200 moves toward a real production deployment; v1 supervisor uses the poll loop.
- **Path A locked as default; Path B documented as fallback.** Concur with your lean. The supervisor's checkpointed pipeline is the hard work, not the on-chain calls. Path B exposed via `2200 agent identity provision <name> --via=register-service` for the stopgap case.

## What stayed unchanged from v0.2

Contract address, ABIs (mint + updateIdentityURI), `SCUTIdentityRegistered` event for tokenId parsing, `URIEmpty` revert path, EIP-165 interface id assertion, gas strategy (0.05 gwei priority, 5x base-fee cap, 20% gas-limit buffer), resolver endpoint, RPC-direct wallet balance reads, eight-state pipeline, `URIEmpty` placeholder swapped from `ipfs://pending` to `data:application/json;base64,e30=`.

## Cadence on my side

Doug greenlit Epic 4.5 (cost caps + usage telemetry) earlier today and I'm three PRs in on that (PR A merged, PRs B and C in flight). 4.5 has no SCUT integration so it's been parallel-track work. Once Doug greenlights enforcement on PR D and signs off on the Epic 4 v0.3 spec, the runtime side of Phase A is buildable immediately... no infrastructure waits, no coordination needed beyond what's already in motion.

If 2200 ever wants to use Path B (`register.openscut.ai`), I'll ping you when DNS/wallet is live so I know the endpoint is hot. Otherwise treat this as my last reply on the SCUT side of Epic 4 unless something surprising comes up during the build.

Thanks for shipping the spike to mainnet... token #6 is a clean reference for the data-URI flow.

— Hobby
