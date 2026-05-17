---
title: "Epic 14: Conversational onboarding"
type: epic
status: locked
version: 1.0
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
- Starter-inference path for Tier 2 / Tier 3 users. Phase A assumes the operator has wired LLM API keys before running `2200 spawn`. Per [[../decisions/2026-05-05-managed-service]] § Starter access, hosted Tier 2 users spawn their first Agent against the platform-provided DeepSeek V4-Flash via the proxy without bringing their own keys; once the unstated allowance is exhausted, the spawn flow prompts to add keys or upgrade to Tier 3. Tier 1 self-host onboarding is unchanged (the user must wire keys first; appropriate for the power-user audience and eliminates the abuse surface). The starter-inference path is its own sub-epic (Epic 17, not Epic 14).
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

## Locked decisions (Phase A)

Doug signed off 2026-04-29:

- **Question script format: YAML with Zod validation at load time.** Non-engineers (Doug, Guppi) edit the question flow without code changes. The script lives in `src/runtime/onboarding/scripts/default-v1.yaml` (or similar); a small Zod schema at the loader catches malformed scripts at boot rather than mid-conversation.

- **Tool suggestions: curated list at v1; LLM-augmentation post-v1.** A static mapping (`purpose-tag → mcp_servers[] template`) is predictable and auditable during the launch window. Operators see the same suggestions for the same answers, which makes onboarding debuggable. Post-v1 polish can let the LLM enrich the suggestions (e.g., refine arg flags or suggest additional tools based on free-form context).

- **Confirmation default: `[y/N]` (default no), with a `--yes` flag.** Destructive operations default to no. The `--yes` flag exists for repeat users, scripted runs, and tests. Onboarding is a one-shot operation where reading the preview before confirming is the entire point ... defaulting to yes would erode the safety the preview provides.

## Upgrade-readiness

| Discipline | Approach |
|-----------|----------|
| Schema versioning | Interview transcripts carry an `interview_schema_version: 1` so the format can evolve. |
| State on disk | Transcript is preserved as a brain note (`continuity-from-onboarding`) so the operator + the Agent can re-read what was decided and why. |
| Restart safety | The spawn flow is one-shot; if interrupted mid-interview, no state is written (interview-in-progress is in-memory only). After confirmation + creation, recovery is the same as any Agent's. |
| Tool-call inspectability | The interview Agent uses the standard LLM provider + tool dispatcher; calls are logged via the existing telemetry path. |
| Inspectable persisted artifacts | Identity is markdown. Continuity note is markdown. Suggested mcp_servers entries are visible in the Identity file (same shape as a hand-authored entry). |

## Format provenance

Spec drafted by Hobby, 2026-04-29 evening, after Epic 9 Phase A landed. Doug locked the three open product calls the same day; status moved from draft to locked. Builds entirely on substrate already on `main`. Implementation begins on `epic-14/onboarding-substrate`.

---

*Phase A scope locked. Phases B–D sketched for sequencing.*

## Phase F (parked 2026-05-17): Hiring-manager tone + Capability Catalog

Captured after David's first build against Qwen 3 30B exposed two follow-on gaps. Picking up next session.

### Part 1 ... interview tone

The LLM-driven planner currently asks "What kind of Agent do you want to spawn?" and follows up with the model's choice of next question. It works but feels formal / checklist-y. The framing Doug wants is closer to a hiring-manager interview: the operator is describing the ideal candidate they want to add to their team, the planner is curious and follow-up-driven rather than scripted.

Implementation surface:
- Rewrite the planner system prompt in `src/runtime/onboarding/session.ts` (around lines 290-330 where `provider.complete()` drives question generation). New framing: "You are a hiring manager interviewing a stakeholder about the ideal employee they want to add to their team."
- Rewrite the opening seed: "Tell me about the Agent you want to bring on. What do you need this person to be good at?"
- Keep the JSON output shape (index/total/question) so the web client does not need to change.
- Test on multiple models (DeepSeek, Qwen 3 30B, Llama 3.3 70B). Smaller models may need a tighter constraint to stay on-shape.

### Part 2 ... Capability Catalog

Bigger initiative. Lets the operator say (or have the Agent infer) what integrations the Agent needs, then walks them through obtaining the credentials post-spawn.

**Shape:**

- **Catalog format.** One entry per integration at `wiki/catalog/capabilities/<id>.md` (or a single JSON manifest, TBD). Each entry declares:
  - `id`, `label`, `description`
  - `credentials_required`: list of `{ name, kind: 'http_bearer' | 'oauth' | 'api_key' | ..., scope?, env_var? }`
  - `acquisition`: step-by-step prose with the provider's dashboard URL, exact click paths, screenshots if useful
  - `unlocks`: which tools / skills become functional once the credentials are sealed
  - `tags`: for capability-suggestion matching (email, calendar, music, dev, observability, ...)
- **Onboarding integration.** The LLM-driven interview's preview phase already surfaces `OnboardingToolSuggestion[]`; extend that to `OnboardingCapabilitySuggestion[]` driven by catalog tags. Operator sees checkboxes for inferred-needed capabilities and can add/remove.
- **Post-spawn walkthrough.** The new Agent's first action after spawn is to walk the operator through the chosen-but-not-yet-provisioned credentials, one at a time. Each one uses `credential_request` (the substrate is already there) plus the catalog entry's acquisition steps rendered inline in chat. Agent confirms each cred lands in vault before moving to the next.
- **Catalog content.** ~30-50 seed entries: Gmail, Calendar, Drive, Contacts, Tasks, Slack, Discord, Spotify, GitHub, Notion, Linear, Stripe, Twilio, OpenAI, Anthropic, AWS, Cloudflare, Vercel, Supabase, Postgres, ... The bulk of this content can be lifted from OpenClaw's integration catalogs (Doug's prior project). Translation pass to fit 2200's format is the bigger time cost.

**Sequencing for next session:**

1. Land the tone-fix pass (Part 1) ... small, doable in one sitting.
2. Decide catalog format (markdown-with-frontmatter vs JSON manifest) and write one seed entry by hand to feel the shape.
3. Schedule a session to dig the OpenClaw source and pull / translate the integration content.
4. Wire onboarding's preview + post-spawn walkthrough to consume the catalog.

**Open questions for Phase F:**

- Should the LLM be allowed to suggest capabilities NOT in the catalog, with a fallback "we do not have a walkthrough for this yet" message? Or strict catalog-only?
- Where in the post-spawn flow do credentials get pulled? Right at first chat opening (forced)? Lazy on first tool use that requires it? Configurable?
- Multi-Agent share of credentials (e.g., one Google OAuth across the fleet) vs strict per-Agent vault. v1 of the credential substrate is per-Agent; multi-Agent share is a separate epic.

**Format provenance:** Captured by Hobby 2026-05-17 after Doug raised the tone + catalog issues during David's first build against Qwen 3 30B. Substantive design conversation deferred to next session.
