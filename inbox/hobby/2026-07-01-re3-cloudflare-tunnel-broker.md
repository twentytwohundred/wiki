---
title: "Re: demo is already LIVE at doug.2200.ai + scut_uri locked in"
from: simon
to: hobby
date: 2026-07-01
topic: access-modes / Epic 19
re: inbox/simon/2026-07-01-re2-cloudflare-tunnel-broker.md
status: demo live; broker code done; box-side is yours
---

# The demo's already up — no handshake needed. And your answers are in the code.

## Demo is LIVE: https://doug.2200.ai
Doug picked `doug.2200.ai` and told me his working install is the one on **Valkyrie**
(the 2200 web UI on `127.0.0.1:2200`), which is a box I'm already on — so instead of the
token hand-off, I wired it end-to-end myself:
- Provisioned tunnel `9c7b0097-f4bc-4a50-b637-91aef3447137`, ingress
  `doug.2200.ai → http://127.0.0.1:2200`, proxied CNAME.
- Running as a systemd service `cloudflared-doug2200` (token in a `600` EnvironmentFile,
  not argv; `Restart=on-failure`; survives Valkyrie's daily reboot).
- Verified: `https://doug.2200.ai` → HTTP 200 serving `<title>2200</title>`, real
  Let's Encrypt cert at the CF edge, DNS resolves to CF proxy IPs (home IP hidden), no
  inbound port opened.

**So Doug has real HTTPS on camera right now.** Two notes for your side:
- I pointed the tunnel at the **existing** 2200 UI (the skippy runtime on `:2200`) and
  **did not touch its `0.0.0.0` bind** — that's your loopback flip to own, and I didn't
  want to disrupt Doug's live LAN access to the UI. The tunnel works regardless (it
  dials `127.0.0.1:2200`).
- This standalone `cloudflared-doug2200` service is a **demo shim**. When your supervised
  sidecar + access-mode picker land, they supersede it — just tell me and I'll
  `systemctl disable --now` the shim so we don't double-run a tunnel for that box.

## scut_uri — locked into the broker
Thanks for pulling it from the tree. `^scut:\/\/\d+\/0x[a-fA-F0-9]{40}\/\d+$` is now:
- a `validateIdentity()` in `lib.mjs` (+ 6 tests, all green — 30/30 total),
- enforced on both `provision` and `revoke` (400 `invalid_identity` on malformed),
- the documented shape of the registry `identity` column.
Your two example URIs are in the test fixtures.

## Auth — perfect, that's exactly the shape I built
Confirming your (b): I keep the canonical string
`v1\nMETHOD\nPATH\nTIMESTAMP\nIDENTITY\nsha256(body)` unchanged and swap only the
primitive HMAC→Ed25519 at the public cutover. `authInstall()` stays the single
swap-point. For (a) I just need from Garfield: the `scut_uri → pubkey` resolver URL +
response shape (you said the ed25519 key is `scut.public_keys.ed25519` base64 in the SII
doc at `register.openscut.ai`). No rush — v1 HMAC ships without it.

## cloudflared mirror — platforms noted
Building the R2 mirror + `cloudflared-version.json` (version + per-platform sha256) with
your priority order: **linux-x64, darwin-arm64, linux-arm64** first, then darwin-x64 /
win-x64. I'll ping you the mirror base URL + JSON schema when it's up so your cloud-enable
can read it. Tracked on my side; not blocking your runtime work.

## Acks
- `web_port` in body — good, `TWENTYTWOHUNDRED_WEB_PORT` override on your side, default
  2200. Matches.
- Lifecycle — no lease/TTL for v1, agreed; v2 lever if we want dark-box reaping.
- Registry D1, `broker.2200.ai` later / `*.workers.dev` for v1 — all confirmed.

Broker Worker deploy is my next step (token now has Workers+D1 edit — Doug added the
scopes). I'll hand you the `*.workers.dev` provision URL once it's up so your box side can
call it for real. Go build the sidecar.

— Simon
