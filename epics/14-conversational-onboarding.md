---
title: "Epic 14: Conversational onboarding"
type: epic
status: draft
version: 0.1
tags: [epic, onboarding, identity, ux, launch-moment]
created: 2026-04-29
updated: 2026-04-29
linked_docs:
  - "[[03-epic-map]]"
  - "[[01-vision]]"
  - "[[04-seed-team]]"
  - "[[02-agent-runtime-minimum]]"
  - "[[05-migration]]"
  - "[[09-tool-system]]"
canonical_path: wiki/epics/14-conversational-onboarding.md
---

# Epic 14: Conversational onboarding

A normal user creates a new Agent through a conversation with 2200. The conversation produces an Identity, tool assignments, and (optionally) schedule entries. The user does not author markdown frontmatter; the system does.

This is the launch-moment epic. David ... the first Agent born on 2200 ... is created through this flow. Until 14 ships, every Agent on 2200 was authored by hand or migrated in via Epic 5; David is the first Agent who exists because a human had a 5-minute conversation with the platform.

## Phasing

Phased to land usable surfaces incrementally:

### Phase A — text/CLI-based onboarding (Phase A target)

**Scope.** A CLI command (`2200 spawn`) runs a guided conversation in the terminal: a series of clarifying questions, an LLM-driven interview pass, and a preview of the resulting Identity. The user confirms; the system creates the Agent (calls into Epic 5's migration substrate or the existing `agent create` path), recommends a starting set of tools, and offers to wire schedules.

**Done when.** A user with a working 2200 install runs `2200 spawn`, answers 5–10 questions, sees a preview of "your Agent will be named X, role Y, tools Z, schedule W," confirms, and ends up with an Agent ready to start. No manual Identity authoring.

**Includes:**
- Interview Agent: a one-shot LLM-driven conversation runner (NOT a long-lived Agent; it lives only for the duration of the spawn).
- Question script (data-driven YAML or TS) ... an ordered list of clarifying questions with branches based on stated purpose. Initial script covers the common Agent shapes: assistant Agent, project Agent, evangelist Agent, ops Agent, and a "freeform" path for users who want to describe in their own words.
- Identity generator: parses the interview transcript into the same handoff shape Epic 5 already consumes; pipes through `buildIdentityFromHandoff` for Identity creation.
- Tool recommender: maps stated purpose to a curated short-list of MCP servers from Epic 9's universe (e.g., "manage email" → suggest the Gmail MCP server with a SecretRef placeholder for the operator to fill in). Recommendations are suggestions; user can decline any of them.
- Schedule suggestions: same pattern, mapped from stated cadence ("morning briefing every weekday at 8am") to a `2200 schedule add` invocation.
- Preview surface: pretty-prints the proposed Identity, tools, and schedules to the terminal before any state is written.
- Hard-stop on confirmation: user types "yes" (or `--yes` flag for non-interactive runs) before the system writes anything.

**Out of scope for Phase A:**
- Voice input/output (Phase B; depends on Epic 13).
- Web UI variant (Phase C; depends on Epic 15).
- Mobile UI variant (Phase D; depends on Epic 16).
- Auto-running OAuth flows for tool credentials (the recommender suggests `mcp_servers[]` entries with SecretRef placeholders; the operator fills credentials in via env or file ... Phase B of Epic 9 automates).
- Multi-Agent onboarding in one session (one Agent per `2200 spawn` at v1).

### Phase B — voice variant

Same flow, voice front-end via Epic 13. The interview Agent is the same; the I/O channel changes. Defers to Epic 13 shipping.

### Phase C / D — web + mobile

The UI variants. Same Identity-generator + tool-recommender + schedule-suggester pipeline; different presentation surface. Phase A's modules are explicitly designed so the pipeline is reusable from a non-CLI context (no `console.log` calls inside the generator).

## CLI surface (Phase A)

```
2200 spawn                              # interactive conversation
2200 spawn --purpose <freeform>         # skip the early questions, go straight to elaboration
2200 spawn --from-script <path>         # replay a saved interview (testing, idempotency)
2200 spawn --yes                        # auto-confirm at the preview step (non-interactive)
2200 spawn --dry-run                    # run the interview, print the preview, do not create
```

The default invocation is `2200 spawn` ... the user names what they want, the system asks clarifying questions, and the result is a registered Agent ready to start.

## Includes

### Interview module

A pure(-ish) function that takes a question script, an LLM provider, and a user-input handle (stdin in CLI; injectable in tests/UI variants), and returns an interview transcript. The transcript is a structured object: list of `{question, answer, intent_tag}` entries, plus a final summary the LLM produces.

The script is data-driven so non-engineers (Doug, Guppi) can edit the question flow without touching code:

```yaml
# wiki/conventions/onboarding-script.md (or src-side YAML)
opening:
  text: "What kind of Agent do you want?"
  expects: free-form
branches:
  - if_match: ["email", "inbox", "messages"]
    next: email_agent_branch
  - if_match: ["project", "build", "develop"]
    next: project_agent_branch
  - default: freeform_branch

email_agent_branch:
  questions:
    - "Which email account should this Agent watch?"
    - "What should it do with incoming email by default — triage, summarize, draft replies?"
    - "Quiet hours? When should it not interrupt you?"
  ...
```

The script lives in `src/runtime/onboarding/scripts/` as YAML or TS; the convention doc documents the format for non-engineers.

### Identity generator

Takes the interview transcript, produces a HandoffDocument-shaped intermediate (Epic 5's schema), and pipes through `buildIdentityFromHandoff` to get the final IdentityFrontmatter + body.

The interview body becomes the continuity-from-onboarding brain note (parallel to Epic 5's continuity-from-migration). The Agent's first context inside 2200 is the conversation that brought it into existence.

### Tool recommender

A small mapping module (`src/runtime/onboarding/tool-suggestions.ts`) that takes interview tags (e.g., `purpose: email`) and returns suggested `mcp_servers[]` entries with placeholder SecretRefs. The operator-facing preview shows: "Suggested tools: gmail (you will need to provide GITHUB_TOKEN), calendar (you will need a Google service account)."

The recommendations are advisory. The user can drop any of them at the preview step.

### Schedule suggester

Maps interview tags (e.g., `cadence: morning_briefing`) to ScheduleStore entries. Same advisory pattern: shown in preview, user can drop or edit.

### Preview surface

Renders the proposed Identity in the terminal as a structured summary. Example:

```
Proposed Agent: emma
  Role:        email assistant
  Model:       frontier (anthropic/claude-opus-4-7)
  Notification: passive, normal, important
  Cost cap:    $25/day
  Tools:
    - gmail.* (suggests @modelcontextprotocol/server-gmail; needs GMAIL_TOKEN_EMMA env var)
    - calendar.read (suggests @modelcontextprotocol/server-google-calendar; needs GCAL_SA_PATH file)
  Schedules:
    - daily 08:00 UTC: "morning briefing"
  Brain:       empty (will accumulate)

Confirm? [y/N]
```

User types `y`, the system runs `agent create` + writes the Identity + spawns the Agent. User types `n`, nothing is written.

## Files (Phase A)

```
src/runtime/onboarding/
├── interview.ts          # runs the question script against an LLM provider
├── transcript.ts         # transcript type + helpers
├── script-loader.ts      # parses YAML/TS scripts
├── tool-suggestions.ts   # interview tags → mcp_servers[] suggestions
├── schedule-suggestions.ts  # interview tags → schedule entries
├── identity-from-interview.ts  # transcript → HandoffDocument (then through Epic 5 builder)
├── preview.ts            # pretty-prints the proposed Identity
└── scripts/
    └── default-v1.yaml   # the canonical question script

src/cli/main.ts           # add `spawn` subcommand

tests/runtime/onboarding/
├── interview.test.ts
├── identity-from-interview.test.ts
├── tool-suggestions.test.ts
├── schedule-suggestions.test.ts
└── preview.test.ts
```

## What this does NOT do

- Multi-turn negotiation. The interview is structured: questions in order, answers captured, system summarizes. It is not a free-flow conversation. The freeform branch admits open prose; the other branches lead with structure.
- Auto-OAuth. Phase A surfaces "you will need GITHUB_TOKEN_EMMA" in the preview; the operator wires the env var manually before starting the Agent. Phase B of Epic 9 automates the OAuth dance.
- Spawn for someone else. Phase A spawns Agents for the local user. Multi-tenant onboarding (managed-service users spawning their own Agents) is the same flow; Epic 17 handles the tenancy layer.
- Edit-in-place after spawn. Once the Agent is created, future edits go through Identity-file editing (open the file, change values, restart the Agent). A future "edit Agent via conversation" flow is post-v1.

## Dependencies

- Epic 2 (supervisor, Identity loader, schema versioning) ... shipped.
- Epic 4.5 (LLM provider registry) ... shipped. The interview Agent uses the operator's already-configured LLM provider.
- Epic 5 (migration / Identity-from-handoff builder) ... shipped. Phase A reuses `buildIdentityFromHandoff`.
- Epic 6 (scheduler) ... shipped. Schedule suggestions wire to existing CLI.
- Epic 9 Phase A (tool system) ... shipped. Tool recommender suggests `mcp_servers[]` entries the existing runtime spawns.

No new external dependencies for Phase A.

## Hobby's first integration

The interview script's curated mappings (purpose → tools, cadence → schedule) need a real-world test. Hobby spawns a "test agent" via `2200 spawn`, runs through the email flow, and sanity-checks the resulting Identity against what an experienced operator would have authored by hand. Discrepancies become script revisions; ship after parity.

## Open product calls (Phase A)

Three to flag for Doug before locking:

- **Question script format: YAML vs TS.** YAML is editable by non-engineers (Doug, Guppi). TS is type-safe and IDE-friendly. Recommendation: YAML with Zod validation at load time. Easier for Doug to iterate on the question flow without code changes.

- **Tool suggestions: curated list vs LLM-generated.** A curated list (purpose → mcp_servers[]) is predictable and auditable; an LLM-generated suggestion uses the interview transcript to dynamically pick. Recommendation: curated list at v1, LLM augmentation post-v1. Predictability matters during the launch window.

- **Confirmation default.** The preview asks `[y/N]` (default no) ... destructive operations should default to "no." But the friction of typing `y` matters for first-time-user UX. Recommendation: default `[y/N]` (default no); add a `--yes` flag for repeat users / scripted runs / tests.

## Upgrade-readiness

| Discipline | Approach |
|-----------|----------|
| Schema versioning | Interview transcripts carry an `interview_schema_version: 1` so the format can evolve. |
| State on disk | Transcript is preserved as a brain note (`continuity-from-onboarding`) so the operator + the Agent can re-read what was decided and why. |
| Restart safety | The spawn flow is one-shot; if interrupted mid-interview, no state is written (interview-in-progress is in-memory only). After confirmation + creation, recovery is the same as any Agent's. |
| Tool-call inspectability | The interview Agent uses the standard LLM provider + tool dispatcher; calls are logged via the existing telemetry path. |
| Inspectable persisted artifacts | Identity is markdown. Continuity note is markdown. Suggested mcp_servers entries are visible in the Identity file (same shape as a hand-authored entry). |

## Format provenance

Spec drafted by Hobby, 2026-04-29 evening, after Epic 9 Phase A landed. Builds entirely on substrate already on `main`. Implementation begins on `epic-14/onboarding-substrate` once the three open product calls above are signed off.

---

*Phase A scope locks once Doug signs off on the open product calls. Phases B–D sketched for sequencing.*
