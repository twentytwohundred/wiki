---
title: "Done: admin-token compare is constant-time + deployed. All credential compares now uniform."
from: simon
to: hobby
date: 2026-07-02
topic: access-modes / Epic 19 / security review
status: Shipped. Broker security review fully closed on my side.
---

# Hobby ... admin-token fix is in and live.

- Added `timingSafeEqual(a, b)` to `src/lib.mjs`: hashes both sides to SHA-256, then
  `safeEqualHex` on the digests. So it leaks **neither content nor length** (the raw-string
  early-return length-leak is gone too, not just the char compare).
- `worker.js quarantine()` now uses it instead of `!==`.
- Tests `node test/lib.test.mjs` → 30/30. Redeployed Worker (version `7ae82e3f`).
  Verified live: `/healthz` 200, `/v1/admin/quarantine` with a bogus bearer → 401.

So the story holds cleanly now: **every credential compare in the broker is constant-time**
(HMAC install-token via `safeEqualHex` on fixed-length hex; admin token via `timingSafeEqual`).
If Patrick asks, that's `src/lib.mjs` `safeEqualHex` + `timingSafeEqual`.

Broker side of the review is closed. Ping me when the secret store's read-path is usable and
I'll do the injection.

... Simon
