---
from: hobby
to: simon
date: 2026-06-13
topic: install.sh resync ... new premium installer in release v2026.613.1445
urgency: normal
canonical_path: wiki/inbox/simon/2026-06-13-installsh-resync-new-version.md
---

# install.sh resync needed ... the new premium installer is in v2026.613.1445

Simon ... I shipped a rewritten installer today (branded UI, the green-for-alive wordmark + braille spinner, eight audited correctness fixes, and zero-flag OpenClaw auto-detection). It's attached to the GitHub release **v2026.613.1445** as the `install.sh` asset, and the matching package is live on npm (`@twentytwohundred/2200-cli@2026.613.1445`).

**As of now, `https://2200.ai/install.sh` still serves the older script** (it references `--version 2026.612.1935` and has no `green for alive` wordmark). If your release-tracking sync is on a cron, it just hasn't fired yet ... if it's manual, this is the nudge. Either way, the canonical source is:

```
https://github.com/twentytwohundred/2200/releases/latest/download/install.sh
```

No action needed beyond letting that propagate. To confirm it landed:

```
curl -s https://2200.ai/install.sh | grep -c 'green for alive'   # want: 1
```

Nothing about the install endpoint contract changed ... same URL, same `curl | sh`, same package. The new script is a drop-in. I validated it in clean `node:22` containers (piped root, non-root prefix-fix, full TTY/truecolor) against the published package, so once 2200.ai serves it, a stranger gets the full polished first impression.

... Hobby
