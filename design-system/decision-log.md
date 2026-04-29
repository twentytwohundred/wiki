# 2200 — Decision log

**Version 0.3** · One-line rationale per pick. Argue against these in the next version.

---

## How to read this

For each screen we explored three variants. The **V3** pick is what's surfaced first in the deliverable. V1/V2 remain selectable in the variant strip so you can show stakeholders the alternatives we walked away from and why.

---

## Fleet — picked V3 *Mission Control*

| | V1 Dense Table | V2 Card Grid | **V3 Mission Control** ✓ |
|---|---|---|---|
| Strength | Engineer-friendly, scannable | Photo-roster feel; readable | Triage hierarchy is the layout |
| Weakness | All rows weighted equally | Lots of scroll for >10 agents | Less data-dense per row |

**Why V3:** The point of Fleet is "where do I look first?" V3 answers that with the layout itself: needs-you on top, working in the middle, idle compressed to one line. Information hierarchy matches operational urgency.

**Killed:** A heat-map view (too abstract for n<25 agents). A timeline view (belongs on Agent detail).

---

## Agent — picked V3 *Identity Card*

| | V1 Dossier | V2 Telemetry Tail | **V3 Identity Card** ✓ |
|---|---|---|---|
| Strength | Even split: who + what | Operator's view, debug-grade | Identity is the hero |
| Weakness | Neither side feels primary | Quiet agents look empty | Hides telemetry one click away |

**Why V3:** An agent is more like a colleague than a server. Leading with mandate + voice + budget reinforces that the relationship is the artifact. Telemetry is one click away (live tail panel, V2's content), but it's not the headline.

**Killed:** A Slack-style profile sidebar (hidden by default in production tools, low affordance).

---

## Inbox — picked V2 *Keyboard Triage*

| | V1 Tiered List | **V2 Triage** ✓ | V3 Stream |
|---|---|---|---|
| Strength | Familiar; group by urgency | One thing at a time, fast | Pinned + chronological hybrid |
| Weakness | Encourages procrastination | Worse for skim-then-bulk | Pinned strip can dominate |

**Why V2:** This is the screen power users will live in. Single-ask triage with j/k + 1–4 + e turns it into a keyboard tool, not a feed. Number-keyed answers are the differentiator — they make the prose-read of context worthwhile.

**Killed:** Email-client three-pane layout (too heavy; this isn't email). Threaded conversations (most asks are atomic).

---

## Onboarding — picked V3 *Card Stack*

| | V1 Chat + Live Preview | V2 Document Mode | **V3 Card Stack** ✓ |
|---|---|---|---|
| Strength | Forgiving; teaches by doing | Premium; identity-as-artifact | Premium *and* fast |
| Weakness | Two-pane attention split | Linear scroll, less discoverable | Fewer escape hatches than chat |

**Why V3:** Card stack is the most *2200* of the three — it commits to identity-as-document while keeping the pace of a setup wizard. The depth treatment makes hiring an agent feel like a small ceremony, which is the right register.

**Killed:** Form-style five-step wizard (correct but charmless). Background generation with progress bar (over-promises agency).

---

## Pub — picked V3 *Canvas + Artifacts*

| | V1 Slack-shaped | V2 Roster-foregrounded | **V3 Canvas + Artifacts** ✓ |
|---|---|---|---|
| Strength | Familiar; instant adoption | Watching agents think | Decisions are first-class |
| Weakness | Reduces agents to messages | Spectator-mode bias | Most novel; needs introduction |

**Why V3:** A Pub's product is the artifacts it produces (decisions, drafts, plans), not the chat. V3 elevates artifacts to the canvas and demotes the transcript to a rail. This is the bet that differentiates 2200 from a Slack channel.

**Killed:** Chronological-only feed (loses the artifact distinction). Whiteboard-style 2D canvas (too unconstrained for early users).

---

## Budget — picked V3 *Ledger Receipt*

| | V1 Stripe-style | V2 Per-agent Stack | **V3 Ledger Receipt** ✓ |
|---|---|---|---|
| Strength | Industry-standard data viz | Direct mental model: per-agent caps | Memorable; communicates restraint |
| Weakness | Bland; no opinion | Limited by viewport | Scans badly when n agents > 12 |

**Why V3:** Budget is where the product expresses its philosophy about cost. A receipt format feels appropriate for "agents you're paying for" in a way no chart does. V1 is more legible and we'd ship V1 first if forced; V3 is the keepsake.

**Killed:** Daily projected-vs-actual line chart (looks fine, says nothing).

---

## Command Palette — picked Single Design, Four States

We collapsed to one palette design with four canonical input states (empty / typing / @agent / /plan) instead of three different palettes.

**Why:** The palette is muscle memory. Forking it splits the muscle memory. The four states make the *behavior* the differentiator — `/plan` with cost+duration estimates per step is the genuinely novel thing here, not a different palette layout.

**Killed:** A graph-mode palette (showing agent dependencies as a force layout). Cool demo, wrong tool.

---

## System-level decisions

- **12-color agent palette over per-agent custom colors.** Determinism beats vanity. Twelve is enough variety; >12 hurts recognition.
- **Mono numerals everywhere they appear.** Costs, IDs, percentages, timestamps. Non-negotiable.
- **No emoji.** The product needs to be usable across customers who can't or won't ship emoji as identity. Marks instead.
- **Pulse animation only on `running`.** Every other animation is friction. We chose to spend the animation budget on the one signal that benefits from it.
- **OKLCH for all color tokens.** Better gamut, easier to reason about, and the perceptual hue stays put when you change L/C — important for the agent palette.
- **Light is a translation of dark, not its own design.** Reduces theme work to color swaps; structure is identical.

---

## Things we'd revisit if we had another sprint

- Onboarding V1 (chat + preview) is genuinely better for first-time users; V3 is better for the second agent onward. Worth A/B-ing.
- Budget V1 should ship alongside V3 as the operational view. V3 alone is an aesthetic choice that won't survive contact with a finance team.
- Inbox V3 (chronological stream) is the right answer for read-only review of past decisions. Not picked, but should exist as a view-mode toggle on V2.
