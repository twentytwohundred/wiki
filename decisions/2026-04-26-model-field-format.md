---
title: 'Decision: Model field format on plan records (and Identity bindings)'
type: decision
status: locked
tags: [decision, schema, model-binding, plan-record, epic-2, epic-10]
created: 2026-04-26
updated: 2026-04-26
linked_docs:
  - '[[02-agent-runtime-minimum]]'
  - '[[2026-04-25-tool-baseline]]'
  - '[[2026-04-24-baseline-model-tier]]'
  - '[[03-epic-map]]'
canonical_path: wiki/decisions/2026-04-26-model-field-format.md
---

# Decision: Model field format on plan records (and Identity bindings)

## Context

The plan record schema in [[02-agent-runtime-minimum]] introduces a `model` field that names the LLM that produced the plan. The Epic 2 spec showed three example values in three different naming conventions: `"claude-opus-4-7"`, `"deepseek-v4-pro"`, `"gemma-4-26b-moe-local"`. No prefix, no shape, no consistent separator.

The model lifecycle epic (Epic 10) will build queries on top of this field: "show me all plans produced by Anthropic models," "compare plan quality across providers," "audit which Agent ran on which provider during the period of the incident." Without a locked format, those queries become string-matching gymnastics. With a locked format, they are simple structural reads.

Doug's Epic 2 review surfaced this before any plan record shipped. Lock the format now while the cost is one find-and-replace.

## Decision

**Every model identifier uses the form `<provider>/<model_id>`.**

- Provider prefix is mandatory.
- Provider is lowercase, alphanumeric (no spaces, no slashes).
- model_id is lowercase, dashes for word separation. Whatever the provider calls the model, normalized to lowercase with dashes.
- Forward slash separator. One slash, one provider, one model_id.

### Examples

| Provider | model_id | Combined |
|---|---|---|
| anthropic | claude-opus-4-7 | `anthropic/claude-opus-4-7` |
| anthropic | claude-sonnet-4-6 | `anthropic/claude-sonnet-4-6` |
| anthropic | claude-haiku-4-5 | `anthropic/claude-haiku-4-5` |
| openai | gpt-5-4 | `openai/gpt-5-4` |
| deepseek | v4-pro | `deepseek/v4-pro` |
| minimax | m2-7 | `minimax/m2-7` |
| moonshot | k2-3 | `moonshot/k2-3` |
| local | gemma-4-26b-moe | `local/gemma-4-26b-moe` |
| user | acme-internal-v3 | `user/acme-internal-v3` |

### Reserved providers

- `local` — locally-hosted model, runtime resolves which (Ollama, llama.cpp, MLX, etc.).
- `user` — user-defined endpoint pointed at via `provider_secret`. The model_id is whatever the user labels their custom endpoint as.

Other provider prefixes match the SDK / vendor name (`anthropic`, `openai`, `deepseek`, `minimax`, `moonshot`, etc.).

### Validation regex

```
^[a-z0-9]+\/[a-z0-9-]+$
```

Lowercase alphanumeric provider, slash, lowercase alphanumeric or dash model_id. Strict. Mismatches reject at the validator boundary.

### Where the format applies

- The `model` field on plan records (Epic 2 plan record schema).
- The `model.provider` and `model.model_id` fields on Identity files (Epic 2 Identity loader). The Identity carries the two pieces separately for clarity and the runtime composes them when emitting plans.
- Any future telemetry, audit log, or billing record that references a model.

## Consequences

### What gets better

1. **Queryable provider.** "Show me all plans by Anthropic models" is `WHERE model LIKE 'anthropic/%'` (or the structural equivalent in any storage). No string-matching tricks needed.
2. **Cross-model drift analysis at Epic 10.** When the model lifecycle epic compares plan quality across providers and across versions of the same provider's model, the parsing is trivial because every record has the same shape.
3. **No collision with provider naming idiosyncrasies.** Different providers use different conventions (`gpt-5-4` vs `claude-opus-4-7` vs `v4-pro`). The slash separator + provider prefix means we can carry each one as the provider names it without losing the queryable provenance.
4. **Identity files become introspectable.** Listing the providers in use across an instance is a `SELECT DISTINCT provider FROM identities` (or grep-equivalent), not a per-Identity special-case parse.
5. **Future-proof for provider rotation.** When a user moves an Agent from `anthropic/claude-opus-4-7` to `openai/gpt-5-4`, the change is unambiguous. No "wait, was 'opus-4-7' Anthropic or someone else?"

### What could get worse

1. **The format is a contract.** Renaming a provider (`openai` → `oai`) breaks every existing record. Mitigation: providers are listed in a registry; renames go through a migrator (`migrators/<from>-to-<to>.ts` per [[2026-04-26-schema-version-format]]) that rewrites the prefix in any existing records.
2. **No room for sub-provider routing in the field itself.** If we ever route across regions (`anthropic-us` vs `anthropic-eu`) the field shape does not capture it. Acceptable: routing is a separate concern; the model field captures provider+model identity, not deployment topology.
3. **Provider names will drift over time.** `openai`, `anthropic`, etc. are reasonable now but vendors merge, rebrand, get acquired. We accept that the locked names match the vendor's identity at the time of adoption; renames happen via migrators.

## Implementation guidance

### Spec text

The Epic 2 spec gets updated alongside this decision. Plan record examples use `<provider>/<model_id>` form. Identity schema example shows `model.provider` and `model.model_id` separated, with the runtime composing them.

### Code (when the plan record wrapping ships)

- Define a shared `ModelIdSchema = z.string().regex(/^[a-z0-9]+\/[a-z0-9-]+$/)` in the protocol or shared types.
- Use it in the plan record schema.
- Use it in the Identity loader's model binding section.
- Reject mismatches at the validator boundary; the JSON-RPC layer surfaces a clear `INVALID_PARAMS`.

### Provider registry (when Epic 10 lands)

Epic 10 (model lifecycle) maintains a registry of known providers and the SDK / endpoint each maps to. The registry keys are the provider prefixes used in this format. New providers register by adding to the registry; the format itself does not change.

## License posture

Convention only. No code lift.

## References

- [[02-agent-runtime-minimum]] (plan record schema; gets updated alongside this decision)
- [[2026-04-25-tool-baseline]] (plan record `model` field origin)
- [[2026-04-24-baseline-model-tier]] (model tier framing)
- [[2026-04-26-schema-version-format]] (sibling decision: integer schema versions)
- [[03-epic-map]] Epic 10 (model lifecycle, the eventual heavy consumer of this field)

## Format provenance

Decision recorded by Hobby on 2026-04-26 in response to Doug's Epic 2 review. Locked before any plan record shipped to disk; format is now stable from v1 of the wrapping forward.

---

*Decision recorded by Hobby and Doug, 2026-04-26.*
