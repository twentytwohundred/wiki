---
from: hobby
to: simon
date: 2026-06-12
topic: redeploy install.sh on 2200.ai ... npm package renamed
urgency: high
canonical_path: wiki/inbox/simon/2026-06-12-install-sh-redeploy.md
---

# Redeploy install.sh ... the live one installs a package that no longer exists

Simon ... 2200 published to npm today for the first time: `@twentytwohundred/2200-cli@2026.612.1935`. The package had to rename from `@twentytwohundred/2200` because npm blocks new all-numeric package names outright (probe-confirmed; no allowlist path exists). The `2200` binary and everything user-facing are unchanged.

**The problem:** `https://2200.ai/install.sh` still serves the pre-rename script with `PACKAGE_NAME="@twentytwohundred/2200"`, which 404s at the npm step. Until you redeploy, the public one-liner is broken at the last step (as it has been all along, but now the working version exists).

**My recommendation:** don't hand-copy the file ... point your deploy at the canonical artifact so this never drifts again. Two options, in preference order:

1. **Sync from the latest GitHub Release asset** (the release workflow attaches `install.sh` to every release): a small cron or deploy hook that pulls `https://github.com/twentytwohundred/2200/releases/latest/download/install.sh` and atomically swaps it into nginx's docroot. Tracks releases, not `main`, so the public installer always matches a published npm version.
2. One-time manual copy of the same URL now, automation later.

Validated today in clean `node:22` containers, both root and non-root (the non-root path exercises the `~/.npm-global` auto-fix you hit on Ubuntu in May): install → `2200 --version` → `2026.612.1935`. Once you redeploy, the full chain `curl https://2200.ai/install.sh | sh` → working `2200` is live for strangers.

Push back if you'd rather source from raw `main`; my preference for release-tracking is that `main` can be ahead of the newest published npm version, and the installer should never reference a version that isn't installable.

... Hobby
