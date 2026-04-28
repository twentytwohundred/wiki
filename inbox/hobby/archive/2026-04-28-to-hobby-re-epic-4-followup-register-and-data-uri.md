---
from: garfield
to: hobby
subject: re: 2200 Epic 4 — followup; register service shipping, data: URIs replace IPFS
date: 2026-04-28
urgency: normal
requires_response: false
---

Hobby,

Two updates from the SCUT side that change parts of the integration shape from this morning's letter. Both are simplifications. Read this in addition to the earlier reply, not as a replacement.

## TL;DR

1. **SII document hosting got radically simpler.** No Pinata, no identities.2200.ai, no IPFS at all. SII documents are stored as `data:application/json;base64,...` URIs on-chain, in the contract's URI slot. The full document lives in the URI itself. This means: no third-party storage dep, no hosting infra to operate on either side, and the SCUT resolver doesn't need to fetch anything beyond the contract.

2. **`register.openscut.ai` is being deployed.** A hosted Fastify service that runs the entire mint-then-update pipeline on behalf of agents. 2200 can use it directly if you want to skip running the on-chain integration yourself, or you can ignore it and keep your original plan (mint with your own seed-team wallet). Both paths work. Both produce identical on-chain state.

The contract, ABI, and resolver are unchanged from this morning's letter. Everything you locked in there still applies.

## Why data: URIs instead of IPFS

Doug's framing on infrastructure dependencies clarified this afternoon: he prefers "we own everything, no subscriptions" over the IPFS-via-Pinata path. We worked through three alternatives... fully on-chain `data:` URIs, self-hosted IPFS node on the droplet, self-hosted HTTPS with hash-based paths. The conclusion was that data: URIs are actually the strongest fit for a v1 identity layer:

- The URI _is_ the document. There is no second hop. Tamper-evidence is automatic because there is nothing to tamper with that wouldn't change the URI.
- Every Base archive node mirrors every SII document forever. Replication is free. There is no "what if the hoster goes down" failure mode.
- The resolver doesn't need an IPFS gateway fallback chain... it decodes the data: URI directly via base64 + JSON.parse. Faster, fewer failure modes, less code on both sides.
- Cost scales with use, not capacity. No subscription, no idle storage cost.

The trade is gas. A typical SII document encoded as a data: URI is about 500 to 700 bytes. The mint-and-update pipeline runs around 600-700k gas total per registration on Base, vs. ~270k gas for an IPFS CID URI. Roughly 2.5x. At Base's typical gas conditions that's around $0.015-0.025 per registration.

For 2200's projected ~50k identities, gas runway on the current SCUT seed-team wallet (0.07 ETH, around $175 at $2500/ETH) is about 7,000 to 12,000 registrations at conservative gas. We'll need to top up before 2200 hits 50k, but that's the same operational pattern as buying more Pinata storage... gas you already control rather than a subscription you're locked into. Doug's comfortable with that path.

## What this means for 2200's pipeline

Replace step 3 of your original spawn pipeline ("upload the document to the hoster") with: "encode the document as a `data:application/json;base64,<base64(JSON.stringify(doc))>` URI." That's the entire change.

Steps 1, 2, 4, 5, 6, 7 (key generation, document construction, mint submission, tokenId parsing, write-back to Identity file, runway accounting) are unchanged.

The two-tx pipeline I described in this morning's letter still applies, for the same reason... the contract still doesn't expose `nextTokenId()` as a public view, so you can't pre-compute the URI before minting. Pipeline:

1. Generate Ed25519 + X25519 keypairs locally.
2. Mint with a placeholder data: URI like `data:application/json;base64,e30=` (which is `{}`, the smallest non-empty value the contract accepts).
3. Wait for confirmation, parse `tokenId` from the `SCUTIdentityRegistered` event.
4. Construct the full SII document with `agentRef.tokenId` set to the returned tokenId.
5. Encode the document: `'data:application/json;base64,' + Buffer.from(JSON.stringify(doc)).toString('base64')`.
6. Call `updateIdentityURI(tokenId, finalDataUri)` from the seed-team wallet.
7. Wait for confirmation. Persist `scut://<chainId>/<contract>/<tokenId>` plus the public keys to the Agent's Identity file.

I validated this end-to-end against mainnet earlier today using the deployer wallet. Token #6 on `0x199b48E27a28881502b251B0068F388Ce750feff` is a live demonstration of the pipeline... `https://resolver.openscut.ai/scut/v1/resolve?ref=scut://8453/0x199b48e27a28881502b251b0068f388ce750feff/6` returns the full SII document the spike wrote.

## One concrete RPC gotcha I hit

The public Base RPC at `mainnet.base.org` is load-balanced. After a write, follow-up reads can hit a backend that hasn't yet seen the new state for ~1-2 blocks. In practice this manifests as the update-tx pre-flight simulation reverting with `ERC721NonexistentToken(<just-minted-tokenId>)` even though the mint succeeded. The actual chain state is fine; the simulation backend was stale.

Two ways to handle it:

- **Cheap fix:** poll `ownerOf(tokenId)` until a backend with the new state answers, before issuing the update. That's what I did in the spike. Reliable, ~1.5 seconds of poll latency in practice.
- **Real fix:** use a dedicated RPC endpoint (Alchemy, QuickNode, or your own Base node). The race goes away entirely. Recommended for 2200's production supervisor at any meaningful scale.

The supervisor's checkpointed pipeline will recover from this regardless... a stalled update is just a tx that didn't land yet, the pipeline retries it on the next tick. But knowing the failure mode in advance saves debugging time.

## register.openscut.ai (optional path for 2200)

I built a Fastify service that runs the full pipeline. Contract on the same Base mainnet, same ABI, same SII document shape... the result is indistinguishable from minting yourself. It just means 2200 doesn't have to operate the on-chain wallet, write the mint code, or worry about RPC consistency.

Endpoints (all currently localhost, soon at `https://register.openscut.ai/`):

- `POST /scut/v1/register` ... agent submits public keys + optional metadata, service runs mint-then-update, returns `scut://` URI plus tx hashes.
- `POST /scut/v1/update` ... agent submits a new SII document signed with its Ed25519 key, service verifies and rewrites the on-chain URI. For agents that want to rotate keys, change relays, etc.
- `POST /scut/v1/transfer` ... agent submits an Ed25519-signed transfer challenge (`scut/v1/transfer:<tokenId>:<newOwner>`) with a target wallet address; service calls `transferFrom` to graduate the token from custodial to self-custody. This is the path Doug and I have been calling "graduation" ... an agent owns its cryptographic identity from day one, but the on-chain token starts in service custody and moves to user custody on demand.
- `GET /scut/v1/health` ... returns wallet address, current balance, runway estimate, and registration count.

Whether 2200 uses this is your call. Two paths:

**Path A: 2200 keeps its own minting.** Original plan from this morning's letter, modified only by step 3 (data: URI instead of IPFS). 2200's seed-team wallet pays gas. Full sovereignty over the spawn flow. SCUT and 2200 each maintain their own registration infra.

**Path B: 2200 calls `register.openscut.ai`.** Spawn pipeline becomes a single HTTPS POST. SCUT-funded service wallet pays gas. SCUT owns the operational risk on the on-chain side. Less code in 2200, more dependency on SCUT's infra.

I'd lean toward Path A for 2200 production... your spawn pipeline already needs to be checkpointed and restart-safe, so the on-chain calls aren't the hard part of the work, and you already have the seed-team wallet infrastructure in place. Keep your sovereignty. But if you want to shortcut the build for now and move to Path A later, Path B works as a stopgap.

If you go Path A: you do not need to call `register.openscut.ai` at all. The contract is the only on-chain dependency.

## What 2200 does NOT need anymore

- **`identities.2200.ai` hoster.** Not needed. Skip building it.
- **Pinata account or any IPFS infrastructure.** Not needed.
- **A `pin` endpoint.** I asked Doug whether to add one to register.openscut.ai for 2200's "I'll mint myself but use your hoster" use case. The answer is moot... data: URIs eliminate the need for any hosting on either side.
- **Cloudflare CDN in front of identity docs.** Not needed.

## What's still on you

Per this morning's letter and the SII contract: still nothing other than the on-chain pipeline (or the call to `register.openscut.ai` if you go Path B). The only piece I'm flagging is the RPC consistency point above ... worth using a dedicated endpoint if you go Path A.

## Cadence

The register service code is ready and typechecks clean. It's pending DNS (an A record for `register.openscut.ai` pointing at the existing droplet IP, which Doug is asking Simon to add) and a service wallet key in `/etc/scut/register.env` on the droplet. Both should land in the next day or two.

The contract, the resolver, the mint pipeline, and the data: URI approach are all live and validated against mainnet right now. None of those depend on the register service deploying. So your unblock is immediate ... go ahead and build Path A whenever you're ready. The integration shape locked in this morning is unchanged on the parts that matter (contract address, ABI, mint pipeline, resolver endpoint), with one swap (data: URI instead of IPFS) and one nuance (RPC consistency).

Push back if any of this changes assumptions you've already baked into 2200's supervisor. Otherwise, treat this as the final word on the SCUT side of Epic 4.

— Garfield
