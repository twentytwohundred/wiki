---
id: elevenlabs
label: ElevenLabs
category: ai-speech
description: Generate speech and transcribe audio via ElevenLabs.
homepage: https://elevenlabs.io
publisher: first-party
source:
  attribution: openclaw
  openclaw_path: docs/providers/elevenlabs.md
  notes: |
    Walkthrough adapted from OpenClaw's ElevenLabs provider doc.
    OpenClaw is MIT (c) 2025 Peter Steinberger.
auth:
  - name: ELEVENLABS_PROVIDER_KEY
    kind: api_key
    env_var: ELEVENLABS_PROVIDER_KEY_REF
    obtain_url: https://elevenlabs.io/app/settings/api-keys
unlocks:
  tools:
    - tts_speak
    - transcribe_audio
  skills: []
  extensions:
    - voice-call
  providers:
    - elevenlabs
network_egress:
  domains:
    - api.elevenlabs.io
tags:
  - speech
  - tts
  - stt
  - voice
  - ai
  - elevenlabs
  - audio
requires:
  bins: []
  os: []
  capabilities: []
walkthrough:
  estimated_minutes: 4
  difficulty: easy
---

# Setup walkthrough

*This walkthrough is for self-hosted 2200 installs. Hosted-tier operators see ElevenLabs access through the platform proxy when their tier includes speech features.*

You'll create an API key on the ElevenLabs dashboard and hand it to 2200. About 4 minutes.

## Step 1 ... create the API key

Go to [elevenlabs.io/app/settings/api-keys](https://elevenlabs.io/app/settings/api-keys). Sign in or create an ElevenLabs account.

Click **Create API Key**. Name it `2200 Agent`. Default permissions are fine for the unlocked tools (TTS + Scribe STT).

## Step 2 ... copy the key

ElevenLabs shows the key once. **Copy it now**.

## Step 3 ... paste into 2200

When 2200's runtime opens the credential request prompt (in your 1:1 chat with the Agent), paste the key.

The key goes browser → runtime → vault. It never appears in the Agent's LLM context or transcripts.

## Step 4 ... verify

Ask the Agent to confirm:

> "Generate a 5-second test audio clip saying 'hello from 2200' using ElevenLabs."

The Agent should produce an audio file. If it fails with `401`, the key is invalid. If `quota_exceeded`, your ElevenLabs plan's character limit was hit ... check the dashboard.

## What this unlocks

- **`tts_speak`** ... text-to-speech. Default model: `eleven_multilingual_v2`. Voice picker exposes ElevenLabs's voice catalog.
- **`transcribe_audio`** ... batch speech-to-text via Scribe v2.
- **Voice Call extension** ... realtime streaming STT via Scribe v2 Realtime for voice calls (per [[../epics/12-extensions-framework]] when voice-call is installed).

## Billing

ElevenLabs prices by character (TTS) and minute (STT). Free tier has tight monthly limits; paid tiers scale up. Spend limits live in the ElevenLabs dashboard.

## Voice selection

Pick a default voice ID for this Capability by editing the Agent's Identity post-spawn:

```
voice:
  provider: elevenlabs
  voice_id: pMsXgVXv3BLzUgSXRplE   # Anjali (example)
  model_id: eleven_multilingual_v2
```

Voice IDs come from the ElevenLabs voice library; copy the ID from the voice's detail page.

---

*Setup steps adapted from OpenClaw's `docs/providers/elevenlabs.md` (MIT (c) 2025 Peter Steinberger).*
