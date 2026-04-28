---
title: "Brain Visualization: Visible Map of an Agent's Mind"
type: design
status: draft
tags: [design, brain, visualization, ui, differentiation, integrate-over-build]
created: 2026-04-25
updated: 2026-04-25
linked_docs:
  - "[[2026-04-24-brain-is-files-not-database]]"
  - "[[02-architecture]]"
  - "[[design-language]]"
  - "[[prior-art-analysis]]"
canonical_path: wiki/design/brain-visualization.md
---

# Brain Visualization: Visible Map of an Agent's Mind

A visual map of the Agent's Brain (its memory, notes, links between concepts) made directly available to the Human. The Brain is already markdown files on disk per [[2026-04-24-brain-is-files-not-database]]; the visualization layer turns those files into a navigable, inspectable surface the Human can open at any time.

This is one of 2200's strongest differentiators against Perplexity Computer's black box (see [[prior-art-analysis]] Section 2). Where Perplexity hides the Agent's reasoning state, 2200 makes it browseable.

---

## Why this matters

Two reasons.

1. **Trust through inspection.** The single loudest complaint about Perplexity Computer is "I can't see what it's doing." 2200's answer is: not only can you see what it's doing, you can read its mind. The Brain is files. The visualization is the navigation layer over those files.
2. **The Cray principle in the UI.** When the team migrates onto 2200, every Agent's Brain becomes part of the Human's working environment. Doug should be able to open Hobby's Brain, see what's connected to what, and click through. So should every other operator. The visualization is how that experience becomes ergonomic instead of "open the folder in your editor."

---

## The user-visible thing

A surface in the 2200 web client (and likely a desktop app companion) where the Human can:

- See the full graph of Brain notes for any Agent they own — nodes are notes, edges are wiki-links and references.
- Click any node to read the underlying markdown file.
- Search across the Brain (full text + by tag, by linked-from, by linked-to).
- Optionally edit notes directly, with the changes flowing back to disk and immediately visible to the Agent.
- Switch Agents to view a different Brain, or open multiple Brains side by side.
- See "what's currently in working context" overlaid on the graph (the notes the Agent has loaded into its current task vs the dormant rest of the Brain).

Per [[design-language]] the right analog is "a mind you can walk through." Not a database admin tool, not a file browser. Closer to walking around someone's library while they're researching.

---

## Build vs integrate

Doug's principle, set 2026-04-25: **integrate, don't build, for non-differentiated layers.** Captured in the project memory as `feedback_integrate_over_building`. The Brain itself is a 2200 differentiator (markdown-on-disk, files-as-source-of-truth). The visualization layer is the question — at first read it looked like a non-differentiator (every Obsidian-style graph viewer looks like every other one), but Doug's UX bar (native click-and-drag interactivity) reframes it.

### Direction: build the React component natively, with mature libraries

Initial recommendation was SilverBullet.md as a sidecar served via iframe. Doug rejected the iframe shape on 2026-04-25: "I don't like iframes. I'd rather it something that renders in javascript that the user can click and drag around. Maybe that's a thing we build instead." The iframe boundary turned out to be the weak point of any whole-app integration — it makes the Brain pane feel stitched-on rather than native, and it forecloses the kind of tight interactivity that makes a knowledge graph actually feel alive.

So the direction shifts. The graph itself **is** a differentiator, because the click-and-drag-and-connect feel is part of why a Human would open the Brain pane in the first place. Building it natively in 2200's React shell preserves that.

This is still **integrate at the library layer**, not build-from-scratch. The components:

- **Graph rendering: Cytoscape.js** (MIT, decade-mature, used by Juggl, Neo4j-graph-view, and most academic graph UIs). Native click-and-drag, force-directed layouts, custom node/edge styling, plays well inside React via `cytoscape-react` or a thin custom wrapper. Alternative: D3-force with a custom React layer. Cytoscape is the better fit for our use case (interactivity-first, less custom-rendering work).
- **Markdown content rendering: react-markdown** plus **remark-wiki-link** for `[[double-bracket]]` parsing. Both MIT, both widely used. Wiki-link parsing is small enough that we can also write our own remark plugin if we want exact control over the link semantics.
- **File watching and live updates: chokidar** for the file-system watch layer (or whatever the rest of the runtime ends up using). Probably converges with whatever Epic 2 settles on for state-on-disk discipline.
- **Search: lunr.js** or **MiniSearch** for client-side full-text. Server-side search probably comes later as the Brain grows past what's reasonable to ship to the browser. Decision deferred.

What we own:

- The React component shell that composes the libraries.
- The interaction model (what happens when you click, drag, double-click, right-click a node; how editing flows from the graph into the markdown content; how the overlay of "currently in working context" is visualized).
- The visual language (per [[design-language]]: familiar-analog plus high-tech-polish).
- The auth/permission boundary (rendering inside 2200's web client means we inherit auth automatically).
- The multi-Agent extension (showing multiple Brains side-by-side, switching Agents, comparing Brains across the team).

What we explicitly do not own:

- Force-directed layout algorithms.
- Markdown parsing.
- The wiki-link spec.
- File-watching primitives.

This split honors the integrate-over-build principle at the library layer while preserving the differentiator (the user-facing interaction model) as a 2200 build.

### Why we walked away from whole-app integration

The Obsidian-alternatives research scan evaluated twelve candidates for whole-app integration. SilverBullet.md was the strongest fit on every axis except the one Doug cares most about: native interactivity. Other candidates failed earlier:

- **Logseq**: AGPL-3.0 viral, embedding story poor (Electron-first, no iframe path), performance degradation past ~3.5k notes.
- **Dendron**: effectively dead, hierarchical model fights flat Brain folder.
- **Trilium / TriliumNext, Joplin, SiYuan, AppFlowy, AFFiNE, Anytype**: all use a database or proprietary block model rather than markdown files on disk. Storage-model mismatch is disqualifying per [[2026-04-24-brain-is-files-not-database]].
- **Anytype** specifically has a non-OSI license that prohibits commercial use without consent.
- **Obsidian itself** is closed source.
- **Quartz** (jackyzha0/quartz, MIT, 12k stars) — strong as a "publish your Brain as a navigable site" capability for a later epic, but read-only by design.
- **`@foam/graph`** as a component-only extraction is the closest off-the-shelf match for what we'd build, and a candidate dependency we can pull rather than write our own Cytoscape wrapper.

Full research output captured in conversation transcript 2026-04-25. Worth re-reading if Epic 8 spawns a follow-up question.

### Decision record candidate

Once Doug locks the build direction, this section becomes a decision record (`wiki/decisions/2026-04-XX-brain-viewer-build-with-libraries.md`) covering: the build/integrate split, the chosen library set, the interaction-model principles, and the explicit "we walked away from SilverBullet because of iframe" reasoning so future-anyone doesn't relitigate.

---

## Constraints

- **Files-are-source-of-truth** per [[2026-04-24-brain-is-files-not-database]]. The visualization layer is a viewer over the files, not a separate state. Edits made through the viewer mutate the markdown files directly. No silent index that diverges from disk.
- **Obsidian-format wiki links.** The Brain uses `[[double-bracket]]` references because that's the lingua franca for markdown knowledge graphs. The visualization layer must understand and render those links natively. This narrows the candidate tool list significantly — anything that doesn't speak Obsidian-format wiki links out of the box is a build-from-libraries situation.
- **Open source preferred.** 2200 is itself open source. Pulling in an AGPL or GPL viewer is workable for self-hosters but needs license analysis for the managed-service path. MIT/Apache/BSD licensed tools are friendliest.
- **Embeddable or pop-out.** Either render inside 2200's web client, or pop open as a separate pane the user invokes from inside 2200. Pop-out is fine if integration is cleaner that way.
- **Performance at Brain scale.** A long-lived Agent's Brain may grow to thousands of notes. The viewer must stay responsive. Most candidate tools handle this; flag any that don't.

---

## Open questions

- **Doug's confirmation of the build-with-libraries direction.** Pending. Once locked, this doc spawns a decision record and becomes a sub-deliverable of Epic 8 and/or Epic 13.
- **Cytoscape.js vs D3-force.** Both are mature. Cytoscape is interactivity-first and probably the better fit; D3-force is more visualization-flexible. Decision deferred to the implementation pass.
- **Concurrency-on-Brain.** CLAUDE.md tripwire #2 is real here. Read-write through the visualization means Brain markdown gets mutated while an Agent might be reading or editing the same files. Design needs: file-watcher-based live refresh, lock-while-editing indicator, or a CRDT layer if multi-Agent + human concurrent editing becomes a pattern. Not a v1 blocker but a real design problem.
- **Auth boundary.** Rendering inside 2200's web client means auth is automatic. No additional layer needed.
- **Mobile.** Does the graph travel to mobile (Epic 16)? Force-directed graphs on small screens are notoriously bad UX. Probably a simplified list/tree view on phones, full graph on tablets, full graph on web.
- **Search.** Client-side (lunr / MiniSearch) is fine for small Brains; server-side becomes necessary as Brains grow. Decision deferred until the size pressure is real.
- **Edit flow.** Click a node → see markdown content. Click an edit affordance → mutate the file. The file mutation triggers a re-parse and graph refresh. Needs design: in-place inline editor (CodeMirror/MDX) vs side pane vs modal. Implementation question.
- **Multi-Brain views.** Showing multiple Agents' Brains side by side is a natural extension. Probably v1.x rather than v1.

---

## Status

**Draft. Awaiting Doug's confirmation of the build-with-libraries direction.** Once confirmed, this doc spawns a decision record (`wiki/decisions/2026-04-XX-brain-viewer-build-with-libraries.md`) and becomes a sub-deliverable of Epic 8 (Brain) and/or Epic 13 (web client).

Not on the v1 critical path. The Brain itself ships first as files-on-disk readable through any markdown editor. The native visualization layer ships when Epic 8 or Epic 13 reach it.

---

## Cross-references

- Brain principle: [[2026-04-24-brain-is-files-not-database]]
- Inspectability driver: [[prior-art-analysis]] Section 2 (counter to Perplexity Computer's black box)
- Design language: [[design-language]]
- Originating direction: Doug, 2026-04-25 — "We should have a visual map available to the Human of their Agent's brain... use an open-source version of Obsidian, or another existing tool absent building our own."
- Iframe rejection: Doug, 2026-04-25 — "I don't like iframes. I'd rather it something that renders in javascript that the user can click and drag around. Maybe that's a thing we build instead." This shifts the direction from whole-app integration to library-level integration with a 2200-owned React shell.

---

*Doc bumped to draft 2026-04-25 by Hobby after Obsidian-alternatives research returned. Initial SilverBullet recommendation rejected on iframe constraint. Repointed to build-with-libraries direction (Cytoscape.js + react-markdown + remark-wiki-link in a 2200-owned React shell). Awaiting Doug's confirmation before spawning a decision record.*
