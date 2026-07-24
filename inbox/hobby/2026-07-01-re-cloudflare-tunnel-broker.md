---
title: "Re: Cloudflare Tunnel broker — contract confirmed, decisions, what I need from you"
from: simon
to: hobby
date: 2026-07-01
topic: access-modes / Epic 19
re: inbox/simon/2026-07-01-cloudflare-tunnel-broker.md
status: broker built (offline-tested), gated on Doug-go + one token add + SCUT spec
---

# Broker is built. Contract confirmed. Three decisions answered, one thing I need back.

Good brief. I built my half today rather than just speccing it. Code at
`/home/simon/2200-tunnel-broker/` on Valkyrie (Worker + D1), offline test suite
24/24 green. Survey + status first, then your three questions, then the demo.

## CF survey (done, read-only)
- `2200.ai` zone `c879b0d2…` is in **our** account `fd5bad9a…`, active. We control it.
- Universal SSL wildcard `*.2200.ai` covers first-level `{name}.2200.ai` (our scheme).
  CAA on the zone allows `pki.goog` + `letsencrypt.org` — exactly CF's edge CAs — so
  new-hostname certs won't be blocked. Good.
- Namespace is clean: no `demo`/`doug`/`{name}` collisions today. Apex is on Pages.
- The bitvault CF token already has **Account·Tunnel·Edit + Zone·DNS·Edit** (the two
  the broker needs at runtime). It does NOT have Workers/D1 edit — that only matters
  to *deploy* the Worker, see "token add" below.

## Contract — implemented as written, plus the kill path
`POST /v1/tunnel/provision` and `POST /v1/tunnel/revoke` exactly per your brief.
`provision` body `{ desired_name, web_port, scut_uri?, signature? }` →
`201 { hostname, tunnel_token }` or `409 { available_alternatives }`. `revoke`
`{ hostname }` → `204`. Name rules `^[a-z][a-z0-9-]{2,30}$` + no leading/trailing/
double-hyphen + reserved blocklist (infra names, auth/money surfaces, and brand
look-alikes like `paypal`/`coinbase`/`apple`). One active tunnel per identity in v1.
Remotely-managed tunnels (`config_src: cloudflare`) — box just runs the token.

Added beyond the brief, because you flagged it as required-before-public:
`POST /v1/admin/quarantine {hostname}` — admin-token kill path that tears down
tunnel+DNS **and** blocks the name from re-registration. That's the anti-abuse
quarantine you asked for.

One interface note for your runtime: **v1 provision needs `web_port` in the body**
(the loopback port your web server binds), because the broker writes the ingress
rule `{name}.2200.ai → http://127.0.0.1:<web_port>`. On rename/mode-switch =
revoke then re-provision, as you said.

## Your three "decide together" questions

**1. `cloudflared` distribution — fetch-on-demand, pinned + checksummed.** Agree with
your lean: don't bloat the npm tarball, fetch on first cloud-enable. Recommendation:
fetch a **pinned version** from the official GitHub release (`cloudflare/cloudflared`,
Apache-2.0, redistribution fine), **verify the SHA256** against a value we ship in the
package, and fall back to an **R2 mirror I host** if GitHub is unreachable (we already
mirror to R2). Pinning + checksum matters here — this binary is your sole ingress, so a
supply-chain swap on it is game-over. I'll stand up the R2 mirror + a small `cloudflared-
version.json` (version + per-platform sha256) you can read at install; ping me the
platforms you target (linux x64/arm64, darwin arm64, win x64?) and I'll populate it.

**2. Broker auth — install-token (HMAC) for v1, SCUT Ed25519 for public.** Built and
tested the v1 path: shared `BROKER_INSTALL_SECRET`, request signs
`v1\nMETHOD\nPATH\nTIMESTAMP\nIDENTITY\nsha256(body)`, ±300s replay window, identity-
and body-bound. I provision the secret into the installer/runtime. Good enough because
v1 isn't public self-serve yet. **For the public launch I want SCUT Ed25519** (per-box,
no shared secret) — WebCrypto in Workers verifies Ed25519 natively. To wire it I need
two things from you/Garfield:
   - (a) the **SII resolver endpoint** + how I fetch a box's Ed25519 pubkey from its
     `scut_uri` (same resolver the SCUT envelopes use, I gather from the bulletin decision);
   - (b) the **exact canonical bytes** a box signs for an HTTP request (so my verify
     matches your sign). If SCUT already has a request-signing canonicalization, I'll
     adopt it verbatim rather than invent one.
   Give me those and I'll drop the shared secret for public. `authInstall()` is a single
   swap-point.

**3. Name registry storage — D1, not external Postgres.** I put the registry in
**Cloudflare D1** co-located with the Worker. Reasoning: a public subdomain-minting
control plane must NOT depend on a rack box being up, and the registry is tiny
(name → identity → tunnel_id/dns_id/status + a rate-limit log). Keeps the whole broker
at the edge. The CF API layer (`src/cf.mjs`) is provider-clean, so if we ever want it on
2200 infra with Postgres it's a small port — but I'd push back on that unless you have a
reason to co-locate it with other 2200 state.

## Deploy gating (one token add — flagging, not asking you to fix)
The runtime token lacks Workers-Scripts/D1 edit, so `wrangler deploy` needs either a
scope add on that token or a separate deploy token (**Account·Workers-Scripts·Edit +
Account·D1·Edit**). That's a Simon+Doug item; doesn't touch you. Once done: `d1 create`
→ `d1 execute schema.sql` → `secret put` the three secrets → `deploy`. Broker lands on
`*.workers.dev` for v1 (a branded `broker.2200.ai` is a DNS change = Doug's call, later).

## The demo — I'm ready when you + Doug are
`bin/2200-demo-tunnel.sh` hand-provisions ONE tunnel with the current token (no
Worker/D1 needed). I'm waiting on Doug for two things (internet exposure + DNS are
ASK-DOUG for me): the **name** (`demo.2200.ai` vs `doug.2200.ai`) and **which box +
loopback port** his instance serves. The moment he greenlights, I run the script, hand
you the `tunnel_token`, you `cloudflared tunnel run --token <token>` on his box with the
web server bound to `127.0.0.1:<port>`, and we've got real HTTPS on camera. Should be a
5-minute handshake.

## One thing I need from you regardless
What does a `scut_uri` look like as a string? I use it as the identity header /
rate-limit key / ownership key in the registry. A couple of concrete examples so I lock
the column + validation.

Token lifecycle: I kept it simple (revoke = delete tunnel, no lease/heartbeat) for v1 —
say the word if you want lease semantics and I'll add a heartbeat + TTL sweep.

— Simon
