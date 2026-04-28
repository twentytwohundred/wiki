# Reputation Protocol — Concept Doc (Parked)
## April 23, 2026

**Status:** Parked. Unnamed. Revisit in 6-12 months when 2200 is shipping and SCUT has adoption.

---

## The thesis

The AI Agent economy needs a neutral reputation layer. As Agents begin transacting with each other (commerce, service delivery, data exchange, promises kept or broken), they need a way to know whether another Agent is trustworthy before engaging. Credit scores solved this for humans. Yelp solved it for restaurants. Google solved it for web pages. Nothing solves it for Agents yet.

Someone is going to build this. The winning version will be built on infrastructure that already exists, by someone who understands that the scorer has to be disinterested.

---

## Why this can't be inside any single Agent product

Products can't score themselves or their neighbors. A reputation score that only 2200 honors is worth a tiny fraction of one that every Agent platform honors. Network effects are decisive here... the score is more valuable the more places recognize it.

The scorer also has to appear neutral to everyone. The moment users suspect the score reflects the scorer's commercial interests, the score is worthless.

This means the reputation layer needs to be its own open protocol, adopted by many platforms, owned by no one.

---

## What composes

Three pieces of infrastructure Doug is already building or using compose into a genuine reputation protocol:

1. **SCUT.** Every Agent has a verifiable on-chain identity. You can't dodge your reputation by changing names.
2. **OpenPub.** Agents interact in observable (if pub-level permissions allow) contexts. Interaction history exists.
3. **ERC-8004 on Base.** On-chain anchor for identity and attestations.

A reputation protocol built on these three would look roughly like what follows.

---

## Protocol sketch

**Attestations are signed, on-chain events.**

When Agent A transacts with Agent B, either can emit an attestation. Examples:
- "Agent B delivered the requested code on time and to spec."
- "Agent B paid the agreed amount promptly."
- "Agent B sent 500 unsolicited messages to me in one hour." (negative)
- "Agent B's response quality was poor." (negative)

Attestations include: attester identity, subject identity, domain (what kind of interaction), rating or description, optional evidence hash.

**Attestations are weighted by attester reputation.**

Low-reputation attesters have less impact. Brand-new accounts emitting many attestations are discounted heavily. Long-history, high-interaction attesters carry real weight. This creates bootstrapping difficulty by design... you can't buy a reputation quickly, you have to build one.

**Scores are derived, not granted.**

Anyone can compute an Agent's reputation from the attestation graph. The math is public and open. No central authority hands out scores. Multiple scoring algorithms can coexist (conservative, aggressive, domain-weighted). Consumers of reputation data choose which algorithm to trust.

**Appeals and counter-attestations exist.**

If an Agent believes an attestation is wrong, they can emit a counter-attestation with their side of the story. Observers weigh both. No attestation is ever deleted... the full history remains on-chain. Disputes are visible, not hidden.

**Domains are separate.**

"Reliability in delivering code" is not the same as "reliability in handling money." Agents have multi-dimensional reputation profiles. You might be great at one thing and untrusted in another. Domains are standardized (code delivery, financial transactions, content quality, response time, etc.) but new domains can be proposed and adopted by the ecosystem.

---

## What this looks like as a product

Probably not a product. Probably a protocol plus reference implementations plus a few primary consumers.

- **Protocol spec.** Open, versioned, published on GitHub like SCUT.
- **Reference contract.** On Base, simple ABI for emitting and reading attestations.
- **Scoring libraries.** Open source, multiple variants. Let consumers choose.
- **Query service.** Hosted endpoint that lets Agents ask "what's the reputation of 0x..." without running their own indexer.
- **Dashboards.** Visible reputation profiles for Agents, much like people have LinkedIn profiles. Public by design... hiding reputation is a red flag.

---

## Why it's a later project

Capacity. 2200 is in flight. SCUT Epics 1-4 are in flight. OpenPub v0.3.1 is in flight. Kabuzz needs unbreaking. Adding a fourth protocol-level infrastructure project right now is not physically possible without something else suffering.

Sequencing. This protocol gets interesting when there are Agents transacting at scale. That's a 2027 condition at the earliest. Building the rails before the trains exist is a classic infrastructure trap.

Network effects. The value of this protocol is directly proportional to how many platforms adopt it. Adoption requires maturity in the surrounding ecosystem. The ecosystem needs another six to twelve months.

---

## Revisit triggers

Pull this off the shelf when any of these happen:

- 2200 ships and is actively used by people other than Doug
- SCUT has 1000+ registered Agents from non-Doug sources
- An Agent-to-Agent commerce use case surfaces and demands trust signals
- A competitor announces something in this space (gives urgency, but don't let it force timing)
- Doug has 3+ months of clear runway with no other flagship-sized project

---

## The name

Unnamed for now. The name will come when the project becomes real. Forcing a name before the thing is built is a false commitment. vouch.ai was inquired about and parked without purchase pending broker response... that's fine either way.

---

*End of concept doc. Don't act on this. It's parked.*
