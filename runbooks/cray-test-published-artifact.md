---
title: "Runbook: Cray test on the published artifact"
type: runbook
status: active
tags: [runbook, dogfooding, cray-test, phase-2, migration, openclaw, release]
created: 2026-06-13
updated: 2026-06-13
linked_docs:
  - "[[release-plan]]"
  - "[[05-phase-b-openclaw-adapter]]"
canonical_path: wiki/runbooks/cray-test-published-artifact.md
---

# Runbook: Cray test on the published artifact

The Cray threshold (release-plan Phase 2) is "2200 can host its own builders." This runbook executes it against the **published npm package** ... the exact bits a stranger gets ... not the dev tree. Anyone (Hobby, Simon, Doug) can run it cleanly on a fresh box.

Reference values as of this writing: npm `latest` is `2026.612.2230`; package is `@twentytwohundred/2200-cli`; binary is `2200`.

## 0. Prerequisites

- A fresh machine (or a fresh user account) with **Node.js 22+**. Check: `node --version`.
- For the migration leg: read access to an OpenClaw home (e.g. `skippy@valkyrie:~/.openclaw`).
- One LLM provider credential, unless you migrate it from OpenClaw (the OC adapter copies provider keys into `runtime.env` automatically).

## 1. Install from the public one-liner

```sh
curl -fsSL https://2200.ai/install.sh | sh
```

Expected: Node/npm checks pass, the package installs from npm, the binary verifies on PATH, the success banner prints. On a non-writable npm prefix (typical apt-installed Node on Ubuntu/Debian) the installer auto-configures `~/.npm-global` and tells you to open a new shell or `source` your init file. Confirm:

```sh
2200 --version        # prints the CalVer version, e.g. 2026.612.2230
```

To pin a version instead of `latest`: `curl -fsSL https://2200.ai/install.sh | sh -s -- --version 2026.612.2230`.

## 2. First-run

```sh
2200
```

Walk the guided setup: choose `2200_HOME`, init the directory layout, start the daemon, mint the user identity, optionally sign in to Grok / paste a provider key. All prompts collect input before any side effect (ctrl-C is safe at any step).

If an OpenClaw home is present on the same machine, first-run offers to migrate it (no flag needed). To rehearse that path deliberately, use the explicit command in step 3.

## 3. Migrate an Agent from OpenClaw

If the OC instance is on another host, copy its home over first (exclude the heavy dirs):

```sh
rsync -a --exclude node_modules --exclude cache --exclude logs --exclude media \
  skippy@valkyrie:.openclaw /tmp/oc-src/
```

Preview, then run:

```sh
2200 agent migrate --from-openclaw /tmp/oc-src/.openclaw --validate   # prints the migration report; no state change
2200 agent migrate --from-openclaw /tmp/oc-src/.openclaw              # real run
```

What lands: SOUL.md as the Agent's Identity body (verbatim), daily memories imported and searchable, enabled cron jobs as 2200 schedules, the model binding (when the provider maps), LLM provider keys copied into `~/.config/2200/runtime.env` (existing keys never overwritten; `--no-migrate-llm-keys` opts out). Channel tokens do NOT migrate ... the printed report maps each one to its 2200 path. The run ends with disable-not-delete commands for the source OC instance.

Verify continuity:

```sh
2200 daemon start
2200 agent start <name>
2200 brain show <name> continuity-from-migration   # the continuity note + migration report
2200 schedule list <name>                           # imported schedules
```

## 4. Disable the source OpenClaw instance

So you are not paying for two fleets (the migration does NOT delete OpenClaw):

```sh
# on the OpenClaw host
systemctl --user stop openclaw 2>/dev/null || openclaw gateway stop
systemctl --user disable openclaw 2>/dev/null || true
# re-enable later with: systemctl --user enable --now openclaw
```

## 5. The Cray assertion

The test passes when the migrated/built Agent does **real work from inside 2200** on the published artifact: it wakes on a schedule or a task, runs its loop, holds budget caps, and you can drive it from the web app (`2200 web`). Run it for more than a one-shot ... let a scheduled task fire, check the inbox, restart the daemon and confirm the Agent recovers.

## Teardown (when testing on a shared box)

```sh
2200 daemon stop
npm uninstall -g @twentytwohundred/2200-cli
rm -rf ~/.local/share/2200/ ~/.config/2200/   # ONLY if you want to wipe fleet state
rm -rf /tmp/oc-src                              # the rsync'd OC copy
```

## Known good / watch-items

- The installer's non-writable-prefix auto-fix is exercised by the non-root container path; if `2200` is "not found" after install, `source` your shell init file or open a new shell.
- `agent migrate` refuses to run while the daemon is up (state-file race). Stop the daemon, migrate, restart ... or use the first-run offer, which holds the Supervisor directly.
- Provider mapping: OpenClaw primary models on providers 2200 doesn't carry (e.g. minimax) fall back to the default binding with a warning; rebind via the model picker.
