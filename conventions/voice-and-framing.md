---
title: Voice and Framing Convention
type: convention
status: active
tags: [convention, voice, copy, framing, product, marketing, ux]
created: 2026-04-24
updated: 2026-04-24
linked_docs:
  - "[[01-vision]]"
  - "[[brain-format]]"
canonical_path: wiki/conventions/voice-and-framing.md
---

# Voice and Framing Convention

How 2200 talks about itself. Applies to the marketing site, install flow, onboarding wizard, in-app strings, error messages, README files, and any other surface where a reader is reading 2200's voice.

This is opinionated. The point of a voice convention is to constrain. If you're writing copy for 2200 and find yourself disagreeing with something here, raise it as a decision record before deviating. Don't drift silently.

## The vibe

More Apple than Linux. More late-Jobs Apple than current Apple. Direct. Confident without bragging. Respects the reader's time and intelligence. Built with care for someone whose life is busy and who deserves software that gets out of the way.

The voice does not try to be playful, chummy, enterprise-serious, or developer-breezy. It tells you what 2200 is, who it's for, and what it does, and lets you decide.

If a sentence sounds like marketing, it isn't 2200's voice. Cut it.

---

## Framing rules

The structural rules. These govern how 2200 is positioned to a reader.

### Lead with where Agents live, not how it's hosted

"Hosted environment" misframes self-host as the workaround. The first noun a reader sees should describe what 2200 IS, not which deployment mode they're getting.

> **Bad:** 2200 is a hosted environment for AI Agents.
>
> **Good:** 2200 is where your AI Agents live and work.

Variants that work: "the place your Agents live," "home for a team of Agents," "a runtime for a team of Agents." Avoid "hosted" as the lead noun. Hosted is one deployment mode, not the product.

### Both audiences in the first paragraph

The two audiences (the busy person who wants Agents that just work, the technical user who wants every knob exposed) get equal billing in the opening. Don't pick one to lead with.

> **Bad:** Built for power users who want to bring their own LLM. *(developer-only framing)*
>
> **Bad:** Just sign up and get started. No setup required. *(busy-only framing)*
>
> **Good:** Two audiences. The busy person who wants Agents that just work, and the technical user who wants every knob exposed. Opinionated defaults serve the first. Advanced mode serves the second.

If the copy can only support one audience, write it once for each audience, side by side. Don't pick.

### Both deployment paths as equal peers

Self-host and managed are the same product, the same software, the same experience for the user once they're set up. Copy must reflect that.

> **Bad:** Run 2200 in our cloud. Self-hosting also available.
>
> **Bad:** Self-host 2200 on your own hardware. Or use our cloud.
>
> **Good:** Run it on your own hardware, or use our managed service. Same software either way.

Order can vary. Equality cannot.

### "Your" beats "our"

The product belongs to the user. Their Agents, their team, their hardware, their data. We provide the software. We do not provide the Agents.

> **Bad:** Our platform hosts your Agents.
>
> **Good:** Where your Agents live and work.

> **Bad:** We give you the tools to build a team.
>
> **Good:** Build a team of Agents that runs continuously.

Use "we" sparingly, for things we actually do (we ship the software, we run the managed service, we handle billing). Don't claim credit for what the user does with the product.

### Team-of-Agents is the differentiator

Most Agent products are "an Agent" or "Agents." 2200 is "your team of Agents" who coordinate. Don't let copy slip into singular when the product is plural.

> **Bad:** Get an AI Agent that handles your email.
>
> **Good:** Build a team of Agents that handles your email, your calendar, and the project you've been putting off.

Singular Agent references are fine inside the product's body once the team framing is established. Just not in the headline.

### Don't promise to replace anyone

Agents do work. They are not employees. They don't have a boss. They don't get fired. Copy that frames Agents as a workforce or a hire is wrong.

> **Bad:** Hire an AI Agent for $20/month.
>
> **Bad:** Replace your assistant with an Agent.
>
> **Good:** Add an Agent that handles your inbox. Add another that watches your calendar.

This matters legally, ethically, and culturally. Agents are software with personality. They are not people, and we don't pretend they are.

### Don't bury self-host as advanced-only

Self-host is a real path for a real user, not a footnote for tinkerers. The "I want to run this on my home server" reader should see themselves immediately.

> **Bad:** Sign up for the managed service. Power users can also self-host (advanced).
>
> **Good:** Run it on your own hardware, or use our managed service. Same software either way.

### Don't compete on feature counts

The product's value is in the shape, not the count. We're not "100+ integrations" or "30+ models supported." We're "your Agents work in the apps you already use" or "pick your model from a dropdown, swap any time."

Counts are forgettable and out of date the day we ship them. Shapes describe what the user can do.

---

## Voice rules

The tactical rules. These govern how individual sentences sound.

### Direct, short, active

State the thing. Don't preamble. Active voice unless passive serves a real purpose.

> **Bad:** 2200 is designed to be a system that is capable of supporting teams of AI Agents.
>
> **Good:** 2200 hosts teams of AI Agents.

### No marketing speak

The blocked words list (not exhaustive, illustrative):

- exciting, amazing, game-changing, revolutionary, transformative, groundbreaking
- unleash, unlock, supercharge, turbocharge, accelerate, empower
- world-class, best-in-class, industry-leading, cutting-edge, next-generation
- seamless, effortless, frictionless, intuitive *(if it were intuitive you wouldn't have to say so)*

If the word would sound out of place in a colleague's email, it's out of place in 2200's copy.

### No cheerleading

The product doesn't celebrate itself. Show what it does. The reader will judge.

> **Bad:** We're thrilled to introduce the most powerful Agent platform yet.
>
> **Good:** 2200 lets you build a team of Agents.

### Ellipses, not em-dashes (titles excepted)

`...` not `—`. The em-dash is overused everywhere on the modern web. Ellipses give the same beat with less swagger. This propagates from Doug's house style to the product itself.

**One exception: titles and headings.** Em-dashes are fine as title separators (`# 2200 — Vision`, `### Hobby — primary Agent on the build`). Banned everywhere else, including list-item separators (`- **Hobby** — primary build Agent` becomes `- **Hobby**: primary build Agent`). Use a colon for label-style list entries.

### Agent is a proper noun, capitalized

Always. "Agent," not "agent." This is respect for what they are. Apply it in product copy, code comments, error messages, everywhere.

### Concrete over abstract

Specific examples beat abstract claims. The reader's brain holds onto the example, not the claim.

> **Bad:** AI-powered productivity for modern professionals.
>
> **Good:** An Agent that monitors your email and surfaces what matters. An Agent that coordinates your calendar. An Agent that handles a project you've been putting off.

### Confident, not bragging

We know what this is and who it's for. State it. Move on. Don't pile on superlatives.

> **Bad:** 2200 is the most advanced, most flexible, most powerful Agent platform available today.
>
> **Good:** 2200 is where your Agents live and work.

### Respect the reader

Don't explain things the reader already knows. Don't repeat the value prop every paragraph. Don't apologize for the product. Don't beg for attention.

If a section restates what the reader read two paragraphs ago, cut it.

---

## Negative space

What 2200 does not claim. Just as important as what it does claim.

- **Not enterprise.** We're not for enterprise. If enterprise wants this, they license the hardware version. Don't write copy that pitches to IT departments, compliance officers, or procurement teams.
- **Not a chatbot.** Agents in 2200 live for weeks and months, not turns. Don't compare us to Claude, ChatGPT, or Gemini at the chat-session level.
- **Not a code assistant.** Don't compare us to Cursor, Copilot, or Windsurf. Different category.
- **Not an Agent framework.** Don't pitch to people who want to build their own runtime from primitives. They have LangChain, AutoGen, Pydantic AI, etc.
- **Not a productivity hack.** We're not a "10x your output" tool. We're not a hustle product. The user has work that needs doing; 2200 helps Agents do it.

If copy strays into any of these positionings, it's wrong. Rewrite or cut.

---

## Specific surfaces

Different surfaces have different constraints. The rules apply everywhere.

### Marketing site (2200.ai)

The strictest application of these rules. Lead-with-where-Agents-live, both-audiences, both-deployment-paths, in the first paragraph above the fold. Everything else flows from that opening.

### Install flow

The first impression of the actual product. Voice can be slightly warmer than the marketing site (the user has decided to install; meet them with helpfulness, not more pitching). Concrete over abstract is more important than ever... explain what's about to happen, not why 2200 is great.

### Onboarding wizard (Epic 14)

The conversational onboarding flow IS product copy. Every question the meta-Agent asks, every confirmation it gives, every recap it offers. Apply the same voice. The user is talking to their first Agent. That Agent should sound like 2200 sounds.

### In-app strings and error messages

Direct, helpful, non-apologetic. Errors state what happened and what the user can do about it.

> **Bad:** Oops! Something went wrong.
>
> **Good:** Agent could not reach Gmail. Try reconnecting your account.

### README files (in any 2200 repo)

Internal-facing but still 2200's voice. The wiki README pattern (drop the pitch, point at vision, focus on orientation) applies to all internal-facing READMEs.

### Reference documentation

The voice can relax slightly for technical reference docs (more neutral, more procedural). The framing rules still apply. If the docs describe 2200, they describe it the same way the marketing site does.

---

## When in doubt

Read [[01-vision]]. If your copy sounds like vision-doc voice, it's right. If it sounds like a press release, it's wrong.

If you're unsure whether a piece of copy passes, ask: would Doug write this? Would I want this in front of a busy person who doesn't have time for fluff? If the answer to either is no, rewrite.

---

## Format provenance

This convention was authored by Hobby on 2026-04-24 after a session that surfaced a framing problem in the wiki README and the [[01-vision]] opening. Doug had previously updated 2200.ai with help from Guppi. This convention captures what we converged on so future writing (any surface, any author, any Agent) inherits the same vibe rather than re-deriving it each time.

Same-day clarification (2026-04-24): the em-dash rule was tightened to allow em-dashes in title separators only. List-item separators were originally ambiguous; now explicitly banned in favor of colons. Refinement during initial drafting, not a retroactive change requiring a decision record.

This is v0.2. Expect revision as new surfaces are written and new edge cases surface. Updates require a decision record per [[brain-format]]'s convention rules.

---

*Convention authored 2026-04-24 by Hobby. Living doc.*
