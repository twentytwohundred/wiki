---
title: "Decision: Skill Ingest Substrate (OC-compatible install path)"
type: decision
status: proposed
tags: [decision, skills, mcp, extensions, ingest, audit, openclaw-compat]
created: 2026-05-14
updated: 2026-05-14
linked_docs:
  - "[[02-architecture]]"
  - "[[03-epic-map]]"
  - "[[2026-05-14-claim-vs-evidence-audit]]"
canonical_path: wiki/decisions/2026-05-14-skill-ingest-substrate.md
---

# Decision: Skill Ingest Substrate

**Status:** Proposed, in flight. Implementation follows in PR #200+ on `main@d4f619a`.

## Context

The 2200 fleet's tooling week opens with one strategic question: how do operators add new capabilities to a running fleet? Two adjacent ecosystems are converging on the same answer ... a single markdown file (`SKILL.md`) with YAML frontmatter that both teaches the Agent how to use a capability AND tells the runtime how to install it.

The OpenClaw (Anthropic Claude Code) community has shipped thousands of SKILL.md files via GitHub, vanity URLs, and gists. They are the de facto standard for "drop in a capability." 2200 supporting that format directly ... without forking, without requiring upstream changes, without requiring re-authoring ... is the cleanest path to operator-friendly capability addition AND to user portability from OC.

Doug's framing: *"This is our shot at capturing market share without it being a pain for the Human to port over to us."*

## The bar

A randomly-picked OC community SKILL.md should install into 2200 with **zero modifications**. The operator's only choices at install time:

1. Paste the source URL.
2. Confirm name + description in a preview pane.
3. Supply any env values the embedded MCP server requires.
4. Pick which Agents get the capability (default: all live, non-archived Agents).

No spec coordination with the skill author is required for the capability to function. 2200-specific enrichments (the `tool_classes` audit hint) are additive ... a SKILL.md without them still installs and works; one with them produces cleaner audit output.

## What already exists (substrate inventory, 2026-05-14)

- `src/runtime/skills/registry.ts` ... filesystem-backed Skill registry at `<home>/skills/<name>/SKILL.md`. Lists with per-entry validity tolerance.
- `src/runtime/skills/types.ts` ... `SkillFrontmatterSchema` (name + description required; tags + tools optional). Body trimmed. Unknown frontmatter fields preserved as `extras` ... key extension point.
- `src/runtime/skills/install.ts` ... `installSkill({ home, source, force })` validates the SKILL.md at the source root, copies into `<home>/skills/<name>/`. `uninstallSkill` for removal.
- `src/runtime/skills/wrapper.ts` ... synthesizes an `ExtensionManifest` from a `ParsedSkill` for unified install/list semantics with full Extensions.
- `src/runtime/extensions/source.ts` ... `resolveSource(url|path)` returns a `ResolvedSource` with a local `rootDir`. GitHub repo URLs supported via `git clone`. Tarball/zip throws ("None at v1"). Single-file URLs not supported.
- `src/runtime/secrets/resolver.ts` ... resolves `SecretRef` from env / file / per-Agent vault. Vault is keyed by `(home, agent)`; SecretRef format `{ source: 'vault', id: '<credential>' or '<agent>:<credential>' }`.
- `src/runtime/identity/types.ts` ... `IdentityFrontmatterSchema` includes `mcp_servers: McpServerSpec[]` ... a discriminated union of stdio (`command + args + env`) and HTTP (`url + auth + headers`).
- `src/runtime/agent/audit/verifiers.ts` ... `*_CLASS_TOOLS` sets (FILE_CREATE, FILE_READ, EXTERNAL_SEND, etc.) drive mechanical claim verification. Closed taxonomy ... new tools slot into existing sets.

## What's missing (the v1 delta)

1. **HTTP install endpoint** wrapping `installSkill` so the web app drives ingest. CLI exists; web does not.
2. **Single-file SKILL.md URL** support in `resolveSource` (synthesize a tmpdir holding just the file).
3. **MCP block extractor** that scans the SKILL.md body for the first fenced ```json block containing `mcpServers` and parses it. The OpenPub SKILL.md publishes the install block this way; the OC community follows the same convention.
4. **Identity mutation helper** that appends an `mcp_servers[]` entry to a set of selected Identity files, atomically, with the same frontmatter discipline `applyArchiveEdit` uses.
5. **Per-Agent vault writes** at install time. Operator-supplied env values land as credentials in each selected Agent's vault; the synthesized `mcp_servers[]` entry references them via `SecretRef` with `source: 'vault'`.
6. **Install wizard UI** in `SettingsScreen` ... new "Capabilities" section. Paste-URL field, preview pane, env-form, Agent checkboxes, install button. Restart-needed pills on impacted Agents.
7. **`tool_classes` frontmatter extension** + per-Identity audit overlay map. Read at install time; merged into the audit verifier's class lookups at runtime.

## The four design decisions

### D1. Source types supported in v1

- **GitHub repo URL** ... already works via existing `resolveSource`. The majority of OC skills live on GitHub.
- **Single SKILL.md URL** ... NEW. Implementation: fetch the file, write to a fresh `mkdtemp` path as `SKILL.md`, hand the tmpdir to `installSkill` as a `ResolvedSource`. This is what makes `https://openpub.ai/skill.md` ingest in one paste.
- **Local filesystem path** ... already works via CLI; web exposes the URL form only.
- **Tarball / zip URL** ... deferred. Resolver throws today. Add when a real-world skill demands it.

### D2. MCP block extraction algorithm

The OC and OpenPub convention is a fenced ```json block in the body containing a top-level `mcpServers` object. The parser:

1. Walks the SKILL.md body line-by-line.
2. When a fence with `json` or `JSON` info-string opens, accumulates lines until the closing fence.
3. JSON-parses the captured block.
4. If the parsed value has a top-level `mcpServers` key with at least one entry, that's the install block. Stop.
5. Otherwise continue scanning. No match → no MCP install, skill is knowledge-only.

The parser is **strict on the JSON**, tolerant on **everything else around it**. If the first json block isn't the install block, the second one might be (some skills include example tool calls before the install instructions). First valid match wins.

**Preferred future path:** authors can declare an `mcp:` block in the YAML frontmatter directly:

```yaml
---
name: my-skill
description: ...
mcp:
  servers:
    foo:
      command: npx
      args: ["@foo/mcp"]
      env:
        FOO_TOKEN: { kind: secret, name: foo_token }
---
```

If `mcp:` is present in frontmatter, it wins and the body extractor is skipped. This is a 2200 spec extension we publish in `wiki/conventions/` so that any skill author who wants cleaner ingest can adopt it. **Not required.** Bodies without it install fine.

### D3. Tool class declaration for audit integration

The closed taxonomy in `src/runtime/agent/audit/verifiers.ts` decides whether a claim like "I checked into a pub" can be verified against the send-class tool log. New skill-borne tools without classification land as `unclassified` ... the audit goes silent on them rather than guessing.

The `tool_classes` frontmatter extension:

```yaml
---
name: openpub
description: ...
tool_classes:
  check_in: external_send
  check_out: external_send
  search_pubs: file_read
  get_pub_details: file_read
  whats_happening: file_read
  get_my_profile: file_read
  get_memories: file_read
  lookup_agent: file_read
  get_wallet: file_read
---
```

When present, the runtime appends each `<server>.<tool>` name to the matching `*_CLASS_TOOLS` set via a per-Identity overlay. Stored alongside the identity in a sibling file (`identity-audit-overlay.json`) so the audit substrate can look it up without re-parsing every SKILL.md on each turn.

When absent, every tool from the skill audits as unclassified ... claims involving it land as `unverified` (the conservative default the audit substrate enforces). The operator can promote tools later via a Settings action; that's a low-priority follow-up, not v1.

### D4. Per-Agent env collection UX

Many MCP servers want **per-Agent** secrets (OpenPub gives each Agent its own JWT; Slack tokens are usually shared). The SKILL.md doesn't say which is which.

v1 UX:

- Install wizard surfaces an env form **per selected Agent**.
- A "copy from first Agent" button copies the literal values down the list. Default off.
- Each Agent's vault stores its own credentials at install commit time.
- The synthesized `mcp_servers[]` entry on each Identity references the vault by name (no agent prefix in the SecretRef ... the resolver context supplies it at runtime).

Per-Agent collection is the correct default. The copy button is the escape hatch for shared-token servers without requiring a spec extension to distinguish them.

## Wire format / API surface

### HTTP

```
POST /api/v1/skills/preview
  body: { source: string }
  response: {
    name, description, body_preview,
    mcp: { servers: [{ name, transport, command|url, env_keys: [...] }] } | null,
    tool_classes: { <tool>: <class> } | null,
    source_kind: 'github' | 'file_url' | 'local',
  }

POST /api/v1/skills/install
  body: {
    source: string,
    agents: string[],         // identity slugs to install MCP server into
    secrets: {                // per-agent env values for the MCP server(s)
      [agentName]: { [serverName]: { [envKey]: string } }
    },
    force?: boolean,
  }
  response: {
    skill: { name, description, path },
    mcp_installed_for: string[],          // agent names
    requires_restart: string[],           // agent names
  }

DELETE /api/v1/skills/:name
  response: { removed: boolean, requires_restart: string[] }
```

`preview` is read-only and idempotent; it fetches and parses but does not write. The wizard uses it to populate the env form. `install` is the commit step. Preview shape is **not** versioned as a public wire contract ... it's purely web-to-runtime, change freely.

### Per-Identity audit overlay

`<home>/state/identities/<agent>/identity-audit-overlay.json`:

```json
{
  "schema_version": 1,
  "tool_classes": {
    "openpub.check_in": "external_send",
    "openpub.check_out": "external_send",
    "openpub.search_pubs": "file_read"
  },
  "source": { "skill": "openpub", "installed_at": "2026-05-14T..." }
}
```

Audit verifier loads overlays at process start (or on identity-change WS event) and merges them into the in-memory `*_CLASS_TOOLS` sets. The audit pass is per-Agent; overlays are per-Agent; no global cross-talk.

## Open trade-offs (locked)

- **Slug regex stays strict** (`^[a-z][a-z0-9-]*$`). If a skill's frontmatter name contains invalid characters, the install fails with a clear error message naming the offending character. We do not auto-sanitize ... an Agent's `invoke_skill openpub` call must match the on-disk name exactly, and silent normalization breaks that. v1.1 may surface a "rename on install" field in the wizard.
- **No conflict resolution between skills.** If two skills declare an MCP server with the same name, the second install fails. Operator renames or uninstalls one. v1.1 may add a "rename on install" prompt for MCP server names too.
- **No skill versioning at v1.** SKILL.md ecosystems don't version files. Reinstall replaces. If a skill author publishes a breaking change, the operator reinstalls and tests. v2 may track an `etag` per install for "an update is available" surfacing.
- **No skill marketplace / discovery surface** in 2200 at v1. Doug pastes a URL; he discovers them himself. Discovery is its own product question.
- **Skills stay global, MCP servers stay per-Agent.** Skills are knowledge ... every Agent can `invoke_skill <name>` if its tool deps are satisfied. The per-Agent `mcp_servers[]` is what gives a specific Agent access to the skill's tools.

## Audit substrate integration

The audit substrate locked in [[2026-05-14-claim-vs-evidence-audit]] requires no changes for this work. New tools from installed skills surface through the audit verifier's overlay-merge path; the verifier code is untouched. The kick-back loop, refusal-as-first-class, and audit_card_v1 envelope all apply automatically.

If a skill installs a tool that the audit doesn't know how to classify, the audit defaults to `unverified` on any claim mentioning it. That's the conservative-default we already locked. The `tool_classes` extension is the operator's way to promote a skill's tools into the verified path.

## What this means for tooling week

This decision doc is the substrate for everything else next week. Once it ships:

- Adding any new MCP-server-backed capability to the fleet becomes a paste-and-confirm operation. No CLI, no identity-md editing by hand, no per-agent secret juggling.
- The audit substrate auto-extends with every install. No retrofit.
- The OpenClaw skill ecosystem becomes immediately reachable by 2200 users. Portability story locks.
- Doug's 8h-autonomous-work target ([[project_eight_hour_autonomous_work_target]]) gains another lever: capabilities can land via the operator's evening review of "what skill should this agent have for the next 8h block" without dropping into the CLI.

## Implementation order

1. Source resolver: add single-file SKILL.md URL support.
2. MCP block extractor + `tool_classes` reader. Pure functions, fully unit-testable.
3. Identity mutation helper for `mcp_servers[]` append + per-Agent vault writes.
4. HTTP endpoints (`preview`, `install`, `uninstall`).
5. Audit overlay loader + verifier overlay-merge.
6. SettingsScreen Capabilities section + install wizard component.
7. End-to-end demo on `https://openpub.ai/skill.md` with hobby + simon + jodin.

Each step is unit-tested in isolation; the demo validates the integration.

## Follow-ups (out of v1 scope)

1. Tarball / zip URL source type.
2. Skill update detection (etag / last-modified diffing).
3. "Rename on install" for slug conflicts and MCP server name conflicts.
4. Operator-promotion UI for unclassified tools (Settings → skill detail → "this tool is unclassified, classify as: ...").
5. Skill marketplace / discovery surface.
6. Skill-to-skill dependency declaration (skill A imports skill B's prompt fragment).
7. `wiki/conventions/skill-md-spec.md` documenting the 2200 extensions (`mcp:` frontmatter, `tool_classes`) for upstream skill authors.

## Provenance

Decision drafted 2026-05-14 evening following session 25's claim-vs-evidence audit work. Doug's framing of "OC compatibility as our shot at market share without porting friction" sets the bar. OpenPub's published SKILL.md at `https://openpub.ai/skill.md` is the first real-world ingest target and serves as the demo gate.
