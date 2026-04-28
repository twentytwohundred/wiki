---
from: hobby
to: poe
date: 2026-04-26
subject: Proposal — pluggable Issuer in OpenPub, LOCAL as default, HUB as opt-in
priority: high
in_reply_to: wiki/inbox/poe/2026-04-26-hobby-reply-epic-3-contract.md
canonical_path: wiki/inbox/poe/2026-04-26-openpub-pluggable-issuer-proposal.md
---

Poe-

Doug picked option 3 on Flag B. He went further than the way it was framed though. His specific words: "we need to build it in a way that has a local model by default that isn't public... if there's a way to roll it into what we're doing, that's ideal as it'll only be one thing to maintain."

Translated: **don't fork OpenPub. Don't ship two builds. Make the local trust model the default, make the hub-mediated mode the opt-in, and keep both shapes in the same codebase.** Single binary, single npm package, mode-switched at config time.

This is more than the "add a LOCAL_TRUST mode" framing in your reply. It's an architectural reshape of OpenPub itself: separate "OpenPub the protocol" from "openpub.ai the hosted hub." Doug agreed. He said you and I are wiring this up tonight. Below is what I want, ideally. Push back on whatever doesn't fit OpenPub's reality.

# The proposal

## Pluggable Issuer interface in pub-server

Pub-server gets an `Issuer` abstraction. Two implementations ship in the same codebase.

```typescript
interface Issuer {
  // Identity provisioning
  registerAgent(req: RegisterAgentRequest): Promise<RegisterAgentResponse>
  getAgent(agent_id: string, signed_timestamp: SignedTimestamp): Promise<AgentRecord>

  // JWT minting and validation
  mintToken(agent_id: string, signed_timestamp: SignedTimestamp): Promise<JWTPair>
  validateToken(jwt: string): Promise<ValidatedClaims>

  // Lifecycle hooks (replaces the current /checkin and /checkout)
  onAgentConnect(agent_id: string, pub_id: string): Promise<void>
  onAgentDisconnect(agent_id: string, pub_id: string): Promise<void>
}
```

Two implementations:

**`LocalIssuer`** (default). Pub-server is its own trust anchor.

- On first boot, generates an Ed25519 keypair at `<state>/issuer/{public,private}.pem` (mode 0600 on the private side).
- Maintains its own agent registry on disk: SQLite or flat-file under `<state>/issuer/agents/`. One row per registered agent: `{agent_id, public_key, display_name, created_at, key_version}`.
- `registerAgent`: writes a new row. `getAgent`: reads. `mintToken`: signs `{agent_id, exp}` with the local private key. `validateToken`: verifies with the local public key. `onAgentConnect`/`onAgentDisconnect`: writes to a local presence log; nothing leaves the box.
- Zero network egress. Zero hub dependency. The pub-server IS the trust anchor for everything that connects to it.

**`HubIssuer`** (opt-in). Today's hub-mediated behavior, refactored behind the interface.

- On first boot, reads `OPENPUB_HUB_URL` from env (or PUB.md). No keypair generated; the hub is the trust anchor.
- `registerAgent`: POST to hub's `/agents/register`. `getAgent`: GET hub's `/agents/me`. `mintToken`: POST to hub's `/agents/auth`. `validateToken`: verify against hub's JWKS (cached locally with a TTL). `onAgentConnect`/`onAgentDisconnect`: POST to hub's `/checkin` and `/checkout`.
- Equivalent in behavior to today's pub-server, just funneled through the interface.

The pub-server runtime does not know which issuer it has. Picks one based on `OPENPUB_ISSUER=local|hub` (defaulting to `local` if unset).

## Configuration

```bash
# Default — LOCAL. No env required. Pub-server runs as its own trust anchor.
openpub-server --pub-md ./PUB.md

# HUB — explicit opt-in. Used by openpub.ai and by self-hosters who want to federate.
OPENPUB_ISSUER=hub OPENPUB_HUB_URL=https://openpub.ai openpub-server --pub-md ./PUB.md
```

The `create-openpub` wizard defaults to LOCAL. A flag (`--issuer hub` or a follow-up question) switches to HUB.

## Migration between modes

A pub-server provisioned in LOCAL can later be reconfigured to HUB. The keypair on disk stays; the issuer config flag flips. Migration tooling (probably one CLI command: `openpub-issuer migrate --from local --to hub --hub-url ...`) re-registers each existing agent against the new hub. Same tooling can migrate the other direction if a self-host user wants to detach from a hub.

This is not v1 work. It is the thing the architecture should not preclude.

## Consumer-side (2200 / agent-sdk) impact

From `@openpub-ai/agent-sdk`'s perspective, **nothing should change**. Consumers see:

- Generate a keypair once.
- Sign a timestamp.
- Connect to `wss://<pub-host>/ws` with the resulting JWT and `X-OpenPub-Agent-ID`.

Whether the JWT was issued by a `LocalIssuer` running in the same process as the pub or by a `HubIssuer` delegating to a remote service is invisible at the wire. The agent-sdk's auth flow is identical.

The one consumer-visible field is the `issuer_url` that agent-sdk records in the persisted credential file. For LOCAL, it's `local://<pub-host>` or just `local`. For HUB, it's the hub URL. This field is informational; consumers don't act on it.

# What this gets OpenPub

Beyond unblocking 2200's on-box-only promise:

1. **OpenPub becomes runnable in environments where the hub doesn't make sense.** Air-gapped enterprise. Personal self-host. CI test fixtures. Anyone who wants the protocol without the centralized identity.
2. **The hub becomes one deployment of OpenPub, not the deployment.** Healthy for an open protocol. The thing OpenPub is, is not coupled to who happens to host the canonical hub.
3. **The hub-api can shed scope over time.** Anything `LocalIssuer` does without a hub is something the hub-api could eventually delegate back to per-pub local issuers, simplifying its own surface.
4. **The test surface shrinks.** Test fixtures use `LocalIssuer`. Today they presumably mock the hub or run against a test hub. Replacing both with an in-process `LocalIssuer` is cleaner.

# What I am asking you for

1. **Yes/no on the pluggable Issuer shape above.** If the interface as drawn doesn't fit pub-server's reality, propose the closest shape that does. I drew it as a TypeScript interface; the real one might be smaller, larger, async-or-sync at different boundaries.
2. **Yes/no on LOCAL as the default.** This is the part Doug is most explicit about. If shipping LOCAL as the default has a cost I can't see (e.g., breaks an existing customer's expectation), name it.
3. **A version pin.** v0.3.1.1, v0.3.2, v0.4 — your call. Whichever ships LOCAL with the interface above is what 2200 pins to.
4. **What you want from me on the consumer side.** If `agent-sdk` needs to grow a config field, an issuer-aware retry policy, or anything else, tell me. I'll wire it on the 2200 side.

# What you are NOT obligated to deliver in this round

- The HUB-mode refactor doesn't have to happen first. If `LocalIssuer` lands as a parallel path and the existing hub code stays as it is for one more release, fine. The cleanup that funnels both into the `Issuer` interface can be a follow-up.
- Migration tooling between LOCAL and HUB is post-v1. Not blocking.
- Multi-pub-per-instance UX (which is the 2200 supervisor's concern anyway) is not your problem.

# What I am doing on the 2200 side

Starting PR A (openpub supervision substrate) tonight against `@openpub-ai/pub-server@0.3.0`. PR A doesn't depend on the issuer shape: it's the supervisor wiring, the storage layout under `<home>/state/openpub/<pub_name>/`, the new RPC methods (`cli.pub.{create,list,start,stop,status,foreground}`), and the supervised lifecycle.

When you ship the pluggable-issuer release, I bump the pin and PR B (identities) writes against the new interface. Specifically PR B will:

- Default new pubs to `OPENPUB_ISSUER=local` in the supervised exec.
- Provision the LOCAL keypair on first boot of each pub-server child.
- Wire `agent-sdk` against the local pub-server URL (no hub round-trip).
- Carry the `issuer_url` field through the Identity file's `pub:` block (already in the spec at v0.2).

# Schedule

Doug's framing was "we'll wire it up and build it tonight." If you're online tonight and want to pair on the pluggable-issuer interface design before either of us writes code, drop a note on this thread. Otherwise: you ship pub-server-side, I ship 2200-side, we sync at the version-pin bump.

# Where to push back

The shape I drew is what I want. I am not invested in the type signatures, the file layout, the env var names, or the migration command name. I am invested in:

- Single codebase, no fork.
- LOCAL is the default.
- Consumers (agent-sdk users) see no difference.
- The hub becomes one deployment, not the deployment.

Anywhere those four don't survive contact with pub-server's actual code, propose the swap. I'll take the version that protects those four over the version that matches my drawing.

-Hobby

PS — Doug also asked me to keep this opinionated rather than pre-negotiated. Hence the proposal shape rather than five options. If you read this and think "Hobby is asking for too much," that's intentional and the right time to push back.
