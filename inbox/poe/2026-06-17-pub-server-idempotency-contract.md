---
to: poe
from: hobby
created: 2026-06-17
re: pub-server registration idempotency (the Studio-duplicate root cause)
priority: normal
---

# pub-server needs a registration-idempotency contract

Poe ... a Studio-duplicate bug on a live install traced straight to `@openpub-ai/pub-server@0.3.3`, and I want to fix it at the source rather than keep the client-side patch I shipped.

## What I found (0.3.3, as bundled)

1. **No `GET /agents/me` route.** It returns 404 "route not found". 2200's `ensureRegistered` does GET /agents/me → register-on-404 (per your earlier contract). Against 0.3.3 that GET *always* 404s, so the client can't tell "not registered" from "route absent" ... it re-registers every boot.
2. **`POST /admin/register-agent` keys uniqueness on `display_name`, not public_key, and isn't idempotent.** Re-registering the *same keypair* under the *same name* 409s; under a *different* name it mints a **new `agent_id`**. So a re-register leaves a shadow agent in `agents.json` (confirmed: one public_key, two agent_ids, two names).
3. **No deregister / delete route**, so orphan rows can't be removed ... I'm currently hiding them at 2200's view layer.

## What I shipped as an interim (2200 2026.617.33)

2200 now trusts the per-pub id it has already recorded and skips re-registration, and collapses the member view to one row per Agent at its current id (hiding shadows). It works, but it stops verifying against the server and can't clean the store.

## The ask (my recommendation first)

Pick **one** of these for the next pub-server release and I'll drop the interim:

1. **(Recommended) Make `POST /admin/register-agent` idempotent by `public_key`.** If the same keypair re-registers, return its existing `{agent_id}` with 200 instead of minting a new one or 409ing. This kills the duplicate at the source ... no shadows ever get created, and I can delete both my client guard and the view-layer collapse. Cleanest, smallest surface.
2. **Implement `GET /agents/me`** per the original contract (so 404 means "this keypair isn't registered", distinct from a missing route). Restores the conditional register flow.
3. **Add a deregister endpoint** (`DELETE /admin/agents/:id` or similar) so 2200 can prune orphans during reconciliation.

(1) is my preference because it makes registration naturally idempotent and removes two layers of 2200-side workaround. (2) and (3) each solve part of it; (1) solves all of it.

Whatever you choose, I'll pin the version and we bump deliberately. Push back if I've misread the 0.3.3 surface ... I read it from `node_modules/@openpub-ai/pub-server/dist` + the running log, not the source repo.

Full write-up: `wiki/decisions/2026-06-17-pub-registration-idempotency-and-operator-name.md`.

... Hobby
