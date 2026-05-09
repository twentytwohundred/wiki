---
title: Tool Schema Design Convention
type: convention
status: active
tags: [convention, tools, llm, schema, robustness]
created: 2026-05-08
updated: 2026-05-08
linked_docs:
  - "[[09-tool-system]]"
  - "[[10-model-lifecycle]]"
canonical_path: wiki/conventions/tool-schema-design.md
---

# Tool Schema Design Convention

How to design baseline tool schemas (and any non-baseline tools an Agent
will see) so they work across the range of models 2200 supports today
and the range we expect to add. Born from real incidents this session
where DeepSeek and Grok-4.3 tripped the error-storm detector trying to
call a tool with a Zod discriminated-union argument they could not
shape correctly.

## Audience

This is the developer convention for anyone authoring a tool the
runtime will expose to an Agent. It applies to:

- Baseline tools (`src/runtime/tools/baseline/*`)
- Tool surfaces emitted via Identity-declared MCP servers (we do not
  control those schemas, but we do control wrappers)
- Future tool ecosystems (Skills, Extensions)

Out of scope: internal RPC schemas (CLI ↔ supervisor, Agent ↔
supervisor). Those are JSON-RPC and only humans / TS code call them.

## Why this matters

2200 supports multiple LLM providers (Anthropic, OpenAI, DeepSeek,
xAI/Grok, Moonshot Kimi, OpenRouter, Google Gemini, local) and the
spread in tool-call quality across them is wide. A schema that is
elegant on Claude Opus 4.7 can produce 5 consecutive arg errors on
DeepSeek and trip the error-storm detector. The platform's value
proposition includes "use whichever model you want" ... so tool
schemas have to work for whichever model the operator picks.

The principle: **raise the floor without lowering the ceiling.** A
flat-shape schema is the same number of bytes for a strong model and
strictly easier for a weak one. There is no model that handles
discriminated unions well but flat shapes badly. So the right default
is "flat unless there's a reason."

## Rules

### 1. Prefer flat top-level args over nested objects

Bad:

```ts
argsSchema: z.object({
  prompt: z.string(),
  timing: z.object({
    kind: z.enum(['cron', 'interval']),
    expression: z.string().optional(),
    interval_seconds: z.number().optional(),
  }),
})
```

Good:

```ts
argsSchema: z
  .object({
    prompt: z.string(),
    cron: z.string().optional(),
    timezone: z.string().optional(),
    interval_seconds: z.number().int().min(5).optional(),
  })
  .refine(
    (a) =>
      (a.cron !== undefined && a.interval_seconds === undefined) ||
      (a.cron === undefined && a.interval_seconds !== undefined),
    { message: 'pass exactly one of `cron` or `interval_seconds`' },
  )
```

The flat shape has the same expressivity, the same validation power,
AND it works on DeepSeek/Grok. Use a `refine` for "exactly one of"
constraints; the message lands in the model-side error feedback when
the model gets it wrong.

### 2. Avoid Zod discriminated unions on tool args

Discriminated unions ask the LLM to:

1. Set the discriminator field (the `kind` tag).
2. Know the enum value for the variant.
3. Include the right per-branch fields.

That's three things to remember. DeepSeek and Grok-4.3 forget at least
one consistently. Frontier Anthropic and OpenAI models handle them,
but the failure mode for "raise the floor" lands here ... when a weaker
model fails, every tool argument-shaping attempt blows up at the
schema layer before the dispatcher even sees it.

If the conceptual shape really is a sum type, encode it as flat
optional fields with a refinement.

### 3. Required > optional, when the meaning is clear

Optional fields with implicit defaults invite the model to omit them
even when the operator's intent depends on the value. If a default
matters, set it as a literal default rather than leaving the field
optional. If absence has meaning, document the meaning in the
description.

### 4. Description text carries weight

The `description` field is the model's primary cue for when to use a
tool and how to shape the args. Be opinionated. Prefer:

- "Pass either `cron` (a 5-field cron expression like `'0 8 * * 1-5'`
  for weekdays 8am, plus optional `timezone`) OR `interval_seconds`
  (every N seconds, min 5)."

over:

- "Schedule timing."

The first works on DeepSeek. The second leaves the model guessing.

### 5. Idempotency category should match the operation, not the wishful thinking

Per the perm-matrix in `[[09-tool-system]]`:

- `pure` ... safe to retry, no side effects beyond the local view
  (e.g. `time.now`, `brain.read`, `web.search`).
- `checkpointed` ... has side effects but re-runs are safe (the tool
  itself is idempotent or has its own dedup; e.g. `brain.write`
  upsert-by-slug, `pub.send` with idempotency_key).
- `destructive` ... re-runs are NOT safe (e.g. `fs.delete`,
  `brain.delete`, `schedule.add`, `schedule.run_once`,
  `notification.ask`).

Pick honestly. The perm matrix uses these to gate "what tools can a
task in category X call?" If you mark a destructive tool as
checkpointed because "it'll probably be fine," a wake-resume on a
crashed task may double-fire it.

The corollary: tasks that legitimately need destructive tools should
themselves be classified `destructive`. Chat-originated tasks do this
by default (a user asking via chat is implicit authorization).

### 6. Tolerant parsers are pure upside

Anywhere we parse model output (the agent loop's tool-block extractor;
the onboarding interview's directive parser), accept multiple shapes.
A model that produces canonical output passes through unchanged; a
model that decorates with prose or wraps with the wrong fence tag
gets rescued instead of erroring out. The cost is a few extra lines
of regex / fallback logic; the win is robustness across providers.

### 7. Native tool-use protocols when the provider supports them

For Anthropic and OpenAI, the runtime's LLM provider adapter uses
the native tool-use surface (`tool_use` blocks for Anthropic,
`tool_calls` for OpenAI) instead of asking the model to emit
\`\`\`tool fenced JSON in the text channel. The native paths are
strictly better: structured by the provider's training, not by our
hopes about formatting.

For providers without native tool-use (DeepSeek, xai, OpenAI-
compatible local endpoints), the fenced-text path is the universal
fallback. The agent loop accepts both.

The fenced-text path is not deprecated; it's the floor. Native paths
are the ceiling.

### 7a. Wire names for native tool-use must match `^[a-zA-Z0-9_-]+$`

Both Anthropic and OpenAI validate tool names server-side against
that pattern. Our internal names are dotted (`fs.read`,
`brain.search_shared`); the wire form replaces dots with underscores
(`fs_read`, `brain_search_shared`).

The runtime handles the translation in `src/runtime/llm/tool-spec.ts`:
`toNativeToolSpecs()` emits wire names automatically and stamps the
dotted internal name on each `NativeToolSpec.internalName`. The
agent loop translates wire -> internal when receiving native
`response.toolCalls` before dispatching. Tool authors don't have to
do anything special as long as they use the dotted convention for
internal names.

DeepSeek and other OpenAI-compatible vendors validate the name
pattern even when they don't actually wire function calling through.
A tool name that breaks Anthropic / OpenAI breaks DeepSeek too. The
runtime's wire-name translation makes this transparent.

### 8. Test on the cheap tier first

Per the user's standing memory: validate features on DeepSeek/Grok
before considering Sonnet/Opus. If a tool design works on DeepSeek
it works everywhere; if it only works on frontier Anthropic, it has
a model dependency that may surprise the operator who picked
"DeepSeek" on the picker.

### 8a. Validate against a live API call before declaring "ready"

Unit tests with a fake provider don't catch provider-side validation
errors. The native tool-use rollout in 2026-05-08 session 13 shipped
clean unit tests but every agent on the install hit a 400 on first
real call because of the dotted tool-name pattern violation. The
fix took two minutes; the production-down window was the operator's
testing time, which is the most expensive thing on the project.

Before declaring a provider-touching feature ready: trigger ONE
real `complete()` call against the cheapest configured provider.
The cost is one DeepSeek request; the value is catching every
provider-side validation issue before the operator sees it.

## Process

When adding a new baseline tool or wrapping an MCP server tool:

1. Draft the args schema. Flat by default; reach for objects only when
   the data really nests.
2. Write a description that names the args and gives an example.
3. Set the idempotency category honestly.
4. Add a smoke test that exercises the tool end-to-end with a
   scripted-provider fake (no network).
5. Run the new tool through DeepSeek as the live first test before
   considering it ready.

When tightening an existing tool that's been failing in the field:

1. Find the actual failures (supervisor.log + agent stderr).
2. Determine if the model's shape is recoverable (mis-fenced JSON,
   wrong arg name) ... if so, broaden the parser. If the model is
   genuinely outputting nonsense, broaden the description and/or
   simplify the schema.
3. If you flatten a schema, update consumers (tool execute body
   re-builds the original shape from flat args).
4. Update the corresponding shared-brain `2200-tools` note so spawned
   agents see the new arg names during orientation.

### 9. Tool names are underscored, single-token-after-namespace

Per [[../decisions/2026-05-09-canonical-tool-names]], tool names use
`namespace_verb` form throughout the runtime (`fs_read`,
`brain_search_shared`, `schedule_add`). The dotted form
(`fs.read`) is no longer the internal canonical, though the
dispatcher still accepts it as a tolerant fallback for models
that emit it from training-set memory.

Why: Anthropic and OpenAI both validate tool names server-side
against `^[a-zA-Z0-9_-]+$`; dotted names break native tool-use.
Using underscored as the canonical internal name eliminates the
"two names for the same tool" footgun where the model saw
dotted in the system prompt and underscored in the native spec.

When you author a new baseline tool: declare
`name: 'namespace_verb'`. Done.

### 10. Pair every fs_write with implicit recall, not just docs

Per [[../decisions/2026-05-09-path-discipline]], the agent loop
now tracks paths the agent writes during a task and surfaces them
on subsequent ENOENT errors. This is a runtime guardrail, not a
schema rule per se ... but worth noting here: the same pattern
("when the model needs to recall something it produced earlier in
the task, the runtime surfaces it on the failure path") is
generalizable. Tools that produce ids the model needs later
(schedule ids, notification ids, pub message ids) should consider
similar recall-on-error wiring. Documentation alone is
insufficient for working-memory recall across many turns.

## Provenance

Drafted 2026-05-08 after the schedule_add discriminated-union failure
landed Jodin in `blocked_on_detector`. The session that incident
sits in: see the supervisor.log around 2026-05-08T21:09 for the
five consecutive arg errors that tripped error_storm.

Updated 2026-05-09 with rules 9 and 10 after Antigravity's
codebase review and the Jodin path-hallucination incident.
