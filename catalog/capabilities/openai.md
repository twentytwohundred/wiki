---
id: openai
label: OpenAI
category: ai-llm
description: Call OpenAI GPT and o-series models via the OpenAI API.
homepage: https://openai.com
publisher: first-party
source:
  attribution: openclaw
  openclaw_path: docs/providers/openai.md
  notes: |
    Walkthrough adapted from OpenClaw's OpenAI provider doc. The Codex
    OAuth and Codex app-server alternate paths are omitted at v1 ...
    direct API-key auth is the cleanest single-operator setup. Operators
    who want subscription-OAuth or native Codex behavior can configure
    those post-spawn by editing the Identity. OpenClaw is MIT (c) 2025
    Peter Steinberger.
auth:
  - name: OPENAI_PROVIDER_KEY
    kind: api_key
    env_var: OPENAI_PROVIDER_KEY_REF
    obtain_url: https://platform.openai.com/api-keys
unlocks:
  tools: []
  skills: []
  extensions: []
  providers:
    - openai
network_egress:
  domains:
    - api.openai.com
tags:
  - llm
  - ai
  - openai
  - gpt
  - codex
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

*This walkthrough is for self-hosted 2200 installs. Hosted-tier operators don't need this; the platform provides GPT access through the managed-tier proxy.*

You'll create an API key on OpenAI's platform and hand it to 2200. About 3 minutes.

## Step 1 ... create the API key

Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys). Sign in or create an OpenAI account (separate from a personal ChatGPT account if you have one).

Click **Create new secret key**:

- **Name**: `2200 Agent` (so you can find/revoke later).
- **Project**: pick or create a project (OpenAI's project scoping is per-team-billing; for solo use, default is fine).
- **Permissions**: default `All` is fine for general Agent use. Restrict scope if your Agent's role is narrow (e.g. inference-only, no fine-tuning).

## Step 2 ... copy the key

OpenAI shows the key once, prefixed `sk-`. **Copy it now** ... if you navigate away, you'll need to create a new one.

## Step 3 ... paste into 2200

When 2200's runtime opens the credential request prompt (in your 1:1 chat with the Agent), paste the key.

The key goes browser → runtime → vault. It never appears in the Agent's LLM context or transcripts.

Substrate-level reminder: the env-var name `OPENAI_API_KEY` is on `PROVIDER_ENV_BLOCKLIST` per [[../decisions/2026-05-18-capability-security-model]] § "Real-world precedent." This Capability uses `OPENAI_PROVIDER_KEY_REF` instead.

## Step 4 ... verify

Ask the Agent to confirm it can call OpenAI:

> "Run a quick check against the OpenAI provider."

The Agent will issue a small test call (typically a few tokens) and confirm the credential works. If it fails with `401`, the key is invalid or revoked. If `429`, the project's rate limit or balance is the issue ... check the OpenAI dashboard.

## What this unlocks

This Capability registers `openai` as an available model provider in 2200's runtime. Agents bound to `openai/gpt-5.5`, `openai/gpt-5.4`, `openai/o3`, `openai/gpt-image-2`, or any other OpenAI model id can now route their LLM (or image-gen) calls through your account.

## Billing

OpenAI bills usage-based against the project your key belongs to. Set spend limits in the OpenAI dashboard (Settings → Limits) ... 2200's per-Agent cost caps respect this but OpenAI's project-level cap is the hard ceiling.

## Rotation

To rotate: create a new key, paste it into 2200 via the credential walkthrough (re-runs Steps 1-3), then revoke the old key in the OpenAI dashboard. The new key takes effect on the Agent's next API call.

---

*Setup steps adapted from OpenClaw's `docs/providers/openai.md` (MIT (c) 2025 Peter Steinberger). The three-route table from OpenClaw's doc (API key / Codex OAuth / Codex app-server) is collapsed to API key only for v1; alternate routes available post-spawn.*
