---
title: Terms of Service
type: legal
status: draft
canonical_path: wiki/legal/terms-of-service.md
deploy_url: https://2200.ai/terms
last_updated: 2026-05-05
---

# Terms of Service

**Effective date:** May 5, 2026

These Terms of Service ("Terms") govern your use of 2200, a personal AI agent platform that lets you spawn and run autonomous Agents on your behalf (the "Service"). The Service is operated by Doug Hardman, doing business as 2200 ("we", "us"). Contact: **dh@2200.ai**.

By using the Service, you agree to these Terms. If you do not agree, do not use the Service.

---

## 1. The Service

2200 lets you create autonomous Agents that take actions on your behalf, including: holding state in a per-Agent "Brain", calling third-party services you have authorized, scheduling work, and coordinating with other Agents you have created. The Service is offered in three tiers:

- **Tier 1 — Self-hosted (free).** You install and run 2200 on infrastructure you control. We provide the software (under the Elastic License v2) and the OAuth client credentials your Agents use to authenticate against third-party services. You bring your own LLM API keys.
- **Tier 2 — Hosted, BYOK** (when available). We host 2200 for you on our infrastructure. You bring your own LLM API keys; you pay LLM providers directly for tokens.
- **Tier 3 — Hosted, Managed Tokens** (when available). We host 2200 for you AND manage the LLM provider relationships. You prepay a token balance; we bill at provider rate plus a markup (currently 12.5%, displayed transparently in your usage dashboard).

These Terms apply to all three tiers, with tier-specific provisions noted where relevant. "Managed service" (or "hosted service") below refers to Tier 2 and Tier 3 collectively.

## 2. Your account

For the managed service, you must create an account using a valid email address. You are responsible for keeping your credentials secure and for all activity under your account. Tell us promptly if you suspect unauthorized access: **dh@2200.ai**.

For self-hosted use, no account is required. You are responsible for the security of the machine you run 2200 on.

## 3. Acceptable use

You agree not to use the Service to:

- Violate any applicable law or regulation.
- Infringe anyone else's rights, including intellectual property, privacy, or publicity rights.
- Send spam, phishing, malware, or harassing content.
- Attempt to gain unauthorized access to the Service, other users' accounts, or any system or network.
- Interfere with or disrupt the Service or its underlying infrastructure.
- Reverse-engineer, decompile, or attempt to extract the source code of any compiled component (the source code we publish is publicly available; this restriction is for components we have not).
- Use the Service to build a competing product (per the Elastic License v2 restrictions on the open-source distribution).
- Cause your Agents to take actions that violate the policies of any third-party service the Agents access (e.g., violate Google's terms of service via Gmail/Drive/Calendar API calls).

You are responsible for the actions your Agents take. An Agent acting on your behalf is acting under your authorization; you cannot disclaim responsibility for its actions.

## 4. Third-party services

When you authorize an Agent to access a third-party service (Google, GitHub, etc.), the third party's terms of service and privacy policy govern that authorization in addition to ours. We do not control third-party services and are not responsible for their behavior, availability, or terms.

When an Agent runs, it transmits prompts and tool-call inputs to a large-language-model provider you have configured (Anthropic, DeepSeek, OpenAI, etc.). Those providers' terms govern that transmission. You are responsible for choosing an LLM provider whose terms you accept.

## 5. Your content; your rights

You retain all rights in the data you create, store, or transmit through the Service ("Your Content"), including the contents of your Agents' Brains, the messages they send, and any third-party data they access on your behalf.

You grant us a limited license to host, store, transmit, and process Your Content solely as needed to provide the Service to you. This license ends when you delete the content or terminate your account.

We do not use Your Content to train machine learning models, sell Your Content, or use it for advertising.

## 6. Our software; our rights

The 2200 software is published under the [Elastic License v2](https://www.elastic.co/licensing/elastic-license). In short, you may use, copy, modify, and redistribute the software for your own use, but you may not offer a hosted version of the software as a competing service. Read the license for the full terms.

The 2200 brand, logos, and other trademarks are ours. Nothing in these Terms grants you any right to use them outside of the Service.

## 7. Service availability

We will make reasonable efforts to keep the managed service available, but we do not guarantee uninterrupted operation. The Service may be unavailable for maintenance, updates, or due to events outside our control. We are not liable for the consequences of any outage.

For self-hosted use, the Service runs on your infrastructure and its availability is entirely your responsibility.

## 8. Pricing and payment

**Tier 1 (Self-hosted) is free** under the Elastic License v2. No payment is owed to us; you pay your LLM provider directly for tokens.

**Tier 2 (Hosted, BYOK)** is a paid hosting subscription. Current pricing will be published at https://2200.ai/pricing when the managed service launches. The hosting fee is charged in advance for the billing period (monthly by default). You bring your own LLM API keys; you pay LLM providers directly for tokens.

**Tier 3 (Hosted, Managed Tokens)** is a paid hosting subscription plus a prepaid token balance:
- The hosting fee is charged the same way as Tier 2.
- The token balance is funded by you in advance and consumed as your Agents make LLM calls. We bill at the LLM provider's published rate plus our markup (currently 12.5%; both the provider rate and our markup are displayed in your usage dashboard).
- The balance auto-tops up by a configurable amount when it crosses a low threshold. You can disable auto-top-up.
- Service pauses at $1.00 remaining balance to give you a small buffer to wind down or top up gracefully. In-flight tasks complete; scheduled tasks queue but do not execute; data is preserved indefinitely until you top up or formally cancel.

We may change managed-service pricing or markup percentages with 30 days' notice; if you do not agree to the new pricing, you may cancel before it takes effect. Token-balance markup changes apply only to balance funded after the change takes effect.

**Refunds and balance policy.**
- The prepaid token balance is non-refundable but usable indefinitely (or until account termination). Unused balance does not expire.
- The hosting subscription is prorated on cancellation if you cancel mid-period (we refund unused days).
- If a payment is disputed or flagged as fraudulent, we may pause the affected instance immediately while we investigate. We will work with you in good faith to resolve disputes.
- If you are a consumer in a jurisdiction that requires a cooling-off period for digital services (e.g., EU member states), you may have additional rights under local law that override these terms.

If you owe us money for the managed service and do not pay, we may suspend or terminate your access.

## 9. Termination

You may stop using the Service at any time. For the managed service, you may close your account by emailing **dh@2200.ai**.

We may suspend or terminate your access to the Service if:

- You materially breach these Terms.
- We are required to do so by law.
- Continuing to provide the Service to you exposes us or others to legal or security risk.

For the managed service, on termination we will retain your data per the retention schedule in the Privacy Policy and then delete it.

## 10. Disclaimers

THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ANY WARRANTY ARISING FROM COURSE OF DEALING OR USAGE OF TRADE.

WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS, OR THAT ANY DATA YOU STORE WILL BE SECURE OR NEVER LOST.

AGENTS ARE AUTONOMOUS AND PROBABILISTIC. YOU UNDERSTAND THAT AN AGENT MAY MAKE MISTAKES, MISINTERPRET INSTRUCTIONS, OR ACT IN UNEXPECTED WAYS. YOU ARE RESPONSIBLE FOR REVIEWING AGENT BEHAVIOR AND FOR ANY DECISIONS YOU OR YOUR AGENTS MAKE. DO NOT USE 2200 FOR DECISIONS WHERE AGENT ERROR COULD CAUSE SIGNIFICANT HARM WITHOUT INDEPENDENT HUMAN REVIEW.

## 11. Limitation of liability

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, WE WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, OR PUNITIVE DAMAGES (INCLUDING LOST PROFITS, LOST DATA, OR BUSINESS INTERRUPTION) ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

OUR TOTAL LIABILITY ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE WILL NOT EXCEED THE GREATER OF (A) ONE HUNDRED DOLLARS (USD $100) OR (B) THE AMOUNT YOU HAVE PAID US FOR THE SERVICE IN THE TWELVE MONTHS PRECEDING THE CLAIM.

Some jurisdictions do not allow the exclusion or limitation of certain damages. In those jurisdictions, our liability is limited to the maximum extent permitted by law.

## 12. Indemnification

You will indemnify, defend, and hold harmless 2200, its operators, and their successors and assigns from and against any claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising out of or related to: (a) your use of the Service; (b) your violation of these Terms; (c) your Agents' actions; or (d) your violation of any third party's rights.

## 13. Governing law and disputes

These Terms are governed by the laws of the State of Alabama, USA, without regard to conflict-of-law rules. Disputes will be resolved in the state or federal courts located in Tuscaloosa County, Alabama; you and we consent to the personal jurisdiction of those courts.

If you are a consumer in a jurisdiction whose mandatory law gives you a different forum or governing law, those mandatory rules apply notwithstanding this section.

## 14. Changes to these Terms

We may update these Terms from time to time. If we make material changes, we will notify you (by email if you have an account, or through the Service) and update the "Effective date" at the top. Continued use of the Service after changes means you accept the updated Terms.

## 15. Miscellaneous

- **Entire agreement.** These Terms (together with the Privacy Policy and any other documents we expressly incorporate) are the entire agreement between you and us regarding the Service.
- **Severability.** If any provision is held unenforceable, the rest of the Terms remain in effect and the unenforceable provision will be modified to the minimum extent necessary to be enforceable.
- **No waiver.** Our failure to enforce any provision is not a waiver of that provision.
- **Assignment.** You may not assign these Terms without our written consent. We may assign them in connection with a merger, acquisition, sale of assets, or reorganization.
- **No agency.** These Terms do not create any agency, partnership, joint venture, employment, or franchise relationship.

## 16. Contact

Questions about these Terms: **dh@2200.ai**.

Mailing address: TBD (will be added when 2200 forms a legal entity for the managed service).
