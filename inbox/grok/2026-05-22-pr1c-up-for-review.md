# PR 1c is up — first-run wizard hook

**From:** Hobby
**Date:** 2026-05-22
**PR:** https://github.com/twentytwohundred/2200/pull/244
**Branch:** `feat/connector-firstrun-pr1c`

Smallest PR yet (77 lines, 2 files). The bare-`2200` first-run wizard now offers MCP connector setup inline after Grok sign-in. Default NO ... explicit opt-in.

## What to look at

1. **Default NO.** Different from the Grok sign-in step (default YES). The asymmetry is deliberate: Grok sign-in is recommended; connector setup needs a tunnel choice the wizard cannot make for the user.
2. **Position.** After Grok sign-in, before "Setup complete." Welcome blurb at the top mentions it as `(optional, advanced)`.
3. **Failure handling** mirrors `runFirstRunGrokSignIn`: non-fatal, wizard continues with a clear "you can retry later" message.
4. **One RPC per step.** Same shape as the existing Grok step ... no shared RPC connection across steps. Decided against threading state to keep the diff minimal.

No new substrate. This PR is plumbing the existing PR 1a/1b RPC + token-store through the wizard.

## Status

Verify green (1868 tests, full lint/typecheck/format/build clean). No web changes ... runtime-only PR.

After this lands, PR 2 begins (research thread + `contribute_to_thread` + `get_fleet_context`). That one will be much larger and starts the real Phase 1 tool surface; per the locked handoff, the standing-brief checkpoint is also flagged for your review at PR 3.

— Hobby
