---
title: Runtime API Convention
type: convention
status: drafted
version: 0.1
tags: [convention, api, http, websocket, frontend, runtime, level-3-theming]
created: 2026-04-29
updated: 2026-04-29
linked_docs:
  - "[[../decisions/2026-04-29-theme-aware-from-v1]]"
  - "[[../epics/15-web-app]]"
  - "[[../02-architecture]]"
canonical_path: wiki/conventions/runtime-api.md
---

# Runtime API Convention

The contract between the 2200 runtime and any frontend that consumes it. Web app, mobile app, third-party Level-3 theme, scripted client ... all talk to the runtime over the same HTTP+WebSocket surface defined here.

This convention is load-bearing for [[../epics/15-web-app]] and [[../decisions/2026-04-29-theme-aware-from-v1]]. The frontend never imports runtime types or calls runtime functions directly; it only ever sees this API.

## Versioning

The base path is `/api/v1`. Breaking changes mint `/api/v2`; old versions stay alive through one minor cycle. New endpoints, new fields, and new query params are additive and do not bump the version. Removing a field, renaming a field, or changing a field's type is breaking.

The runtime publishes a JSON Schema bundle at `/api/v1/schema` describing every endpoint, request shape, and response shape. Frontends generate their type universe from that schema; no shared TypeScript types between runtime and frontend (see [[../epics/15-web-app]] boundary discipline).

## Transport

- **HTTP/1.1 or HTTP/2.** The supervisor's HTTP server (Fastify per [[../decisions/2026-04-26-toolchain-pick]]) handles both.
- **JSON request and response bodies.** `Content-Type: application/json; charset=utf-8`.
- **UTF-8 throughout.** No other encodings.
- **Time as ISO-8601 UTC strings.** `2026-04-29T14:32:08.123Z`. The runtime never emits a local-time string.
- **Money as decimal strings,** not floats. `"0.0234"` (USD), three significant figures past the leading non-zero. The frontend formats for display.

## Auth

Phase A (local-install): bearer token. The CLI generates a token at `2200 web start` (or first runtime start with web enabled), stores it at `<home>/state/web-tokens/<id>.json`, and prints it once. The frontend stores it in localStorage and sends it as `Authorization: Bearer <token>` on every request and during the WebSocket upgrade.

Tokens are revocable via `2200 web token rotate` (invalidates all current tokens and prints a new one). Each token has a creation timestamp and a label; rotation is logged.

Phase B (managed service, Epic 17): per-user accounts with session cookies + CSRF protection. The bearer-token flow remains for self-hosted single-user installs.

**Unauthorized requests** return `401 Unauthorized` with the standard error envelope. **Forbidden requests** (token valid but lacks permission for the action) return `403 Forbidden`. The runtime never returns a leaked error page; every endpoint authenticates before doing anything.

## Resource shape

URLs identify resources. RESTful where natural; RPC-shaped sub-paths where the action does not map cleanly to a CRUD verb.

- **Lists:** `GET /api/v1/agents`
- **One resource:** `GET /api/v1/agents/{name}`
- **Create:** `POST /api/v1/agents` with body
- **Update:** `PATCH /api/v1/agents/{name}` with partial body
- **Delete:** `DELETE /api/v1/agents/{name}`
- **Action on resource:** `POST /api/v1/agents/{name}/budget/override` with body. Action verbs are nouns from the runtime's vocabulary, not framework-y verbs.

Resource identifiers are slugs (kebab-case, `[a-z0-9-]+`), not numeric ids. Agent name is the slug. Brain notes use their slug. Tasks use their UUID (assigned at create time).

### Pluralization

Always plural at the collection root: `/agents`, `/notifications`, `/tasks`, `/pubs`, `/brain-notes`. Singular is reserved for resources that are unambiguously single (`/api/v1/me` for the authenticated user, `/api/v1/runtime/health` for the runtime itself).

## Pagination

Cursor-based. Every list endpoint accepts:

- `?limit=<n>` (default 50, max 200, min 1)
- `?cursor=<opaque>` (optional; from the previous response)

Every list response is shaped:

```json
{
  "items": [...],
  "cursor": {
    "next": "opaque-string-or-null",
    "limit": 50
  }
}
```

When `next` is `null`, the list is exhausted. The cursor is opaque to the client; clients never parse or construct one.

## Error envelope

Every non-2xx response has the same shape:

```json
{
  "error": {
    "code": "agent_not_found",
    "message": "No Agent with name 'mira'",
    "status": 404,
    "details": {
      "agent": "mira"
    },
    "request_id": "req_01H..."
  }
}
```

Fields:

- `code`: stable machine-readable error code in snake_case. Frontends switch on this. Codes are documented per endpoint in the schema.
- `message`: human-readable English. The frontend shows this to the user when there is no canned copy for the code.
- `status`: HTTP status, repeated for clients that lose it.
- `details`: optional, code-specific structured data.
- `request_id`: ULID/KSUID; logged on the runtime side. Surface in `<details>` of `ErrorState` per the design system.

Standard codes:

- `unauthorized` (401), `forbidden` (403), `not_found` (404), `conflict` (409)
- `validation_failed` (422) ... `details.fields[]` lists the failures
- `rate_limited` (429) ... `details.retry_after_ms`
- `internal_error` (500) ... never includes a stack trace; the request_id maps to logs

## Live signal: WebSocket

The web app and any other live client connect to:

```
GET /api/v1/ws
Authorization: Bearer <token>
```

The connection upgrades to WebSocket on success. The server pushes JSON messages of the shape:

```json
{
  "event": "agent.status_changed",
  "occurred_at": "2026-04-29T14:32:08.123Z",
  "payload": {
    "agent": "hobby",
    "old_status": "running",
    "new_status": "idle"
  }
}
```

### Event taxonomy (Phase A)

| event | payload |
|---|---|
| `agent.status_changed` | `{ agent, old_status, new_status }` |
| `agent.task_started` | `{ agent, task_id, source, summary }` |
| `agent.task_finished` | `{ agent, task_id, duration_ms, cost }` |
| `agent.task_errored` | `{ agent, task_id, error_code }` |
| `notification.created` | `{ notification_id, agent, tier, kind }` |
| `notification.answered` | `{ notification_id, response_summary }` |
| `notification.dismissed` | `{ notification_id }` |
| `budget.threshold_crossed` | `{ agent, threshold_pct, day }` |
| `runtime.health` | `{ healthy, components: { ... } }` |

Phase B adds `pub.message`, `pub.member_changed`, `schedule.fired`, `tool.restarted`, `tool.health_changed`. Mobile/Epic 16 adds `push_notification` (delivered via APNs/FCM, mirrored on WS for visibility).

### Subscription model

Phase A: clients receive every event the authenticated principal is permitted to see; no subscribe/unsubscribe protocol. The connection is single-tenant (one user) so the bandwidth is fine.

Phase B (when fleets get larger): the client sends a `subscribe` frame with a filter (e.g., `{ agents: ["mira", "juno"] }`) and the server scopes pushes accordingly.

### Reconnect + backfill

Each event has an `event_id` (monotonic ULID per connection). On reconnect, the client sends `Last-Event-Id: <id>` (header) or `?since=<id>` (query) and receives any events it missed since that id, up to a 5-minute backfill window. Beyond 5 minutes, the client refetches the affected resources via HTTP and resumes the live stream.

### Heartbeat

The server sends `{ "event": "heartbeat" }` every 30 seconds. The client's reconnect logic triggers if it misses two consecutive heartbeats.

## Endpoints (Phase A surface)

The runtime exposes the following at v1. Every endpoint authenticates. Every list endpoint paginates per the convention above. Every error follows the envelope above.

### Agents

- `GET /agents` ... list. Query: `?status=running|idle|blocked|errored`, `?cursor=`, `?limit=`.
- `GET /agents/{name}` ... full Agent record (Identity + current status + current task summary + today's cost).
- `POST /agents` ... create. Body: a HandoffDocument-shaped payload; runtime calls `migrateFromHandoff` per Epic 5.
- `PATCH /agents/{name}` ... edit Identity (subset; not all fields are editable post-create).
- `DELETE /agents/{name}` ... remove (calls `Supervisor.removeAgent`).
- `POST /agents/{name}/start` ... start the Agent process.
- `POST /agents/{name}/stop` ... stop.
- `POST /agents/{name}/budget/override` ... body: `{ amount_usd, reason }`. Calls into Epic 4.5.
- `GET /agents/{name}/timeline` ... recent activity events (for Agent detail).

### Tasks

- `GET /agents/{name}/tasks` ... per-Agent task list. Query: `?state=pending|running|done|errored|blocked`.
- `GET /tasks/{id}` ... one task's full record (across all Agents).
- `POST /agents/{name}/tasks` ... submit a task. Body: `{ source: "cli"|"user", summary, body }`.

### Notifications

- `GET /notifications` ... list across all Agents. Query: `?state=pending|answered|dismissed|expired`, `?tier=`, `?agent=`.
- `GET /notifications/{id}` ... one.
- `POST /notifications/{id}/respond` ... body: `{ response: ... }` (shape varies by notification kind; documented in schema).
- `POST /notifications/{id}/dismiss`.

### Brain

- `GET /agents/{name}/brain` ... list notes (slug + frontmatter only).
- `GET /agents/{name}/brain/{slug}` ... full note (frontmatter + body).
- `GET /agents/{name}/brain/search?q=<query>` ... FTS5-backed search.
- `POST /agents/{name}/brain` ... create or upsert (only when the authenticated principal has write permission, per Epic 8 phase B).

### Schedules

- `GET /agents/{name}/schedules`.
- `POST /agents/{name}/schedules` ... body: `{ id, cron|interval, payload }`.
- `PATCH /agents/{name}/schedules/{id}`.
- `DELETE /agents/{name}/schedules/{id}`.

### Tools (Epic 9)

- `GET /agents/{name}/tools` ... declared `mcp_servers[]` + their current health (running, restarting, failed).
- `POST /agents/{name}/tools/{server}/restart` ... force-restart one MCP server.

### Budget / usage

- `GET /budget/today` ... aggregate across all Agents + breakdown by Agent + breakdown by provider.
- `GET /budget/range?from=YYYY-MM-DD&to=YYYY-MM-DD&group_by=agent|provider|day`.
- `GET /agents/{name}/budget` ... per-Agent, plus the cap, plus today's spend.

### Pubs (Phase B; reserved Phase A)

- `GET /pubs` ... list.
- `GET /pubs/{id}` ... pub detail (members + recent messages).
- `GET /pubs/{id}/messages` ... paginated history.
- `POST /pubs/{id}/messages` ... post (when the authenticated principal is the user, not an Agent).

### Runtime + system

- `GET /me` ... the authenticated principal's profile.
- `GET /runtime/health` ... liveness probe + per-component status.
- `GET /runtime/version` ... runtime version + build info.
- `GET /schema` ... JSON Schema bundle for the entire API. Self-describing.

## Naming conventions

- **JSON keys are snake_case.** Matches the broader 2200 convention (Identity frontmatter, brain note frontmatter, scheduler config). The frontend transforms to camelCase at the API-client layer if it wants to.
- **Boolean field names are positive.** `is_active`, not `is_inactive`. Default values for booleans are documented per field.
- **Enum values are snake_case strings,** never integers. `"running"`, `"blocked_on_detector"`, etc.
- **Identifier types are explicit:** `agent_name`, `task_id`, `notification_id`, `pub_id`, `brain_slug`. Never just `id`.

## What the API does NOT expose

These are deliberate omissions to preserve runtime/client boundary integrity:

- **No raw filesystem paths.** The frontend never sees `<home>/state/notifications/abc.md`. It sees `notification_id: abc` and uses the API to read/write.
- **No process IDs, no OS internals.** Whether an Agent runs as a child process, a thread, or a remote container is not the frontend's concern.
- **No credentials of any kind.** Tokens, API keys, SecretRefs are masked in responses. The frontend can read that a `mcp_server` declares `env: { GITHUB_TOKEN: { secretRef: "..." } }` but never sees the resolved value.
- **No internal supervisor RPC.** The control-plane RPC over UDS (per [[../decisions/2026-04-26-control-plane-protocol]]) stays internal. The HTTP API translates between the frontend's vocabulary and the supervisor's.

## Schema authority

The runtime's TypeScript types are the source of truth at the runtime side. Each endpoint's request/response is validated by Zod schemas in `code/2200/src/http/routes/<resource>.ts`. The schemas drive both runtime validation and the JSON Schema bundle published at `/api/v1/schema`.

The frontend never imports the Zod schemas or the TypeScript types. It generates its own types from the JSON Schema (via `quicktype`, `json-schema-to-zod`, or a hand-rolled generator). When the runtime ships a new field, the frontend re-generates and gets the new type.

This is the "two type universes that share a schema, not source" model called out in [[../epics/15-web-app]].

## Compatibility commitments

While `/api/v1` is current:

- **Additions are non-breaking.** New endpoints, new fields, new enum variants are fine.
- **Removals are breaking.** Removing a field, an endpoint, or an enum variant requires `/api/v2`.
- **Renames are breaking.** Treat them as removals + additions.
- **Type changes are breaking.** `string` → `number` is a v2.

The runtime emits a console warning when serving any endpoint marked `deprecated_at: <version>` in the schema. Deprecation precedes removal by at least one minor.

## Implementation pointers (not contract)

For implementers, not part of the contract:

- The HTTP server lives at `code/2200/src/http/`. Fastify, hosted by the supervisor process.
- Auth middleware reads the token from the `Authorization` header, looks it up in `<home>/state/web-tokens/`, and attaches the resolved principal to the request.
- The WebSocket server reuses the same auth check during the upgrade.
- The schema endpoint serves a precomputed bundle generated at runtime startup from the route definitions.

## References

- [[../epics/15-web-app]]
- [[../decisions/2026-04-29-theme-aware-from-v1]]
- [[../02-architecture]]
- [[../decisions/2026-04-26-control-plane-protocol]]
- [[../decisions/2026-04-26-toolchain-pick]]
- Standard error envelope is RFC 7807 ... shaped, not strict.

---

*v0.1 drafted 2026-04-29 by Hobby. Locks the API contract for Phase A web app implementation. Phase B endpoints (pubs, scheduler firings, tool health events) reserved here, specified when those phases activate.*
