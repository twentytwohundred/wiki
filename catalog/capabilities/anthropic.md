---
id: anthropic
label: Anthropic
category: ai-llm
description: Call Anthropic Claude models via the Anthropic API.
homepage: https://www.anthropic.com
publisher: first-party
source:
  attribution: openclaw
  openclaw_path: docs/providers/anthropic.md
  notes: |
    Walkthrough adapted from OpenClaw's Anthropic provider doc. The
    Claude CLI alternate path is omitted at v1 (extra dependency, mostly
    useful for reusing an existing CLI login); API key is the cleanest
    single-operator setup. OpenClaw is MIT (c) 2025 Peter Steinberger.
auth:
  - name: ANTHROPIC_PROVIDER_KEY
    kind: api_key
    env_var: ANTHROPIC_PROVIDER_KEY_REF
    obtain_url: https://console.anthropic.com/settings/keys
unlocks:
  tools: []
  skills: []
  extensions: []
  providers:
    - anthropic
network_egress:
  domains:
    - api.anthropic.com
tags:
  - llm
  - ai
  - anthropic
  - claude
  - provider
  - reasoning
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

*This walkthrough is for self-hosted 2200 installs. Hosted-tier operators don't need this; the platform provides Claude access through the managed-tier proxy.*

You'll create an API key on Anthropic's console and hand it to 2200. About 3 minutes.

## Step 1 ... create the API key

Go to [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys). Sign in or create an Anthropic account.

Click **Create Key**. Name it `2200 Agent` (so you can find/revoke it in the future). Pick a workspace if your account has multiple.

## Step 2 ... copy the key

Anthropic shows the key once, prefixed `sk-ant-`. **Copy it now** ... if you navigate away, you'll need to create a new one.

## Step 3 ... paste into 2200

When 2200's runtime opens the credential request prompt (in your 1:1 chat with the Agent), paste the key.

The key goes browser → runtime → vault. It never appears in the Agent's LLM context or transcripts.

Substrate-level reminder: the env-var name `ANTHROPIC_API_KEY` is on `PROVIDER_ENV_BLOCKLIST` per the [[../decisions/2026-05-18-capability-security-model]] § "Real-world precedent" (GHSA-rhgp-j443-p4rf incident). This Capability uses `ANTHROPIC_PROVIDER_KEY_REF` instead so the host's Anthropic provider key cannot be shadowed by a Capability declaration.

## Step 4 ... verify

Ask the Agent to confirm it can call Anthropic:

> "Run a quick check against the Anthropic provider."

The Agent will issue a small test call (typically a few tokens) and confirm the credential works. If it fails, check that the key has not been revoked in the Anthropic console.

## What this unlocks

This Capability registers `anthropic` as an available model provider in 2200's runtime. Agents bound to `anthropic/claude-opus-4-7`, `anthropic/claude-sonnet-4-6`, `anthropic/claude-haiku-4-5-20251001`, or any other Anthropic model id can now route their LLM calls through your account.

## Billing

Anthropic bills usage-based against the workspace your key belongs to. Set spend limits in the Anthropic console (Settings → Billing) ... 2200's runtime respects per-Agent cost caps but Anthropic's account-level limit is the hard ceiling.

## Rotation

To rotate: create a new key, paste it into 2200 via the credential walkthrough (re-runs Steps 1-3), then revoke the old key in the Anthropic console. The new key takes effect on the Agent's next API call.

---

*Setup steps adapted from OpenClaw's `docs/providers/anthropic.md` (MIT (c) 2025 Peter Steinberger).*
