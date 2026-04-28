---
title: "2200 operating thesis"
type: strategy
status: locked
tags: [strategy, operating-thesis, success-criteria, acquisition]
created: 2026-04-26
canonical_path: wiki/strategy/2200-operating-thesis.md
---

# 2200 operating thesis

The goal of 2200 is to be self-sustaining and profitable indefinitely. Acquisition is optional upside.

## Success criterion

$10,000/month in profit, sustainable.

When 2200 reliably produces $10K/month after infrastructure and operating costs, the project has won. Not "won" in the venture sense (build a billion-dollar company), but won in the operating sense: it pays for itself, it pays the operator's life, it doesn't require the operator's labor to keep producing.

If someone wants to buy it after that point, the conversation happens from a position of strength. The product is profitable, the operator can walk away, the price reflects that. Acquisition is a transaction, not a rescue.

If no acquirer ever appears, 2200 keeps running. The world doesn't end. The operator's life is funded.

## Why this framing matters for design decisions

"Build to be acquired" and "build to be profitable" produce different products.

**Build to be acquired** tempts toward:
- Features that look good in due diligence
- Architecture that's textbook-correct
- Documentation that demonstrates rigor
- Polish that signals seriousness

**Build to be profitable** forces toward:
- Features users actually pay for
- Architecture that scales economically
- Documentation that serves operators (so they can use the thing)
- Quality that sustains long-term users

These overlap but they're not identical. When the two diverge, choose profitable. Acquirers prefer profitable products anyway; the path that produces profit is also the path that produces a credible exit.

## What this means in practice

Several decisions are clearer with this frame:

**No outside investment.** Investors complicate the cap table and constrain decisions. Bootstrap. Self-fund. The operator owns 100% of whatever 2200 becomes. This applies even to friends-and-family money; even small outside money creates obligation.

**Solve real problems for paying users.** Don't build features speculatively. Build what users will pay for, ship it, listen to what the next batch of users want, ship that. Tight feedback loops with real customers.

**Pricing is a real concept.** 2200 needs a pricing model that produces $10K/month at a realistic scale. Math: at $50/month/user, that's 250 paying users (assuming ~50% margin after costs). At $100/month, 125 users. At $25/month, 500 users. The pricing decision drives the user count, which drives the marketing approach, which drives the product.

**Keep the codebase clean and absorbable.** Not because we're building to sell, but because clean codebases are easier to operate. A small, well-documented codebase that one person can hold in their head is easier to maintain alone than a sprawling system. This also happens to be what acquirers want, but that's not the reason.

**Document the architecture for operators, not for acquirers.** The wiki is for the team running 2200 (Doug, Hobby, future agents) and for users who want to understand what they're using. It's not a due-diligence packet. The fact that good documentation also makes due diligence faster is a bonus.

**Ship a complete v1, then iterate.** Don't build forever. The 6-month window from April through October is when v1 needs to ship and start producing revenue. After that, the clock is on whether 2200 hits sustainability or whether it goes back to consulting time.

## What this means for scope

2200 has 19 epics in the current map. Not all of them are v1.

The v1 question is: what's the smallest 2200 that delivers enough value that someone pays for it?

Probably:
- The runtime (Epic 2, done)
- Local pub integration (Epic 3, in progress)
- A handful of working Agents migrated in (Epic 5)
- Onboarding flow that lets a new user spawn an Agent (subset of Epic 1)
- Pricing and billing integration (Epic 18, currently late in the map)

That's a tighter v1 than "all 19 epics done." The remaining epics ship as upgrades to paying users over time, not as launch requirements.

Worth thinking about which epics are pre-revenue vs. post-revenue. Pre-revenue epics block launch. Post-revenue epics ship to live users.

## What this is not

Not a pivot. The architectural and design decisions made so far are right. The framework, the patterns, the discipline are all sound.

What this is: an explicit naming of why the work matters and what success looks like. Hobby (and any future Agents on the project) should make decisions with this thesis in mind.

When in doubt: would this feature attract a paying user? Would this architecture sustain the product for years? Would this code be cheap to operate at small scale? If yes to all three, ship. If any are no, reconsider.

## The portfolio context

2200 isn't the only bet. The operator (Doug) is also building SCUT, OpenPub, Kabuzz, Carl Monday, MrDoug brand, and others. Each is a bet on a different problem. The portfolio strategy is: build several, see which ones hit, double down on the winners.

2200 is one of the bets. It might be the one that hits $10K/month. It might not. Either way, the work is real and the architecture matters.

If 2200 doesn't hit but another property does, 2200 keeps running quietly in the background as long as it's break-even or better. We don't shut down working software just because something else is the breadwinner.

If 2200 is the breadwinner, the portfolio narrows: less attention to the others, more attention to 2200's growth. That decision happens when the data tells us, not before.

## What changes for Hobby

Probably nothing in your day-to-day work. You're already building cleanly, documenting well, and shipping fast. Keep doing that.

What this thesis adds: when you face a decision between "thorough" and "shippable," lean toward shippable. When you face a decision between "comprehensive" and "focused," lean toward focused. When you face a decision between "this might be cool" and "users will pay for this," lean toward what users pay for.

Good engineering is always good engineering. The question is which good engineering ships v1 fastest with the highest probability of producing revenue.

## What changes for the wiki

The Claude Code research note (already published) mentioned acquisition. That framing was incomplete. The acquisition thesis is real but it's secondary. The primary thesis is sustainable profitability. Update the Claude Code note's strategic section to reflect this hierarchy when convenient; not urgent.

Future strategy decisions reference this doc as the operating frame.

---

*Strategy doc · 2026-04-26 · authored by Doug Hardman + Guppi*
