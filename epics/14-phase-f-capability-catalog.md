---
title: "Epic 14 Phase F: Capability Catalog (full inventory + attack plan)"
type: epic-subdoc
parent: "[[14-conversational-onboarding]]"
status: draft (awaiting Doug review)
version: 0.1
tags: [epic, onboarding, capability-catalog, attack-plan]
created: 2026-05-18
updated: 2026-05-18
canonical_path: wiki/epics/14-phase-f-capability-catalog.md
---

# Epic 14 Phase F: Capability Catalog ... full inventory + attack plan

Working doc. The EVERYTHING brain dump for Phase F. Each numbered section below is a self-contained unit of work; we knock them down one at a time. Nothing here is shipped yet.

This doc supersedes the parked Phase F sketch at the bottom of [[14-conversational-onboarding]]. That sketch was four paragraphs; this one is the full surface.

Survey of the OpenClaw source (the prior-art catalog Doug wrote pre-2200) ran 2026-05-18 evening. Findings inline below. OpenClaw is MIT licensed © 2025 Peter Steinberger; lift is permitted with attribution.

---

## 0. What we're building

A **Capability** is the unit of integration an operator says yes/no to during onboarding. One Capability typically bundles:

- The credentials needed (one or more, with auth type)
- The tools/skills/extensions/providers that become functional once those credentials are sealed
- A human-friendly setup walkthrough (prose with the provider's dashboard URL + click path)
- Tag metadata so the LLM-driven interview can map "watches my email" → Gmail without hardcoding

The catalog is the corpus of all known Capabilities. At v1 we expect ~30-50 entries. Onboarding surfaces a subset to the operator at the preview step; the new Agent walks them through the chosen-but-not-yet-provisioned credentials at first chat after spawn.

---

## 0a. Open product calls (resolve BEFORE knocking sections down)

Five calls. My recommendation next to each; replace with Doug's call.

| # | Call | Hobby recommended | Doug locked 2026-05-18 |
|---|------|-------------------|------------------------|
| 1 | Catalog format | markdown-with-frontmatter, one file per Capability under `wiki/catalog/capabilities/<id>.md`; frontmatter is the structured query surface, body is the acquisition prose rendered inline into chat. Matches `skill.md` shape Poe uses. | **Locked.** |
| 2 | LLM off-catalog suggestions | strict catalog-only at v1. Off-catalog asks get "we don't have a walkthrough for that yet, the Agent can still work without it" + log to catalog-gap tracker for later filling. | **Locked.** Off-catalog asks render *"we can add a walkthrough for that later ... want me to file a gap?"* with a logged catalog-gap entry. |
| 3 | When credentials are pulled post-spawn | forced walkthrough at first chat open; new Agent leads with "I need these things to do my job, let's set them up together." Lazy-on-first-tool-use creates confusing mid-task interrupts. | **Locked.** |
| 4 | Multi-Agent credential share | out of scope; per-Agent vault for Phase F. Walkthrough surfaces the limitation in prose ("if another Agent on this instance already has these, you'll be asked again for now"). Cross-Agent share is a separate credential-substrate epic. | **Locked.** |
| 5 | Multi-service Capability bundling | One Capability per OAuth scope-set, not per service. `google-workspace` is ONE Capability that unlocks Gmail + Calendar + Drive + Contacts + Tasks (one OAuth, one client_secret, five service surfaces). Same for Microsoft 365. Splitting into five separate Capabilities multiplies onboarding friction. | **Locked.** Operator UI gets sub-toggles in the preview: one master checkbox + per-service checkboxes (Gmail, Calendar, Drive, Contacts, Tasks), all default-on. Operator unticks what they don't want; Identity gets filtered `unlocks.tools[]` / `unlocks.skills[]` lists. See §7 sub-toggles note; ships AFTER task-7 baseline preview integration. |

---

## 1. Capability schema (frontmatter format)

Proposed shape, one file per Capability at `wiki/catalog/capabilities/<id>.md`:

```yaml
---
id: gmail                                   # slug, unique
label: Gmail                                # human display
category: email                             # see §3 categories
description: Read, label, draft, and send Gmail or Workspace mail.   # ≤60 chars, single sentence, ends with period, no marketing words
homepage: https://gmail.com
publisher: first-party                      # one of: first-party | local | <publisher-id-string>
auth:
  - name: GOOGLE_WORKSPACE_OAUTH            # canonical credential id
    kind: oauth                             # one of: api_key | oauth | http_bearer | basic | webhook_secret | service_account | local_permission | none
    scopes:                                 # OAuth scopes (omit for non-oauth)
      - https://www.googleapis.com/auth/gmail.modify
      - https://www.googleapis.com/auth/gmail.send
    env_var: GOOGLE_WORKSPACE_OAUTH_REF     # name used in the vault/SecretRef
    obtain_url: https://console.cloud.google.com/apis/credentials
unlocks:
  tools: [gmail_search, gmail_get, gmail_draft, gmail_send, gmail_label]
  skills: [gmail-triage]
  extensions: []                            # connector extensions (gateways), if any
  providers: []                             # LLM providers, if any
network_egress:
  domains:                                  # v1: declared but not enforced; future enforcement layer reads this field
    - www.googleapis.com
    - accounts.google.com
    - oauth2.googleapis.com
tags: [email, inbox, gmail, workspace, triage, drafts, send]
requires:
  bins: []                                  # binaries that must exist on PATH
  os: []                                    # darwin | linux | windows, empty = all
  capabilities: [google-workspace-oauth]    # other Capabilities this depends on
walkthrough:
  estimated_minutes: 8
  difficulty: medium                        # easy | medium | hard
source:
  attribution: openclaw                     # openclaw | original | other
  openclaw_path: docs/channels/...md        # for audit
---

# Setup walkthrough

(body is the acquisition prose ... numbered steps, links, screenshots if any.
Rendered verbatim into the Agent's chat when it walks the operator through this Capability.)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/...)
2. ...
```

**Zod schema lives at:** `src/runtime/onboarding/capability-schema.ts`. Validates at boot, not mid-conversation. Loader caches parsed entries; hot-reload in dev.

**Why markdown-with-frontmatter (not JSON):**
- Acquisition prose is multi-paragraph with links and code blocks; markdown native.
- Non-engineers (Doug, Guppi) can edit without touching JSON.
- Matches OpenPub `skill.md` shape Poe uses.
- Public-wiki visibility is fine.

**Trust + security fields.** `publisher`, `network_egress`, and the `capability_id` binding on sealed credentials (recorded on `CredentialRequest` at seal time, see §8 walkthrough-runner) are forward-compat primitives from the [[../decisions/2026-05-18-capability-security-model]] decision. v1 ships the fields with defaults (`publisher: first-party`, `network_egress.domains: unrestricted` when omitted, `capability_id` populated by the walkthrough runner when active). v1 enforces none of them. The future External-Publisher Epic adds enforcement without retrofitting existing entries.

**Description hardline.** `description` is one sentence, ≤60 characters, ends with a period, no marketing words ("amazing," "powerful," "seamless," "delightful," etc.). The Zod schema rejects malformed entries at load. The description is the picker's prompt budget; treating it as a moderation surface keeps the catalog dense across hundreds of entries. If a real Capability cannot fit its purpose in 60 characters, the description needs to tighten, not the schema. (Pattern borrowed from Hermes's skill-description discipline; see [[../decisions/2026-05-18-hermes-deep-dive]] §6a.)

**Non-overridable provider-env blocklist (substrate-level).** A code-level constant `_PROVIDER_ENV_BLOCKLIST` declared at the substrate (not at the Capability frontmatter) lists environment variable names that no Capability's `auth.env_var` may shadow. Default contents: every host LLM provider key (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `XAI_API_KEY`, `GEMINI_API_KEY`, etc.) plus 2200's own service tokens (supervisor pub auth, OpenSCUT minter token, etc.). Zod refines `auth.env_var` to reject at load time if the name appears in the blocklist; the Capability cannot opt out via frontmatter. Pattern borrowed from Hermes's `_HERMES_PROVIDER_ENV_BLOCKLIST` (response to GHSA-rhgp-j443-p4rf, the real-world incident where a skill registered `ANTHROPIC_TOKEN` as passthrough and received the host's credential). Enforcement on credential reads at runtime (M3 from [[../decisions/2026-05-18-capability-security-model]]) lands in the External-Publisher Epic; the schema-level rejection at Capability load ships in Phase F so the substrate is sound from day one.

---

## 2. Loader, suggestion logic, and runtime wiring

Files to add/touch:

```
src/runtime/onboarding/
├── capability-schema.ts        # Zod schema, types
├── capability-loader.ts        # walks wiki/catalog/capabilities/, parses + validates
├── capability-suggest.ts       # interview transcript tags → Capability[] matches
├── session.ts                  # extend to surface OnboardingCapabilitySuggestion[]
└── walkthrough-runner.ts       # post-spawn walkthrough orchestration

src/runtime/llm/system-prompt.ts  # extend so new Agent's first-chat prompt includes walkthrough script

tests/runtime/onboarding/
├── capability-loader.test.ts
├── capability-suggest.test.ts
└── walkthrough-runner.test.ts
```

**Suggestion logic:** simple tag overlap at v1. Interview transcript already has `intent_tag` per question (Phase A built this). Suggest = Capabilities whose tags overlap interview tags, ranked by overlap count, deduped by id. No LLM-driven enrichment at v1 (per §0a decision 2).

**Catalog location resolution:**
- Default: `wiki/catalog/capabilities/` in the install's wiki repo (the public catalog).
- Override: `~/.2200/catalog/capabilities/` for per-operator additions (private extensions).
- Loader merges; per-operator entries override public ones by id with a logged warning.

---

## 3. Categories

Top-level taxonomy. Used for the picker grouping and for the `category:` frontmatter field. One Capability lives in exactly one category.

1. **email** ... Gmail, Outlook, IMAP/Himalaya, Fastmail
2. **calendar** ... Google Calendar, Outlook Calendar, iCal, Cal.com, Calendly
3. **chat** ... Discord, Slack, Telegram, WhatsApp, iMessage (BlueBubbles), Signal, Matrix, MS Teams, Google Chat
4. **voice-telephony** ... Twilio, Telnyx, Plivo, ngrok (tunnel dep)
5. **dev-code** ... GitHub, GitLab, Bitbucket
6. **dev-deploy** ... Vercel, Netlify, Fly, Render, Cloudflare, Heroku
7. **dev-issues** ... Linear, Jira, GitHub Issues (same as dev-code OAuth)
8. **dev-observability** ... Sentry, Datadog, PagerDuty, Better Stack, Honeycomb
9. **productivity-notes** ... Notion, Obsidian, Apple Notes, Bear, Roam, Logseq
10. **productivity-tasks** ... Things 3, Apple Reminders, Todoist, Asana, Trello
11. **productivity-docs** ... Google Docs/Sheets (bundled with workspace), Coda, Airtable
12. **storage-files** ... Google Drive (bundled), Dropbox, OneDrive, Box, S3, R2
13. **payments** ... Stripe, PayPal, Square, Mercury, Brex, Ramp
14. **crm** ... HubSpot, Salesforce, Pipedrive, Attio, Folk
15. **analytics** ... Plausible, PostHog, Google Analytics, Mixpanel, Amplitude
16. **marketing-email** ... Mailchimp, SendGrid, Resend, Postmark, Beehiiv, ConvertKit
17. **maps-location** ... Google Places, Mapbox, OpenStreetMap
18. **media-music** ... Spotify, Apple Music, Tidal, YouTube Music, Sonos, BluOS
19. **media-video** ... ffmpeg utilities (frames, GIF), Loom, YouTube
20. **media-photo** ... iCloud Photos, Google Photos, camera capture (RTSP/ONVIF)
21. **smart-home** ... Philips Hue, Eight Sleep, Home Assistant, SmartThings, Tesla, Nest, Ring
22. **health-fitness** ... Apple Health, Whoop, Oura, Strava, Garmin, MyFitnessPal
23. **finance-accounting** ... QuickBooks, Xero, Wave, Plaid, Mercury (also payments)
24. **search-web** ... Brave, Exa, Tavily, Firecrawl, DuckDuckGo, Perplexity, SearXNG
25. **social** ... X, Bluesky, Mastodon, LinkedIn, Reddit, Threads, Instagram, TikTok
26. **commerce-personal** ... Foodora, Uber/Lyft, DoorDash, Instacart, Booking.com
27. **ai-llm** ... Anthropic, OpenAI, Google Gemini, xAI, DeepSeek, Mistral, Groq, OpenRouter, all-of-them
28. **ai-speech** ... ElevenLabs, Deepgram, OpenAI Whisper, Sherpa-ONNX
29. **ai-image-video** ... Replicate, fal.ai, Runway, ComfyUI
30. **secrets-auth** ... 1Password, Bitwarden, Doppler, Infisical
31. **other** ... catch-all (avoid using; if needed, propose a new category)

Total = 31 categories. Operator-facing picker probably collapses these into 8-10 "starter packs" (Email & Calendar / Team Chat / Dev / Money / etc.) at preview time.

---

## 4. Capability inventory (Tier 1 / Tier 2 / Tier 3)

The full list. Tier 1 = must-have for v1 launch (the seed-team and earliest external Agents need these). Tier 2 = should-have, likely needed in the first month. Tier 3 = post-launch fill-in. Counts at the bottom of each tier.

Format: `id ... category ... auth shape ... source` where source is `OC` (lift from OpenClaw with attribution), `NEW` (write from scratch, no OpenClaw prior art), or `PAT` (pattern-borrow from OpenClaw but content original).

### Tier 1 ... v1 launch must-have

| id | category | auth | source | notes |
|----|----------|------|--------|-------|
| `google-workspace` | email + calendar + storage-files + productivity-docs | oauth (download client_secret) | PAT (gog skill) | Bundled per §0a-5. Single Capability, multi-surface unlock. Doug's primary stack at dh@2200.ai. |
| `discord` | chat | bot token | OC (docs/channels/discord.md) | Already integrated into 2200 substrate; catalog entry formalizes the cred ask. |
| `slack` | chat | bot+app token (Socket Mode) | OC (docs/channels/slack.md, gold-standard walkthrough) | Future-team / client engagements. |
| `whatsapp` | chat | Business API (bot+token+phone-id) | OC (docs/channels/whatsapp.md) | Already integrated; catalog formalizes. |
| `github` | dev-code | oauth or PAT | OC (skills/github/SKILL.md) | Doug's twentytwohundred org. |
| `stripe` | payments | api_key | NEW | Critical for 2200's $10K/mo profit target ([[../decisions/2026-04-29-operating-thesis]]). No OpenClaw prior art. |
| `twilio` | voice-telephony | account-sid+auth-token | OC (extensions/voice-call manifest) | Already a dep for voice extension. |
| `anthropic` | ai-llm | api_key or oauth | OC (docs/providers/anthropic.md) | Default frontier model. |
| `openai` | ai-llm | api_key or oauth | OC (docs/providers/openai.md, three-route table) | |
| `deepseek` | ai-llm | api_key | OC (extensions/deepseek manifest) | Default reasoner per current Agent config. |
| `xai` | ai-llm | api_key | OC (extensions/xai manifest) | grok-4.3 path. |
| `elevenlabs` | ai-speech | api_key | OC (extensions/elevenlabs manifest) | Voice ext dep. |
| `1password` | secrets-auth | local-app + tmux | OC (skills/1password/SKILL.md, lift "Guardrails" verbatim) | Doug uses; surfaces the OS-permission gotcha. |
| `openscut` | (special) | hosted-service ref | NEW | The 2200-owned identity provisioner ([[../decisions/2026-04-15-openscut-contract]]). Required for any Agent spawn. Auto-included; not in picker. |
| `openpub` | (special) | hosted-service ref | NEW | The 2200-owned pub. Required. Auto-included; not in picker. |

**Tier 1 count: 15** (12 user-facing + 3 internal/special). All 12 user-facing are seed-team-validated needs.

### Tier 2 ... v1 month-1 should-have

| id | category | auth | source | notes |
|----|----------|------|--------|-------|
| `imessage-bluebubbles` | chat | local app + token | OC (docs/channels/bluebubbles.md) | Best macOS iMessage path; Doug's preferred. |
| `notion` | productivity-notes | api_key | OC (skills/notion/SKILL.md) | Doug's note-of-record. |
| `obsidian` | productivity-notes | local-vault | OC (skills/obsidian/SKILL.md) | The "Brain"-adjacent note system. |
| `linear` | dev-issues | api_key | NEW | The PM-tracking standard for serious teams. |
| `spotify` | media-music | oauth + premium | OC (skills/spotify-player/SKILL.md) | Existing demo material. |
| `philips-hue` | smart-home | local-bridge button | OC (skills/openhue/SKILL.md) | Demo-friendly, no cloud cred. |
| `eight-sleep` | smart-home | email+password | OC (skills/eightctl/SKILL.md) | Doug uses; sleep data + alarms. |
| `things-3` | productivity-tasks | local-db + url-scheme | OC (skills/things-mac/SKILL.md) | Doug's task tracker. |
| `telegram` | chat | bot token | OC (docs/channels/telegram.md) | Easy add, BotFather walkthrough. |
| `apple-reminders` | productivity-tasks | local cli + permissions | OC (skills/apple-reminders/SKILL.md) | macOS-native fallback. |
| `apple-notes` | productivity-notes | local cli + permissions | OC (skills/apple-notes/SKILL.md) | macOS-native fallback. |
| `google-chat` | chat | service-account | OC (docs/channels/googlechat.md) | Workspace teams that prefer Chat over Slack. |
| `ms-teams` | chat | app-id + secret + tenant | OC (docs/channels/msteams.md) | Enterprise teams. |
| `outlook-365` | email + calendar | oauth (MS Graph) | NEW | Microsoft analog of `google-workspace`. |
| `cal-com` | calendar | api_key | NEW | OSS scheduling, popular w/ dev teams. |
| `vercel` | dev-deploy | api_token | NEW | Most popular Next.js / frontend deploy. |
| `cloudflare` | dev-deploy + storage-files | api_token (scoped) | NEW | DNS + R2 + Workers in one credential. |
| `dropbox` | storage-files | oauth | NEW | Operator file workflows; alternative to Drive. |
| `mailchimp` | marketing-email | api_key | NEW | The default mass-email pick. |
| `resend` | marketing-email | api_key | NEW | Transactional/dev-friendly; cleaner DX. |
| `posthog` | analytics | project-api-key | NEW | OSS analytics, common in dev shops. |
| `sentry` | dev-observability | dsn + auth-token | NEW | Default error tracker for serious teams. |
| `apple-music` | media-music | musickit oauth | NEW | Doug uses (alongside Spotify). |
| `home-assistant` | smart-home | long-lived-access-token | NEW | The OSS smart-home hub many serious users run. |
| `x-twitter` | social | bearer + user-ctx | OC (skills/xurl/SKILL.md) | OpenClaw has the xurl writeup. |
| `bluesky` | social | app-password | NEW | Doug's preferred microblog. |
| `mastodon` | social | api_token | NEW | Federated alternative. |
| `tailscale` | dev-deploy + secrets | api_key | NEW | Doug's networking substrate; relevant for Heisenberg ([[../decisions/2026-05-01-deployment-target]]). |
| `ngrok` | dev-deploy | auth_token | OC (voice-call manifest) | Tunnel substrate for webhook flows. |
| `brave-search` | search-web | api_key | OC (extensions/brave manifest) | First non-Google search default. |
| `exa` | search-web | api_key | OC (extensions/exa manifest) | LLM-native search. |
| `tavily` | search-web | api_key | OC (extensions/tavily manifest) | Cheaper search alt. |
| `firecrawl` | search-web | api_key | OC (extensions/firecrawl manifest) | Web-page-to-markdown crawler. |
| `openrouter` | ai-llm | api_key | OC (extensions/openrouter manifest) | Aggregator for all-of-them access. |
| `groq` | ai-llm | api_key | OC | Speed tier. |
| `mistral` | ai-llm | api_key | OC | EU vendor alternative. |
| `ollama` | ai-llm | local-server | OC | The local-model path Doug uses on the GB10. |
| `vllm` | ai-llm | local-server | OC | The other local path; what David runs on. |
| `lmstudio` | ai-llm | local-server | OC | Mac-local model server. |
| `replicate` | ai-image-video | api_token | NEW | Image gen default. |
| `fal-ai` | ai-image-video | api_key | OC (extensions/fal manifest) | Cheaper, faster image gen. |
| `runway` | ai-image-video | api_key | OC (extensions/runway manifest) | Video gen. |
| `signal` | chat | signal-cli + phone | OC (docs/channels/signal.md) | Privacy-focused operators. |
| `matrix` | chat | homeserver + token | OC (docs/channels/matrix.md) | Self-hosted operators. |

**Tier 2 count: 44.**

### Tier 3 ... post-launch fill-in

The long tail. Listing as a flat tags-only inventory; we don't write entries for these until an operator asks. (Naming them now means we're not surprised when a request lands.)

- Calendar: outlook-cal (covered by outlook-365 entry), fastmail-cal, ical-feed
- Chat: feishu, line, mattermost, nextcloud-talk, qq, irc, twitch, nostr, zalo
- Code: gitlab, bitbucket, gitea
- Dev-deploy: netlify, fly, render, heroku, railway, supabase, planetscale, digitalocean
- Dev-issues: jira, asana, monday, clickup, height, basecamp
- Dev-observability: datadog, pagerduty, betterstack, honeycomb, loki, grafana-cloud
- Productivity-notes: roam, evernote, logseq, mem, devonthink, bear (Tier 2 has apple-notes)
- Productivity-tasks: todoist, omnifocus, ticktick
- Productivity-docs: coda, airtable
- Storage: onedrive, box, s3, backblaze, icloud-drive (no public API ... document as "not supported")
- Payments: paypal, square, mercury, brex, ramp, wise, plaid
- CRM: hubspot, salesforce, pipedrive, attio, folk, copper
- Analytics: plausible, mixpanel, amplitude, segment, google-analytics
- Marketing-email: sendgrid, postmark, convertkit, beehiiv
- Maps: mapbox, openstreetmap, foursquare
- Media-music: tidal, youtube-music, deezer, soundcloud, sonos, bluos
- Media-video: loom, youtube-cms
- Media-photo: icloud-photos (no api), google-photos
- Smart-home: smartthings, tesla, ring-arlo, roomba, ifttt, nest-google-home
- Health-fitness: apple-health, whoop, oura, strava, garmin, myfitnesspal, fitbit
- Finance-accounting: quickbooks, xero, wave, ynab, mint
- Search-web: duckduckgo (no key ... easy add), searxng, perplexity, you.com
- Social: linkedin, reddit, threads, instagram, tiktok, pinterest
- Commerce-personal: uber, lyft, doordash, instacart, booking, airbnb, foodora (OC has this)
- AI-llm: cohere, fireworks, together, huggingface, voyage (embeddings), nvidia, perplexity-ai, every-chinese-frontier-model-from-openclaw (qwen, kimi, minimax, moonshot, zai, byteplus, volcengine, tencent, qianfan, alibaba, xiaomi, stepfun, sense)
- AI-speech: deepgram (Tier 2 has elevenlabs), assemblyai
- AI-image-video: comfyui, midjourney (no api ... document as "not supported"), suno, udio
- Secrets-auth: bitwarden, doppler, infisical, hashicorp-vault, aws-secrets-manager
- Other: foodora (OC has it ... ports easily), peekaboo (macOS UI automation; OpenClaw has the skill), shortwave-mail, missive

**Tier 3 count: ~120 named, expandable as gaps surface.**

### Total inventory: ~180 distinct Capabilities at full coverage. v1 launch ships 15. Month-1 ships up to 59. The remaining ~120 ship on demand.

---

## 5. Auth pattern primitives (14 shapes)

The kinds of auth flows the catalog needs to express. Each gets a discriminated-union variant in `capability-schema.ts`. Reused across many Capabilities.

| pattern | example | how walkthrough works |
|---------|---------|-----------------------|
| `api_key` | Anthropic, Stripe, Notion | "Go to URL, copy key, paste into vault." Simplest. |
| `api_key_dual` | Trello | Two values, both provided by the same dashboard. |
| `bot_token` | Discord, Telegram | API-key flavor, but bot-specific UX (BotFather, Dev Portal). |
| `bot_token_plus_app_token` | Slack | Two tokens with distinct purposes (Socket Mode vs HTTP). |
| `app_id_secret_tenant` | MS Teams, Microsoft 365 | OAuth-adjacent; three values. |
| `oauth_browser_pkce` | OpenAI Codex, Claude CLI | We launch browser, user grants, we receive token. Substrate already in place via Extensions framework. |
| `oauth_download_client_secret` | gog/Google | User creates an OAuth client in provider's console, downloads JSON, points us at the file. |
| `service_account_json` | Google Chat | User generates JSON file, uploads/points to it. |
| `webhook_secret_plus_bot` | Synology Chat, Nextcloud Talk | Two-part: bot identity + signing key. |
| `basic_username_password` | Eight Sleep, IMAP | Username + password; no OAuth available. Vault stores both. |
| `local_config_wizard` | Himalaya | We shell out to a third-party CLI's `configure` command; auth state lives in their config. |
| `local_permission_grant` | 1Password, Things 3, peekaboo | OS-level permission (Full Disk Access, Screen Recording, Accessibility); no credential per se. Walkthrough is "open System Settings, do X." |
| `no_credentials` | wttr.in weather, DuckDuckGo, Sonos (SSDP), OpenHue (local bridge) | Capability needs only network reachability. Walkthrough is degenerate. |
| `hosted_service_ref` | OpenSCUT, OpenPub | Capability points to a 2200-owned hosted endpoint. No operator credential; auth via 2200's identity. |

**Implementation note:** the existing credential substrate (the one that handled David's first API key) already accepts an opaque envelope. The catalog's job is to surface "this Capability needs a credential of this shape" to onboarding; the substrate accepts whatever shape we pass. No substrate changes needed for Phase F.

---

## 6. Hiring-manager tone (Part 1, parked from 2026-05-17)

Sub-deliverable, independent of the catalog itself but bundled in Phase F since it's load-bearing for capability suggestion quality.

**Files:** `src/runtime/onboarding/session.ts` planner prompt (~lines 290-330 per the parked spec).

**Changes:**
- Reframe planner system prompt: "You are a hiring manager interviewing a stakeholder about the ideal employee they want to add to their team."
- Reframe opening seed: "Tell me about the Agent you want to bring on. What do you need this person to be good at?"
- Output JSON shape unchanged (web client stays put).
- Test across DeepSeek (default frontier), Qwen 3 30B (David's local), and Llama 3.3 70B if available. Smaller models may need a tighter output-shape constraint.

**Order:** ship this first. It's tactical and clears the runway for the capability work to come.

---

## 7. Preview integration (interview → capability suggestions)

Where Capabilities show up DURING onboarding (not post-spawn).

**Current preview surface (per 2200#130 web client):** Card Stack screen renders proposed Identity + suggested tools + suggested schedules. Operator can drop any of them.

**Phase F addition:** a new `<CapabilityCard>` row in the Card Stack:
- Header: "Suggested capabilities"
- Body: each suggested Capability as a checkbox + 1-line description + "this needs: ..." credential summary.
- Operator toggles on/off.
- Default ON for high-confidence suggestions (tag overlap ≥ 2); default OFF for speculative ones (tag overlap 1).

**API:** extend `POST /api/v1/onboarding/:id/answer` response to include `capability_suggestions: OnboardingCapabilitySuggestion[]` once the interview tags settle. Web client renders.

**Confirm step:** confirming includes the toggled-on Capabilities; they're written into the Agent's Identity as `capabilities: [<id>...]` field. The post-spawn walkthrough reads this field on first boot.

**Sub-toggles for bundled Capabilities (post-task-7 polish; not blocking task 8).** Bundled Capabilities (like `google-workspace` per §0a-5) unlock multiple service surfaces under one OAuth consent. Operator UX: when a bundled Capability is in the suggestion list, render a master checkbox + N per-service sub-checkboxes (Gmail, Calendar, Drive, Contacts, Tasks for `google-workspace`), all default-on. Untick a sub-toggle to drop just that service; the Identity is written with `unlocks.tools[]` and `unlocks.skills[]` filtered to the kept services. Schema already supports this via `unlocks.tools[]` enumeration per service; no schema change. Until sub-toggles ship (after task 7 baseline preview integration), bundled Capabilities are takes-all-or-takes-nothing; document that limitation in the walkthrough prose for v0 entries.

---

## 8. Post-spawn walkthrough (mechanics)

The "new Agent's first action is to walk the operator through chosen-but-not-yet-provisioned credentials" flow.

**Trigger:** Agent's first message to its primary pub (Studio by default) after spawn, IF `capabilities[]` is non-empty AND any of them lack sealed credentials in the vault.

**Loop:**
1. Agent reads `capabilities[]` from Identity.
2. For each Capability, in order, check vault for sealed credential.
3. If sealed: skip silently.
4. If unsealed: render Capability's walkthrough prose into chat, then call `credential_request` for the named credential.
5. Wait for operator to provide. Substrate handles sealing.
6. On seal-success: acknowledge in chat, move to next Capability.
7. After all Capabilities walked: Agent posts "I'm set up. What would you like to work on first?"

**Edge cases:**
- Operator says "skip" mid-walkthrough → Agent records `walkthrough_skipped: [<id>...]` to brain, moves to next.
- Operator says "do this later" → same behavior; brain note flag.
- Walkthrough resumable: on every chat-open, Agent re-checks vault; if a capability is still unsealed and not skipped, can re-offer.
- Credential request fails (operator pastes garbage) → Agent retries inline.
- Tool-error sanitization: when a Capability's tool call errors during the walkthrough, the runner strips fences, CDATA, control sequences, and anything injection-shaped from the error string before surfacing to the operator or re-injecting to the model. Pattern borrowed from Hermes's `_sanitize_tool_error` (see [[../decisions/2026-05-18-hermes-deep-dive]] §6a); closes a small but real prompt-injection-via-error-message hole.

**Files:**
- `src/runtime/onboarding/walkthrough-runner.ts` ... the orchestration helper.
- Extension to the Agent's first-chat system prompt: a small directive block "if your Identity has unsealed capabilities, walk the operator through them now."

---

## 9. OpenClaw lift map (file-level)

Concrete files to lift prose from, with attribution. Each lift creates one Capability entry. Attribution lives in the `source.openclaw_path` frontmatter field AND a footer line in the body: `_Setup steps adapted from OpenClaw (MIT © 2025 Peter Steinberger)._`

| Capability | OpenClaw source | Lift type |
|------------|-----------------|-----------|
| `discord` | `docs/channels/discord.md` (lines 24-174, 8-step walkthrough) | Adapt walkthrough; rewrite for 2200 tool names. |
| `slack` | `docs/channels/slack.md` (esp. 119-225 manifest copy-paste) | Lift the manifest verbatim; rewrite app name. |
| `telegram` | `docs/channels/telegram.md` (BotFather flow) | Adapt; minimal changes. |
| `anthropic` | `docs/providers/anthropic.md` | Adapt; replace `openclaw onboard` commands with `2200 spawn` equivalents. |
| `openai` | `docs/providers/openai.md` (three-route table) | Adapt; the disambiguation framing is gold. |
| `gmail` (in google-workspace bundle) | `skills/gog/SKILL.md` formatting tips + `docs/automation/cron-jobs.md` Gmail PubSub section | Adapt; merge into a single walkthrough. |
| `notion` | `skills/notion/SKILL.md` (4-step flow + data_source/database_id explainer) | Adapt; lift the integration-share step verbatim. |
| `1password` | `skills/1password/SKILL.md` (Guardrails section) | Lift verbatim with attribution; the tmux gotcha is real. |
| `things-3` | `skills/things-mac/SKILL.md` | Adapt; OS-permission specificity is the value. |
| `eight-sleep` | `skills/eightctl/SKILL.md` | Lift; simple. |
| `spotify` | `skills/spotify-player/SKILL.md` | Adapt; spogo/spotify_player CLI install. |
| `philips-hue` | `skills/openhue/SKILL.md` | Lift; local-bridge button-press flow. |
| `whatsapp` | `docs/channels/whatsapp.md` | Adapt; we have our own gateway, but acquisition prose carries over. |
| `imessage-bluebubbles` | `docs/channels/bluebubbles.md` | Lift; the recommended path. |
| `signal` | `docs/channels/signal.md` | Lift. |
| `matrix` | `docs/channels/matrix.md` | Lift. |
| `google-chat` | `docs/channels/googlechat.md` | Lift; service-account JSON walkthrough. |
| `ms-teams` | `docs/channels/msteams.md` | Lift; app-id + secret + tenant flow. |
| `twitch` | `docs/channels/twitch.md` | Lift; OAuth-access-token. |
| `x-twitter` | `skills/xurl/SKILL.md` | Lift; bearer + user-ctx writeup. |
| All LLM providers (~40) | `docs/providers/*.md` + `extensions/*/openclaw.plugin.json` | Bulk lift; pattern is consistent. Doable as a single batch session. |
| All web-search (~7) | `docs/tools/web-search.md` + per-provider docs | Bulk lift. |

**Files that are NOT good lifts:**
- The `extensions/*/openclaw.plugin.json` manifests have the structured cred-surface (env vars, OAuth choices) ... reference for our schema design, but don't lift the structure; OpenClaw's shape is denser than ours needs to be (it carries CLI plumbing for `openclaw onboard --<flag>` which we don't need).
- The Mintlify-specific `<Steps>` / `<Tabs>` rendering tags don't port; we render plain markdown numbered lists.

---

## 10. Holes OpenClaw doesn't cover (we write from scratch)

Per the survey, OpenClaw has near-zero coverage of:

- **Payments:** Stripe (Tier 1!), PayPal, Square, Mercury, Brex, Ramp.
- **CRM:** all of it.
- **Calendar beyond Google:** Cal.com, Outlook, Fastmail, iCal.
- **Storage beyond Drive:** Dropbox, OneDrive, S3, R2, Backblaze.
- **Project management:** Linear, Jira, Asana, ClickUp, Monday.
- **Databases / warehouses:** all of it.
- **Analytics:** Plausible, PostHog, Mixpanel, Amplitude.
- **Marketing email:** Mailchimp, SendGrid, Resend, Postmark.
- **Travel / commerce:** Uber, Lyft, DoorDash, Booking, Airbnb.
- **Social beyond X:** Bluesky, Mastodon, LinkedIn, Reddit.
- **Music beyond Spotify:** Apple Music, Tidal, YouTube Music.
- **Smart home beyond Hue/Eight/Sonos:** Home Assistant, SmartThings, Tesla, Nest, Ring.
- **Health/fitness:** all of it.
- **Finance/accounting:** all of it.
- **Most developer infra:** Vercel, Netlify, Cloudflare DNS, Render API.

Of these, Tier 1 lift-from-scratch priority is **Stripe** (Doug's monetization path) and **Linear** (project tracking standard).

---

## 11. Out of scope for Phase F (deferred)

- LLM-augmented suggestion enrichment (off-catalog suggestions, smarter ranking). v1 = tag overlap only.
- Cross-Agent credential sharing. Per-Agent vault.
- Editing Capabilities post-spawn via conversation. Re-onboard if needed.
- Operator-authored Capability marketplace (community catalog). Public wiki PR is the v1 contribution path. The hosted external-publisher marketplace is explicitly gated behind the future External-Publisher Epic; see [[../decisions/2026-05-18-capability-security-model]] for the threat model + mitigation surface that gate-keeps it. None of M1 (publisher signing), M3 enforcement (cross-Capability cred refusal), M5 (per-Capability audit trail), or M6 (curation tiers) ship before community catalog goes live.
- Auto-OAuth dance from within onboarding (where 2200 acts as the OAuth client and walks the operator through consent screens programmatically). Phase F shows the walkthrough prose; operator clicks links and pastes back. Auto-OAuth is its own epic.
- "Bundled installs" (one-click install N capabilities from a starter pack). Phase F surfaces them individually.
- Catalog versioning beyond a single `version:` field. Migration of catalog entries between versions is post-v1.
- i18n. English only for v1.

---

## 12. Sequence of work (the knock-down list)

In order. Each is a discrete commit / handoff-able unit. Some can parallelize; default order shown.

1. **Land Part 1 tone-fix in `session.ts`.** Small. One session. Ships independently. ([[#6]])
2. **Draft `capability-schema.ts` + Zod.** Define the type, write the validator, no real entries yet. ([[#1]])
3. **Write the `gmail` Capability by hand** (as the seed entry; google-workspace bundle). Validates the schema against a real, multi-credential, OAuth-download-client-secret case. Stops here for Doug review before propagating. ([[#0a-5]])
4. **Catalog loader + suggestion logic.** Hot-reload in dev. Tests. ([[#2]])
5. **Preview integration in onboarding.** Card Stack `<CapabilityCard>` + extension to the answer-endpoint response. Web client edits. ([[#7]])
6. **Walkthrough runner + first-chat system prompt extension.** ([[#8]])
7. **End-to-end test:** spawn an Agent through the web onboarding with `gmail` selected. Confirm walkthrough fires on first chat. Verify creds land.
8. **Lift Tier 1 OpenClaw entries** (Discord, Slack, Telegram, GitHub, Anthropic, OpenAI, DeepSeek, xAI, ElevenLabs, 1Password, Twilio). Batch session. ([[#9]])
9. **Write Tier 1 from-scratch entries** (Stripe). Single session, hand-walked through Stripe's dashboard. ([[#10]])
10. **First external Agent built end-to-end via this flow.** Validates the full Tier 1 surface. Likely a "demo Agent" for a target user category.
11. **Tier 2 batch lift.** Multi-session. Group by category for efficiency.
12. **Tier 2 from-scratch entries.** Group by category.
13. **Document operator-authored Capability convention** at `wiki/conventions/capability-catalog.md` so external contributors can PR new entries.
14. **Tier 3 = on demand.** No proactive work; each entry is filed when an operator asks.

Estimated checkpoints (per [[../../memory/feedback_no_time_estimates]] no hours/days):
- After step 3: Doug reviews schema + first entry. Go/no-go on shape.
- After step 7: end-to-end works for one Capability. Decide whether to batch Tier 1 lift, or pause to iterate UX.
- After step 10: first external Agent. Decide whether v1-launch criteria are met.
- After step 12: full Tier 2 done. Phase F done.

---

## 13. Risks / footguns

- **Catalog entry rot.** Provider dashboards change UI; click paths in walkthroughs go stale. Mitigation: timestamp every entry's `updated:` frontmatter; surface stale-entry warnings in a future Doctor check (>12 months old or flagged-broken). Not Phase F work; flag for Doctor backlog.
- **Walkthrough chat-spam.** A new Agent with 10 Capabilities will dump 10 walkthroughs into Studio at first boot. Mitigation: walkthrough runner posts a single "I need to set up N integrations. Want to do them now or skip for later?" message first; only enters per-Capability flow on operator confirm.
- **Credential confusion across Agents.** Per §0a-4 deferred. Walkthrough prose surfaces the limitation; operator may experience surprise. Acceptable for v1.
- **Tag-overlap suggestion misses.** Operator says "I want it to deal with my email" → if the catalog uses `email` and the interview tags as `inbox`, no match. Mitigation: aggressive tag synonyms in the catalog entries (`tags: [email, inbox, mail, gmail, ...]`); plus a fallback "show all capabilities by category" link in the preview.
- **Off-catalog ask UX.** Operator says "I want it to manage my Plaid bank feed" and we don't have Plaid. Per §0a-2 we render "we don't have a walkthrough for that yet, the Agent can still work without it." This needs to be graceful; operator should not feel rejected.
- **Public-wiki visibility (per CLAUDE.md rule 5).** The catalog is fine to be public ... but the per-operator override directory (`~/.2200/catalog/capabilities/`) must NOT auto-sync to the wiki. Confirm loader paths don't accidentally cross.
- **Bundled-Capability ambiguity.** `google-workspace` unlocks five service surfaces. If the operator wants only Gmail (not Calendar/Drive/Contacts/Tasks): resolution is sub-toggles in the preview UI (§7 post-task-7 polish), NOT separate Capabilities. v1 ships takes-all-or-takes-nothing; sub-toggle UI ships once the baseline preview integration matures. Document the takes-all-takes-nothing default in the walkthrough prose for entries written before sub-toggles land; operator can also disable specific tools post-spawn by editing the Identity.
- **OpenClaw upstream changes.** Our lifts are point-in-time. If OpenClaw rewrites a walkthrough, we don't auto-track. The `source.openclaw_path` frontmatter is for audit, not sync. Acceptable; the catalog diverges from the moment we lift.
- **Capability ordering in walkthrough.** Order matters (e.g., google-workspace before gmail-specific things). v1: order is the order the operator selected them in the preview, with `requires.capabilities` dependencies forcing reordering. Document in walkthrough-runner.

---

## 14. Cross-references

- Parent: [[14-conversational-onboarding]]
- Onboarding driver decision: [[../decisions/2026-05-06-onboarding-driver-server-side-state-machine]]
- Capability security model + threat model + External-Publisher Epic prerequisites: [[../decisions/2026-05-18-capability-security-model]]
- Credential substrate Phase F builds on: [[../decisions/2026-05-14-request-credential-substrate]]
- Claim-vs-evidence audit (future per-Capability hook): [[../decisions/2026-05-14-claim-vs-evidence-audit]]
- Existing credential substrate: David's first-chat exercise documented in [[../handoffs/hobby/2026-05-17]] (§ "Tool-trigger quick reference + credential card persists across reload")
- Wiki rule context (public visibility): root CLAUDE.md § "Rules I Do Not Violate"
- Operating thesis (why Stripe is Tier 1): [[../decisions/2026-04-29-operating-thesis]]
- Google publisher verification gating: [[../decisions/google-publisher-verification-deferred]] (memory pointer; verify with current decision-doc path)
- Hosted OpenSCUT contract: [[../decisions/2026-04-15-openscut-contract]] (verify path)

---

## 15. Format provenance

Drafted by Hobby on 2026-05-18 morning per Doug's instruction "survey OpenClaw, then make a doc with EVERYTHING, then we knock them down one at a time." OpenClaw survey ran in a research subagent and is summarized in §4 inventory + §9 lift map.

2026-05-18 afternoon: capability security model decision filed at [[../decisions/2026-05-18-capability-security-model]] after Doug + Guppi threat-model session. Three forward-compat primitives (`publisher`, `network_egress`, `capability_id` binding at seal time) baked into §1 schema; community-catalog deferral in §11 explicitly gated on the future External-Publisher Epic.

2026-05-18 evening: Hermes Agent v0.14.0 deep dive filed at [[../decisions/2026-05-18-hermes-deep-dive]]. Three Hermes-borrowed patterns folded into Phase F doc per Doug's approved §7 list: (1) §1 Capability description hardline (≤60 chars, single sentence, no marketing words; Zod-rejected at load); (2) §1 substrate-level non-overridable provider-env blocklist (`_PROVIDER_ENV_BLOCKLIST`, motivated by GHSA-rhgp-j443-p4rf in the agent ecosystem); (3) §8 walkthrough-runner tool-error sanitization. Three further loop-layer patterns (fuzzy tool-name repair, JSON-args retry with synthetic tool-error injection, tool-call circuit breaker) plus smart-approvals-via-aux-LLM, runtime blocklist enforcement, and Skills Guard pattern set parked in new backlog epic [[16-loop-layer-reliability]] (numbered 16 because 15 collides with web-app; flagged for renumber). Hardline-below-yolo two-tier safety floor filed as [[../decisions/2026-05-18-hardline-below-yolo]]. Gmail schema example tightened to 60-char compliance.

2026-05-18 late evening: Doug locked all five §0a open product calls (table updated to reflect lock + lock-date). Sub-toggle UX for bundled Capabilities added to §7 as post-task-7 polish (not blocking task 8). §13 bundled-Capability footgun updated to point at sub-toggle resolution.

2026-05-18 evening (autonomous run): Phase F §12 step 2 + step 3 shipped while Doug was out. `src/runtime/onboarding/capability-schema.ts` + Zod (PROVIDER_ENV_BLOCKLIST substrate-level constant + description hardline refine + 14-shape auth discriminator + forward-compat fields). 28 unit tests at `tests/runtime/onboarding/capability-schema.test.ts` covering valid entries, default application, id format, description hardline (all 4 reject kinds), env-var blocklist (every blocked name), auth kind discriminator. Canonical seed entry filed at `wiki/catalog/capabilities/google-workspace.md` (description: *"Read, label, draft, and send Gmail or Workspace mail."* = 53 chars; well inside the 60-char hardline, schema does not need revision before tier 1 batch lift). Step 3 stop-gate per §12 honored ... Doug reviews the schema + seed shape before propagation to other Capabilities. Verify: typecheck + lint + format + 1654 tests passing (one chaos flake retry-passes in isolation, pre-existing per [[../research/2026-05-14-external-architecture-review]] § "Four risk areas").

2026-05-18 (session 32, Doug review + greenlit "keep rolling"): §A1-A5 refinements landed (cache-as-invariant + heuristics-vs-boundaries decisions, Epic 16 reframed as "loop as recovery engine," schema refinements via PR #202, Epic 16 implementation notes section, Hermes deep dive moved to research/ per filing convention lock, branch protection updated to allow self-merge after CI). Tier 1 batch lift (Phase F §12 step 3 → propagation): 12 Capability entries shipped to `wiki/catalog/capabilities/` ... chat (discord, slack, telegram), dev (github), AI providers (anthropic, openai, deepseek, xai, elevenlabs), secrets (onepassword ... id renamed from `1password` because the regex requires leading letter; `1password` retained as tag for search), voice (twilio), payments (stripe; original walkthrough, no OpenClaw prior art, critical Tier 1 for operating thesis). All 13 entries (12 + google-workspace seed) validate via `scripts/validate-catalog.ts` (PR #203, merged). One schema gap surfaced + worked around (id leading-digit constraint). Phase F §12 step 4 shipped: `src/runtime/onboarding/capability-loader.ts` + 12 tests (PR #204, merged). Phase F §12 step 5 partial shipped: `src/runtime/onboarding/capability-suggest.ts` + 12 tests (PR #205, merged). Two further interim prompt patches shipped (PR #207) ahead of the structural walkthrough runner: Phase 4 of starter-pack orientation teaches new Agents to proactively `credential_request`, and a YOU-need-a-credential bullet in `loop.ts` `buildSystemPrompt` teaches all-Agents-on-restart the same. Both marked INTERIM in code; walkthrough runner rollout removes them. Self-restart tool also shipped (PR #206) as the substrate path for Jodin's stuck-loop pattern: `restart_self` baseline tool + supervisor RPC; no cross-Agent target arg (structural closure of the malice vector). Phase F §12 step 5 web side + step 6 walkthrough runner + step 7 end-to-end test ... pending; afternoon's work.

— Hobby
