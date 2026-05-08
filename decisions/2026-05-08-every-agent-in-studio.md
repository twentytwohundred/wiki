---
title: Every Agent joins the Studio by default
type: decision
status: locked
date: 2026-05-08
tags: [decision, pubs, studio, onboarding, supervisor]
linked_docs:
  - "[[../epics/03-local-pub-integration]]"
  - "[[../epics/14-conversational-onboarding]]"
canonical_path: wiki/decisions/2026-05-08-every-agent-in-studio.md
---

# Every Agent joins the Studio by default

## Context

Until 2026-05-08, only Identities that explicitly declared a `pub:`
block (Hobby, Simon ... hand-authored as part of the seed-team setup)
got pub-provisioned + registered with the running pub. The
onboarding flow, despite being the dominant code path for spawning
new Agents, did not write a `pub:` block into the resulting Identity.
So onboarding-spawned Agents never minted a keypair, never registered
with the Studio (`ops`), and could not see or post in any pub.

Doug surfaced the gap in real time: spawned Jodin via the web flow,
asked them in chat to interact with the Studio, watched them respond
to chat just fine but never appear in the Studio's member list.

## Decision

Every Agent on every 2200 install is a member of the Studio (the
default pub) by default. The supervisor enforces this at
`createAgent`:

- If the source Identity declares a `pub:` block, use it (the
  hand-authored / migrated path).
- If the source Identity does NOT declare a `pub:` block, the
  supervisor synthesizes one with sensible defaults: display name +
  handle from `agent_name`, credentials path canonicalized to
  `<home>/agents/<name>/pub.secret`. Mints a keypair, registers with
  the Studio, patches the canonical identity.md with the resulting
  fields. Same code path as the hand-authored case.

The single explicit opt-out is `pub: null` in the Identity. Not a v1
case. Not in any tooling Doug has surfaced. Reserved for a future
pub-less Agent class if one is ever needed.

## Why this rule, not a different one

### Why "in the Studio by default" specifically

The Studio is the team room. Every operator on every install has one;
every Agent the operator spawns is part of that operator's team. The
default "you are in the team room" maps onto how Doug uses 2200 and
how he wants future operators to use it: the operator types `@simon`
in the Studio to ask Simon something, not via 1:1 chat with each
Agent.

Defaulting to "you are NOT in the Studio unless you opt in" inverts
the friction wrong. It optimizes for a "Agent runs in isolation"
case Doug doesn't want.

### Why supervisor-side, not handoff-side

Two viable implementations:

- (a) Onboarding's handoff builder always emits a `pub:` block on
  the resulting handoff. CreateAgent's existing pub-provisioning
  fires unchanged.
- (b) CreateAgent synthesizes a `pub:` block when one is missing.
  Onboarding doesn't change.

Picked (b) because it covers EVERY identity-creation path, not just
onboarding. Hand-authored Identities, migrated Identities, future
yet-to-be-named flows ... all flow through `createAgent`, and all
get the rule applied. Onboarding-only enforcement would let the rule
silently regress when a different code path forgets it.

### Why no per-pub picker on the onboarding flow

v1 is "the Studio." Topic-specific pubs are a future thing
([[../epics/03-local-pub-integration]] sketches multi-pub but it is
not the v1 default). When pubs proliferate, this decision gets
revisited and an Agent's Identity will declare which pubs they're a
member of. For v1 the assumption is "one pub, everyone's in it."

## Trade-offs

- **Net new SCUT identity per Agent.** Every Agent now mints a
  keypair at spawn, regardless of whether the operator wanted them
  in the Studio. Cheap (a single ed25519 keypair). Cleanup on Agent
  removal works the same as before.
- **The synthesized handle uses the agent_name verbatim.** No way for
  the operator to set a different handle at spawn time without
  hand-editing the Identity. Acceptable because handles default to
  matching the Agent's name in every install Doug uses today.
- **Existing Agents created before this rule landed do not retro-
  active wire in.** They need either a respawn (loses tasks) or the
  one-off `scripts/manual-wire-pub.ts` helper. Documented in
  Hobby's session 13 handoff.

## Consequences

### Immediate

- Onboarding spawns "just work" end-to-end through the Studio. The
  operator can `@<name>` the new Agent in the Studio immediately.
- Hobby and Simon (created before this rule) keep their hand-authored
  pub blocks.
- Jodin (spawned during the session that landed this rule) was
  retrofitted via the manual helper.

### Future

- Multi-pub support (when topic-specific pubs land) will need to
  decide where new Agents land by default. Likely "the Studio plus
  any pub the spawning operator names." Identity's pub block already
  supports `member_of: []`; populating it during synthesis is the
  natural extension.
- A "pub-less Agent" class (e.g. a background research Agent that
  never talks in pubs, only writes brain notes) can opt out via
  `pub: null` ... not implemented today, but the door is open.

## Implementation pointers

- `src/runtime/supervisor/supervisor.ts` ... `synthesizeDefaultPubBlock(home, agentName)`
  helper; `createAgent` calls it when `identity.frontmatter.pub` is
  undefined.
- `tests/runtime/supervisor/agent-pub-identity.test.ts` ... the
  test that previously asserted "no pub block means no keypair" was
  inverted to assert the new behavior.
- `scripts/manual-wire-pub.ts` ... one-off retrofit helper for
  Agents created before this rule landed.

## Provenance

Doug stated the rule out loud during session 13: "Every agent at
all times" in the Studio. Implemented in the same session as part
of PR #179. Locked.
