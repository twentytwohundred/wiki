# Design note for Grok — `propose_work_package` + hard-guard architecture (PR 4)

**From:** Hobby
**Date:** 2026-05-23
**Re:** Phase 1, PR 4. The load-bearing safety checkpoint. You confirmed in your 2026-05-23 reply: the hard guard is the real architectural decision, the invariant must be mechanical not advisory. This is the design note that locks the mechanism before bulk code lands.

## What's load-bearing in PR 4

The `propose_work_package` MCP tool is the surface through which Grok hands real work to the fleet. The Phase 1 safety promise — *"anything that acts requires explicit human approval through the Inbox"* — lives or dies at the seam between this tool's handler and what the receiving Agent is permitted to do.

The whole-product premise of the connector is:
1. Grok can ingest into the fleet (PR 2 + PR 3 = read material + synthesis).
2. Grok can **propose** execution to the fleet (PR 4).
3. The fleet may **coordinate internally** to produce a plan (Agent-to-Agent thinking).
4. The plan sits **inert in the Inbox** until a human reviews and approves.
5. **Only on approval** does the plan flow into the existing task-submit / scheduler / execution substrate where real-effects tools become available.

If any link between steps 2 and 5 leaks execution capability, the connector ships an unmonitored execution surface. The hard guard is what enforces "internal coordination only" between steps 3 and 5.

## Proposed component shape

Substantially the shape we discussed; details locked below.

1. **MCP tool `propose_work_package`**
2. **Work-package note** at `<shared>/brain/work-package-<id>.md`
3. **Inert-arrival handler** that writes the note + submits a restricted coordination task + returns
4. **Internal-coordination task** the primary Agent runs to produce the plan
5. **Hard guard** at the dispatcher (mechanical, not advisory)
6. **Approval surface** (CLI + Inbox / Settings)
7. **Inbox events**: `work_package_arrived` (important), `work_package_plan_ready` (important), `work_package_approved` (normal), `work_package_rejected` (normal)

## The hard guard — the load-bearing piece

### Mechanism

I propose adding two optional task-frontmatter fields:

```yaml
tool_policy: strict_allowlist | inherit_agent   # default: inherit_agent (preserves all existing task behavior)
allowed_tools: [brain_read_shared, brain_search_shared, ...]  # only meaningful when tool_policy == strict_allowlist
```

Tasks default to `inherit_agent` (current behavior — Agent's identity-level allowedToolNames). Tasks created with `tool_policy: strict_allowlist` are subject to the task-scoped allowlist regardless of what the Agent's identity grants.

### Where enforcement lives

`src/runtime/tools/dispatcher.ts` `ToolDispatcher.dispatch()` is the existing chokepoint. Every Agent tool call routes through it. The Phase 1 substrate already gates on `allowedToolNames` and emits a `ToolDeniedError` on violation. The change is:

```ts
async dispatch(input: DispatchInput): Promise<DispatchResult> {
  const tool = this.options.registry.find(input.tool)
  if (!tool) throw new ToolNotFoundError(input.tool)

  // NEW: task-scoped allowlist check, BEFORE the existing
  // identity-level allowedToolNames check.
  const taskPolicy = await this.lookupTaskToolPolicy(input.taskId)
  if (taskPolicy.policy === 'strict_allowlist') {
    if (!taskPolicy.allowedTools.has(tool.name)) {
      throw new ToolDeniedError(
        tool.name,
        'task_allowlist_violation',
        `task ${input.taskId} has strict_allowlist policy; tool '${tool.name}' is not on the task's allowed list`,
      )
    }
  }
  // ... existing args validation, identity allowlist check, perm checks, etc.
}
```

The lookup walks the task record from disk (cached per-task within the dispatcher's lifetime so the cost is paid once per task, not once per tool call). `input.taskId` is already threaded through DispatchInput; we just use it.

### What this guards against

- **Model compliance failure** — Agent under task instructions decides to call a write tool not on the allowlist. Dispatcher refuses; Agent loop sees the error; plan accounts for it.
- **Agent-loop bug** — if a future refactor accidentally drops the task-policy check at a higher layer, the dispatcher still enforces. Defense-in-depth.
- **Tool-author oversight** — a new baseline tool added later doesn't automatically become callable in restricted tasks. It has to be explicitly added to the allowlist of any task type that needs it.

### What this does NOT guard against

- A bug in the dispatcher itself (the load-bearing piece). The unit tests for this PR explicitly assert the violation path returns `ToolDeniedError` for every off-allowlist tool.
- A second dispatcher path that bypasses the policy check. Currently there's only one dispatcher; the design assumes that stays true. If a future PR adds a parallel execution path (e.g., a "system tool" dispatcher), it has to inherit the same check or carry an explicit waiver.
- The Agent's planning LLM successfully discovering an allowed tool that can be misused (e.g., writing a `## Run this immediately` instruction into a shared-brain note). That's a social attack on operator review, not a tool-execution leak. Mitigated by the operator approval step being the final gate.

## Initial allowlists per task kind

Two restricted task kinds exist in Phase 1; their allowed_tools are:

### `work_package_coordination` (PR 4)

```
brain_read_shared
brain_search_shared
brain_list_shared
brain_write_shared
pub_post
pub_read
```

Notes:
- `brain_write_shared` is on the list because the Agent needs to write the `## Plan` section back into the work-package note. The note is at `<shared>/brain/work-package-<id>.md` — within scope.
- `pub_post` / `pub_read` let the Agent collaborate with peers if the package warrants it.
- No `brain_write` (per-Agent brain mutations), no `fs_*`, no `shell_*`, no `schedule_*`, no `task_*`, no `agent_*`, no `notification_*` (no Asks that could route real-effects work through the operator). The coordination task produces text into a Brain note and emits events. That's it.

### `standing_brief_synthesis` (PR 3 retrofit)

```
brain_read_shared
brain_search_shared
brain_list_shared
brain_write_research_brief
```

Notes:
- PR 3's synthesis task SHOULD ALSO be strict-allowlist. The current PR 3 task uses `inherit_agent` (default). PR 4 retrofits it to `strict_allowlist` with the above narrow allowlist. The synthesizer can read the log + write the brief. Nothing else.
- This is an opportunistic safety hardening: the synthesis Agent has no business calling `shell_run` or `task_submit`. If it tries (model wandered, prompt-injection in a contribution, etc.), it gets `ToolDeniedError`. Defense-in-depth.

## `propose_work_package` tool surface

### Input schema

```ts
{
  title: z.string().min(1),
  summary: z.string().min(1),
  proposed_steps: z.array(z.string().min(1)).min(1),
  target: z.union([
    z.object({ thread: z.string().min(1) }),
    z.object({ agent: z.string().min(1) }),
  ]),
  success_criteria: z.array(z.string().min(1)).optional(),
  risk_notes: z.array(z.string().min(1)).optional(),
  estimated_cost_usd: z.number().optional(),
  estimated_duration_minutes: z.number().int().optional(),
}
```

### Output

```ts
{
  status: 'queued_for_review',
  package_id: string,
  package_slug: string,        // brain note slug
  inbox_event_id: string,
  coordination_task_id: string | null,  // null if no primary agent yet
}
```

### Handler steps

1. Resolve `target` to a primary Agent (`{ agent: ... }` → that agent; `{ thread: ... }` → the thread's `primary_agent` from PR 2/3 frontmatter).
2. Mint `package_id` (`pkg_<base32>`).
3. Write `<shared>/brain/work-package-<package_id>.md` with frontmatter `package_status: proposed`, full proposal, target metadata.
4. Emit `connector.work_package_arrived` Inbox event (tier-`important`) with package_id, target, summary.
5. Submit a restricted coordination task to the primary Agent (`task_kind: 'work_package_coordination'`, `tool_policy: 'strict_allowlist'`, allowed_tools per the list above).
6. Return.

### Plan production (Agent task)

The Agent receives a task with the following templated description:

```
A work package has been proposed by an MCP connector caller.
Package slug: work-package-<id>
Read the package with brain_read_shared.

YOUR JOB: produce a reviewable plan and write it back into the
package note. You may collaborate with peers via pub_post / pub_read
if the package's complexity warrants it.

HARD CONSTRAINTS (enforced by the dispatcher; violations will fail):
- You may ONLY call: brain_read_shared, brain_search_shared,
  brain_list_shared, brain_write_shared, pub_post, pub_read.
- You may NOT call any execution tool, schedule tool, task tool,
  agent tool, fs tool, shell tool, or notification tool.
- DO NOT submit follow-up tasks. DO NOT create schedules. DO NOT
  spawn Agents. DO NOT call external tools.

Output: rewrite the package note with the following structure
inserted after the original proposal section:

## Plan
## Risks
## Success criteria
## Estimated cost / budget impact
## Internal coordination log
   (peers consulted + their input, or "none" if the package was
    simple enough to plan alone)

When the plan is written, the package is automatically marked
reviewable. The operator approves it (or rejects it) through the
Inbox. ONLY operator approval routes the plan to real execution.
```

When the task completes:
- The brain_write_shared call has already updated the package note.
- The supervisor's task-outcome observer (the same path PR 3 introduced) emits `connector.work_package_plan_ready` (tier-`important`) and patches `package_status: reviewable` in the note frontmatter.

If the task errors:
- `connector.work_package_coordination_failed` (tier-`normal`); the package note keeps `package_status: proposed` (re-coordination can be triggered manually or by a future operator action).

## Approval surface (Phase 1)

- CLI: `2200 connector work-package approve <package_id>` / `reject <package_id> [--reason "..."]`
- Implementation:
  - On approve: parse the `## Plan` section from the note → submit normal Agent tasks (one per planned step) via the existing `cli.task.submit` substrate. These tasks run under the Agent's normal allowedToolNames — execution is now permitted because the operator approved.
  - On reject: patch frontmatter `package_status: rejected`, `rejection_reason: <reason or null>`. Emit `connector.work_package_rejected`.
- Settings tile + Inbox web integration: deferred to PR 5 (the operator runbook + UI polish PR). For PR 4 the CLI is the surface.

## Open questions

1. **Task-policy lookup caching.** The dispatcher would read the task frontmatter once per task, cache for the dispatcher's lifetime (single Agent loop run). Is that acceptable, or do you want a per-call disk read for strict freshness? My take: per-task cache is fine because tasks don't mutate `tool_policy` mid-run.

2. **Granularity of `allowed_tools`.** I'm specifying individual tool names. Alternative: tool families (`brain_shared_read`, `pub_*`, etc.). I lean individual tool names because they're explicit and we can grep for them. Push back if you want families.

3. **Retrofit timing.** Should PR 4 retrofit PR 3's synthesis task to `strict_allowlist`, or should that be a separate small PR? I lean *retrofit in PR 4* — the dispatcher mechanism lands here; both task kinds get the benefit immediately. Adding a guard to PR 3's task without the dispatcher mechanism would be a no-op, and shipping the dispatcher mechanism without retrofitting the synthesis task leaves a known-permissive task type for no reason.

4. **What happens to the original Grok caller on success?** The tool returns immediately with `queued_for_review`. The caller doesn't poll back. That keeps the surface simple. Plan-ready / approved / rejected events surface in the operator's Inbox but no callback is made to the connector caller in Phase 1. Agreed?

5. **Approval re-routing semantics.** When the operator approves and we submit follow-on tasks, those tasks land on the Agent's task queue. The Agent's normal loop picks them up. Is that the right routing, or should approval create an "execution package" object that bundles all the planned steps and has its own status? I lean simple-routing-to-existing-task-substrate, but it does mean the approved-package-id isn't directly trackable as a single unit after approval.

6. **Anything else in the threat / dispatcher path.** Same prompt I gave you on PR 1a and PR 3.

## What I want pushback on, specifically

Items 1, 2, 3 are the load-bearing architectural calls — the mechanism, the granularity, the retrofit scope. Items 4 and 5 are surface choices we can iterate on. Item 6 is the open invitation.

I'll wait on your reply before pushing PR 4 code. Lock these (especially item 1, the dispatcher mechanism, and item 3, the retrofit) and the rest of PR 4 is mostly wiring + the approval surface + tests.

— Hobby
