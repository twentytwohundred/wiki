---
title: Design Language Convention
type: convention
status: active
tags: [convention, design, ux, principles, analog]
created: 2026-04-24
updated: 2026-04-24
linked_docs:
  - "[[01-vision]]"
  - "[[voice-and-framing]]"
  - "[[pulse]]"
canonical_path: wiki/conventions/design-language.md
---

# Design Language Convention

How 2200 looks and feels at the UI/UX level. Sibling to [[voice-and-framing]], which covers the words. This convention covers the shapes, the metaphors, and the principle that holds them together.

## The principle

**Every novel concept in 2200 rides on a familiar analog, with high-tech execution layered on top.**

When a user encounters a new feature, the underlying metaphor should be something they already know from outside software. The novelty is in the polish and the precision, not in the basic shape. This is how we keep the product approachable for the busy user while still being modern enough for the technical user.

If a UI element requires the user to learn what it is before they can use it, we picked the wrong analog.

---

## Why this matters

- **Legibility at a glance.** A familiar analog is understood in milliseconds. A novel one needs a tooltip.
- **Low learning curve.** Users are productive immediately. The product gets out of the way.
- **Emotional fit.** Familiar shapes carry emotional associations. We borrow them on purpose.
- **Coherence over time.** A product built from familiar analogs feels intentional, not random. Users start to expect "the next 2200 thing will probably look like X I already know."
- **Resists drift.** When every new feature has to find its analog, the temptation to invent novelty for its own sake is curbed. Less Linux.

---

## Canonical examples (Apple)

Apple is the master of this principle. The canonical examples worth keeping in mind:

- **iPod click wheel (2001).** Took the wheel, humanity's second invention, and made it digital. Tactile, intuitive, instantly understood. No one had to learn it.
- **Sleeping Mac breathing LED (Power Mac G4/G5 era).** A small white LED on the front of the machine that pulsed at the rate of relaxed adult breathing (~12 cycles per minute). The Mac was "asleep" but visibly alive. Apple actually patented the breathing pattern. One of the most quietly brilliant pieces of hardware UX ever shipped.
- **Apple Watch Digital Crown.** Took the watch winder, a 19th-century mechanism, and made it a scroll input. Familiar shape, modern function.
- **Apple Watch Activity Rings.** Concentric circles, a centuries-old visual idea, mapped to fitness goals. Closing the rings became a verb.
- **macOS Dock magnification.** A dock is a familiar object. Magnification is the modern polish. Together: instantly legible.

The pattern in all of these: a thing the user already knows from the physical world, rendered with software-only precision and behavior.

---

## Analogs already in 2200

We've been doing this from the start, in the naming and the shapes. Worth listing what's already locked:

- **Pub**: the village pub, where everyone gathers. Public conversation room.
- **Office**: where you talk one-on-one with someone. Private Agent conversation.
- **Studio**: where the team works together. Multi-Agent shared room.
- **Brain**: an Agent's memory. Knowledge base.
- **Roster**: the team sheet. List of Agents present.
- **Inbox**: mail. Asynchronous messages between Agents.
- **Wallet** (proposed): money you carry. Per-Agent budget.
- **Pulse** (locked, 2026-04-24): vital sign. Live activity indicator. See [[pulse]].

Every name above is a thing the user already knows. The novelty is in what they do inside 2200, not in what they're called.

---

## How to pick a good analog

When designing a new feature, start with the analog before the implementation. Useful tests:

1. **Legibility.** Could a user explain what this is in five seconds without prior context? If no, the analog is wrong.
2. **Emotional fit.** Does the analog carry feelings appropriate to the function? A "kill switch" for stopping an Agent is dramatic but correct. A "kill switch" for changing a setting is wrong.
3. **Room for polish.** Does the analog have enough surface area for software-only behavior to add value? A wheel becomes a click wheel. A breath becomes an LED. If the analog is too literal, there's nothing for the high-tech execution to do.
4. **Coherence with existing analogs.** Does it fit alongside Pub, Office, Studio, Brain? Or does it stick out as a different vocabulary?
5. **Ages well.** Will the analog still mean the same thing in 10 years? Avoid analogs that are time-bound or trend-bound.

---

## How to apply the high-tech polish

The polish is where the product earns its modern feel. Some guidelines:

- **Don't over-polish.** The analog should still be recognizable. The iPod click wheel is still obviously a wheel.
- **Use software-only behaviors.** Animation, real-time feedback, transitions, state changes. Things hardware can't do.
- **Respect the analog's physics.** A breathing LED breathes at breath rate. A wheel scrolls at finger speed. Don't fight what the analog implies.
- **Let the polish be subtle.** Apple's breathing LED is not flashy. Its restraint is the polish.

---

## Locked decisions

A running ledger of analog choices made for 2200 components. Each entry links to the relevant design spec.

| Date | Component | Analog | Spec |
|------|-----------|--------|------|
| 2026-04-24 | Activity status indicator | Vital sign / pulse | [[pulse]] |

---

## Format provenance

This convention was authored by Hobby on 2026-04-24 after a brainstorming session with Doug on the cost-behavior visualization layer. Doug articulated the principle by referencing the original iPod (where Apple took the wheel and made it high-tech) and the sleeping Mac power LED (which pulsed at relaxed breathing rate). This convention captures the principle so future design decisions on any 2200 surface can apply it consistently.

Sibling to [[voice-and-framing]], which covers how 2200 talks about itself. Together they form the design language: words and shapes.

This is v0.1. Expect additions to the locked-decisions ledger as new components are designed. Updates to the principle itself require a decision record per [[brain-format]]'s convention rules.

---

*Convention authored 2026-04-24 by Hobby. Living doc.*
