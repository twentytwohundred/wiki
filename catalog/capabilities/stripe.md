---
id: stripe
label: Stripe
category: payments
description: Charge cards, manage subscriptions, read Stripe payouts.
homepage: https://stripe.com
publisher: first-party
source:
  attribution: original
  notes: |
    Original walkthrough; no OpenClaw or Hermes prior art for Stripe.
    Stripe is critical Tier 1 for 2200's operating thesis ($10K/mo
    profit target depends on Stripe working; see Hobby's session 31
    handoff and [[../decisions/2026-04-29-operating-thesis]] if filed).
    Walkthrough takes the operator through Stripe Dashboard step by
    step, with attention to the test-mode-vs-live-mode distinction
    (the biggest first-time-setup footgun).
auth:
  - name: STRIPE_SECRET_KEY
    kind: api_key
    env_var: STRIPE_SECRET_KEY_REF
    obtain_url: https://dashboard.stripe.com/apikeys
unlocks:
  tools:
    - stripe_customer_lookup
    - stripe_customer_list
    - stripe_charge_create
    - stripe_charge_get
    - stripe_charge_list
    - stripe_subscription_list
    - stripe_subscription_get
    - stripe_subscription_cancel
    - stripe_payout_list
    - stripe_invoice_list
    - stripe_invoice_get
    - stripe_event_list
  skills: []
  extensions: []
  providers: []
network_egress:
  domains:
    - api.stripe.com
    - files.stripe.com
    - m.stripe.network
tags:
  - payments
  - stripe
  - billing
  - subscription
  - charge
  - customer
  - payout
  - invoice
requires:
  bins: []
  os: []
  capabilities: []
walkthrough:
  estimated_minutes: 12
  difficulty: medium
---

# Setup walkthrough

*This walkthrough is for self-hosted 2200 installs. Hosted-tier operators cannot use this Capability ... payment processing requires per-operator Stripe accounts; the platform does not proxy Stripe.*

You'll create a Stripe account (or use an existing one), generate a restricted API key scoped to what the Agent needs, and hand it to 2200. About 12 minutes start to finish.

The single biggest first-time-setup footgun: **Stripe Dashboard defaults to Test mode.** The keys in Test mode look real (`sk_test_...`) but only work against Stripe's test ledger ... no real money moves. When you flip to Live mode the keys are different (`sk_live_...`). Make sure you generate the right key for what the Agent should actually do, and consider whether the Agent should be operating in test or live mode at all (see "Test vs live" below).

## Step 1 ... open Stripe Dashboard

Go to [dashboard.stripe.com](https://dashboard.stripe.com). Sign in or create a Stripe account.

For new accounts: Stripe will walk through business-info collection, bank-account verification for payouts, identity verification for the account holder. Stripe takes 1-3 business days to activate the account for live charges. You can use Test mode immediately.

## Step 2 ... decide test vs live

Top-left of the Dashboard, you'll see a toggle ... **Test mode** or **Live mode**. This is the single most important decision for an Agent setup.

**Use Test mode if:**
- You're prototyping the Agent's Stripe usage.
- You want the Agent to issue charges and verify the flow without real money.
- You're not yet sure what the Agent should be allowed to do.

**Use Live mode if:**
- The Agent is operating an active business (recurring billing, customer subscriptions, real charges).
- You've thought through the scope of what the Agent can do (restricted API key with limited permissions is the answer to "what if it makes a mistake").

Recommendation for the first install: **start with Test mode.** Get the Agent working against test data. When you're comfortable with what it does, repeat this walkthrough with a Live mode key.

## Step 3 ... create a restricted API key

Stripe has two key types:

- **Standard secret keys** (`sk_test_...` / `sk_live_...`) ... full account access. Powerful, dangerous. Don't use these for Agents unless you're certain.
- **Restricted keys** (`rk_test_...` / `rk_live_...`) ... scoped per-resource. Recommended for Agents.

Go to [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys). Make sure you're in the mode you decided in Step 2 (top-left toggle).

Click **Create restricted key**. Configure:

- **Name**: `2200 Agent` (or your Agent's name).
- **Permissions** (set per-resource):
  - **Customers**: Read OR Read + Write (write only if Agent creates customers; usually Read is enough for lookup-style Agents).
  - **Charges**: Read OR Read + Write (write only if Agent issues charges).
  - **Subscriptions**: Read OR Read + Write (write only if Agent modifies subscriptions).
  - **Invoices**: Read.
  - **Payouts**: Read.
  - **Events**: Read.
  - **Webhooks**: None (the Agent doesn't manage webhook endpoints).
  - **Connect / Treasury / Issuing**: None (unless your Agent specifically needs them).

If you don't know whether the Agent needs a permission, default to NOT granting it. You can always create a new restricted key later with broader scope; restricting now is the safer default.

## Step 4 ... copy the key

Click **Create key**. Stripe shows the key once, prefixed `rk_test_...` or `rk_live_...`. **Copy it now** ... if you navigate away, you'll need to delete it and create a new one.

## Step 5 ... paste into 2200

When 2200's runtime opens the credential request prompt (in your 1:1 chat with the Agent), paste the key.

The key goes browser → runtime → vault. It never appears in the Agent's LLM context or transcripts.

## Step 6 ... verify

Ask the Agent to confirm:

> "Look up the most recent 5 customers on Stripe."

If you're in Test mode against a fresh account, you may see an empty list (no test data yet); the call succeeded if the response is empty rather than an error.

If you see `401`, the key is invalid or revoked.
If you see `403` on a specific resource, the restricted key didn't grant that permission ... revisit Step 3.

## What this unlocks

Read operations:
- `stripe_customer_lookup`, `stripe_customer_list`
- `stripe_charge_get`, `stripe_charge_list`
- `stripe_subscription_get`, `stripe_subscription_list`
- `stripe_invoice_get`, `stripe_invoice_list`
- `stripe_payout_list`
- `stripe_event_list`

Write operations (only functional if your restricted key grants the corresponding write permission):
- `stripe_charge_create`
- `stripe_subscription_cancel`

## Test vs live ... a recurring caution

If you ever get confused about which mode the Agent is operating in, ask it:

> "Are you currently using Stripe in test or live mode?"

The Agent can introspect the key prefix (`rk_test_` vs `rk_live_`) and tell you. **Confirm this before asking the Agent to do anything that moves money.** Test-mode mistakes are educational; live-mode mistakes cost actual money and (worse) affect actual customers.

## Rotation

Stripe restricted keys don't expire by default. Rotate by creating a new restricted key, pasting it into 2200 via this walkthrough (re-runs Steps 3-5), then deleting the old one from the Dashboard. The new key takes effect on the Agent's next API call.

## Multi-account note

One restricted key targets ONE Stripe account. If your Agent operates against multiple Stripe accounts (e.g. test sandbox + production), provision them as separate Capability installs ... v1 holds one Stripe credential per Capability install.

---

*Walkthrough original to 2200. Stripe's documentation at [stripe.com/docs](https://stripe.com/docs) is the canonical reference for any operation beyond the typed tools.*
