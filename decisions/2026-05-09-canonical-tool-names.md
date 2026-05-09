---
title: Canonical underscored tool names
type: decision
status: locked
date: 2026-05-09
tags: [decision, tools, llm, naming, canonical]
linked_docs:
  - "[[2026-05-08-native-tool-use-adapter]]"
  - "[[../conventions/tool-schema-design]]"
  - "[[../handoffs/hobby/2026-05-09]]"
canonical_path: wiki/decisions/2026-05-09-canonical-tool-names.md
---

# Canonical underscored tool names

## Context

PR #178 (session 13) shipped native tool-use adapters for Anthropic
and OpenAI. Both providers validate tool names against
`^[a-zA-Z0-9_-]+$`. Our internal tool names were dotted
(`fs.read`, `brain.search_shared`, `schedule.add`), so the rollout
introduced a translation layer: dotted internal name → underscored
wire name on the way out, underscored wire name → dotted internal
name on the way back.

This worked. But the model saw two names for the same tool:
the dotted form in the system prompt's tool descriptions, and the
underscored form in Anthropic's `tools[].input_schema.name` /
OpenAI's `tools[].function.name`. Models that fell back to fenced
text emitted whichever name caught last in their attention. Some
calls used `fs.read`, some used `fs_read`. The dispatcher needed a
tolerant fallback to translate either form.

Antigravity's codebase review flagged this as a footgun: "Two
names for the same tool" is a class of bug, not an instance.

## Decision

Standardize on underscored names everywhere internally. Drop the
dotted form. Wire name == internal name.

- All baseline tool definitions use underscored `name:` fields:
  `fs_read`, `brain_search_shared`, `schedule_add`. 34 tools.
- `BASELINE_TOOL_NAMES` list, system prompts, persona blocks, the
  `2200-tools` shared-brain reference, conventions docs, example
  identities, and ~40 tests all updated.
- `createInProcessServer` prefix check requires `<name>_` (was
  `<name>.`). Server name is the namespace prefix.
- `expandToolGrants` accepts both modern (`github_*`) and legacy
  (`github.*`) wildcard forms so older Identity files still parse.
- Identity schema's `ToolNameSchema` regex accepts both separators
  (`<ns>_<verb>` and `<ns>.<verb>`) for backward compat with
  hand-authored Identity files from before this change.
- `NativeToolSpec.internalName` is dropped (no longer needed; one
  canonical name).
- `tool-spec.ts`'s `toWireName` translator is dropped.
- The dispatcher's lookup is tolerant: if the requested name
  doesn't resolve, it tries replacing the first dot with an
  underscore. Catches models that emit dotted form despite seeing
  only underscored in the spec.

## Why this rather than keep the translation

Two names for the same tool is the failure shape. The
translation logic was correct; the problem was the model not
knowing which name was canonical. Eliminating the translation
eliminates the ambiguity at the source.

The reviewer's specific call: "If providers demand
`^[a-zA-Z0-9_-]+$`, make that the canonical internal name too.
Renaming `fs.read` to `fs_read` internally is a one-time migration
that eliminates mapping logic, avoids name collisions, and scales
effortlessly to 50+ tools and 5 providers."

Lived experience confirmed: today's Studio outage came from the
model getting two names for the same tool and emitting the wrong
one in fenced text. With one canonical name, that failure mode
collapses.

## Trade-offs

- **Identity grants in the wild may use dotted form.** Older
  hand-authored Identity files may declare `tools: ['fs.read', 'github.*']`.
  Both the schema regex and `expandToolGrants` accept either
  form, so older Identities still parse correctly. New Identities
  can use either; canonical recommendation is underscored.
- **Telemetry / log records carry whatever name was on the call.**
  Older plan/run/perm records reference dotted names. Records are
  historical; not a concern for live behavior.
- **Tooling-as-text anywhere outside the runtime** (operator
  scripts, external integrations) may still reference the dotted
  form. Wildcard expansion + dispatcher tolerance covers most
  cases.
- **The dispatcher's tolerant lookup adds a single extra registry
  read on the miss path.** Cheap; only fires when the model
  emitted the wrong form. No-op on the canonical path.

## Consequences

### Immediate

- One canonical name per tool, everywhere.
- The native tool-use adapters in PRs #178 / #181 simplify: no
  translation layer.
- The `2200-tools` shared-brain reference matches what the model
  sees in its native tool spec.
- 1264 unit tests updated; 0 regressions.

### Future

- Adding a new baseline tool: just declare `name: 'namespace_verb'`.
  No translation table to update.
- Identity files going forward should use the underscored form
  consistently; legacy dotted entries continue to work via the
  acceptance regex.
- The dispatcher's dotted-name fallback can be removed in a future
  cleanup once we have evidence that no model emits the dotted
  form anymore.

## Implementation pointers

- `src/runtime/tools/baseline/*.ts` ... every tool's `name:` field.
- `src/runtime/tools/baseline/index.ts` ... BASELINE_TOOL_NAMES list.
- `src/runtime/identity/types.ts` ... ToolNameSchema accepts both
  separators.
- `src/runtime/mcp/tool-grants.ts` ... wildcard expansion handles
  both forms.
- `src/runtime/mcp/server.ts` ... server-prefix check requires `_`.
- `src/runtime/llm/tool-spec.ts` ... drop translation; emit names
  directly.
- `src/runtime/llm/types.ts` ... drop `internalName` field on
  `NativeToolSpec`.
- `src/runtime/tools/dispatcher.ts` ... inline tolerant fallback
  for legacy dotted form.

## Provenance

Antigravity codebase review on 2026-05-09 (item #3, "The
nativeToolSpecs Naming Footgun"). Implementation in PR #181 the
same day. Locked.
