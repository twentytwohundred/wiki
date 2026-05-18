---
id: xai
label: xAI
category: ai-llm
description: Call xAI Grok models via the xAI API.
homepage: https://x.ai
publisher: first-party
source:
  attribution: openclaw
  openclaw_path: docs/providers/xai.md
  notes: |
    Walkthrough adapted from OpenClaw's xAI provider doc.
    OpenClaw is MIT (c) 2025 Peter Steinberger.
auth:
  - name: XAI_PROVIDER_KEY
    kind: api_key
    env_var: XAI_PROVIDER_KEY_REF
    obtain_url: https://console.x.ai
unlocks:
  tools: []
  skills: []
  extensions: []
  providers:
    - xai
network_egress:
  domains:
    - api.x.ai
tags:
  - llm
  - ai
  - xai
  - grok
  - provider
  - frontier
requires:
  bins: []
  os: []
  capabilities: []
walkthrough:
  estimated_minutes: 3
  difficulty: easy
---

# Setup walkthrough

*This walkthrough is for self-hosted 2200 installs. Hosted-tier operators don't need this; xAI access is available through the managed-tier proxy.*

You'll create an API key on xAI's console and hand it to 2200. About 3 minutes.

## Step 1 ... create the API key

Go to [console.x.ai](https://console.x.ai). Sign in or create an xAI account.

Find the **API Keys** section and click **Create API Key**. Name it `2200 Agent`.

## Step 2 ... copy the key

xAI shows the key once. **Copy it now** ... if you navigate away, you'll need to create a new one.

## Step 3 ... paste into 2200

When 2200's runtime opens the credential request prompt (in your 1:1 chat with the Agent), paste the key.

The key goes browser → runtime → vault. It never appears in the Agent's LLM context or transcripts.

## Step 4 ... verify

Ask the Agent to confirm it can call xAI:

> "Run a quick check against the xAI provider."

## What this unlocks

This Capability registers `xai` as an available model provider in 2200's runtime. Agents bound to `xai/grok-4`, `xai/grok-4-0709`, `xai/grok-4.3`, or any other Grok model id can route their LLM calls through your account.

The same xAI key can also power the runtime's `web_search` provider (Grok-backed) and `x_search` first-class tool if you select xAI as the search backend post-spawn.

## Billing

xAI bills usage-based against the account. Console has spend limits and usage dashboards.

---

*Setup steps adapted from OpenClaw's `docs/providers/xai.md` (MIT (c) 2025 Peter Steinberger).*
