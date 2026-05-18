---
id: github
label: GitHub
category: dev-code
description: Manage repos, PRs, issues, and workflows on GitHub.
homepage: https://github.com
publisher: first-party
source:
  attribution: openclaw
  openclaw_path: skills/github/SKILL.md
  notes: |
    Concept adapted from OpenClaw's github skill (gh CLI wrapper).
    2200 uses GitHub's REST API directly via a fine-grained PAT
    rather than depending on gh CLI being present and pre-authed.
    OpenClaw is MIT (c) 2025 Peter Steinberger.
auth:
  - name: GITHUB_PAT
    kind: api_key
    env_var: GITHUB_PAT_REF
    obtain_url: https://github.com/settings/personal-access-tokens
unlocks:
  tools:
    - gh_pr_list
    - gh_pr_view
    - gh_pr_create
    - gh_pr_merge
    - gh_pr_checks
    - gh_pr_comment
    - gh_issue_list
    - gh_issue_view
    - gh_issue_create
    - gh_issue_close
    - gh_issue_comment
    - gh_workflow_list
    - gh_workflow_view
    - gh_repo_list
    - gh_repo_view
    - gh_api_get
  skills: []
  extensions: []
  providers: []
network_egress:
  domains:
    - api.github.com
    - github.com
    - uploads.github.com
    - codeload.github.com
tags:
  - dev
  - dev-code
  - github
  - git
  - pr
  - issue
  - ci
  - workflow
  - repo
requires:
  bins: []
  os: []
  capabilities: []
walkthrough:
  estimated_minutes: 6
  difficulty: easy
---

# Setup walkthrough

*This walkthrough is for self-hosted 2200 installs. Hosted-tier operators see a different flow that we'll add when the hosted tier ships.*

You'll generate a fine-grained Personal Access Token (PAT) on GitHub, scope it to the repositories and permissions the Agent needs, and hand it to 2200. About 6 minutes start to finish.

GitHub also supports OAuth Apps, but a PAT is the cleaner path for an Agent: scoped per-repo, expires on a date you set, revocable from the GitHub UI with one click. OAuth would put 2200 in the middle of the user-consent flow which we don't need for a single-operator install.

## Step 1 ... open the fine-grained PAT page

Go to [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens) (or **Settings → Developer settings → Personal access tokens → Fine-grained tokens**).

Click **Generate new token**.

## Step 2 ... configure the token

- **Token name**: `2200 Agent` (or your Agent's name, so you can revoke easily later).
- **Expiration**: 90 days is the GitHub default; pick what fits your operating cadence. Setting an expiration is a security best practice ... a token that lives forever is harder to rotate.
- **Resource owner**: you (your personal account) OR an organization you own.
- **Repository access**: pick the option that matches your scope:
  - **All repositories** ... broad; OK for personal use.
  - **Only select repositories** ... safer; pick the specific repos the Agent should operate on.

## Step 3 ... grant permissions

Fine-grained PATs require explicit permission grants per category. Enable these:

**Repository permissions:**
- **Actions**: Read (for workflow runs + logs)
- **Contents**: Read and write (for branch/file operations if the Agent edits)
- **Issues**: Read and write
- **Metadata**: Read (auto-required)
- **Pull requests**: Read and write
- **Workflows**: Read and write (only if the Agent needs to edit `.github/workflows/*` files)

**Account permissions:** leave at defaults (no special needs for PR/issue/CI use cases).

If you don't know whether the Agent will need a permission, default to NOT granting it. You can always edit the PAT later and add more.

## Step 4 ... generate and copy

Click **Generate token**. GitHub shows the token once, prefixed `github_pat_...`. **Copy it now** ... GitHub won't show it again. If you lose it, generate a new one.

## Step 5 ... paste into 2200

When 2200's runtime opens the credential request prompt (in your 1:1 chat with the Agent), paste the token.

The token goes browser → runtime → vault. It never appears in the Agent's LLM context or transcripts.

## Step 6 ... verify

Ask the Agent to do something light:

> "List the open PRs in twentytwohundred/2200."

If you see a list, you're good. If you see `permission_denied` or `not_found`, the PAT's repository scope doesn't include the repo you asked about ... revisit Step 2's repo selection.

## Rotation

When the token approaches expiry (GitHub emails you ~7 days before), repeat Steps 1-5 with a new token. Revoke the old one at github.com/settings/personal-access-tokens. The Agent transitions seamlessly on next call.

## What this unlocks

- `gh_pr_list / gh_pr_view / gh_pr_create / gh_pr_merge / gh_pr_checks / gh_pr_comment` ... PR lifecycle.
- `gh_issue_list / gh_issue_view / gh_issue_create / gh_issue_close / gh_issue_comment` ... issue lifecycle.
- `gh_workflow_list / gh_workflow_view` ... CI / GitHub Actions visibility.
- `gh_repo_list / gh_repo_view` ... repository metadata.
- `gh_api_get` ... raw GET against `api.github.com` for anything the typed tools don't cover (rate-limited the same as the token's normal scope).

## Multi-org note

One PAT can scope to ONE resource owner (you OR a specific org). If your Agent needs to operate against multiple orgs (e.g. your personal repos AND an org's repos), generate one PAT per owner and add multiple `auth` entries by re-running this walkthrough. Multi-PAT support in a single Capability is a follow-on; v1 holds one PAT per Capability install.

## Multi-Agent note (v1 limitation)

Per [[../decisions/2026-05-18-capability-security-model]] § "What we defer to the External-Publisher Epic," credentials are per-Agent at v1. Two Agents both needing GitHub each generate their own PAT (you can name them by Agent so the GitHub Settings list stays readable).

---

*Concept adapted from OpenClaw's `skills/github/SKILL.md` (MIT (c) 2025 Peter Steinberger). Auth approach changed from gh-CLI-with-OAuth to fine-grained PAT for tighter per-Capability scope and easier revocation.*
