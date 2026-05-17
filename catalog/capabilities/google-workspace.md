---
id: google-workspace
label: Google Workspace
category: email
description: Read, label, draft, and send Gmail or Workspace mail.
homepage: https://workspace.google.com
publisher: first-party
source:
  attribution: openclaw
  openclaw_path: skills/gog/SKILL.md
  notes: |
    Adapted from OpenClaw's `gog` skill (Google Workspace CLI). Format
    translated to 2200 Capability Catalog shape; acquisition prose
    rewritten for our walkthrough runner. OpenClaw is MIT (c) 2025
    Peter Steinberger.
auth:
  - name: GOOGLE_WORKSPACE_OAUTH
    kind: oauth_download_client_secret
    scopes:
      - https://www.googleapis.com/auth/gmail.modify
      - https://www.googleapis.com/auth/gmail.send
      - https://www.googleapis.com/auth/calendar
      - https://www.googleapis.com/auth/drive.readonly
      - https://www.googleapis.com/auth/contacts.readonly
      - https://www.googleapis.com/auth/tasks
    env_var: GOOGLE_WORKSPACE_OAUTH_REF
    obtain_url: https://console.cloud.google.com/apis/credentials
unlocks:
  tools:
    - gmail_search
    - gmail_get
    - gmail_draft
    - gmail_send
    - gmail_label
    - gcal_list_events
    - gcal_create_event
    - gdrive_search
    - gdrive_read
    - gcontacts_list
    - gtasks_list
    - gtasks_create
  skills:
    - gmail-triage
    - gcal-scheduling
  extensions: []
  providers: []
network_egress:
  domains:
    - www.googleapis.com
    - accounts.google.com
    - oauth2.googleapis.com
    - gmail.googleapis.com
    - calendar.googleapis.com
    - drive.googleapis.com
    - people.googleapis.com
    - tasks.googleapis.com
tags:
  - email
  - inbox
  - gmail
  - mail
  - workspace
  - calendar
  - drive
  - contacts
  - tasks
  - google
  - triage
  - drafts
requires:
  bins: []
  os: []
  capabilities: []
walkthrough:
  estimated_minutes: 12
  difficulty: medium
---

# Setup walkthrough

This sets up the Google Workspace bundle ... one OAuth consent unlocks Gmail, Calendar, Drive (read-only), Contacts (read-only), and Tasks. About 12 minutes start to finish.

You'll create a project in Google Cloud Console, enable the API surfaces 2200 needs, download an OAuth client_secret JSON, and tell 2200 where to find it. You don't need to go through Google's app verification process because you're acting as both the publisher AND the end-user of the OAuth client ... the standard "internal use" pattern.

## Step 1 ... open the Google Cloud Console

Go to [console.cloud.google.com](https://console.cloud.google.com) and sign in with the Google account whose Workspace you want this Capability to operate against. If you don't have a project yet, the Console will prompt you to create one ... name it something like `2200 Workspace Agent` so you can recognize it later.

## Step 2 ... enable the API surfaces

In the Console's left nav, go to **APIs & Services → Library**. Enable each of these (search the name, click the result, click "Enable"):

- **Gmail API** ... for read, search, draft, send, label.
- **Google Calendar API** ... for list/create events.
- **Google Drive API** ... for read-only search and document fetch.
- **People API** ... for contacts list.
- **Tasks API** ... for task list and create.

Enabling is per-API; you'll do this five times. After each, the Console shows "API enabled" and offers a "Create credentials" button ... ignore that button for now (we create one OAuth client that covers all five APIs).

## Step 3 ... create the OAuth client

In **APIs & Services → Credentials**, click **Create credentials → OAuth client ID**. If this is your first OAuth client in the project, the Console will require you to configure the OAuth consent screen first:

- **User type**: External (unless your Workspace admin has restricted to Internal).
- **App name**: `2200 Workspace Agent` (anything recognizable).
- **User support email**: your own.
- **Scopes**: skip this step ... the scopes are requested per-call by the runtime.
- **Test users**: add your own email. You can self-test without going through Google's verification flow as long as the test-user list contains your address. Production Workspace verification is a separate process; not needed for a single-operator install.

Now back to **Create OAuth client ID**:

- **Application type**: Desktop app.
- **Name**: `2200 Workspace Agent`.
- Click Create.

The Console shows a dialog with your client ID and client secret. Click **Download JSON** ... the file lands as `client_secret_<something>.json` in your Downloads folder.

## Step 4 ... tell 2200 where the JSON file lives

Move the downloaded JSON to a stable location you'll remember:

```
mkdir -p ~/.config/2200
mv ~/Downloads/client_secret_*.json ~/.config/2200/google-workspace-client-secret.json
chmod 0600 ~/.config/2200/google-workspace-client-secret.json
```

The `0600` permission limits filesystem access to you only ... the JSON contains the OAuth client secret and shouldn't be world-readable.

In the next message, 2200 will ask you to paste the **path** to this file (not the file's contents). Paste:

```
~/.config/2200/google-workspace-client-secret.json
```

## Step 5 ... complete the OAuth flow

When 2200's runtime opens the OAuth flow in your browser:

- Pick the Google account whose Workspace this Capability targets.
- Google will warn that "Google hasn't verified this app." Click **Advanced → Continue (unsafe)** ... this is expected for unverified single-operator apps and is safe in this context (you ARE the publisher).
- Grant each scope when prompted (mail, calendar, drive, contacts, tasks).

When Google returns you to 2200, the credential is sealed and the walkthrough completes.

## Verification

Once setup completes, your Agent can:

- `gmail_search "from:<your-address> is:unread"` to confirm Gmail access.
- `gcal_list_events --days 7` to confirm Calendar.
- `gdrive_search "type:document modified:7d"` to confirm Drive.

If any of these fail with `permission_denied`, the OAuth scope was not granted; re-run Step 5 and grant the missing scope.

## Multi-Agent note (v1 limitation)

This Capability is per-Agent. If two Agents on this instance both need Google Workspace, each will run through this walkthrough independently and produce its own OAuth grant. Cross-Agent credential share is deferred to a separate substrate epic; see [[../../decisions/2026-05-18-capability-security-model]] § "What we defer to the External-Publisher Epic."

## Sub-toggle note (post-task-7 polish)

Today this Capability is takes-all-or-takes-nothing across the five service surfaces (Gmail, Calendar, Drive, Contacts, Tasks). The preview UI's sub-toggle support (see [[../../epics/14-phase-f-capability-catalog]] §7) ships after the baseline preview integration ... once it lands, you can untick individual services to filter the unlocked tools/skills lists. Until then, you can disable specific tools post-spawn by editing the Identity.

---

*Setup steps adapted from OpenClaw's `skills/gog/SKILL.md` (MIT (c) 2025 Peter Steinberger). Format translated to 2200 Capability Catalog shape.*
