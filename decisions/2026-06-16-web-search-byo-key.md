---
title: "Web search is bring-your-own-key: Brave default, Gemini + Google, hot-reloaded"
type: decision
status: locked
tags: [decision, web-search, tools, openclaw]
created: 2026-06-16
canonical_path: wiki/decisions/2026-06-16-web-search-byo-key.md
---

# Web search is bring-your-own-key (Brave default, Gemini + Google)

**Decision (Doug, 2026-06-15/16):** `web_search` is a real, configurable tool, the OpenClaw model ... **bring your own key**, Brave as the default, with Gemini and Google as alternatives. Each operator brings their own key, so the host 2200 runs on isn't the thing being pounded as users scale from 1k → 50k.

## Providers

- **Brave Search** (default) ... `BRAVE_API_KEY`, free tier ~2000/mo. The intended default for the scaling reason above.
- **Gemini grounding** ... `GEMINI_SEARCH_API_KEY`, Google-Search grounding via the Gemini API (single key, no `cx`). This is what OpenClaw's "google" provider actually is ... not the Custom Search JSON API ... so an OpenClaw migration carries that key straight into this provider. Billed per query beyond a small free tier.
- **Google Programmable Search** ... `GOOGLE_SEARCH_API_KEY` + `GOOGLE_SEARCH_CX` (Custom Search JSON API; needs a key *and* an engine id).

`resolveSearchProvider` picks the pinned `WEB_SEARCH_PROVIDER`, else Brave → Gemini → Google (mirroring OpenClaw's auto-detect). Configured in **Settings → Web Search** (paste a key; no env editing), and carried on OpenClaw migration.

## Keys apply without a restart (`2026.616.1447`)

A pasted key has to *work*. `web_search` reads its keys from `runtime.env` at search time, not just at spawn ... so a key added in Settings takes effect on the **next search**, no `2200 daemon restart`, no Agent restart. (Previously a freshly-added key sat unused until the whole fleet was bounced ... an Agent only reads its environment once, at start. This bit a real user.) Add/change hot-applies; a *removed* key still needs a restart, the rarer case. The runtime.env path is overridable via `TWENTYTWOHUNDRED_RUNTIME_ENV`.

## OpenClaw provider mapping

OpenClaw 2026.4.11 has **12** web-search providers and no Custom Search provider at all ... its `google` is Gemini grounding (key at `plugins.entries.google.config.webSearch.apiKey`, no `cx`). The migration maps `gemini→gemini` / `brave→brave` from OpenClaw's real key paths; providers 2200 doesn't implement yet (grok, perplexity, exa, ...) carry nothing and are named in the migration report rather than silently pinning a dead provider.

## Open follow-up

Grok-native keyless search (xAI subscription) is the highest-value addition ... xAI deprecated its Live Search API for a heavier Agent Tools API, so that's a separate build. See [[2026-05-21-xai-grok-oauth]] and the Grok-First positioning.
