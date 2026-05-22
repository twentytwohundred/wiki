# Phase 1 MCP Connector — Full Byte-Level Review

**Date:** 2026-05-23  
**Reviewer:** Grok  
**Scope:** Complete substrate from PRs 1a + 1b + 1c (listener, bearer vault, audit, supervisor wiring, CLI, web Settings tile, first-run hook, protocol, tests).  
**Status:** All files pulled and read. Cross-checked against locked handoff (2026-05-22), AGENTS.md conventions, prior incremental review fixes, and threat model.  
**Goal:** Surface *every* issue (critical to cosmetic) so the set can be tidied before Phase 2 begins. Then move cleanly to the real tool surface (`contribute_to_thread`, `propose_work_package`, `get_fleet_context` + standing brief).

---

## Executive Summary

The Phase 1 substrate is **high quality and production-ready**. It correctly implements the locked decisions:

- Dedicated listener (blast radius isolation from web UI).
- Sealed vault bearer with distinct HKDF namespace and `2200-mcp-` prefix.
- Constant-time auth, no fallback-allow, uniform 401 responses.
- Full Inbox audit surface (`call_received` pre-handoff, throttled `auth_rejected`, lifecycle, errors).
- Operator controls in CLI + Settings (show-once token, regenerate, disable, 2-step confirms, reveal gate).
- First-run opt-in (default NO, advanced framing).
- Non-fatal failure handling everywhere.
- Only `liveness` probe today (real tools deferred — correct split for review).

All major fixes from the incremental reviews (audit timing before transport handoff, `mcp.close()` before `fastify.close()` + `forceCloseConnections`, etc.) are present and correct.

**No critical correctness, security, or data-loss bugs found.**

The remaining items are all addressable polish, maintainability, or Phase 2 preparation points. Many are tiny. We should fix the ones that matter before locking the substrate.

---

## File Inventory (All Pulled & Reviewed)

**Connector-specific**
- `src/runtime/mcp/connector/listener.ts`
- `src/runtime/mcp/connector/bearer-store.ts`
- `src/runtime/mcp/connector/audit.ts`
- `src/runtime/mcp/connector/server.ts`
- `src/runtime/mcp/connector/index.ts`

**Integration points**
- `src/runtime/supervisor/supervisor.ts` (lifecycle, RPC handlers, regenerate/disable, web-host warning, startup)
- `src/runtime/http/server.ts` (loopback web routes + comments)
- `src/runtime/supervisor/bootstrap.ts`
- `src/runtime/control-plane/protocol.ts` (schemas)
- `src/runtime/install/first-run.ts` (1c wizard)
- `src/cli/main.ts` (connector subcommands)

**Web UI**
- `apps/web/src/screens/settings/ConnectorSection.tsx`
- `apps/web/src/screens/settings/SettingsScreen.tsx`
- `apps/web/src/lib/api.ts`

**Tests**
- `tests/runtime/mcp/connector/listener.test.ts` (real HTTP + MCP SDK client)
- `tests/runtime/mcp/connector/bearer-store.test.ts`
- `tests/runtime/mcp/connector/audit.test.ts`
- Coverage in CLI, HTTP server, and integration suites

**Reference**
- Locked handoff: `wiki/inbox/grok/grok-mcp-connector-locked-handoff.md`
- AGENTS.md conventions

---

## Strengths (What Is Already Excellent)

1. **Security model is sound** — Dedicated listener + loopback web UI + bearer only on the public surface + constant-time + vault isolation. The `web_host_non_loopback` Inbox event is the right operator-visible tripwire.
2. **Audit is first-class** — Pre-handoff `call_received` (fixed in 1a review), proper tiering, per-IP throttle with suppression count, synthetic `__connector` emitter (visually distinct). Matches "everything visible in the Inbox" requirement.
3. **Lifecycle discipline** — Regenerate does clean restart (outage accepted after review), deleteBearer on disable, listener only binds when bearer present, close ordering prevents SSE hangs.
4. **Operator UX consistency** — "Shown once, copy now" pattern is the same in first-run, CLI, and Settings post-regen banner. Reveal is gated and loopback-only.
5. **Failure modes are non-fatal** — Wizard, daemon startup, RPC paths all degrade gracefully with clear recovery instructions.
6. **Conventions followed** — `schema_version: 1` on sealed bearer, atomic writes, WHY comments present in most hot paths, ellipses used correctly in prose.
7. **Incremental review process worked** — The two real bugs we caught in 1a (audit timing, close ordering) are fixed in the tree.

---

## Issues Found (Categorized — Fix Before Phase 2)

### 1. Correctness / Reliability (None Critical)

**None.** All paths (regenerate while listener down, rapid regenerate, first-run before/after daemon ready, bind failure, vault missing, etc.) behave as documented.

### 2. Security & Threat Model (Minor Gaps / Future-Proofing)

- **X-Forwarded-For trust assumption** ([listener.ts:244](src/runtime/mcp/connector/listener.ts))  
  `clientIp` takes the first entry of `x-forwarded-for` without validation that the immediate client is a trusted proxy. In the common ngrok/Tailscale case this is fine (the tunnel is the only path), but we should document the assumption explicitly and note that a misconfigured reverse proxy could let an attacker spoof sourceIp in audit events. Add a one-line comment or decision note.

- **Body limit is 1 MiB** ([listener.ts:85](src/runtime/mcp/connector/listener.ts))  
  Fine for Phase 1 `liveness`. When `contribute_to_thread` lands with research blobs, sources, or long transcripts, this will be too small. We will need a tunable (or higher default) + clear error path. Flag for PR 2.

- **No rate limiting or connection caps beyond Fastify defaults**  
  Fastify `bodyLimit` + `connectionTimeout: 60s` exist. For a public-facing (tunneled) MCP endpoint this is acceptable baseline, but we should call it out in the threat model section of the handoff or a short decision record so future load or abuse is expected.

- **SDK supply-chain note is present** ([server.ts:9](src/runtime/mcp/connector/server.ts)) but not in a machine-readable place. The comment says "Pin updates and re-review". Good, but consider adding the SDK version to `THIRD_PARTY_NOTICES.md` or a lockfile comment when we bump it.

### 3. Observability & Audit (Small Improvements)

- **`getConnectorStatus()` sync version returns lies** ([supervisor.ts:907](src/runtime/supervisor/supervisor.ts))  
  It always reports `bearer_present: false` etc. The detailed async version is the one actually used for CLI/web. The comment explains the intent ("for hot paths"), but a caller could be surprised. Add an explicit `// Only use the async getConnectorStatusDetailed() for operator surfaces` or rename the sync one to `getConnectorStatusFast()`.

- **Throttle state is lost on listener restart**  
  By design (documented in audit.ts). Restart itself emits a `listener_state_changed` event, so the operator sees the context. Acceptable, but worth a one-sentence confirmation in the handoff update.

- **No "call completed" / latency event yet**  
  Current design only has received + errored. For Phase 2 tools that may do real work (even if inert), we may want a paired completion event later. Not required for Phase 1.

### 4. UX / Consistency (Polish — Worth Fixing)

- **First-run connector prompt wording** vs Grok sign-in step ([first-run.ts:189](src/runtime/install/first-run.ts))  
  Grok step says "(recommended)". Connector says "(advanced; default skip)". The welcome blurb is good. Minor inconsistency in header style. Suggest aligning the section headers or adding a parallel "recommended for power users who already have a tunnel" line.

- **Post-regen success message in first-run** says "Connector listener started."  
  Accurate, but the Grok sign-in success is "Signed in to xAI / Grok. Subscription credential sealed to disk." Slightly different voice. Make the connector one mention the token was minted and the bearer is now live.

- **Settings tile "MCP Connector" title** and subtitle are good, but the "Phase 1 ships the door" sentence in the component will need updating once the real tools land. Easy follow-up.

- **CLI `connector token show`** prints the raw token with no "copy now" wrapper or warning about it being single-use for the paste step. The regenerate path has the banner; `show` does not. Minor, but for symmetry add the same guidance text that appears in regenerate.

### 5. Code Quality / Maintainability (AGENTS.md Alignment)

- **Missing WHY in a few places**:
  - `bearer-store.ts:171` (the HKDF derivation) has good comments higher up, but the salt-vs-master-key split could use one more sentence on why we need a per-fleet salt even though master key already exists.
  - `listener.ts:90` preHandler comment is excellent (constant-time + uniform response). Good.
  - `supervisor.ts:954` comment on "Grok's review accepted a brief outage" — perfect historical record.

- **Ellipses usage** — Clean in all new prose. No em-dashes found in the connector code.

- **Agent capitalization** — The synthetic emitter is `__connector` (lowercase with underscores) for technical reasons (not a real Agent). All user-facing strings correctly say "MCP connector" (tool, not Agent). Correct.

- **Schema versioning** — Present on the sealed bearer. Good. When we add the real tool implementations we must ensure any new persisted state (e.g. standing brief metadata) also carries `schema_version`.

### 6. Phase 2 Preparation (Important — Do Before Unlocking Real Tools)

- **The `propose_work_package` contract must be enforced at arrival time**, not just documented. The handler that receives it (future PR) must only be allowed to post internal Agent-to-Agent messages into a shared Brain/room. No task creation, no schedule creation, no Agent spawn, no external side effects. We should add a clear internal guard or comment in the handoff that this is the load-bearing invariant.

- **Standing brief ownership** — The locked handoff says "the primary (or designated) Agent maintains a standing brief". We need an explicit place (probably a special note in the shared Brain or a new lightweight structure) and a convention for which Agent is responsible. This is the highest-risk quality item for long-running Grok conversations.

- **`contribute_to_thread` targeting** — Must support both a specific Agent and a "Grok Research Thread" shared Brain section. The current substrate has no opinion; the PR 2 design must define the addressing scheme cleanly.

- **Tool allow-listing** — Grok side uses `allowed_tools`. On our side we should eventually enforce that only the three approved tools are registered (or return a clear error for anything else). For Phase 1 the single `liveness` tool is fine.

- **Context size & truncation strategy** for long drive conversations — Not a code problem yet, but we should call it out as a known open risk in the updated handoff.

### 7. Test Coverage Gaps (Minor)

- No automated test for the exact first-run wizard path that hits the connector step (the unit tests stop at early aborts; happy path is manual + the broader integration suite).
- No test that exercises `regenerate` while the listener was previously idle (the "not running" amber state in the UI).
- Listener tests are strong for the happy + auth failure paths. Good enough for Phase 1.

### 8. Documentation & Handoff Updates Needed

- Update the locked handoff (or add a short "Phase 1 as-shipped" note) with:
  - The brief-outage-on-regenerate decision.
  - The in-memory throttle trade-off.
  - Current tool surface = only `liveness`.
  - Exact sourceIp handling assumption.
- The inline threat-model notes in `listener.ts:16` are excellent — keep them and consider promoting the key bullets to a short `decisions/2026-05-22-mcp-connector-threat-model.md` if we want a permanent record.

---

## Recommended Fix List (Prioritized)

**Must-fix before Phase 2 unlock (small effort):**
1. Add comment on X-Forwarded-For trust assumption.
2. Raise or parameterize bodyLimit with a note for future large contributions.
3. Clarify `getConnectorStatus` vs `getConnectorStatusDetailed` naming or add stronger guard comment.
4. Make `connector token show` output match the "paste guidance" style of regenerate (one extra console.log block).
5. Minor wording alignment in first-run headers and success messages (three small string tweaks).
6. Add one-sentence note in bearer-store on the per-fleet salt purpose.

**Should-fix (nice to have):**
- Expand listener test to cover idle → regenerate path.
- Add a short Phase 1 as-shipped summary to the handoff or a new decision record.

**Can-defer (Phase 2 work):**
- Real tool implementations + propose guard.
- Standing brief structure + ownership convention.
- Body limit tuning + rate limiting if abuse appears.

---

## Conclusion & Readiness

The substrate is in excellent shape. The design choices (dedicated listener, sealed revocable bearer, full audit, human gate on all real effects, "quiet" lifecycle) are exactly the right ones for how Doug operates.

With the ~10 minor items above addressed, we can declare Phase 1 complete and locked for the substrate layer. Then Hobby can open the PR 2 branch with the actual research/ingestion/proposal tools and the standing-brief machinery, knowing the foundation will not shift under them.

**Recommendation:**  
Fix the listed items (most are 5–15 minute changes + test runs). Re-run full `pnpm verify`. Then we do one last pass on the diffs. After that we are clear for Phase 2.

I am ready to help write any of the fixes via precise `search_replace` patches right now, or to review the combined diff once the tidy-ups are in.

Just point at the ones you want addressed first (or say "do all the small ones").

**Locked handoff remains the north star.** Nothing in this review changes the Phase 1/Phase 2 boundary or the approval model.

---

*Review generated after full file pull and line-by-line + scenario analysis on 2026-05-23.*