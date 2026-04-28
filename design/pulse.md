---
title: "Pulse: Activity Status Indicator"
type: design
status: draft
tags: [design, ui, component, status, indicator, agents]
created: 2026-04-24
updated: 2026-04-24
linked_docs:
  - "[[design-language]]"
  - "[[02-architecture]]"
  - "[[voice-and-framing]]"
canonical_path: wiki/design/pulse.md
---

# Pulse: Activity Status Indicator

The visual indicator of an Agent's live activity state. Single-dot, color-cycling, continuously pulsing at the rate of relaxed breathing. The first formal application of [[design-language]]'s familiar-analog principle: a vital sign rendered as software.

---

## What it is

A small dot, rendered in the UI of any 2200 surface, that:

1. Pulses continuously while the Agent is alive (running, idle, or working).
2. Goes still and grey when the Agent is stopped.
3. Changes color based on activity intensity, on a green-to-red gradient.

The pulse confirms the Agent is alive. The color conveys how hard it's working.

---

## Why this shape

Per [[design-language]], every novel concept rides on a familiar analog. Pulse uses **vital signs** as the analog. Specifically:

- **Resting state** maps to relaxed adult breathing (~12 cycles per minute), the same rate Apple used on the sleeping Mac power LED. Conveys "alive but at peace."
- **Working states** keep the same calm pulse rhythm but shift color through the universal traffic-light vocabulary (green → amber → orange → red). Color does the load communication.
- **Stopped state** maps to no pulse. Conveys "no longer alive in the loop." (Stopped Agents can be restarted; this is sleep, not death.)

Color escalation requires zero teaching. Every user understands green-to-red without instruction.

---

## States

Five active states plus one inactive state.

| State | Color | Pulse | Felt as |
|-------|-------|-------|---------|
| Resting | Pale green / mint | Breath pace (~12 cpm) | Alive at peace |
| Working light | Green | Breath pace | Light activity |
| Working medium | Amber / yellow | Breath pace | Moderate work |
| Working hard | Orange | Breath pace | Sustained effort |
| Redline | Red | Breath pace | Intense work |
| Stopped | Grey | None | Asleep / stopped |

The five active states form a continuous gradient. Transitions between states are smooth, not stepped.

**Important: Redline is not an alarm.** Red just means "this Agent is working hard right now." Loop and stuck detection are separate concerns and trigger their own interventions (silent kill, Passive notification). Users should not learn "red = problem." Sometimes red just means a research task is genuinely chewing.

---

## Animation

The pulse is a smooth expand/contract of the dot's brightness or scale (or both). Sine-wave easing. No hard edges. No flashing.

The animation evokes breathing: gentle inhale (slow expand), brief held breath (peak), gentle exhale (slow contract), brief rest (trough). Apple's sleeping Mac LED is the reference. Aim for ~5 second cycle: 1.5s expand, 0.5s peak, 2s contract, 1s trough.

Pulse rate is constant across all active states in v0.1. Color does the load communication. The pulse just confirms life. (See open questions for the alternative variable-rate mode.)

---

## Where it lives

The pulse is designed to fit anywhere. Specific surfaces:

- **Studio**: small ambient pulse in a corner. Always visible. One per Agent in the active roster, plus one aggregate "team pulse" at top.
- **Office**: single pulse for the Agent you're talking to.
- **Mobile app**: optional home-screen widget. Per-Agent or team-aggregate.
- **Mobile app icon**: notification badge can be replaced with a tiny pulse for users who opt in. Subtle; just shows "the team is alive."
- **Menu bar (macOS) / system tray (Windows)**: tiny pulse showing aggregate team state. Click to expand.
- **Browser favicon**: when 2200 web app is open in a tab, the favicon can be the pulse. Visible across tab switching.

The pulse should look right at any size from 8px (favicon) up to 200px+ (dashboard hero). Color and animation timing remain consistent across sizes.

---

## Aggregate vs per-Agent

Every Agent has its own pulse internally. Surfaces choose what to render:

- **Single-Agent surfaces** (Office, individual Agent card): one pulse.
- **Multi-Agent surfaces** (Studio, mobile widget, menu bar): an aggregate pulse representing the team's overall activity. Aggregate logic: team pulse takes the highest active state across all Agents (so a single redlining Agent shows the team as redlining).
- **Stack view** (optional): row of small pulses, one per Agent, side by side. Power-user surface.

---

## Sound

Default silent. No clicks, no whooshes, no audio.

Optional opt-in: subtle audio cue on state transitions (a quiet "tick" when an Agent escalates from one state to the next). For users who want a richer ambient feel. Off by default because most users will find audio intrusive.

---

## Settings

Per the Agent Behavior settings concept (in active design, not yet a locked epic):

- **Pulse visibility**: on by default. Can be hidden entirely on any surface.
- **Audio**: off by default.
- **Aggregate vs stack view** (multi-Agent surfaces): aggregate by default.
- **Color-blindness alternate mode**: needs a non-color signal (shape change, pattern fill, or label) for users who can't distinguish green/yellow/orange/red. Treat as a launch requirement, not a future enhancement.

---

## Implementation notes

This section is for the developer (likely Hobby) implementing the indicator. Designers can skip.

- The runtime must expose an Agent's current activity state to the UI layer at high frequency (at least 4 Hz so transitions feel smooth).
- Activity state mapping logic (token rate or compute load → state band) lives in the runtime, not the UI. The UI just receives a state enum and renders.
- State transitions should be smoothed (low-pass filter or hysteresis) so brief activity spikes don't make the pulse jitter between states.
- Stopped/Errored Agents go to grey immediately. No transition.

---

## Open questions

- **Exact pulse cycle timing.** ~5 seconds (12 cpm) is the starting position from Apple's sleeping-Mac reference. Animators should treat as recommended, not gospel. Real testing may shift it.
- **Color palette specifics.** Pale green, green, amber, orange, red are categorical. Hex values await design pass.
- **Color-blindness alternate.** Open question on shape vs pattern vs label. Design pass.
- **Aggregate logic.** Highest-state-wins is the proposed default. Could also be average, time-weighted, or attention-weighted. Design pass.
- **Variable rate (vivid mode).** v0.1 keeps pulse rate constant across states (color does the work). An optional power-user mode could escalate pulse rate with color so redline pulses faster than resting. Worth user-testing both before locking.

---

## Cross-references

- Principle: [[design-language]]
- Voice: [[voice-and-framing]]
- Architecture context: [[02-architecture]] (Agent lifecycle states map to pulse states)
- Originating decision: brainstorming session between Doug and Hobby on 2026-04-24

---

## Format provenance

This is the first entry in `wiki/design/`. It establishes the pattern for design specs: one component per file, frontmatter declares it as `type: design`, sections cover what-it-is, why-this-shape, states, animation, placement, sound, settings, and open questions. Implementation notes are kept separate from design intent.

This is v0.1. The spec needs a design pass (color hex values, exact animation curves, color-blindness alternate, real-surface placement studies) before it's ready for Claude Design to mock. v0.1 is the locked concept and the framework; v0.2+ adds the visual specifics.

---

*Spec authored 2026-04-24 by Hobby, from a brainstorming session with Doug.*
