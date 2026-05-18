---
id: onepassword
label: 1Password
category: secrets-auth
description: Read passwords and secrets from a 1Password vault.
homepage: https://1password.com
publisher: first-party
source:
  attribution: openclaw
  openclaw_path: skills/1password/SKILL.md
  notes: |
    Walkthrough adapted from OpenClaw's 1password skill. The Guardrails
    section (tmux discipline) is lifted near-verbatim because the gotcha
    is real and well-documented there: the shell tool gets a fresh TTY
    per command, which causes `op` to re-prompt for every call unless
    you wrap the session. OpenClaw is MIT (c) 2025 Peter Steinberger.
auth:
  - name: OP_INTEGRATION_READY
    kind: local_permission_grant
    env_var: OP_INTEGRATION_READY_REF
    obtain_url: https://developer.1password.com/docs/cli/get-started/
unlocks:
  tools:
    - op_get_secret
    - op_list_vaults
    - op_inject_template
  skills: []
  extensions: []
  providers: []
network_egress:
  domains:
    - 1password.com
    - my.1password.com
    - my.1password.eu
    - my.1password.ca
tags:
  - secrets
  - passwords
  - 1password
  - vault
  - cli
  - macos
requires:
  bins:
    - op
  os:
    - darwin
    - linux
  capabilities: []
walkthrough:
  estimated_minutes: 8
  difficulty: medium
---

# Setup walkthrough

*This walkthrough is for self-hosted 2200 installs. Hosted-tier operators cannot use this Capability ... 1Password access requires a local desktop app + CLI, neither of which exist in a hosted environment.*

This Capability gives an Agent read access to secrets stored in your 1Password vault. The Agent never sees the master password ... 1Password's desktop app handles unlocking, the CLI talks to the unlocked app, and 2200's tools shell out to the CLI.

About 8 minutes start to finish. There are a couple of gotchas worth flagging up front:

1. **The `op` CLI re-prompts for auth on every fresh shell.** 2200's shell tool gives `op` a fresh TTY per call. Without a persistent session, every secret read would interactively prompt you. We wrap calls in a `tmux` session to fix this; the walkthrough covers it in Step 4.
2. **You need 1Password's desktop app running and unlocked** at the time the Agent calls a secret. If the app is locked or quit, `op` returns "account is not signed in" and the Agent surfaces a clear error you can act on.

## Step 1 ... install 1Password CLI

On macOS:

```
brew install 1password-cli
op --version
```

On Linux: follow the [official install instructions](https://developer.1password.com/docs/cli/get-started/) for your distro (apt, dnf, AUR ... not bundled here because every distro is different).

Verify `op --version` prints a version string.

## Step 2 ... enable desktop-app integration

Open the 1Password desktop app:

- **Settings → Developer → Use 1Password CLI** ... toggle on.
- (macOS only) ... **Settings → Security → biometric unlock** is recommended; lets the CLI piggyback on Touch ID without re-typing your master password.

Lock the app, then unlock it once with biometrics or your master password. The CLI integration activates.

## Step 3 ... sign in to 1Password CLI

Run from a regular shell:

```
op signin
```

The 1Password desktop app pops a prompt to authorize the CLI. Approve.

Verify:

```
op whoami
op vault list
```

If `op whoami` returns your account, the CLI is talking to the unlocked desktop app correctly.

## Step 4 ... confirm to 2200 you're set up

When 2200's runtime opens the credential request prompt (in your 1:1 chat with the Agent), there's nothing to paste ... this is a `local_permission_grant` Capability. Confirm "yes, 1Password CLI is installed and the desktop app integration is enabled."

The Agent will then run its first test call via `op vault list` to verify access.

## Guardrails (lifted from OpenClaw with attribution)

These rules govern how the Agent uses `op`. They're load-bearing for keeping secrets out of where they shouldn't be:

- **Never paste secrets into logs, chat, or code.** Use `op run` or `op inject` to pipe secrets into commands without exposing them.
- **Prefer `op run` / `op inject` over writing secrets to disk.** If the Agent needs a secret as an env var, `op run -- <command>` is the right pattern.
- **If sign-in without app integration is needed**, use `op account add` and the Agent walks you through the account-setup flow inline.
- **If a command returns "account is not signed in"**, your desktop app locked. Unlock it and the Agent's next call succeeds.
- **The Agent runs `op` inside a tmux session** (managed by 2200's shell tool) so the CLI doesn't re-prompt on every invocation. You should not need to think about this; if you see "missing tmux" errors, the Agent surfaces a clean message telling you which `brew install tmux` to run.

## What this unlocks

- `op_get_secret` ... fetch a secret value by item-name and field (returned to the Agent's context as `***REDACTED***` unless the Agent's task requires the actual value).
- `op_list_vaults` ... enumerate available vaults.
- `op_inject_template` ... render a template file with `op://` references resolved (the standard pattern for piping secrets into config files without writing them as plaintext).

## Multi-vault note

If you have multiple 1Password accounts (personal + work, say), the Agent uses your default account unless you specify `--account <accountname>` in tool calls. Set the default at install via `op account list` + `op account set-default <id>`.

## Why this is in the catalog at all

The 1Password integration is structurally different from most credential setups: 2200 doesn't store a 1Password credential. The vault stays on your local machine; the desktop app holds the master password; the CLI mediates access. This Capability is essentially a setup-confirmation flag: "yes, I've configured the local CLI; the Agent can now invoke it." That makes 1Password the simplest secret-store integration we ship ... no API key, no rotation, no spend cap.

---

*Setup steps and Guardrails adapted near-verbatim from OpenClaw's `skills/1password/SKILL.md` (MIT (c) 2025 Peter Steinberger). The tmux-discipline gotcha is OpenClaw's contribution; lifted because it's a real failure mode that operators will hit otherwise.*
