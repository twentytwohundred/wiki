---
title: "Platform integrations are thin passthrough + server-side-only helpers"
type: decision
status: locked
date: 2026-05-11
tags: [decision, design, tools, platforms, spotify, discord, slack, oauth, v1-scope]
linked_docs:
  - "[[../epics/03-platform-tools]]"
  - "[[../handoffs/hobby/2026-05-11]]"
  - "[[2026-04-25-mcp-native]]"
  - "[[2026-04-25-tool-baseline]]"
canonical_path: wiki/decisions/2026-05-11-platform-integration-pattern.md
---

# Platform integrations are thin passthrough + server-side-only helpers

## Context

PR #187 (`feat/platform-tools-discord-slack-spotify`) shipped 23 platform tools across three providers: 12 Spotify, 5 Discord, 6 Slack. Each tool wraps a specific provider endpoint. The Spotify slice was the first one exercised live by an Agent (Grok-Jodin, running the TRL daily pipeline).

Over sessions 14, 15, 16, and 17 the Spotify surface absorbed roughly two days of bug-fix iteration on the same 12 tools:

- **Session 14–15**: Initial scaffold, OAuth flow, vault wiring, token refresh service.
- **Session 16 (2026-05-10)**: Live test surfaced the Spotify Feb-2026 API migration. `@spotify/web-api-ts-sdk` v1.2.0 calls deprecated paths. Patched `createPlaylist` (`POST /v1/users/{id}/playlists` → `POST /v1/me/playlists`) and `addItemsToPlaylist` (`POST /v1/playlists/{id}/tracks` → `POST /v1/playlists/{id}/items`) via the SDK's `makeRequest` escape hatch.
- **Session 17 (2026-05-11)**: Smoke test succeeded after the patches. Follow-up TRL run surfaced three more bugs in the same surface area:
  1. `spotify_search_tracks` returns 400 "Invalid limit" — Zod schema defaults to `limit=20` but the default does not propagate to the SDK call; the runtime tool-args path is silently sending `undefined`.
  2. `spotify_get_playlist_tracks` returns 403 "Bad OAuth request" — same class as the createPlaylist bug; the SDK's `getPlaylistItems` is calling another deprecated path. We patched two endpoints, this is the third we missed, more are inevitable.
  3. `playlist_id` schema regex `^[A-Za-z0-9]+$` rejects URIs of the form `spotify:playlist:abc123` — but `spotify_create_playlist` returns its result in that URI form. Our own create-tool output is rejected by our own add-tool input. The agent fell into this four times in one session.

The same TRL run also showed Grok-Jodin **hallucinating a successful pipeline outcome** when tools failed: one task with a single LLM call and zero tool calls produced a narrative claiming 10 tracks curated, two playlists updated, and a cover uploaded. None of it happened. A separate brain note `trl-log-2026-05-11.md` claimed a "successful run" written while every Spotify write tool was failing in the same task. This regression is partially platform-driven (when tools fail, the agent fabricates instead of escalating) and partially loop-driven (no guardrail catches narrated-completion-without-tool-call).

The forces driving this iteration cost are not Spotify-specific:

1. **SDK staleness is a recurring tax.** Provider TS SDKs lag the provider's API by months. Each adopted SDK becomes a maintenance liability the moment the provider does an API migration. Discord and Slack SDKs have not bitten yet only because Jodin has not exercised them.

2. **Per-endpoint wrappers self-collide.** N endpoints × M shape mismatches × K default-propagation gotchas. The `playlist_id` URI/ID mismatch is Spotify's fault zero percent and our design's fault one hundred percent: our own tool surface is internally inconsistent.

3. **Framework gaps amplify it.** Zod defaults not propagating, error messages that reject without teaching, no hallucination guardrail in the loop — none Spotify-specific, all get worse as platforms multiply. Gmail, Calendar, Drive, Stripe, Twilio, X are coming. If each costs two days of iteration after the initial build we miss the operating-thesis ship window.

## Decision

**Platform integrations are a thin HTTP passthrough plus a small set of server-side-only helpers, not a per-endpoint wrapper-tool catalog.**

The shape for any platform integration:

1. **One `<platform>_api` tool** taking `(method, path, query?, body?)`, resolving the vault token, signing the request, returning the JSON response unmodified. Bypasses any provider SDK. We become the version-coupled layer; we read the provider's actual API docs, not the SDK's stale types.

2. **0–3 high-level tools** per platform, ONLY for operations the model cannot do client-side. The bar: "would calling the API directly + post-processing in the model be sufficient?" If yes, no helper. If no, helper. Two current Spotify cases that pass the bar:
   - `spotify_set_playlist_cover` — needs `sharp` re-encoding + iterative resize to fit the 256KB JPEG cap + base64 encoding. Model cannot do this client-side.
   - `image_generate` (baseline tool, not Spotify-specific) — server holds the xAI API key; model cannot make the request.

3. **One brain note per platform** documenting the API shape: auth model, endpoint catalog, common request/response patterns, gotchas. Authored once, lives in the shared brain, referenced by every Agent that uses the platform. The note is the agent's "what tools exist" affordance, replacing the per-endpoint Zod schemas.

### Net effect on current platform surface

| Platform | Current (PR #187) | After pivot |
|---|---|---|
| Spotify | 12 tools | `spotify_api` + `spotify_set_playlist_cover` |
| Discord | 5 tools | `discord_api` + (TBD on helpers) |
| Slack | 6 tools | `slack_api` + (TBD on helpers) |

23 tools → ~5. Plus 3 platform brain notes.

### What changes about PR #187

PR #187 stays unmerged and is superseded by a new branch implementing the pivot. The pivot branch (`feat/platform-passthrough-tools` or similar) replaces #187's tool surface and ships once Grok-Jodin can run the TRL loop end-to-end without hallucination or tool errors.

The work already in #187 is not lost:
- OAuth flows, vault wiring, token refresh service, Spotify provider config — all reused unchanged.
- `image_generate` baseline tool — reused unchanged.
- `spotify_set_playlist_cover` — reused unchanged.
- Spotify SDK migration patches (`createPlaylist`, `addItemsToPlaylist` via `makeRequest`) — dropped along with the per-endpoint wrappers they patched. The same logic shifts into the brain note as "POST `/v1/me/playlists` to create; POST `/v1/playlists/{id}/items` to add items."

### Cross-cutting fixes that ride the pivot

These are platform-agnostic and belong on the pivot branch (or land before it, depending on shape):

1. **Hallucination guardrail in the agent loop.** Turn-level audit: if the assistant's text narrates completion in past tense ("created the playlist", "uploaded the cover") and the turn contains zero successful tool calls, inject a forcing system message on the next iteration. Optional: write a soft-warning notification to the operator. Today's regression was exactly this pattern; the brain-note rule "do not narrate completion of work you did not do" did not hold.

2. **Zod tool-args default propagation audit.** The `search_tracks` "Invalid limit" bug is the symptom; the cause is somewhere in the tool-args path between LLM JSON and `execute(args)`. Defaults declared in the schema must be applied before `execute` is called. Audit + fix + test.

3. **Tool error messages that teach.** Reject-with-instruction, not reject-with-noise. The virtual-path error should say `use /project/... virtual paths, not absolute /Users/... paths`. The `playlist_id` regex (in the passthrough world, this specific regex is gone, but the principle applies broadly): error messages are model affordances, not log noise.

## Consequences

### What this buys

- **SDK staleness ceases to be a recurring code burden.** A provider API change becomes a brain-note update, not a code change + PR + verify + rebuild + dist + restart.
- **Quadratic surface collapses.** Five tools and three brain notes scale to any number of provider endpoints. New endpoints cost a brain-note edit, not a new tool.
- **Internal consistency by construction.** There is no separate create-output and add-input to disagree; the agent calls `spotify_api` with whatever shape the API actually accepts.
- **Future platforms compress.** Gmail, Calendar, Drive, Stripe, Twilio, X each become ~1–3 tools plus a brain note. We stop paying the per-platform integration tax.
- **2200 strength play.** Brain-note quality becomes load-bearing; that is exactly the layer we want to be the differentiator.

### What this costs

- **Less type-safety at the tool boundary.** The passthrough returns `unknown` JSON; the model handles shape. We trade compile-time guarantees for matching reality.
- **More weight on brain-note quality.** A bad brain note means an agent that cannot use the platform. Mitigated because brain notes are versioned, editable, peer-reviewable, and reusable across Agents — a single high-quality note serves the whole fleet.
- **Higher per-call cognitive load on the model.** The agent must reason about endpoint paths rather than picking from an enumerated tool list. Trade-off acceptable on Grok-4-fast and frontier-tier; we will see how it shakes out on cheap-tier models per the test-on-cheap-models-first principle.
- **One-time migration cost.** The pivot branch is non-trivial. But it is bounded scope and pays off before the third platform integration.

### Things this does NOT change

- **OAuth + vault + token refresh service stays.** Auth is platform-shaped, not endpoint-shaped, and our existing infrastructure handles it correctly.
- **Baseline tools (filesystem, brain, chat, etc.) stay per-operation.** They are not provider integrations; they wrap our own runtime primitives where typed shape and per-op semantics are the point.
- **Skills and Extensions framework is unaffected.** Skills compose tools regardless of tool granularity.
- **MCP compatibility direction unchanged.** A passthrough tool composes cleanly with MCP server-style integrations down the road.

### Risks to watch

- **Brain-note drift.** A platform brain note that lags the actual API is the new failure mode. Mitigated by versioning the note and reviewing it whenever a platform tool bug is reported.
- **Model anchoring on tool names.** Agents trained against per-endpoint tool catalogs may need brain-note coaching to use the passthrough shape. Manageable.
- **Helper-creep.** "0–3 helpers per platform" is a soft cap. Every proposed helper needs to pass the "model cannot do this client-side" bar. Drift here would re-create the per-endpoint surface under a different name.

## Status

Locked, 2026-05-11. PR #187 stays open but is no longer the candidate for merge — superseded by the pivot branch once it lands. Pivot work starts session 18.

## References

- [[../handoffs/hobby/2026-05-10]] — session 16 wrap; Spotify SDK migration discovery
- [[../handoffs/hobby/2026-05-11]] — session 16 final state; smoke test queue
- This session's diagnosis (session 17) covers the regression + the three additional Spotify bugs that triggered this decision
- GitHub PR: `github.com/twentytwohundred/2200#187`
