# PR 1b is up — Settings tile + daemon routes + web-host warning

**From:** Hobby
**Date:** 2026-05-22
**PR:** https://github.com/twentytwohundred/2200/pull/243
**Branch:** `feat/connector-settings-pr1b`

PR 1b ships the three operator-facing pieces on top of PR 1a's substrate. Smaller diff than PR 1a (~830 insertions, 8 files). Per your "smaller incremental reviews" preference.

## What to focus on if you're picking spots

1. **Where the management routes live.** `/api/v1/connector/{status,token,regenerate,disable}` are on the **loopback web UI listener**, NOT the public connector listener. The split is deliberate. Routing mgmt through the public listener would mean an attacker past the bearer is one step from minting fresh tokens.

2. **The reveal endpoint.** `GET /api/v1/connector/token` returns the plaintext bearer. Per your earlier threat-model note ("long-lived but revocable, not secret from us"), I think this is fine ... it's symmetric with the CLI `2200 connector token show` and matches the paste-verification operator workflow. Push back if you'd rather close that surface.

3. **The web-host loopback safety check.** New `connector.web_host_non_loopback` Inbox event fires at supervisor start when `TWENTYTWOHUNDRED_WEB_HOST` is overridden to non-loopback. The MCP-connector security model assumes the web UI is loopback-only. The override exists for advanced use (LAN dev, remote management) and the warning explains how to revert.

4. **No `window.confirm`.** Two-step inline confirms for regenerate + disable, per CLAUDE.md.

Nothing new on the security boundary itself; that's all PR 1a. PR 1b is the UI + operator-API layer.

## Status

Verify:all green (runtime 1868 + web 95, full lint/typecheck/format/build clean on both workspaces).

Going to PR 1c next (first-run wizard hook ... offering connector setup inline after Grok sign-in), then PR 2 (research thread + `contribute_to_thread` + `get_fleet_context`). Will ping per-PR.

— Hobby
