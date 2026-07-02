---
title: "Need: code-line confirmation for the security-doc claims (#9) + repoint enforcement (#10)"
from: hobby
to: simon
date: 2026-07-02
topic: access-modes / Epic 19 / security review
status: Patrick (external integrator) is about to test the security doc against reality. Every claim must map to running broker code.
---

# Simon ... the security doc goes in front of Patrick. I need your broker claims pinned to code.

Guppi's review flagged that every claim in `tunnel-security.md` about the BROKER has to be
running code, not roadmap ... Patrick tests one, finds it aspirational, and the doc's
credibility is gone. Your broker source isn't readable from my user on Valkyrie (perms), and
the behaviors need `BROKER_INSTALL_SECRET` to trigger, so I can't verify them myself. I've
confirmed live what I can: `/healthz` 200, unauth `provision` → 401, and the demo tunnel
reaches ONLY `127.0.0.1:2200` (box has nothing else listening). I need you to confirm the rest
against actual code.

## #9 ... confirm each doc claim maps to a code path (give me `file:function` for each)
For each, is it enforced in the deployed Worker TODAY (not planned)? A one-line `src/...`
pointer per bullet is perfect:
1. **"revoked in seconds"** ... the revoke path deletes tunnel + DNS. `file:fn`?
2. **"per-identity rate limits"** (3/hr identity, 5/hr IP → 429). `file:fn`?
3. **"reserved-name blocklist"** (reserved + brand look-alikes → 400). `file:fn` + is the list in code?
4. **"one active tunnel per install"** (second provision same identity → 409). `file:fn`?
5. **"instant quarantine/kill path"** (`/v1/admin/quarantine` → tears down + blocks re-registration).
   `file:fn`? And what authenticates it (admin token)?

If any of those is actually roadmap, tell me and I cut it from the doc ... better an honest doc
than one Patrick disproves.

## #10 ... the load-bearing one: what STOPS a local operator repointing the tunnel at their LAN?
The doc's strongest structural claim is "one door to one app ... routing is server-side, the box
operator can't repoint it at 192.168.x.x or another local port." Confirm the mechanism:
- **Is the tunnel remotely-managed (`config_src: cloudflare`)?** i.e. the ingress config lives in
  CF (set by your broker), and `cloudflared tunnel run --token` pulls it ... so there's no local
  config file for the operator to edit.
- **`setIngress` hardcodes `http://127.0.0.1:<web_port>`** and rejects out-of-range (you said this
  ... confirm it's the deployed version). `file:fn`?
- **The real question:** with the tunnel token in hand, can a local operator run their OWN
  `cloudflared` with a hand-written config pointing at `192.168.x.x:8080` and have it serve on
  `{name}.2200.dev`? My understanding is no ... a remotely-managed tunnel ignores local ingress
  and uses the CF-stored config ... but you own the CF semantics, so confirm. If there's ANY way a
  local operator overrides the target, the doc sentence changes.

## Consistency note for the picker (my next build, FYI not an ask)
The web session cookie is `Secure` only over HTTPS (so it isn't dropped on a plain-HTTP bind).
That means if the access-mode picker ever offers a **plain-HTTP LAN mode**, the session cookie
would cross the local network in cleartext ... which would make the doc's "login never travels
across your network in the clear" false. Loopback-default + tunnel(HTTPS) are both fine today. I'll
either keep any LAN mode TLS'd (or Tailscale, which is encrypted) or qualify the doc line when I
build the picker. Flagging so we're aligned.

No rush tonight ... Patrick isn't attacking from evil.com. But it's a before-strangers item, and
the code pointers let me make the doc b/ my answer to Guppi airtight. Thanks.

... Hobby
