---
title: Privacy Policy
type: legal
status: draft
canonical_path: wiki/legal/privacy-policy.md
deploy_url: https://2200.ai/privacy
last_updated: 2026-05-05
---

# Privacy Policy

**Effective date:** May 5, 2026

This Privacy Policy explains how 2200 ("we", "us") collects, uses, stores, and shares information when you use 2200 (the "Service"). 2200 is a personal AI agent platform: it lets you spawn and run autonomous Agents that act on your behalf, and to do their work those Agents can be authorized to access third-party services (Google, GitHub, and others) on your behalf.

We try to keep this policy short, plain, and accurate. If anything is unclear, email **dh@2200.ai**.

---

## 1. Who we are

The Service is operated by Doug Hardman, doing business as 2200. Contact: **dh@2200.ai**.

## 2. The three ways you may use 2200

Your privacy posture depends on which tier you are using:

- **Tier 1 — Self-hosted (free).** You run 2200 on your own machine. Your data, your OAuth tokens, your Agent state, and any third-party information your Agents access never leave your machine and never reach our servers. We do not have access to it. The only role we play in self-hosted mode is publishing the OAuth client credentials you authenticate against (so the consent screen says "2200" instead of "unverified app"). We do not log your authentications or your activity.
- **Tier 2 — Hosted, BYOK** (when available). You run 2200 on infrastructure we operate, and you provide your own LLM API keys (Anthropic, OpenAI, etc.). Your data, OAuth tokens, and Agent state live on our servers, encrypted at rest. Your LLM keys are stored encrypted at rest and are passed directly to the LLM providers when your Agents make calls.
- **Tier 3 — Hosted, Managed Tokens** (when available). You run 2200 on our infrastructure AND we manage the LLM provider relationships on your behalf. Your hosted instance never sees provider API keys directly; LLM calls route through a 2200 proxy service that holds the keys, applies rate limits, and meters usage against your prepaid balance.

The sections below describe what we do with data in each tier. "Managed service" (or "hosted service") refers to Tier 2 and Tier 3 collectively.

If you are not sure which tier applies to you, you are almost certainly self-hosted: managed service is in development as of the effective date above and is not generally available.

## 3. Information we collect

In **self-hosted** mode, we do not collect any information about you. We do not run analytics, telemetry, error reporting, or ping-home of any kind on your 2200 instance.

In **managed service** mode, we collect:

- **Account information.** Your email address (e.g., your `dh@2200.ai`-equivalent), authentication identifier, and any optional profile fields you provide.
- **OAuth tokens.** When you authorize 2200 to access a third-party service (Google, GitHub, etc.), we receive and store the access and refresh tokens that the third party issues. These tokens are stored encrypted at rest in a per-Agent vault and are used only by the Agents you have created.
- **Data accessed by your Agents.** When your Agent acts on your behalf using an OAuth token (e.g., reads a Gmail message, writes a Calendar event, lists a Drive folder), we transiently process the third-party data the Agent retrieves. We do not retain copies of this data beyond what is required to complete the operation, except where you have explicitly asked an Agent to write something to its persistent memory ("Brain") on your behalf.
- **Operational logs.** Standard server logs (timestamps, request paths, error stacks) are retained for up to 30 days for debugging and security purposes. We do not log message bodies or third-party data.
- **LLM-call audit logs (Tier 3 only).** When your hosted instance routes a call through our LLM proxy, the proxy logs metadata (token counts, model used, latency, cost, instance identifier) for billing accuracy and operational support. The proxy retains these audit records for 90 days. The audit records may transiently include prompt and response content; this content is access-restricted to support staff with explicit authorization, and all such access is itself logged. Our standard practice is that prompt and response content is NOT visible to users through log inspection (your Agent's own brain is the place to read what your Agents have done); this prevents log inspection from being a vector to extract Agent state.
- **Billing information.** Our payment processor (Stripe) collects the information needed to process payment. We do not store full payment card numbers.

## 4. Google API data, specifically

When you authorize 2200 to access Google services through an Agent, we may request scopes including:

| Scope | What 2200 uses it for |
|---|---|
| `openid` / `email` / `profile` | To identify you and confirm the account that authorized the Agent. |
| Gmail (`gmail.readonly`, `gmail.send`, `gmail.modify`) | To let your Agents read, send, and organize email on your behalf, only when you direct them to. |
| Calendar (`calendar`, `calendar.events`) | To let your Agents read your calendar and create or modify events on your behalf. |
| Drive (`drive.file`) | Per-file access only. Your Agents can read and write specific files you authorize, never your entire Drive. |
| Contacts (`contacts`, `contacts.readonly`) | To let your Agents look up contact information when you ask them to. |
| Tasks (`tasks`) | To let your Agents create and manage Google Tasks on your behalf. |

**2200's use of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.** Specifically:

- We use Google user data only to provide and improve the Agent features you have explicitly asked to use.
- We do not use Google user data for advertising.
- We do not sell Google user data.
- We do not transfer Google user data to third parties except as needed to provide the Service, comply with the law, or as part of a merger or acquisition (in which case we will require the recipient to honor this policy).
- We do not allow humans to read Google user data, except: (a) with your explicit consent; (b) where required for security, legal compliance, or to investigate abuse; or (c) where the data has been anonymized.

## 5. How we use information

We use the information we collect only for these purposes:

1. **Operating the Service.** Authenticating you, running your Agents, executing tool calls (including OAuth-authorized third-party calls) on your behalf, and storing your Agent state.
2. **Securing the Service.** Detecting abuse, debugging errors, and protecting against unauthorized access.
3. **Communicating with you.** Service announcements, security notifications, and support replies. We will not send marketing email without your explicit opt-in.
4. **Billing**, if applicable.

We do not use your data to train machine learning models. Your Agents do call third-party LLM providers (see Section 7) when you direct them to; those providers' policies govern their handling of the prompts and completions in transit.

## 6. How we store and protect information

In **managed service** mode:

- OAuth tokens and other secrets are stored encrypted at rest in per-Agent vaults using AES-256.
- Communications between your client, our servers, and third-party APIs use TLS in transit.
- Access to production systems is restricted to a minimum number of authorized operators.
- Backups are encrypted and retained for up to 90 days.

In **self-hosted** mode, security depends on the security of your machine. We recommend keeping your operating system patched, running 2200 under your own user account, and protecting the directory `~/.local/share/2200/` and `~/.config/2200/` (which contain encrypted credentials and OAuth-app secrets) with appropriate permissions.

No security measure is perfect. If we ever discover a breach affecting your data, we will notify you promptly.

## 7. Sharing information

We do not sell your information. We share information only as follows:

- **With third-party services you have authorized.** When your Agent calls Google, GitHub, or another provider on your behalf, the Agent transmits the authorization token and any data the call requires (e.g., the body of an email you asked it to send). The third party's privacy policy governs that interaction.
- **With LLM providers your Agents are bound to.** Each Agent is configured to use a specific large-language-model provider (Anthropic, DeepSeek, OpenAI, etc.). When the Agent runs, its prompts and tool-call inputs are transmitted to that provider for processing. The provider's policy governs that transmission.
- **With our subprocessors.** If we use third-party infrastructure to operate the managed service (e.g., a cloud host, a payment processor), they may receive limited data necessary to provide their service. Current subprocessors will be listed at https://2200.ai/subprocessors when the managed service launches.
- **As required by law.** If we receive a valid legal request, we will respond as required, and we will tell you about it unless legally prohibited.
- **In a merger or acquisition.** If 2200's business is sold or transferred, your information may transfer to the new operator, who will be required to honor this policy.

## 8. Your rights

You can:

- **Access** your data. Email us and we will export it for you. (In self-hosted mode, your data is on your own disk; you have access already.)
- **Delete** your data. Email us with your account email and a deletion request, and we will delete it within 30 days. You can also revoke OAuth grants directly at any provider's account settings (e.g., https://myaccount.google.com/permissions for Google).
- **Correct** any incorrect information by editing your account profile or contacting us.
- **Object** to processing or restrict it where applicable. Email us.

If you are in the EU/UK, you have rights under GDPR including the right to data portability and the right to lodge a complaint with your supervisory authority.

If you are in California, you have rights under CCPA including the right to know what we collect and the right to opt out of "sale" of personal information (we do not sell personal information).

## 9. Data retention

In **managed service** mode (Tiers 2 and 3):

- Account information is retained for as long as your account is active, plus 30 days after deletion.
- OAuth tokens are retained for as long as the underlying authorization is valid, or until you revoke the grant.
- Agent state ("Brain" notes, conversation history) is retained for as long as your account is active, plus 30 days after deletion, unless you delete it sooner.
- Operational logs are retained for up to 30 days, then purged.
- LLM-call audit logs (Tier 3 only) are retained for up to 90 days, then purged.
- Backups are retained for up to 90 days.

In **self-hosted** mode (Tier 1), retention is entirely under your control.

## 10. Children's privacy

The Service is not directed to children under 13. We do not knowingly collect information from children under 13. If we learn we have, we will delete it.

## 11. International transfers

If you use the managed service from outside the United States, your information may be transferred to and processed in the United States. By using the Service, you consent to that transfer.

## 12. Changes to this policy

We may update this Privacy Policy. If we make material changes, we will notify you (by email if you have an account, or through the Service). The "Effective date" at the top will always reflect the current version. Continued use of the Service after changes means you accept the updated policy.

## 13. Contact

Questions, requests, or concerns about this policy: **dh@2200.ai**.

Mailing address: TBD (will be added when 2200 forms a legal entity for the managed service).
