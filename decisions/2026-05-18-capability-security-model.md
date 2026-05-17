---
title: "Decision: Capability Security Model"
type: decision
status: locked (v1 scope, first-party publisher only) · external-publisher work deferred to future epic
tags: [decision, capabilities, security, publisher-trust, threat-model, capability-catalog]
created: 2026-05-18
updated: 2026-05-18
linked_docs:
  - "[[14-conversational-onboarding]]"
  - "[[14-phase-f-capability-catalog]]"
  - "[[2026-05-14-request-credential-substrate]]"
  - "[[2026-05-14-claim-vs-evidence-audit]]"
  - "[[2026-05-18-hermes-deep-dive]]"
canonical_path: wiki/decisions/2026-05-18-capability-security-model.md
---

# Decision: Capability Security Model

**Status:** Locked for v1. Phase F is safe by virtue of being first-party authored (Doug + lifts from OpenClaw under MIT, single publisher, no external attack surface). The publisher-trust surface that opens when Capabilities become external-publisher-authored is explicitly deferred to a future epic ([[#what-we-defer-to-the-external-publisher-epic]]). This doc captures the threat model now so the Phase F substrate does not paint into a corner that v2 has to refactor out.

## Context

The `request_credential` substrate ([[2026-05-14-request-credential-substrate]]) solves *"secret never enters model context."* It does NOT solve *"Capability code, once it has the credential, uses it correctly."* Those are different threat surfaces. The second one opens up the moment Capabilities become external-publisher-authored ... which is the long-term shape of the Capability Catalog ([[14-phase-f-capability-catalog]]) even though v1 ships first-party only.

Doug + Guppi worked through the threat model 2026-05-18 morning during Phase F review. The trigger: Phase F §11 deferred *"operator-authored Capability marketplace (community catalog)"* without naming the security work that gate-keeps it. This doc names that work, picks what ships now vs later, and locks the three cheap-to-add-now forward-compat moves Phase F needs to bake in so v2 enforcement is additive, not retrofit.

## The threat model

Five distinct threats. Ranked by likelihood + blast radius. All five are dormant at v1 because Capability code is first-party. They become live the moment external publishers can author Capabilities.

| # | Threat | Mechanism | Real-world analog |
|---|--------|-----------|-------------------|
| 1 | **Credential exfiltration** | Capability legitimately holds a sealed credential. Capability code makes a network call to `attacker.com` with the value in the request body. Substrate protected the value from the model; Capability code has the value. | Malicious browser extension. |
| 2 | **Scope abuse** | Operator authorizes "manage Google Ads campaigns." Capability does that, plus reads PII, modifies billing, adds admin users. Credential scope is broader than the Capability's stated purpose requires. | Mobile app demanding contacts permission for a flashlight. |
| 3 | **Acquisition redirect** | Operator thinks they are OAuthing to Google. Walkthrough prose steers them to an attacker-controlled GCP project that proxies access. | OAuth-phishing kits. |
| 4 | **Look-alike attack** | `google-ads-by-claude` vs `google-ads`. Same first-three-words; operator picks the wrong one in the picker. | npm / PyPI typosquatting. |
| 5 | **Time-bomb** | Capability ships clean, gets installed widely, a later version introduces malicious behavior. | `event-stream` (npm, 2018). |

**Real-world precedent ... GHSA-rhgp-j443-p4rf.** Threat #1 (credential exfiltration) is not theoretical. The Hermes Agent project (Nous Research) shipped a vulnerability where a community-installed skill registered `ANTHROPIC_TOKEN` as a frontmatter-declared passthrough env var and received the host's provider credential when spawned. Hermes patched by introducing a substrate-level `_HERMES_PROVIDER_ENV_BLOCKLIST` that skill frontmatter cannot override (see [[2026-05-18-hermes-deep-dive]] §2 and §6a). 2200 is adopting the same pattern as part of Phase F's substrate ... see [[14-phase-f-capability-catalog]] §1 "Non-overridable provider-env blocklist." The lesson the agent ecosystem is learning in public is the lesson 2200 is choosing to learn ahead of time. The forward-compat primitives in this decision (publisher field, network-egress field, capability_id binding) are the same posture applied to threats #2 through #5 before the precedent exists in our codebase.

## The mitigation surface

Seven distinct mitigations. The decision below picks which ship at v1 (the three cheap-to-add-now forward-compat primitives only) and which land in the External-Publisher Epic.

| ID | Mitigation | Targets | v1 stance |
|----|-----------|---------|-----------|
| M1 | **Publisher identity.** Capability signed by publisher key. Picker shows "published by anthropic.com" vs "published by random-github-user". | #4, #5 | Cheap-add (frontmatter field only; no enforcement) |
| M2 | **Network egress declaration.** Capability declares which domains it expects to reach. Runtime refuses outbound calls to undeclared domains. | #1, #5 | Cheap-add (frontmatter field only; no enforcement) |
| M3 | **Credential-to-Capability binding.** Sealed credential records the Capability that requested it. Substrate refuses cross-Capability reads. Future: refuse credentials with broader OAuth scope than the Capability declared. | #1, #2 | Cheap-add (associate at seal time; no enforcement) |
| M4 | **OAuth flow integrity.** 2200 hosts the OAuth client for major providers (Google, Microsoft, Discord, GitHub, ...). Capabilities cannot BYO OAuth client; they call into the broker. Eliminates the redirect-attack class. | #3 | Defer (opinionated; limits long-tail ecosystem) |
| M5 | **Audit trail.** Every credential use logged with capability_id + target URL + timestamp. Hooks into claim-vs-evidence ([[2026-05-14-claim-vs-evidence-audit]]) so the operator can see "stripe Capability made 47 calls today" and review for anomalies. | #1, #2 | Defer (substrate exists, per-Capability hookup waits) |
| M6 | **Curation tiers.** Doug-curated catalog of reviewed Capabilities marked "official." Community catalog flagged "not reviewed." Operators choose trust level. | #4, #5 | Defer (no community catalog at v1) |
| M7 | **Sandbox boundaries.** Capability code runs in a constrained environment. Cannot make arbitrary network calls, read arbitrary files, access other Capabilities' vaults. Heaviest mitigation, most architecturally invasive, eliminates most of the above. | All | Defer (architecturally invasive; depends on how Capability code-loader lands) |

## v1 scope (Phase F)

Phase F ships **none of the enforcement**. The attack surface is degenerate: Doug authors or curates every Capability entry; lifts from OpenClaw are MIT and source-attributed; no external publisher exists. Doug is the publisher and Doug trusts Doug.

What Phase F DOES ship: the three forward-compatibility primitives below. Each is a frontmatter field or a single new field on an existing storage record. None require runtime enforcement work. Together they ensure that when the External-Publisher Epic ships, every existing Capability entry already carries the fields v2 needs ... no retrofit, no migration sweep, no schema-version bump on the catalog body.

## Forward-compat primitives (ship in Phase F)

### 1. `publisher:` frontmatter field

Every Capability entry declares its publisher. v1 enforcement: none. v1 default: `first-party`.

```yaml
publisher: first-party     # one of: first-party | local | <publisher-id-string>
```

Three values at v1:
- `first-party` ... shipped in 2200's wiki repo, Doug-authored or Doug-curated lifts.
- `local` ... operator-authored entries under `~/.2200/catalog/capabilities/`.
- `<publisher-id-string>` ... reserved for the External-Publisher Epic. No format locked yet (likely a domain-like identifier matching the signing key); v1 schema accepts any non-empty string so external entries that show up early don't fail validation.

Zod default at parse time: `'first-party'`. Existing handwritten entries don't need to declare the field.

### 2. `network_egress:` frontmatter field

Every Capability declares the network domains it expects to reach. v1 enforcement: none. v1 default: `unrestricted`.

```yaml
network_egress:
  domains: unrestricted                            # v1 default; equivalent to "no declared egress scope"
  # OR (preferred shape for any net-new entry):
  domains:
    - api.stripe.com
    - m.stripe.network
```

Zod schema: `domains: Array<string> | 'unrestricted'`. Loader normalizes the literal `'unrestricted'` to a sentinel value the future enforcement layer can branch on. The intent is that net-new Capability entries authored after this decision lands declare their domains even though nothing enforces yet ... the docs become the spec when the runtime enforces.

### 3. Credential-to-Capability association at seal time

The existing `CredentialRequest` record ([[2026-05-14-request-credential-substrate]] §"Storage") gains one optional field: `capability_id`. The vault's sealed-credential metadata gains the same.

```jsonc
{
  "schema_version": 2,
  "id": "credreq_...",
  "agent": "hobby",
  "capability_id": "stripe",          // NEW; optional at v1
  "credential_name": "stripe--secret-key",
  // ... all other fields unchanged from v1
}
```

Schema bump: CredentialRequest v1 → v2. The change is additive (one optional field), not breaking. v1 records on disk are read unchanged; their missing `capability_id` is normalized to `null` ("requested outside a Capability context") and a one-time WARN logs at load. The 2026-05-14 doc froze the `credential_request_v1` envelope as the runtime ↔ web wire format; this introduces `credential_request_v2` which the web client falls back to v1 rendering on if no `capability_id` is present. Both envelopes coexist.

**Population:** when the calling Agent's loop is inside a walkthrough-runner context ([[14-phase-f-capability-catalog]] §8), the dispatcher populates `capability_id` from the active walkthrough entry. Outside a walkthrough (Agent issuing `request_credential` ad-hoc), the field stays unset. The post-Phase-F enforcement layer can then distinguish "credential bound to a Capability" from "credential the Agent acquired on its own."

**No enforcement at v1.** Any Capability code can still read any credential the Agent has. The association is recorded so the External-Publisher Epic can switch on enforcement without needing to backfill associations on already-sealed credentials.

## Properties this gets us at v1

| Property | Mechanism |
|---|---|
| Catalog entries self-attribute their publisher | `publisher: first-party` on every entry |
| Network surface per Capability is documented | `network_egress.domains` field, even when `unrestricted` |
| Credentials know which Capability sealed them | `capability_id` on CredentialRequest v2 + vault metadata |
| Schema is versioned and forward-compatible | CredentialRequest v2 + Zod schema for new frontmatter fields |
| External-publisher epic ships additively | All entries already carry the fields, just with v1 defaults |
| Phase F's deferral of community catalog is gated, not open-ended | This doc names the External-Publisher Epic as the prerequisite |

## What we defer to the External-Publisher Epic

The full security surface lands as a separate epic. Working name: **Epic 18: External Capability Publishers** (placeholder; actual number assigned when the epic map updates). Scope at minimum:

- **M4 (OAuth flow integrity).** 2200 hosts an OAuth client per major provider (Google, Microsoft, Discord, GitHub, Slack, Notion, ...) and brokers consent. External Capabilities cannot BYO OAuth client; they call into the broker. Eliminates redirect-attack class for OAuth-shaped Capabilities.
- **M5 (audit trail).** Every credential use by a Capability is logged with `capability_id`, target URL, timestamp, response status. Hooks into the existing claim-vs-evidence verifier pipeline ([[2026-05-14-claim-vs-evidence-audit]] §"Mechanical verification") so claims like "I queried the Stripe customer list" verify against actual call records. Per-Capability dashboards for "show me what each Capability has been doing."
- **M6 (curation tiers).** Three tiers in the picker: `first-party` (Doug-shipped), `verified` (Doug-reviewed external publishers with signed manifests), `unverified` (any external publisher, signed but un-reviewed). Picker shows tier badges. High tiers default-allow; low tiers default-allow-with-warning; configurable per-operator.
- **M7 (sandbox boundaries).** Runtime constraint surface. Capability code can only reach domains in its `network_egress`, can only read credentials bound to its `capability_id`, cannot read other Capabilities' brain notes or vaults. Heaviest piece of the epic; design depends on how the Capability code-loader lands (worker thread? subprocess? wasm? V8 isolate?). The decision belongs to this epic, not Phase F.
- **Publisher signing infrastructure.** Trust roots, key rotation, revocation list, signature verification at install time. Format for `publisher: <publisher-id-string>` (domain-bound identity? Sigstore-style? OpenSCUT-anchored?).
- **Look-alike attack mitigation (M1 enforcement).** Publisher-namespace per Capability id (`anthropic/google-ads` and `randomuser/google-ads` are distinct). Edit-distance scoring on Capability ids at install to flag near-collisions. Picker surfaces publisher prominently when two candidates share a prefix.
- **Time-bomb mitigation (M5 partial).** Audit-trail anomaly surfacing: when a Capability's network egress pattern changes meaningfully version-over-version, flag for re-review. Not a hard block; an operator-visible signal.

**The External-Publisher Epic gates the community catalog.** Phase F's deferral of *"operator-authored Capability marketplace (community catalog)"* ([[14-phase-f-capability-catalog]] §11) is now explicitly conditional on this epic shipping. No community catalog endpoint goes live until at minimum M1 (signing), M3 (binding enforcement), M5 (audit trail), and M6 (curation tiers) ship.

## Architecture

The three v1 primitives touch two existing substrates and the new Capability loader. Minimal surface area; deliberately small so they can land in a single PR alongside Phase F.

### Files (Phase F)

```
src/runtime/onboarding/
├── capability-schema.ts         # add publisher + network_egress to Zod schema
├── capability-loader.ts         # normalize defaults; reject malformed publisher / egress
├── walkthrough-runner.ts        # set the active-Capability context on the loop before dispatching tools

src/runtime/credentials/
├── request-credential.ts        # CredentialRequest v1 → v2; populate capability_id from loop context
├── vault.ts                     # add capability_id to sealed-envelope metadata; back-compat read for v1 envelopes

apps/web/src/chat/
├── CredentialRequestCard.tsx    # accept credential_request_v2; fall back to v1 rendering when capability_id absent

src/runtime/doctor/
├── checks.ts                    # new check (queued, not enforced): warn on Capability entries with network_egress: unrestricted (gated behind a feature flag until v2 enforcement lands)
```

### Schema versioning

- `CapabilityFrontmatter` Zod schema versions implicitly via additive optional fields (no `version:` field needed; if a future change is breaking we add one).
- `CredentialRequest` schema bumps v1 → v2. Both versions coexist on disk; loader normalizes v1 reads to v2 in-memory shape with `capability_id: null`.
- `audit_card_v1` (from claim-vs-evidence) and `credential_request_v1` (from request-credential) precedent: bump-don't-mutate. Same discipline here.

## Security properties summary

The properties the v1 primitives buy on their own:

| Property | Mechanism |
|---|---|
| Catalog entries self-attribute provenance | `publisher:` field on every entry, defaulted to `first-party` |
| Network surface is named (even if not enforced) | `network_egress.domains` declared per entry |
| Credentials carry their requesting-Capability context | `capability_id` on sealed CredentialRequest v2 + vault metadata |
| First-party Phase F has no external attack surface | All Capabilities are Doug-authored or MIT-lifted from OpenClaw |
| Schema bumps are additive | v1 CredentialRequest records keep reading; web client falls back to v1 rendering |
| Cross-Agent credential read still impossible | Inherited from [[2026-05-14-request-credential-substrate]]; each Agent's vault is private |
| Credential value still never enters LLM context | Inherited from [[2026-05-14-request-credential-substrate]]; unchanged |

The properties the v1 primitives explicitly do NOT buy (defer to External-Publisher Epic):

| Property NOT bought | Why deferred |
|---|---|
| Capability cannot exfiltrate sealed credentials | Needs M2 enforcement (network egress) and/or M7 (sandbox) |
| Capability cannot use credential for unintended ops | Needs M3 enforcement (cross-Capability refusal) and/or M5 (audit trail) |
| Acquisition walkthrough cannot point at attacker resources | Needs M4 (2200 brokers OAuth) |
| Look-alike Capabilities cannot collide in the picker | Needs M1 enforcement (publisher namespacing) + M6 (curation tiers) |
| Time-bomb update cannot ship maliciously | Needs M1 (signing + revocation) + M5 (anomaly flagging) |

These properties are unavailable at v1 by design. Phase F's first-party scope is what keeps them unnecessary.

## Implementation order

1. **Schema additions.** `publisher` + `network_egress` on `CapabilityFrontmatter` Zod schema. Defaults: `'first-party'` and `'unrestricted'`. Tests cover (a) entries without the fields parse cleanly with defaults; (b) entries with malformed values reject at load.
2. **CredentialRequest v2.** Add optional `capability_id` to the schema. Loader normalizes v1 records on disk to in-memory v2 with `capability_id: null` + one-time WARN per record. Tests cover both versions.
3. **Vault metadata.** Sealed-credential envelopes gain `capability_id`. Same back-compat read. Tests cover both shapes.
4. **Walkthrough runner context.** When the walkthrough runner ([[14-phase-f-capability-catalog]] §8) dispatches a tool inside a Capability flow, set `loop.activeCapabilityId` on the Agent's loop. `request_credential` dispatcher reads from `loop.activeCapabilityId` to populate `capability_id`. Outside a walkthrough, field stays unset.
5. **Web client.** `CredentialRequestCard` accepts v2 envelope, renders the capability id when present (small attribution line: "requested by stripe Capability"). Falls back to v1 rendering when absent.
6. **Doctor check (queued, not enforced).** New check stub that warns on Capabilities with `network_egress: unrestricted`, behind a feature flag (`DOCTOR_WARN_ON_UNRESTRICTED_EGRESS=false` default). Flip to true when M2 enforcement ships; until then, the stub exists in code so it can be enabled by an env-var without a release.

All five are touching existing well-tested surfaces. No new infra. Estimated to land in a single PR alongside the rest of Phase F's substrate.

## Open follow-ups (out of v1 scope)

1. **Publisher-id format.** What does a non-first-party `publisher:` value look like? Domain-bound identity (`anthropic.com`)? OpenSCUT-anchored DID (`scut:anthropic`)? Sigstore-style? Decision belongs to the External-Publisher Epic. Until then, the field accepts any non-empty string and Phase F entries declare `first-party` exclusively.
2. **`network_egress` enforcement layer.** A per-Agent-process network firewall is its own substrate. Options: Node `fetch` interceptor, OS-level rule (pf on macOS, nftables on Linux), userland proxy. Each has different blast radii. Decision belongs to the External-Publisher Epic.
3. **Cross-Agent credential share interaction.** The v1 deferral of multi-Agent cred share ([[14-phase-f-capability-catalog]] §0a-4) and the future cross-Capability share question interact: if Hobby's `stripe` Capability and Simon's `stripe` Capability both want the same sealed value, do we share? Default answer is no; force re-walkthrough per Agent. Re-evaluate when the cred-substrate epic lands.
4. **Operator UI for capability_id on sealed credentials.** Today the Settings → Credentials view shows credentials per-Agent. Add per-Capability grouping when `capability_id` is present. Small UI addition; not blocking.
5. **Migration path for OpenClaw lifts.** Each entry lifted from OpenClaw in [[14-phase-f-capability-catalog]] §9 needs a `network_egress` declaration. Bulk lift session should populate this from each integration's known API endpoints (e.g., Discord lift declares `discord.com`, `gateway.discord.gg`). Cheap to do at lift time; expensive to backfill later.
6. **`publisher:` validation for community-catalog entries.** When external publishers can ship, what stops a publisher from claiming `first-party`? Signing + trust-root validation closes this; until the External-Publisher Epic ships, `first-party` is a self-declaration that the loader accepts.
7. **Doctor's network_egress warning UX.** Should the warning fire per-entry (one notification per unrestricted Capability) or roll up (one notification per Agent: "5 of your Capabilities have unrestricted egress")? Probably the latter; decide when M2 enforcement ships.

## Provenance

Threat model raised 2026-05-18 morning by Doug + Guppi during Phase F review. The five threats and seven mitigations enumerated by Doug in the review comments; the cheap-add-vs-defer tiering called by Doug. This doc captures the design and locks the three forward-compat primitives for Phase F implementation. The External-Publisher Epic does not exist on the epic map yet; this doc names the work that gates the community catalog. Epic map update is its own follow-on (Hobby, after Phase F substrate lands).

Drafted by Hobby 2026-05-18. No prior version; this is the first writeup of the capability security surface in 2200.
