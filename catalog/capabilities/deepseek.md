---
id: deepseek
label: DeepSeek
category: ai-llm
description: Call DeepSeek chat and reasoner models via DeepSeek API.
homepage: https://www.deepseek.com
publisher: first-party
source:
  attribution: openclaw
  openclaw_path: docs/providers/deepseek.md
  notes: |
    Walkthrough adapted from OpenClaw's DeepSeek provider doc.
    OpenClaw is MIT (c) 2025 Peter Steinberger.
auth:
  - name: DEEPSEEK_PROVIDER_KEY
    kind: api_key
    env_var: DEEPSEEK_PROVIDER_KEY_REF
    obtain_url: https://platform.deepseek.com/api_keys
unlocks:
  tools: []
  skills: []
  extensions: []
  providers:
    - deepseek
network_egress:
  domains:
    - api.deepseek.com
tags:
  - llm
  - ai
  - deepseek
  - provider
  - reasoner
  - cost-efficient
requires:
  bins: []
  os: []
  capabilities: []
walkthrough:
  estimated_minutes: 3
  difficulty: easy
---

# Setup walkthrough

*This walkthrough is for self-hosted 2200 installs. Hosted-tier operators see DeepSeek V4-Flash provided through the platform proxy as the Tier 2 starter-inference path; no separate setup needed there.*

You'll create an API key on DeepSeek's platform and hand it to 2200. About 3 minutes.

DeepSeek's API is OpenAI-compatible; if you've set up OpenAI before, this is the same shape.

## Step 1 ... create the API key

Go to [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys). Sign in or create a DeepSeek account.

Click **Create API Key**. Name it `2200 Agent`.

## Step 2 ... copy the key

DeepSeek shows the key once. **Copy it now** ... if you navigate away, you'll need to create a new one.

## Step 3 ... paste into 2200

When 2200's runtime opens the credential request prompt (in your 1:1 chat with the Agent), paste the key.

The key goes browser → runtime → vault. It never appears in the Agent's LLM context or transcripts.

## Step 4 ... verify

Ask the Agent to confirm it can call DeepSeek:

> "Run a quick check against the DeepSeek provider."

## What this unlocks

This Capability registers `deepseek` as an available model provider in 2200's runtime. Agents bound to `deepseek/deepseek-v4-flash`, `deepseek/deepseek-reasoner`, or other DeepSeek model ids can route their LLM calls through your account.

## Billing

DeepSeek bills usage-based; spend limits configured in the DeepSeek dashboard.

## Why operators pick DeepSeek

DeepSeek's pricing is meaningfully cheaper than US frontier vendors for comparable reasoning-tier models. Many operators use DeepSeek as the default reasoner for cost-sensitive Agents and reserve frontier vendors for specific tasks. The v4 line is competitive enough that the cost gap matters for fleets running long autonomous sessions.

---

*Setup steps adapted from OpenClaw's `docs/providers/deepseek.md` (MIT (c) 2025 Peter Steinberger).*
