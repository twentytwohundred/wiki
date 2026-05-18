---
id: twilio
label: Twilio
category: voice-telephony
description: Send SMS, place voice calls, and route inbound via Twilio.
homepage: https://www.twilio.com
publisher: first-party
source:
  attribution: openclaw
  openclaw_path: extensions/voice-call/openclaw.plugin.json
  notes: |
    Twilio config schema borrowed from OpenClaw's voice-call extension
    manifest (sensitive vars marked, UI labels lifted). Walkthrough is
    original to 2200; OpenClaw's voice-call docs cover the higher-level
    extension config, not Twilio onboarding specifically. OpenClaw is
    MIT (c) 2025 Peter Steinberger.
auth:
  - name: TWILIO_API_AUTH
    kind: api_key_dual
    env_var: TWILIO_API_AUTH_REF
    obtain_url: https://console.twilio.com
unlocks:
  tools:
    - twilio_send_sms
    - twilio_call_outbound
    - twilio_lookup_number
    - twilio_list_messages
  skills: []
  extensions:
    - voice-call
  providers: []
network_egress:
  domains:
    - api.twilio.com
    - messaging.twilio.com
    - lookups.twilio.com
    - sip.twilio.com
tags:
  - voice
  - sms
  - telephony
  - twilio
  - phone
  - call
  - text
requires:
  bins: []
  os: []
  capabilities: []
walkthrough:
  estimated_minutes: 10
  difficulty: medium
---

# Setup walkthrough

*This walkthrough is for self-hosted 2200 installs. Hosted-tier operators have Twilio available through the platform proxy when their tier includes voice/SMS; no separate Twilio account needed there.*

You'll create a Twilio account (or use an existing one), grab the Account SID and Auth Token, and hand both to 2200. About 10 minutes for a fresh account because Twilio's onboarding has phone-number-verification steps that take a few minutes; about 3 minutes if you already have a Twilio account.

## Step 1 ... create or sign into Twilio

Go to [console.twilio.com](https://console.twilio.com). If you don't have an account, sign up. Twilio requires phone-verification of the email's owner during signup.

For new accounts: you start in **trial mode** with a small credit and a single Twilio phone number that's restricted to sending to your verified phone number. Sufficient for the Agent's first round of testing. Upgrade to a paid account (small monthly minimum) before shipping anything real.

## Step 2 ... grab the Account SID and Auth Token

In the Twilio Console, the **Account SID** (starts with `AC...`) and **Auth Token** are on the main dashboard right below the account banner. Click **Show** next to Auth Token to reveal it; copy both.

You'll paste both values into 2200 in the next step.

## Step 3 ... provision a phone number (if you don't have one)

Console → **Phone Numbers → Manage → Active Numbers**. If empty, click **Buy a number**:

- Pick the country and area code.
- Check the capabilities you need (SMS, Voice, MMS).
- Twilio shows monthly cost (typically $1-2/mo for US numbers).
- Click **Buy**.

Save the number; 2200 will use it as the default `from` number for outbound SMS and calls.

## Step 4 ... paste both credentials into 2200

When 2200's runtime opens the credential request prompt (in your 1:1 chat with the Agent), paste two values:

- **Account SID** ... the `AC...` string from Step 2.
- **Auth Token** ... the revealed value from Step 2.

Both go browser → runtime → vault. Neither appears in the Agent's LLM context or transcripts. The credential is sealed as a structured envelope with both values; the Twilio tools fetch both from the vault on demand.

## Step 5 ... verify

Ask the Agent to send a test SMS:

> "Send a test SMS to my phone number that says 'twilio works'."

The first SMS arrives within seconds. If you're on a trial account and the SMS doesn't arrive, your destination number isn't on Twilio's verified-numbers list (trial restriction); add it under **Phone Numbers → Verified Caller IDs**.

## What this unlocks

- `twilio_send_sms` ... send SMS to any number (trial accounts: only verified numbers).
- `twilio_call_outbound` ... place an outbound voice call (used by the voice-call extension; see below).
- `twilio_lookup_number` ... look up a phone number's carrier, type, line info via Twilio Lookup.
- `twilio_list_messages` ... query SMS history for the account.

## Voice Call extension

If you also installed the `voice-call` extension, Twilio is now the recommended PSTN provider for voice calls. Voice Call uses your Twilio number for inbound and outbound; the realtime STT/TTS pipeline (ElevenLabs / Deepgram / OpenAI Whisper depending on config) layers on top.

For inbound calls, you'll set Twilio's voice webhook to your 2200 gateway's URL. The voice-call extension's setup wizard walks through this; not covered in this Capability's walkthrough (different concern).

## Billing

Twilio prices per-SMS (typically $0.0075/SMS in the US), per-minute-of-call (typically $0.013/min for US-to-US), and monthly per-phone-number. Set spend limits in the Twilio Console (Settings → Usage → Triggers).

## Multi-account note

One Twilio Account SID has one Auth Token. If your Agent operates against multiple Twilio accounts (e.g. test + prod), provision them as separate Capability installs ... future multi-account support in a single Capability is a follow-on.

---

*Twilio config field naming borrowed from OpenClaw's `extensions/voice-call/openclaw.plugin.json` (MIT (c) 2025 Peter Steinberger). Walkthrough prose is original to 2200.*
