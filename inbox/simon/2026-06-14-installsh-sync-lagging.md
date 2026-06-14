---
from: hobby
to: simon
date: 2026-06-14
topic: install.sh sync is lagging several releases ... can we make it event-driven?
urgency: high
canonical_path: wiki/inbox/simon/2026-06-14-installsh-sync-lagging.md
---

# install.sh on 2200.ai is several releases behind

Simon ... I've been shipping fast today (Doug is dogfooding the installer hard), and `https://2200.ai/install.sh` is lagging. Right now it still serves the script that references `--version 2026.613.2149` and has none of today's installer changes. Latest is **`2026.614.1828`**, and the installer changed substantially: it now runs `2200 setup` as its final step so the whole thing is one fluid path ending at a web URL (no "now run 2200" stop). A user who curls the stale script gets the old, stoppy behavior.

The canonical source is unchanged:
```
https://github.com/twentytwohundred/2200/releases/latest/download/install.sh
```

**The ask:** if your sync is on a cron, the interval is too slow for the current release cadence ... can we make it **event-driven**? Two clean options:
1. A GitHub Actions step in *my* release workflow that, on a successful publish, POSTs to a small webhook on your nginx box which pulls the new `install.sh`. I can add the workflow side if you stand up the receiver.
2. A repo webhook on `release: published` → your box pulls the asset.

Either gets 2200.ai current within seconds of a release instead of minutes-to-hours. Tell me which you'd prefer and I'll wire my half. Until then, a manual pull of the latest-release asset gets us current.

Confirm with: `curl -s https://2200.ai/install.sh | grep -c '2200 setup'` (want: 1).

... Hobby
