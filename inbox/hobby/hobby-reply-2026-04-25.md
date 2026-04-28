Hobby-

Read both docs. The source findings represent a real upgrade in what we know
versus what we were guessing from documentation. Reward the depth... reading
the actual code instead of just the docs is what produced the better picture.

You found thirteen things worth changing. We're not going to walk through all
thirteen abstractly. We're going to lock the three that affect Epic 2's
architecture, then you draft Epic 2, then we walk the remaining ten against
the concrete spec text.

# Three to lock now

## 1. MCP-native architecture

**Locked.** 2200's tool integration layer is MCP-native, not a parallel
system. Reasons:

- OpenClaw proved the pattern works in production
- Shopify ships four official MCP servers (Dev, Storefront, Customer Account,
  Checkout). Going MCP-native means we inherit those for free
- The MCP ecosystem is becoming the standard for Agent tool integration
  industry-wide. Building a parallel system means perpetually re-implementing
  what others ship natively
- Bulletin (which Garfield is building on the SCUT side) is a different
  protocol layer entirely. MCP for tools, Bulletin for Agent-to-Agent context.
  No conflict.

Write this as a decision record at `wiki/decisions/2026-04-25-mcp-native.md`.
Context: came from your source reading of OpenClaw's gateway. Decision: 2200's
runtime speaks MCP. Consequences: we get the existing MCP ecosystem (Shopify,
others), we don't reinvent the tool calling layer, we have to live within
MCP's evolution rather than designing our own.

This goes into Epic 2 as a foundational architecture choice. The runtime IS
an MCP client and an MCP server simultaneously, depending on context.

## 2. Tool baseline (31 tools, plan/run/perm wrapping)

**Locked, with refinement.** 2200 ships with a baseline tool set every Agent
gets by default. Same shape as OpenClaw's 31, though the exact list is
yours to propose in the Epic 2 spec.

The plan/run/perm wrapping is also locked. Every tool call passes through
three layers:

1. **Plan.** What is the Agent about to do? Why? Logged, surfaced for
   inspection.
2. **Run.** Execute the tool call. Capture inputs, outputs, errors.
3. **Perm.** Was the Agent allowed to do this? Check against the Agent's
   permission scope and the user's preferences.

Don't optimize this away in the name of speed. The wrapping is what makes
the system inspectable, debuggable, and trustworthy. Performance can come
later if it actually matters.

In Epic 2, define:

- The baseline tool list (your call, propose it)
- The plan/run/perm wrapping as the universal tool-call shape
- How user-installed Skills add to (not replace) the baseline

## 3. Skills as first-class

**Locked.** Skills are a first-class concept in 2200, not a flavor of
Extensions. Your earlier framing folded them into Extensions; the source
reading shows OpenClaw treats them separately and the separation matters.

This means:

- Epic 11 (Skills ingestion) is its own epic, not "load Extensions of type
  Skill"
- The Skill compatibility pipeline (parse → validate → normalize → disclose
  → install) operates on first-class Skill objects
- Epic 12 (Extensions framework) is for things that aren't Skills... larger
  capability bundles that include Skills, tools, runtime hooks, UI components

Update the architecture doc to reflect this separation. Skills get their
own object in the object model alongside Agent, Project, Task, Pub,
Notification, Tool, Schedule, Brain. Extensions are a higher-level packaging
concept that can include Skills.

If this changes your earlier decision record on Skill compatibility, write
a follow-up decision record explaining the refinement. Don't edit the
original; it captured the thinking at that point.

# What to do next

1. **Write the three decision records** for MCP-native, tool baseline, and
   Skills-as-first-class. One file each in `wiki/decisions/`. These should
   be quick... the thinking is locked, just capture it.
2. **Update the architecture doc** ([[02-architecture]]) to reflect the
   three locked decisions. Add Skills as a first-class object. Note the
   MCP-native runtime. Add the plan/run/perm wrapping to the tool section.
3. **Draft Epic 2 spec** at `wiki/epics/02-agent-runtime-minimum.md`. The
   spec must include:
   - Process supervisor model with state-on-disk discipline
   - Identity loader, self-notes, model binding (per existing scope)
   - The MCP-native tool integration layer
   - The baseline tool list (your proposal) with plan/run/perm wrapping
   - Tool-loop and stuck-Agent detection per [[2026-04-24-cost-behavior-shape]]
     layer 1
   - Schema versioning for Identity files and persistent artifacts
   - Upgrade-readiness section per [[upgrade-readiness]] disciplines 1, 2,
     3, 6
4. **Stop after Epic 2 draft and check in.** Don't go to Epic 3 yet.

# About the other ten findings

The remaining ten findings from your source-readings doc are not lost. We're
just deferring the walkthrough until Epic 2 is concrete. The walkthrough
will be more productive when it's against real spec text rather than
abstract changes.

When you finish Epic 2 draft, the next session opens with:

- Epic 2 review
- Then the walkthrough of the remaining ten findings against Epic 2

Several of them likely affect Epic 9 (tool system), Epic 11 (Skills), Epic
12 (Extensions), and the Brain epic. Locking them now without the spec
context risks pre-deciding things we'll need to revisit anyway.

# About the work disposition

You went from "v0.1 from docs" to "real source-grounded findings" in a
single session and didn't try to push them all through to lock at once.
You proposed, defended, and let me sequence what to lock when. Same
discipline as session 1. Same disposition.

Keep it. This is how the project will actually ship... not by Hobby
ramming through every change as he discovers it, but by Hobby surfacing
findings clearly and letting product and architecture decisions get made
in the right order.

When Epic 2 is drafted, expect a real review pass. Not a rubber stamp.
That's part of the pattern too.

-Doug
