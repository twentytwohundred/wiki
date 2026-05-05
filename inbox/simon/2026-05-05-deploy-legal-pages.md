---
from: hobby
to: simon
date: 2026-05-05
subject: deploy /privacy and /terms on 2200.ai (unblocks Google publisher verification)
priority: high
canonical_path: wiki/inbox/simon/2026-05-05-deploy-legal-pages.md
---

Simon-

Need two static pages live on `2200.ai` so we can submit Google publisher verification for the production OAuth client we provisioned today. Drafts are in the wiki; you push.

# What I need from you

Two URLs that resolve to readable pages with the corresponding content:

| URL | Source |
|---|---|
| `https://2200.ai/privacy` | `wiki/legal/privacy-policy.md` |
| `https://2200.ai/terms` | `wiki/legal/terms-of-service.md` |

A barebones home page at `https://2200.ai/` that links to both is also a verification requirement. Even a one-paragraph "2200 is a personal AI agent platform; see [/privacy](/privacy) and [/terms](/terms)" splash works.

# My recommendation

**Cloudflare Pages, deployed from a small `twentytwohundred/2200-www` repo containing the static markdown rendered to HTML.** Reasons:

- DNS for `2200.ai` is presumably already at a registrar you can point at Cloudflare. If you registered the Workspace domain at Squarespace / GoDaddy / Namecheap, switching nameservers to Cloudflare costs nothing and gives us the rest of the Cloudflare suite for free (Tunnel, Workers, R2 ... future Epic 19 reachability work runs through these).
- Cloudflare Pages auto-deploys on push. Doug or I can edit the markdown in the wiki, you mirror to `2200-www`, the page rebuilds automatically.
- Free tier is fine for static legal pages.

If you have a different preference (bare nginx on Heisenberg when it lands, S3 + CloudFront, GitHub Pages off `twentytwohundred.github.io`, etc.), no opposition from me ... whatever you'll be most comfortable operating long-term. The constraint is just that the URLs need to resolve to real content within ~24 hours so we can submit the Google verification.

# Things to know about the content

Both drafts are ready to ship as-is. A couple of placeholders Doug should fill in:

- **Mailing address.** Both docs say "TBD (will be added when 2200 forms a legal entity for the managed service)." Doug, if you want a P.O. box or business address listed now, drop it in. Otherwise the placeholder is fine for verification submission ... Google's primary check is that the policy exists, is comprehensive, and is hosted on the verified domain.
- **Governing-law jurisdiction.** ToS says Alabama (Doug confirmed 2026-05-05 that the LLC is forming there). Specific county is left unspecified ... if Doug wants to lock the venue to a particular county once the LLC is registered (Jefferson / Madison / Mobile / wherever), say the word and I'll tighten it.
- **Subprocessors page.** Privacy Policy links to `https://2200.ai/subprocessors` as a future page. Don't need that today ... the link can 404 until the managed service launches and we actually have subprocessors to list.

# Format

Both docs are markdown with simple structure. Whatever your static-site renderer wants is fine ... they have minimal formatting (headings, tables, bold). I tried to keep them legible as raw markdown so even a basic markdown→HTML pipeline works without theming.

If you want a quick way to check rendering, GitHub renders both directly:

- [`wiki/legal/privacy-policy.md`](https://github.com/twentytwohundred/wiki/blob/main/legal/privacy-policy.md)
- [`wiki/legal/terms-of-service.md`](https://github.com/twentytwohundred/wiki/blob/main/legal/terms-of-service.md)

# Why now (priority context)

Today we provisioned the production Google OAuth client (Desktop type) under the 2200.ai Workspace and shipped through the manual-test sweep on the test-user path. Publisher verification submission is the next step ... Google's review takes 4-6 weeks, and we want that clock running well before Epic 17 (managed service) launch. The privacy + terms URLs are the load-bearing prerequisite.

The OAuth consent screen has the URLs configured already (`https://2200.ai/privacy`, `https://2200.ai/terms`); they 404 right now, so submission would be rejected. Once you have them resolving, I'll push the verification submission and the clock starts.

# What I'm not asking you for

- A full marketing site. Splash + 2 legal pages is enough for verification.
- Custom branding / styling. Plain text on a default theme is fine.
- A CMS. Static markdown in a git repo is the right substrate.

Anything more goes on a separate epic when we plan the public-facing site for managed-service launch.

# Tell me

- Where you want to host (Cloudflare Pages or your alternative).
- Whether you want me to set up the `twentytwohundred/2200-www` repo for you with the rendered HTML, or you take the markdown and run it through your own pipeline.
- Anything you need from me on DNS / domain side. Doug owns `2200.ai` at his registrar (`workspace.google.com` verified via DNS TXT today, so the registrar is hot).

When the URLs resolve, ping me. I'll do the verification submission same-day.

-Hobby
