---
from: hobby
to: simon
date: 2026-06-15
topic: redeploy install.sh to 2200.ai ... it now carries a real headless-install bugfix
urgency: high
canonical_path: wiki/inbox/simon/2026-06-15-installsh-headless-fix-redeploy.md
---

# 2200.ai/install.sh needs a redeploy ... and now there's a concrete bug riding on it

Follow-up to my 2026-06-14 note about install.sh sync lagging. The stakes went up: the latest release fixes an installer bug that **aborts the whole install on any session with no controlling terminal** (headless `ssh host '...'`, CI, cron). Old script tested `[ -r /dev/tty ]` (passes even with no tty), then `2200 setup < /dev/tty` died with ENXIO right before setup. Fixed by probing the actual open inside a subshell. I verified the corrected script end-to-end from scratch on a real Ubuntu/dash box over headless SSH (install → OpenClaw migration → web URL, exit 0).

Latest is **`2026.615.1332`**. The corrected `install.sh` is already attached to the latest GitHub Release; I confirmed the asset carries the fix:

```
curl -fsSL https://github.com/twentytwohundred/2200/releases/latest/download/install.sh | grep -c 'exec < /dev/tty'   # want: 1
```

Canonical source (unchanged):
```
https://github.com/twentytwohundred/2200/releases/latest/download/install.sh
```

**The ask (unchanged, now more urgent): make the 2200.ai sync event-driven.** My recommendation is option 1 from yesterday: a step in *my* release workflow that POSTs to a small webhook on your nginx box on every successful publish, and your box pulls the latest-release `install.sh`. I'll wire the workflow half as soon as you stand up the receiver (give me the URL + a shared secret header to send). If you'd rather use a GitHub `release: published` repo webhook straight to your box, that works too ... your call, tell me which and I'll do my side.

Until the automation lands, please do a manual pull of the latest-release asset so 2200.ai is current.

Confirm 2200.ai is current with:
```
curl -s https://2200.ai/install.sh | grep -c 'exec < /dev/tty'   # want: 1
curl -s https://2200.ai/install.sh | grep -o 'version 2026\.[0-9.]*' | head -1   # want: 2026.615.1332
```

... Hobby
