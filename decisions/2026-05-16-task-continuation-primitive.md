# 2026-05-16 ... task continuation primitive

**Status:** accepted, building today

**Decision owners:** Doug, Hobby

**Context decision:** [[2026-05-16-connector-extensions]]

## Problem

Agents can't follow up. An Agent receives a request through one surface (Discord, chat, pub), goes to another surface to fetch what it needs (asks Hobby in Studio), gets the answer there ... and the conversation dies. The original requester never hears back.

Failure mode caught on 2026-05-16 with Doug, Simon, and the Discord connector. Doug asked Simon in Discord: "Ask Hobby what he needs from me, I want to test something." Simon went to Studio, pinged Hobby, said in Discord "I'll relay his answer." Hobby replied in Studio. Simon never came back to Discord.

**Structural cause:** each wake source creates a Task in isolation. The Discord inbound creates Task A. Simon's `discord_send` reply fulfills Task A and the loop closes. Hobby's Studio reply fires a separate wake later, creating Task B in pure Studio context with no link to Task A. The Agent does not know that the Studio message is the answer to a question they asked on a user's behalf in Discord.

Same failure shape applies anywhere an Agent multi-hops to fulfill a request: chat → connector → chat, pub → chat → pub, etc.

## Decision

Ship a **task continuation primitive** in the substrate. Agents declare "I am waiting for a response from X" by calling an `task_await_response` tool. The supervisor's inbound router matches subsequent events against waiting tasks and resumes them instead of creating new tasks in isolation.

Rejected alternatives:

- **Brain-note open-loop pattern.** Agent maintains a brain note tracking owed follow-ups; reads it on every wake. Doable today with zero substrate changes. Rejected because Brain is non-load-bearing memory ... can be wiped, can be missed by the loop's context selection. Continuity needs to be substrate, not advice.
- **Prompt-only nudge.** Tell the Agent in the system prompt "if you say you'll relay, actually relay." Brittle, doesn't survive context resets, doesn't compose across surfaces.

## Wire shape

### Task model gains `wait_for`

```ts
WaitFor = {
  source_kind: 'pub' | 'connector' | 'chat'
  source_ref: {
    // pub: identifies the pub the response is expected in
    pub?: string
    // connector: identifies the conversation the response is expected in
    connector_id?: string
    conversation_id?: string
    // chat: identifies the chat thread
    chat_id?: string
  }
  // Whose response we're waiting for. Format depends on source_kind:
  //   pub:       agent name (matches event.sender.display_name or
  //              the binding's agent_id resolution)
  //   connector: opaque sender id (e.g. Discord user id)
  //   chat:      always 'user' (the chat owner)
  expected_from: string
  // ISO 8601 UTC. Tasks past this time get resumed with a "no response"
  // continuation by the scheduler sweep.
  expires_at: string
  // What to tell the Agent when the response arrives or times out.
  // The Agent's original origin so the continuation includes the context
  // of what the Agent was doing.
  context_note: string
}
```

Persisted on `TaskFrontmatter`. `null` when the task is not waiting.

### Lifecycle

1. **Agent inbound creates Task A.** Existing path.
2. **Agent's loop runs.** Agent sees they need to ask someone else. Calls e.g. `pub_send({ pub: 'studio', content: '@hobby ...' })` and then `await_response({ source_kind: 'pub', source_ref: { pub: 'studio' }, expected_from: 'hobby', timeout_seconds: 1800, context_note: 'Doug asked in Discord channel X; I forwarded to Hobby and will relay back.' })`.
3. **`task_await_response` tool:**
   - Writes the `wait_for` block to Task A's frontmatter.
   - Sets Task A state → `blocked_on_agent`.
   - Returns a result that signals the loop to exit cleanly (treated as task complete-for-now by the loop).
   - The Agent's overall state machine transitions `running → blocked_on_agent`.
4. **Time passes.** Hobby replies in Studio. Studio pub wake fires for Simon.
5. **Supervisor inbound router** (new logic, applied to all three inbound paths):
   - Before creating a fresh task for the event, scan the target Agent's tasks for one matching:
     - `state == 'blocked_on_agent'`
     - `wait_for != null`
     - `wait_for.source_kind` matches the inbound's source kind
     - `wait_for.source_ref` matches the inbound's source identifier
     - `wait_for.expected_from` matches the inbound's sender
     - `wait_for.expires_at > now`
   - **If matched:** append a continuation section to the task body, clear `wait_for`, transition `blocked_on_agent → pending`. Agent's task watcher picks it up and re-enters the loop with the original task body + the appended continuation.
   - **If not matched:** existing path. Create a fresh task.
6. **Agent's loop re-enters Task A.** Sees the appended continuation. Decides what to do (forward, ask follow-up, give up). The original task is still the same task, with full history.
7. **Optionally** Agent calls `task_await_response` again for the next hop. Chain continues.

### Timeout

Default 30 minutes (1800 seconds). Agent can override per call. Scheduler sweep runs every 30 seconds; expired waits get a "no response received within X" continuation and the task transitions back to `pending`. Agent decides whether to give up, retry, or report timeout to the user.

### Matching rules

Per source_kind:

| source_kind | source_ref match | expected_from match |
| ----------- | ---------------- | ------------------- |
| `pub`       | `pub == event.pub_name`     | `expected_from == event.sender_display_name` (case-insensitive) OR `expected_from == event.sender_agent_id` |
| `connector` | `connector_id + conversation_id == event.connector_id + event.conversation.id` | `expected_from == event.sender.id` |
| `chat`      | `chat_id == event.chat_id`  | always `'user'` (the chat owner) |

Only one waiting task per (agent, source_kind, source_ref, expected_from) can match. If multiple match, the oldest one wins. Excess waiting tasks for the same target are an Agent-side bug, not substrate's problem.

## Out of scope for v1

- **Parallel waits.** A task waiting on multiple responses (e.g. "ask Hobby and Poe, forward both"). Sequential only ... if you need both, ask one, wait, ask the second, wait, then forward.
- **Cross-Agent task transfer.** A blocks while B works on something. Not the same shape ... that's delegation, not continuation.
- **User-facing UI for waiting tasks.** Surfaces after the substrate proves out.
- **Re-routing.** A wait can only be satisfied by the originally-named source; if the response arrives via a different surface, treat it as a fresh task. Operator-side mistake, not substrate's problem to detect.

## Touch list

- `src/runtime/agent/task/types.ts` ... add `WaitForSchema`, `wait_for` field on TaskFrontmatter.
- `src/runtime/tools/baseline/task.ts` (or a new baseline server) ... add `task_await_response` tool.
- `src/runtime/http/server.ts` ... match-before-create at the connector inbound endpoint and the chat-send endpoint.
- `src/runtime/pub/wake-source.ts` ... match-before-create when synthesizing pub wake tasks.
- `src/runtime/agent/loop.ts` ... handle the `task_await_response` tool result (signal loop to exit, transition state).
- `src/runtime/agent/task/store.ts` ... add `findWaiting(criteria)` query helper.
- `src/runtime/supervisor/supervisor.ts` ... timeout sweep tick (or extend an existing scheduler tick).
- System prompt for Agents with connector or pub membership ... teach `task_await_response`.
- Tests across the matrix (Discord→Studio→Discord, Chat→Discord→Chat, etc).

## Timeout default

30 minutes. Agent can override per call. Beyond 30 minutes the original requester has probably moved on; report timeout and let the Agent decide.

## Naming

- Tool name: `task_await_response`. Short, verb-first, clear.
- Field name: `wait_for`. Mirrors the conceptual primitive.
- State: reuses `blocked_on_agent`. No new state introduced.

## Future epics this enables

- Multi-agent workflows: ship something to A, A finishes, B picks up the result, etc.
- 8h autonomous work target: Agent can wait on a long-running task without losing the user-facing conversation.
- Cross-instance Agent collaboration via OpenPub: same primitive, different sources.
