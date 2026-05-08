---
title: Native tool-use adapter for Anthropic and OpenAI
type: decision
status: locked
date: 2026-05-08
tags: [decision, llm, tools, providers, robustness]
linked_docs:
  - "[[../conventions/tool-schema-design]]"
  - "[[../epics/09-tool-system]]"
canonical_path: wiki/decisions/2026-05-08-native-tool-use-adapter.md
---

# Native tool-use adapter for Anthropic and OpenAI

## Context

Through Epic 14's onboarding rollout we ended up running real agents
on a mix of providers: Claude Opus on the frontier tier, DeepSeek and
xAI/Grok on the cheap tier, and intermittent OpenAI / Kimi /
OpenRouter usage. The runtime's tool-call protocol has been a single
universal text-fenced shape since Epic 2:

```
\`\`\`tool
{ "tool": "fs.read", "args": { "path": "..." } }
\`\`\`
```

The agent loop's `parseToolCalls` extracts these fenced blocks via
regex and dispatches them through the tool registry.

This works on every provider, but it has a cost on capable ones. Claude
and GPT both have native tool-use surfaces (Anthropic: `tool_use`
content blocks; OpenAI: `tool_calls` array on the message) where the
provider validates the tool name and arg schema server-side and
returns a structured object instead of a free-form text dump that we
have to parse. The fenced-text path leaves yield on the table:

- The model can mis-format the fence (we saw `}\`\`\`` with no
  newline; DeepSeek and Grok do this routinely). The strict regex
  silently misses these and the JSON ships as final text.
- The model can produce a tool-shaped JSON in the wrong fence tag
  (\`\`\`json instead of \`\`\`tool) and the regex misses it.
- Args validation only happens on our side, after the dispatcher
  receives the call. Native tool-use catches arg shape errors at the
  provider, before the request even returns to us, and the model gets
  immediate feedback in its training-shaped tool-call channel.

## Decision

Provider adapters use the provider's native tool-use surface when
present. Specifically:

- **Anthropic**: forward `tools: [{name, description, input_schema}]`
  on every `complete()` call; parse `tool_use` content blocks back
  into `response.toolCalls`.
- **OpenAI**: forward `tools: [{type: 'function', function: {name,
  description, parameters}}]` with `tool_choice: 'auto'`; parse
  `message.tool_calls` back into `response.toolCalls`.
- **DeepSeek, xAI, Kimi, OpenRouter, local Ollama**: same wire shape
  as OpenAI (since they're OpenAI-compatible). DeepSeek and xAI
  silently accept the `tools` field but don't always wire function
  calling through; the agent loop's fenced-text parser is the
  universal fallback when no `response.toolCalls` is returned.

The agent loop, on each turn:

1. Builds `NativeToolSpec[]` from the tool registry once at
   construction (via Zod 4's `z.toJSONSchema()`; no new dep).
2. Forwards the spec list on every `complete()` call.
3. Prefers `response.toolCalls` over text-fenced parsing when
   present.
4. Falls through to the existing `parseToolCalls(response.text)` and
   the tolerant `extractToolShapedJson` fallback when no native
   calls returned.

Tool names on the wire are translated from dotted internal form
(`fs.read`) to underscored wire form (`fs_read`) because Anthropic
and OpenAI both enforce `^[a-zA-Z0-9_-]+$` on tool names.
`NativeToolSpec.internalName` carries the dotted form for dispatch
back into the registry.

The fenced-text protocol is NOT deprecated. It's the floor, the
universal fallback, and what every provider supports. Native tool-use
is the ceiling.

## Alternatives considered

### A. Stay text-fenced everywhere

Cheapest. Works today. But it bakes in the failure modes of weak
models for the strong ones too: a Claude Opus running 2200 still
emits text-fenced JSON instead of structured tool calls, even
though the provider would much rather it use `tool_use`. Yields a
worse Claude experience than `claude.com` or Claude Code itself.

Rejected because the cost was demonstrable: Jodin's first orientation
on DeepSeek emitted `\`\`\`tool { ... } \`\`\`` as final-text instead
of as a tool call; the loop didn't dispatch and the brief never
reached chat. A native-tool-use Anthropic / OpenAI run would have
shipped the same content as a real `tool_use` block instead.

### B. Native tool-use only, no text-fenced fallback

Cleanest in theory. But DeepSeek and xAI (the cheap providers Doug
actually uses) have inconsistent function-calling support. xAI's
docs claim function calling; in practice their open-router-fronted
Grok 4.3 returned tool-shaped JSON in `text` instead of in
`tool_calls`. Forcing native-only would break the cheap tier.

Rejected because the project's posture is "use whichever model you
want;" forcing native breaks that.

### C. Dispatch translation in the loop, not the providers

Have providers return raw text and have the loop be smart about every
provider's response shape. Pushes provider-specific knowledge into
the loop. Rejected because the providers are the right level of
abstraction; the loop should not know which vendor it's talking to.

## Trade-offs

- **Bigger surface area on the LLMProvider abstraction.**
  CompletionRequest gains `tools?`; CompletionResponse gains
  `toolCalls?`. Manageable; both fields are optional and providers
  ignore them gracefully.
- **JSON Schema generation.** Every Zod schema runs through
  `z.toJSONSchema()` once at agent construction. Cheap but failure-
  prone if a tool author writes a Zod schema with constructs Zod 4's
  converter doesn't yet support. Mitigation: the `tool-spec.ts`
  builder warns and skips a tool whose schema can't convert; the
  agent still gets the rest of the baseline.
- **Wire-name translation.** Dotted internal names get underscored
  on the wire and translated back on response. Adds a lookup per
  dispatched call; trivially cheap.

## Consequences

### Immediate

- Anthropic Claude (any version) and OpenAI GPT-* see structured
  tool calls instead of text-fenced JSON. Tool argument validation
  happens at the provider before our dispatcher. Strictly better.
- DeepSeek/xAI continue working through the fenced-text fallback;
  no regression.
- Tool authors get JSON Schema for free from their Zod schemas.
  They don't need to hand-author per-tool schemas for the provider
  surface.

### Future

- New providers added to the registry inherit native tool-use
  automatically if they implement the OpenAI-compatible
  `tool_calls` shape (Kimi, OpenRouter, Gemini's openai-compatible
  endpoint). No per-provider work.
- Streaming tool calls (a future feature) can build on the same
  spec-list infrastructure.
- Tool registry changes (Skills, Extensions, MCP-server-backed
  tools) flow into the spec list automatically as long as they
  expose Zod schemas.

## Implementation pointers

- `src/runtime/llm/types.ts` — `NativeToolSpec`, `NativeToolCall`
  types; `tools?` and `toolCalls?` on the request/response.
- `src/runtime/llm/tool-spec.ts` — `toNativeToolSpecs()` builds the
  spec list from the registry; handles wire-name translation and
  collision detection.
- `src/runtime/llm/anthropic.ts` — forwards `tools[]`, parses
  `tool_use` blocks.
- `src/runtime/llm/openai.ts` — forwards `tools[]` +
  `tool_choice: 'auto'`, parses `message.tool_calls`.
- `src/runtime/agent/loop.ts` — builds the spec list once at
  construction; prefers `response.toolCalls` over text-fenced
  parsing; translates wire names back via the spec list.
- `src/runtime/agent/process.ts` — calls `toNativeToolSpecs()` at
  agent start and passes through to `AgentLoop`.

## Provenance

Drafted 2026-05-08 after the bug-of-the-day chain landed the
implementation cleanly. Doug locked the approach by saying "knock
them out" when offered the three-piece package (loop fix, native
adapter, convention). The bug chain itself (dotted tool name 400s
on every provider) became the primary reference for "why we test
against a live provider before shipping" in the convention.
