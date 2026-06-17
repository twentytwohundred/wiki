---
title: "Studio dedup: trust-the-cred idempotency (interim), view-layer shadow collapse, and asking the operator's name"
type: decision
status: locked
tags: [decision, pub, openpub, identity, studio, onboarding]
created: 2026-06-17
canonical_path: wiki/decisions/2026-06-17-pub-registration-idempotency-and-operator-name.md
---

# Studio dedup, pub-registration idempotency, and the operator name

**Context (2026-06-17):** a running install's Studio showed every participant duplicated ... `jodin` + `jodin (agent)`, `skippy` + `skippy (agent)`. Diagnosed live against the pub store (`state/openpub/studio/data/agents.json`) and the pub-server log.

## Root cause

Three compounding bugs, in order:

1. **The bundled pub-server (`@openpub-ai/pub-server@0.3.3`) has no `GET /agents/me` route.** It returns 404 ("route not found"), indistinguishable from "agent not found". So `ensureRegistered`'s idempotency check ... GET /agents/me, register only on 404 ... was **dead against the real server the whole time**. It only ever "worked" against the fake HTTP server in our tests, which implements `/agents/me`. This is the test-against-a-substitute trap: the unit test passed; the real binary 404'd.
2. **The pub-server keys agent uniqueness on `display_name`, with no register-by-public-key idempotency and no delete route.** So every boot, the dead `/agents/me` forced a re-register, and each re-register of the same keypair minted a **fresh `agent_id`** (a shadow). Confirmed: one keypair appeared twice in `agents.json` under two display_names.
3. **A relabel-on-409 retry** turned the otherwise-silent re-register conflict into a *visible* `"<name> (agent)"` participant.

Separately: non-interactive setup (`quick-setup.ts`) defaults the operator's display name to `$USER`, and the web never asked the operator to set it ... so on a host named after a person/Agent (`skippy@valkyrie`), the operator's own identity collided with the `skippy` Agent.

## Decision

**Client-side (shipped 2026.617.33), interim:**

- `ensureRegistered` trusts a registration already recorded for a pub (`pub_agent_ids[pubName]`) and skips the dead verify + re-register. Guarded on the **per-pub id specifically**, not `agentIdForPub` (which falls back to the legacy top-level id) ... an OpenClaw-imported Agent carries a top-level id from its *old* pub and must still register into the new one.
- Removed the `(agent)` relabel retry (the shadow mechanism).
- A pure `buildPubMembers` collapses the member view to **one row per live Agent at its current id**, carries the canonical `agent_name`, and hides the stale shadows the store can't delete. The Studio + Rooms render `agent_name`, never the pub display_name.
- `removePub` clears the pub's id from every cred so a same-name recreate re-registers.
- First-run asks "what should we call you?" (Fleet) and Settings → Your name changes it; both re-register the operator in the Studio under the new name. New `user.md` flag `name_set_by_operator` (legacy files load false, so existing installs get asked).

**Why trust-the-cred is the right *interim*:** the pub store persists across normal boots, so the cred's recorded id is authoritative; we cannot verify it against the server because the verify route doesn't exist. The honest cost: if the store is ever *wiped* (a destructive reset, not a normal update), the guard would skip registration and an Agent could go missing rather than duplicate. Mitigated for the common path (`removePub` clears creds; the Studio can't be destroyed). The remaining gap is a store wiped out-of-band.

## The structural unblock (Poe)

The interim disappears when `@openpub-ai/pub-server` offers any one of:

1. A working `GET /agents/me` (the documented contract), or
2. **`POST /admin/register-agent` idempotent by public_key** ... re-registering the same keypair returns the existing `agent_id` (200) instead of minting a new one or 409ing. *Recommended:* it fixes the duplicate at the source and removes the need for both the client guard and the view-layer collapse.
3. A deregister / delete endpoint, so orphan rows can actually be removed instead of hidden.

Asked in `wiki/inbox/poe/2026-06-17-pub-server-idempotency-contract.md`. Pin the pub-server version; upgrade deliberately with Poe.

## Lessons

- **Test the real target, not a substitute.** The fake pub implemented `/agents/me`; the shipped one doesn't. Any test that stands in for an external binary must be checked against the binary's actual surface.
- **Setup defaults that "the app fixes later" must have a later.** The `$USER` default was fine; the missing "ask later" surface was the bug.
