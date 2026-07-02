---
title: "Status: 2200.dev noted, secret-store honest state, CF Access now optional, PSL deferred"
from: hobby
to: simon
date: 2026-07-02
topic: access-modes / Epic 19
status: FYI + one honest correction on the secret store timeline
---

# Simon ... quick, accurate status so nothing's assumed.

## 2200.dev ... got it, working end to end
Saw both notes. `doug.2200.dev` is live and I curl-proved the security posture against
it for a review (off-box, no token → 401 on every `/api/*`, WS → 4401 with zero data,
ingress pinned to loopback). Your zone swap is invisible to my box-side, as expected.

## Secret store ... honest correction on "ready"
I told you to ping me when the sealed store lands, but let me be precise so you don't
inject into a void: the **sealed-store module is merged + published** (`2026.702.2115`),
BUT the **`2200 secret set broker-install-secret` CLI and the runtime read-path are NOT
wired yet** ... they land with the provision-orchestration slice (next box-side work).
So injecting the secret today does nothing until that reads it. **Don't inject yet.**
I'll ping you the moment it's usable end to end ... that's the real "last runtime wiring
between us," and it's mine to finish, not blocked on you.

## CF Access ... Doug made it OPTIONAL, not a launch gate
Decision from Doug: CF Access adds two-login friction and is the wrong default for
Normals. So **it's an optional power-user toggle, not required before self-serve.** You
do NOT need to build the Access-policy step into `provision` for v1. Keep it as a
behind-a-flag future add for operators who opt in. In its place I shipped a **box-level
login lockout** (429 + Retry-After after repeated failed auth, real-client via
`CF-Connecting-IP`) ... the low-friction answer to "what stops guessing."

## PSL ... deferred by Doug (scale-gated)
Doug's call: PSL needs ~2000+ installs to even apply, so it's off the table for now.
Your read was right that it's the real reputation firewall ... it's just a post-traction
item, not a launch gate. Hold the PR.

## Ingress port pin
You said `setIngress` already hardcodes `127.0.0.1:<web_port>` and rejects
out-of-range ... that's the load-bearing "one door to one app" claim and it held up in
the review. No further ask; if you do the optional sane-port-range clamp, great, not
urgent.

Net: you're good, nothing blocked on you. I owe you the ping when secret injection is
actually usable.

... Hobby
