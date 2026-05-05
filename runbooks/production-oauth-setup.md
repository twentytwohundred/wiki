---
title: "Runbook: Production OAuth Setup (Google + GitHub)"
type: runbook
status: active
tags: [runbook, oauth, epic-9, identity, integrations]
created: 2026-05-05
updated: 2026-05-05
linked_docs:
  - "[[09-tool-system]]"
canonical_path: wiki/runbooks/production-oauth-setup.md
---

# Runbook: Production OAuth Setup (Google + GitHub)

How to stand up the production OAuth apps that 2200 uses to broker user-grants for third-party services. Done once per provider; the resulting Client ID + Client Secret feed every Agent running on every 2200 instance ... self-hosted today, managed-service later.

This runbook captures the Google + GitHub flows that landed on 2026-05-05. It does **not** cover Slack, Stripe, Twilio, or any other provider Doug adds later ... when those land, append a section per provider following the same shape.

The 2200 OAuth Authorization Code + PKCE flow (Epic 9 Phase B-2) binds to a loopback redirect URI on the user's machine: `http://127.0.0.1:<random-port>/callback`. The OAuth client type at each provider must support that.

---

## Why production-grade now

Two reasons covered in [[feedback_full_effort_always]]:

- A production OAuth client ID with consent-screen branding, verified publisher, and a single-tenant org behind it ships once and migrates to nothing. A personal scratch app does not migrate ... it gets thrown away. The cost of starting on the production app is zero; the cost of switching off a scratch app later is non-trivial.
- Google publisher verification is a 4-6 week clock and only starts once you submit. Starting that clock the first time you stand up the Google OAuth app means the verification badge lands well before the managed-service launch.

---

## Prerequisites

- A Google Workspace owned by 2200 ... domain `2200.ai`, super-admin `dh@2200.ai`. Stand this up at `workspace.google.com` before doing anything else; GCP requires the Workspace organization to exist for billing + identity.
- A GitHub organization to own the OAuth app. Today's home: `github.com/twentytwohundred`. (The brand is "2200"; see [[project_canonical_domain]] for why the GitHub org has the spelled-out name.)
- The 2200 CLI on PATH and a 2200 install on the box (`~/.local/share/2200/` populated by `2200 init`).
- An Agent to receive the resulting tokens. The runbook uses `hobby` as the smoke target.

---

## Storage discipline ... two env files, separated by lifecycle

Two env files under `~/.config/2200/`, both mode 0600, both off Dropbox:

| File | Holds | Sourced when |
|---|---|---|
| `oauth-apps.env` | OAuth-app Client ID + Client Secret per provider (`_2200_OAUTH_<PROVIDER>_CLIENT_ID` / `_2200_OAUTH_<PROVIDER>_CLIENT_SECRET`) | Manually before `2200 oauth login <provider> <agent>` |
| `runtime.env` | Long-lived supervisor-runtime secrets ... LLM-provider API keys (`DEEPSEEK_API_KEY`, `ANTHROPIC_API_KEY`, etc.), any other env the daemon and its agents need at start time | **Automatically by `2200 daemon start`** (Epic 9 Phase D hardening) |

### Why split

Two different lifecycles. OAuth-app secrets are used during interactive flows (Doug runs `2200 oauth login google hobby`, file gets sourced, flow completes, secret is no longer needed). Runtime secrets are needed at every `2200 daemon start` for agent processes to bind their LLM providers. Mixing them in one file means either:

- The user has to source `oauth-apps.env` before every daemon start (friction), OR
- The OAuth-app secrets stay loaded in the daemon's environment forever (unnecessary blast radius).

Splitting cleanly: the daemon auto-sources only what it needs.

### The runtime.env auto-source

`2200 daemon start` reads `~/.config/2200/runtime.env` (if it exists) at spawn time and merges the parsed env into the supervisor child's `process.env`. Agent processes the supervisor later spawns inherit that env. No manual sourcing required.

Format: bash-style `export KEY=value` (or bare `KEY=value`) lines. Comments allowed. Keys must match `/^[A-Z_][A-Z0-9_]*$/`. Surrounding `"` or `'` quote pairs are stripped from values. Parse errors abort daemon start with a line-number-ed error message.

The parser does NOT support multi-line values, command substitution, or variable interpolation. This is config, not a shell script.

### Build-freshness check

The CLI also runs a build-freshness check at startup. If `dist/` is older than the newest `.ts` file in `src/`, you get a yellow stderr warning telling you to `pnpm build`. Skip it with `TWENTYTWOHUNDRED_SKIP_FRESHNESS=1`. In packaged installs (no co-located `src/`), the check is a silent no-op.

This catches the "pulled new commits, didn't rebuild" case that hung the GitHub OAuth flow on 2026-05-05 ... we surfaced the friction the same day we introduced the protection.

---

## Part 1: Google (Workspace + GCP + Desktop OAuth)

### 1.1 Workspace ... domain ownership and admin

1. Visit `workspace.google.com` ... Get Started.
2. Choose Business Starter ($6/user/month) unless you specifically want Meet recording / extra storage (Standard $12). Starter is sufficient for OAuth + admin needs.
3. Business info: name `2200`, region US, employees 1.
4. Domain: `2200.ai`.
5. Verify domain ownership at the registrar via DNS TXT record. Have the registrar's login handy.
6. Create the founding admin: `dh@2200.ai`.
7. Set up MX records so `dh@2200.ai` actually receives mail (not strictly required for OAuth-app paperwork but Google publisher verification routes correspondence here).

The Workspace-to-GCP organization sync is asynchronous. After Workspace is verified, the matching GCP organization may take minutes to a few hours to materialize. Do not create projects in the no-org space and migrate later; wait for the org.

### 1.2 GCP project

Sign in to `console.cloud.google.com` as `dh@2200.ai`. Confirm the `2200.ai` organization appears in the project picker (top-left).

1. Click "New Project" inside the `2200.ai` org.
2. Name: `2200`. Project ID: take the auto-generated value (or set explicitly if you have a preference).
3. Switch to the new project.

### 1.3 Enable APIs

Left nav → APIs & Services → Library. Enable each of these (one click per API):

- Gmail API
- Google Calendar API
- Google Drive API
- Google Tasks API
- Google People API
- Google Docs API
- Google Sheets API

More can be added later as Agents grow new integrations. These are the obvious "Agent connects to my Google stuff" surfaces.

You can also enable them programmatically if `gcloud` is installed and `gcloud auth login` is done:

```
gcloud services enable gmail.googleapis.com calendar-json.googleapis.com drive.googleapis.com tasks.googleapis.com people.googleapis.com docs.googleapis.com sheets.googleapis.com --project=<project-id>
```

### 1.4 OAuth consent screen ... minimum viable for the smoke

APIs & Services → OAuth consent screen → User Type: **External** → Create.

App information:

- App name: `2200`
- User support email: `dh@2200.ai`
- App logo: skip until publisher verification (verification will require a 120x120 PNG)
- App home page: `https://2200.ai`
- App privacy policy URL: `https://2200.ai/privacy`
- App TOS URL: `https://2200.ai/terms`
- Authorized domains: `2200.ai`
- Developer contact: `dh@2200.ai`

For the today-smoke, leave the Scopes screen empty and Save and Continue. Default `openid email profile` is implicit. The full sensitive-scope list (Gmail, Drive, Calendar) gets added later as part of the publisher-verification batch ... see Part 3 below.

Test users: add `dh@2200.ai`. This bypasses the "unverified app" warning for the test user, letting the smoke pass before publisher verification completes.

Save and Continue → Back to Dashboard.

### 1.5 Desktop OAuth Client ID

APIs & Services → Credentials → "+ Create Credentials" → OAuth client ID.

- Application type: **Desktop app** ... critical, NOT Web application.
- Name: `2200 Desktop`
- Create.

A modal pops with Client ID + Client Secret. Copy both.

**Why Desktop app, not Web application:** 2200's OAuth flow uses a loopback redirect with a random port (`http://127.0.0.1:<port>/callback`). Desktop app type accepts any loopback port automatically. Web application type requires registering each port explicitly, which the random-port shape can't satisfy. A separate Web application client gets created later when the managed-service hosted OAuth (Epic 17) lands ... that one will use a fixed `https://app.2200.ai/oauth/callback` URI.

### 1.6 Add to local env file

Append to `~/.config/2200/oauth-apps.env`:

```
export _2200_OAUTH_GOOGLE_CLIENT_ID=<paste-the-client-id>
export _2200_OAUTH_GOOGLE_CLIENT_SECRET=<paste-the-client-secret>
```

Save. Mode stays 0600. Do NOT add LLM API keys or other runtime secrets here ... those go in `runtime.env`.

### 1.7 Smoke

```
. ~/.config/2200/oauth-apps.env
2200 oauth login google hobby
```

The CLI prints the authorize URL, opens the user's browser, listens on a random local port. The user clicks "Continue" past the unverified-app warning (test-user flow), then "Allow" on the consent screen. Tokens land in `hobby`'s vault as `google-openid` (access) + `google-openid-refresh` (refresh).

Verify:

```
2200 credential list hobby                    # see the new entries
2200 credential show hobby google-openid      # metadata only
ACCESS=$(2200 credential show hobby google-openid --reveal | awk '/^value:/{print $2}')
curl -sS -H "Authorization: Bearer $ACCESS" https://www.googleapis.com/oauth2/v3/userinfo
```

Expected response includes `name`, `email: dh@2200.ai`, `email_verified: true`, `hd: 2200.ai`.

---

## Part 2: GitHub (OAuth App under twentytwohundred org)

### 2.1 Create the OAuth app

1. github.com → top-right avatar → Your organizations → `twentytwohundred` → Settings (org settings, not personal).
2. Left sidebar → Developer settings → OAuth Apps → New OAuth App.
3. Application name: `2200`
4. Homepage URL: `https://2200.ai`
5. Application description: short tagline (e.g. "Personal AI agent platform")
6. Authorization callback URL: `http://127.0.0.1/callback` ... GitHub treats loopback URIs as port-flexible, so any port the redirect server binds at flow time matches.
7. Enable Device Flow: leave unchecked.
8. Register → capture Client ID. Generate a Client Secret and copy it (visible only once).

### 2.2 Add to local env file

Append to `~/.config/2200/oauth-apps.env`:

```
export _2200_OAUTH_GITHUB_CLIENT_ID=<paste>
export _2200_OAUTH_GITHUB_CLIENT_SECRET=<paste>
```

### 2.3 Smoke

```
. ~/.config/2200/oauth-apps.env
2200 oauth login github hobby
```

Tokens land as `github-read-user` in hobby's vault.

GitHub OAuth Apps do **not** issue refresh tokens (that's a GitHub Apps feature). The runtime warns about it; informational, not a problem ... GitHub OAuth App access tokens are effectively non-expiring unless the app opts into the "Token expiration" preference at OAuth-app-creation time.

Verify:

```
ACCESS=$(2200 credential show hobby github-read-user --reveal | awk '/^value:/{print $2}')
curl -sS -H "Authorization: Bearer $ACCESS" -H "Accept: application/vnd.github+json" https://api.github.com/user
```

Expected response: GitHub user object including `login`, `id`, etc. for whichever user authorized.

---

## Part 3: Publisher verification (deferred, separate work)

Google's "verified publisher" status is what removes the "unverified app ... proceed at your own risk" warning end-users see on the consent screen. **Required before any non-test-user authenticates against the production OAuth client.** Submission timeline: ~4-6 weeks.

Prerequisites that block submission:

- `https://2200.ai/privacy` must resolve to a real privacy policy page.
- `https://2200.ai/terms` must resolve to a real TOS page.
- `https://2200.ai` must resolve to a real home page (or at least a placeholder splash).
- The OAuth consent screen must have a 120x120 PNG logo uploaded.
- The full sensitive-scope list (Gmail, Drive, Calendar, etc.) must be added to the consent screen ... Google verifies justification per scope, so add them all in one submission.

Sensitive/restricted scopes 2200 will eventually request:

- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/gmail.modify`
- `https://www.googleapis.com/auth/calendar`
- `https://www.googleapis.com/auth/calendar.events`
- `https://www.googleapis.com/auth/drive.file` (preferred over full Drive scope)
- `https://www.googleapis.com/auth/contacts`
- `https://www.googleapis.com/auth/contacts.readonly`
- `https://www.googleapis.com/auth/tasks`

Submission steps (when prerequisites land):

1. Console → OAuth consent screen → Edit.
2. Upload logo. Add full scope list. Provide justification per sensitive scope.
3. Save.
4. Click "Publish App" → "Prepare for verification" → submit.
5. Watch `dh@2200.ai` for Google's verification correspondence. Respond promptly to questions (delays push the clock back).

GitHub has no equivalent verification gate. The OAuth app is usable as soon as the Client ID + Secret exist.

---

## Part 4: Common operational concerns

### Stale CLI binary causes silent OAuth flow hangs

If `pnpm build` hasn't been run since the last source change to `src/runtime/oauth/` (or anywhere else exercised by the OAuth flow), the global `2200` CLI symlink may point to a stale `dist/cli/main.js`. Symptom: the OAuth flow hangs silently on the token-exchange `fetch()` ... the browser callback fires, the redirect server captures the code, but the bundled token-exchange code is from an older path that does not work against today's provider responses.

**As of 2026-05-05, the CLI runs a build-freshness check at startup** (Epic 9 Phase D hardening). If `dist/cli/main.js` is older than the newest `.ts` file in `src/`, it emits a yellow stderr warning telling you to `pnpm build`. Suppress with `TWENTYTWOHUNDRED_SKIP_FRESHNESS=1` if needed. In packaged installs without a co-located `src/`, the check is a silent no-op.

If you see the warning, run `pnpm build` from the project root. The new dist is picked up immediately by the next CLI invocation since `/opt/homebrew/bin/2200` is a symlink.

### Daemon restarts and supervisor env

**As of 2026-05-05, `2200 daemon start` auto-sources `~/.config/2200/runtime.env`** (Epic 9 Phase D hardening). Drop your LLM-provider API keys (`DEEPSEEK_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.) in that file as `export KEY=value` lines and the supervisor inherits them automatically on every `daemon start`. No manual sourcing.

Parse errors in `runtime.env` abort the daemon start with a line-numbered error message. Missing file is fine ... the daemon starts; agent bootstrap will fail loudly if a required key is absent, which is the correct degraded behavior.

If you have a special-case env var that needs to be in the daemon but NOT in `runtime.env`, source whatever you need before `2200 daemon start` and the supervisor will inherit your shell env (the auto-source merges over `process.env`, so explicit env vars take precedence).

### The "wrong clone" trap

If a 2200 supervisor was started from a non-canonical clone path (e.g., `~/code/2200/` instead of the canonical project root), the running supervisor will keep using that clone's `dist/` bundles even after canonical-clone rebuilds. Symptom: code changes do not take effect after `pnpm build` in the canonical clone.

Fix: stop the daemon, ensure the global `2200` symlink points to the canonical clone's `dist/cli/main.js`, restart from the canonical clone. Confirm with `ps -p <supervisor-pid> -o command` ... the path in the output is the source of truth.

### OAuth app rotation

When you regenerate a Client Secret at either provider's console, update the matching `_2200_OAUTH_<PROVIDER>_CLIENT_SECRET` line in `~/.config/2200/oauth-apps.env`. Re-source the file. **Existing per-Agent vault tokens stay valid** ... the Client Secret is used to mint new tokens; existing access/refresh tokens were minted from the old Secret but remain accepted by the provider until they naturally expire or are explicitly revoked.

### Provider-specific quirks

- **Google: `prompt=consent` is required to mint a refresh token.** The provider config in `src/runtime/oauth/providers.ts` already sets this. If you copy-paste a flow elsewhere, do not drop it ... without it, Google issues an access token only and there is no offline access.
- **GitHub: no refresh tokens for OAuth Apps.** The runtime emits a warning on flow completion; it is informational, not a degraded path. Long-lived access tokens are how GitHub OAuth Apps work.

---

## Done-when

- [ ] `~/.config/2200/oauth-apps.env` contains both Google and GitHub Client ID + Client Secret pairs.
- [ ] `2200 oauth login google <agent>` completes; tokens in vault; live `userinfo` call returns the authorized user's profile.
- [ ] `2200 oauth login github <agent>` completes; tokens in vault; live `api.github.com/user` call returns the authorized user's profile.
- [ ] Supervisor's oauth-refresh background job logs `oauth refresh tick` periodically (Epic 9 Phase B-3 ... the tick is one minute by default).

When publisher verification submission unblocks (privacy + TOS pages exist on `2200.ai`):

- [ ] Logo uploaded. Full sensitive-scope list added with justifications.
- [ ] App published; verification submitted.
- [ ] Verification status visible in Console; correspondence routed to `dh@2200.ai`.
