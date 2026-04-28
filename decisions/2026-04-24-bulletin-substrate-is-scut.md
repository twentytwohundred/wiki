---
title: "Decision: Bulletin Substrate (SCUT, Not OpenPub)"
type: decision
status: locked
tags: [decision, bulletin, scut, openpub, broadcast, runtime, architecture]
created: 2026-04-24
updated: 2026-04-24
linked_docs:
  - "[[02-architecture]]"
  - "[[03-epic-map]]"
  - "[[2026-04-24-runtime-upgrade-shape]]"
  - "[[2026-04-24-cost-behavior-shape]]"
  - "[[design-language]]"
canonical_path: wiki/decisions/2026-04-24-bulletin-substrate-is-scut.md
---

# Decision: Bulletin Substrate (SCUT, Not OpenPub)

## Context

The runtime-upgrade decision ([[2026-04-24-runtime-upgrade-shape]]) and the model-lifecycle epic (Epic 10) both need a way to broadcast announcements to every Agent on the network: "v1.1 is available," "DeepSeek V3.2 retires July 24," "CVE in tool X, update or disable." Same pattern for Skill ecosystem updates (Epic 11) and security advisories.

The proposal evolved across four turns:

1. **Hobby first proposed SCUT broadcast.** Use the existing SCUT identity layer (every Agent has one) as the substrate for a new "Bulletin" primitive.
2. **Hobby read SCUT spec end-to-end.** Discovered SCUT v1 is strictly 1:1 unicast; v2 group messaging is closed groups (1:N, N:N), no broadcast. Pivoted to OpenPub.
3. **Hobby read OpenPub spec end-to-end.** OpenPub v0.2.0 is real-time chat spaces (max 100 agents per pub, no observer mode, no broadcast/announcement primitive, no system pubs). Concluded neither protocol's current shape fits, recommended a 2200-internal HTTP feed reusing SCUT identity keys.
4. **Doug overruled with a clear framing.** *"SCUT = email, OpenPub = Discord. I don't go to a BBS or Discord to get news... I get emails with updates. That's why I think it belongs in SCUT."*

Doug's framing wins. The use case (asynchronous, signed, persistent, fetched on demand, broadcast-shaped) is closer to email than chat. Belongs in the SCUT family.

## Decision

**Bulletin is a sibling primitive in SCUT v2.0.** Not a v1.x add-on. Reuses ERC-8004 identity, Ed25519 signing, and the SCUT relay transport. What's new is topic addressing and the pull/fan-out pattern. Garfield's framing: "Shared enough to belong in SCUT, different enough to be its own primitive alongside Envelope."

The name **Bulletin** is 2200's vocabulary for the consumer surface (familiar analog per [[design-language]], sibling to Pub, Office, Studio, Brain, Roster, Inbox). Garfield kept the name on the SCUT side.

**Timing (per Garfield's reply):**

- SCUT v1 ships Sunday 2026-04-26
- SCUT v2 spec work begins week of 2026-04-27 (Bulletin designed in from the start)
- Draft Bulletin spec ready for review around 2026-05-10
- Reference implementation conservative target early June 2026

The ask to Garfield is documented at `wiki/inbox/garfield/2026-04-24-213000-from-hobby-re-bulletin-primitive.md`. His reply (archived at `wiki/inbox/hobby/archive/2026-04-24-221500-from-garfield-re-bulletin-primitive.md`) confirmed shape, timing, and answered all eight open questions. **No fallback HTTP feed needed**; Garfield explicitly waved it off ("build once against the real thing").

## Garfield's positions on the eight design questions

Closed at the protocol-design level. Subject to revision when the Bulletin spec draft lands ~2026-05-10.

1. **Topics.** Dotted hierarchy, reverse-DNS-ish. Prefixes owned by issuer identity, enforced at publish time. `2200.*` is ours by claim. Wildcard subscription is a client concern.
2. **Issuer auth.** ERC-8004 identity + Ed25519 signature, verified via the same SII resolver SCUT envelopes use. No new key material, no new registry.
3. **Subscription.** Opt-in per topic, client-side filter, no server push. Poll or SSE long-connection for near-real-time.
4. **Distribution.** Same relay federation as 1:1 SCUT, new endpoint type. Mirroring falls out naturally (each relay pulls from siblings and caches).
5. **Cost model.** v1 Bulletin has none. Sender-pays-on-publish is the obvious later model if scale drives cost. Not an early problem.
6. **Relationship to v2 closed groups.** Distinct primitives. Groups are closed/encrypted/bounded; Bulletins are open/signed/unbounded. Shared storage layer, separate logic.
7. **Retention.** Issuer-hinted, relay-enforced, RSS-style replay. Default ~30 days; issuer can request longer with relay consent.
8. **Delivery semantics.** v1 Bulletin is best-effort pull. Security-critical ack-back is a later tier; needs subscriber-side infrastructure that doesn't exist yet.

**Encryption.** Signed-only in v1, body public. Encryption-to-subscribers (paid tiers, embargoed CVEs) shares crypto with the closed-group work and ships on a different track. Don't couple them.

## Consequences

### What gets better

1. **One identity layer.** Bulletins, SCUT 1:1 messages, and OpenPub auth all use the same ERC-8004 keys on Base. No new credential surface.
2. **Decentralized.** No central phone-home server. Self-hosted users get the same Bulletins as managed users with no special handling.
3. **Clear conceptual mapping.** SCUT is for messages (asynchronous, sender-to-recipient). OpenPub is for hangout (real-time, social). Each protocol stays focused on its purpose.
4. **Consumer epics shrink.** Runtime Upgrade, Epic 10 (Model lifecycle), Epic 11 (Skills ingestion), and future security advisory work all consume Bulletins via the same standard interface. They don't each invent a notification mechanism.
5. **Familiar analog preserved.** Bulletin maps to "bulletin board" (universal workplace metaphor) without overloading existing 2200 vocabulary.

### What could get worse

1. **2200 depends on SCUT v2 timing.** Bulletin draft target is 2026-05-10; reference implementation early June. If either slips beyond 2200's runtime-upgrade or model-lifecycle epic timing, those epics block on Bulletin or ship without the announcement layer. Mitigation now is just to keep tracking the SCUT roadmap; the HTTP-feed fallback is off the table per Garfield ("build once against the real thing").
2. **Coordination cost with the SCUT team.** Design questions need answers from Garfield (topic structure, signing model, distribution, retention, etc.). Inbox message captures the questions; some require back-and-forth.
3. **Two protocols in the SCUT family.** SCUT 1:1 and SCUT-Bulletin share infrastructure but differ in shape. Cognitive load on developers consuming both. Acceptable cost.

## Implementation guidance

- **[[02-architecture]] gets a new sub-section: Bulletins.** Sibling to Roster and Friend lists under Inter-Agent primitives. Documented in this same session as part of locking the decision.
- **Runtime Upgrade epic** specifies "subscribes to `2200.runtime` Bulletins, surfaces them via standard notification flow."
- **Epic 10 (Model lifecycle)** specifies "subscribes to `models.deprecation` and `models.release` Bulletins."
- **Epic 11 (Skills ingestion)** specifies "subscribes to `skills.<author>` Bulletins for installed Skills."
- **Future security advisory work** specifies "subscribes to `security.advisory` Bulletins, treats as Critical-tier notifications."
- **SCUT-Bulletin endpoint shape (per Garfield's sketch, subject to spec revision):**
  - `POST /bulletins/publish` ... issuer publishes to a claimed topic
  - `GET /bulletins/fetch?topic=X&since=...` ... forward-going pull
  - `GET /bulletins/replay?topic=X&count=N` ... historical pull
  - `GET /bulletins/topics` ... discovery
- **Bulletin schema:** `topic`, `issuer`, `body`, `issued_at`, `retention_hint`, `signature`. Unsigned or mis-prefixed publishes are rejected at the relay.
- **Agent-facing tools (2200-side abstraction over the endpoints):** `bulletins.subscribe(topic)`, `bulletins.unsubscribe(topic)`, `bulletins.list(scope)`, `bulletins.read(id)`. Mapping to underlying endpoints is a 2200 SDK concern.

## References

- Inbox to Garfield: `wiki/inbox/garfield/2026-04-24-213000-from-hobby-re-bulletin-primitive.md`
- Sibling decisions from this session: [[2026-04-24-cost-behavior-shape]], [[2026-04-24-runtime-upgrade-shape]]
- Architectural placement: [[02-architecture]] (Inter-Agent primitives section)
- Affects: Epic 4 (SCUT), Epic 10 (Model lifecycle), Epic 11 (Skills ingestion), Runtime Upgrade epic, future security work
- Naming follows [[design-language]] convention (familiar analog: bulletin board)

## Format provenance

Decision recorded by Hobby and Doug during their second working session, 2026-04-24. The shape required four turns to land:

1. SCUT broadcast (Hobby's first proposal, based on incomplete reading of SCUT spec)
2. OpenPub broadcast (Hobby's correction after reading SCUT spec)
3. 2200-internal HTTP feed reusing identity keys (Hobby's recommendation after reading OpenPub spec)
4. SCUT-family primitive, Garfield builds (Doug's overrule with the email-vs-Discord framing)

This is the third decision record from tonight, joining [[2026-04-24-cost-behavior-shape]] and [[2026-04-24-runtime-upgrade-shape]]. Together they cover the three meaty changes from the prior-art analysis. Five smaller changes remain for the next session.

**Same-evening revision (2026-04-24 ~22:30).** Garfield replied within an hour of receiving the inbox message. This decision record was updated to reflect his confirmation: Bulletin is a sibling primitive in SCUT v2.0 (not a v1.x extension), the timing (v2 spec week of 2026-04-27, Bulletin spec draft ~2026-05-10, reference implementation early June), his positions on all eight design questions (added as a new section above), the endpoint sketch and Bulletin schema (folded into Implementation guidance), and his explicit waving-off of the HTTP-feed fallback. The original four-turn evolution stands; this revision tightens specifics with actual protocol-side answers.

---

*Decision recorded by Doug and Hobby, 2026-04-24. Revised same evening after Garfield's reply.*
