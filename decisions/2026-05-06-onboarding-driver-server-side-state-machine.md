---
date: 2026-05-06
status: shipped (Option A) · Option B deferred behind named unblock
decided_by: Doug + Hobby
related: epics/14-onboarding.md, epics/15-web-app.md
shipped_in: 2200#129 (server state machine), 2200#130 (web Card Stack)
---

# Onboarding driver: server-side state machine, with the client-side driver deferred

## The choice

Epic 14 Phase A built the conversational onboarding flow as a single async function (`runInterview`) with a callback-driven `UserInput.ask()`. That shape is a clean fit for stdin where each prompt blocks on the next line of input. It is not a clean fit for HTTP, where each answer is its own request and the server has to remember where the conversation left off.

When the web Card Stack screen (Epic 15 Phase B) needed to drive that interview from the browser, two architectures presented themselves:

**Option A (server-side state machine).** The runtime owns the session. The server holds an `OnboardingSession` object that exposes discrete-step methods (`submitAnswer`, `markConfirmed`, `cancel`); each method advances state. The web client is a thin driver that POSTs answers and renders whatever the server returns. Session lifetime + LLM access + handoff materialization all happen on the runtime side. The CLI keeps its existing `runInterview` ergonomics unchanged; the web flow gets its own driver via session-store endpoints.

**Option B (client-side driver).** The web app owns the flow. The runtime exposes lower-level primitives (script load, branch picker, summary call, handoff build, migrate) that the client orchestrates. The client tracks its own state, holds the transcript locally, calls each runtime primitive in sequence, and only invokes the migration orchestrator at the end. Sessions live in browser state (or a thin server cache); the runtime sees the interview as a series of independent calls rather than one stateful conversation.

## What we picked

**Option A**, shipped:
- `src/runtime/onboarding/session.ts` ... `OnboardingSession` state machine.
- `src/runtime/onboarding/session-store.ts` ... in-memory store with sliding 30-min TTL + 5-min cleanup sweep, started/stopped from the supervisor lifecycle.
- 5 HTTP endpoints under `/api/v1/onboarding`.
- `apps/web/src/screens/onboarding/OnboardingScreen.tsx` ... 4-phase Card Stack driver consuming those endpoints.

End-to-end PRs: 2200#129 (server) and 2200#130 (web client).

## Why A first

1. **Single source of truth for the LLM call.** Summary generation, tool suggestion, and schedule suggestion are all already runtime concerns (the CLI's `runInterview` does them server-side too). Pulling them out so the browser could orchestrate would split a coherent flow across two trust boundaries for no added user value. The web client has no business holding the Anthropic API key.
2. **Reuses what the CLI already built.** `pickBranch`, `buildHandoffFromTranscript`, `suggestTools`, `suggestSchedules`, `migrateFromHandoff` ... all of these exist server-side and produce the same handoff shape `2200 agent spawn` produces. Wrapping them in a state machine kept the CLI flow byte-for-byte unchanged while giving HTTP a clean drive.
3. **The mobile app gets the same surface.** Every client (web today, iOS/Android later, a hypothetical Slack bot frontend) consumes a uniform `/api/v1/onboarding/*` API. Architecture B would mean re-implementing the orchestration in each client.
4. **Substrate first.** "Decide-and-tell in build phase" + "build clean and absorbable" both point to: ship the obvious good substrate now, surface the alternative in writing, and let real usage reveal whether B is needed.

## What B would buy us

**Faster perceived latency on the summary step.** The LLM call to summarize the transcript runs synchronously inside `POST /api/v1/onboarding/:id/answer` for the final question. The user sees a 5-15s pause on the Next button. With B, the client could optimistically render the preview shell + stream tokens as they arrive, shaving the perceived wait.

**Survives daemon restarts.** Server-side sessions are in memory; a daemon restart drops them, just like Ctrl-C drops a `2200 agent spawn` interview. Client-driven sessions could be resumed from local state across runtime restarts, which matters more for the hosted multi-tenant case (Epic 17) than for a single-user laptop.

**Smaller server surface.** The runtime would expose primitives ... `POST /onboarding/script`, `POST /onboarding/summarize`, `POST /onboarding/build-handoff` ... rather than a session object. Each is independently testable. The state machine moves from server code into client code.

## Named unblock for revisiting B

Revisit Option B (or a hybrid: server holds session metadata, client streams the summary) when **either** of these becomes load-bearing:

1. **Multi-tenant managed service is live and onboarding is the slow surface.** If session resume across daemon restarts becomes a measurable user-experience issue, a thin server-side session backed by SQLite plus client-side optimistic rendering of the preview is a reasonable middle ground. Until the managed service ships, a 30-minute TTL in memory is more than enough.
2. **A second client lands and the server contract is constraining its UX.** If the iOS app or a Slack-bot frontend wants to render the summary token-stream while it arrives, the server needs to expose a streaming primitive. A streaming endpoint (`GET /api/v1/onboarding/:id/summary/stream` returning SSE) is a smaller change than a full re-platform to client-driven, and keeps Option A's other benefits intact.

In neither case do we expect to swap architectures wholesale. The likely path is **augment** rather than **replace**: keep the session state machine, add a streaming primitive when one is needed.

## What we are NOT doing now

- Not building a parallel client-side driver. That's a fork-in-the-road that would create two architectures for the same flow, double the test surface, and slow down every feature that touches onboarding from this point forward.
- Not exposing `summarize` / `build-handoff` / `migrate` as independent endpoints. Those become lower-level primitives only when a real user of them appears.
- Not adding token streaming yet. The Next-button "Working..." state is acceptable for v1; a streaming preview is a polish item.

## Recommendation to Doug

Ride Option A. Revisit only when the named unblock conditions fire. The decision record is the unblock receipt: when one of the conditions hits, this doc names the augmentation path so we don't redo this analysis from scratch.

If you want me to invest in the augmentation path now (token streaming on the final answer for a smoother UX) say so and I'll add it. Otherwise this is shipped + parked.
