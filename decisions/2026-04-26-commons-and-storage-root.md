---
title: "Commons spec addendum for Epic 2"
type: spec-addendum
status: locked
tags: [epic-2, commons, shared-filesystem, storage, fs-tools, runtime]
created: 2026-04-26
updated: 2026-04-26
linked_docs:
  - "[[02-agent-runtime-minimum]]"
  - "[[02-architecture]]"
  - "[[2026-04-25-tool-baseline]]"
canonical_path: wiki/decisions/2026-04-26-commons-and-storage-root.md
---

# Commons and storage root

Addendum to Epic 2. Defines the shared filesystem layer for 2200 — where files live, how the human and Agents share them, and what 2200 deliberately does not do.

## Core principle

2200 doesn't own its storage. The user does.

The user picks a directory. 2200 reads and writes inside that directory. Whatever the user uses to sync, back up, version, or share that directory is the user's responsibility. 2200 sits on top of the storage layer the user already has.

This means:

- A user with Dropbox points 2200 at a Dropbox folder. They get sync across devices and version history for free.
- A user with a NAS points 2200 at a network mount. They get whatever the NAS provides.
- A user with iCloud points at an iCloud folder. They get Apple's sync.
- A user with no opinion points at `~/Documents/2200/`. They get a directory on their disk.
- A power user with a custom backup chain points at the directory in that chain.

Same code path. Same runtime. Different user-chosen storage layer underneath.

## 2200_HOME

The configurable root directory. Set at install time:

```
2200 init --home /path/to/wherever
```

Stored in user-level config (probably `~/.config/2200/config.json` or platform equivalent). Every other 2200 path resolves relative to this root.

Default if not specified: `~/.local/share/2200/` (Linux/macOS XDG conventions). Users can change at any time by re-running `2200 init --home <new-path>`. The runtime supports moving the directory; users handle the actual move themselves.

## Directory layout under 2200_HOME

Convention, not enforcement. Users can deviate; the runtime works with whatever layout exists.

```
$2200_HOME/
├── commons/                  # team-wide shared filesystem
│   ├── reference/            # human-writable, agents read-only by default
│   ├── scratch/              # agent read-write, ephemeral working space
│   └── (whatever the user/agents organize over time)
├── agents/
│   ├── hobby/
│   │   ├── identity.md       # the Identity file
│   │   ├── project/          # working directory for active tasks
│   │   ├── brain/            # memory + records (plan/run/perm, detector trips, etc.)
│   │   └── shared/           # per-agent human-agent handoff point
│   └── simon/
│       └── ...
├── state/                    # supervisor state, daemon PID, etc.
│   └── supervisor.json
└── config/                   # global config that isn't user-level
```

The `state/` and `config/` directories are 2200's internal structure. The runtime expects them to exist and creates them on `2200 init`. Users should not edit files in these directories directly.

The `commons/` and `agents/<name>/` directories are where the human and the team work. Users can edit anything in these freely.

## Commons

The team's shared filesystem. Lives at `$2200_HOME/commons/`. Two subdirectories at v1:

**`commons/reference/`** — human-writable, agents read-only by default. The human drops reference material here: brand guides, customer lists, document templates, anything the team should be able to read but shouldn't accidentally modify.

**`commons/scratch/`** — agents read-write. Ephemeral working space the team uses to coordinate. An Agent produces a draft and drops it here for another Agent to consume. The human can also write here.

Users can create additional subdirectories under `commons/` with whatever organization makes sense for their work. Recommended pattern: structure by project, by client, by topic. The runtime doesn't enforce structure; it provides defaults.

## Per-Agent shared directories

Each Agent gets a `shared/` subdirectory at `$2200_HOME/agents/<n>/shared/`. The human-Agent handoff point distinct from commons.

Use case: the human drops a PDF for Hobby specifically. Says "Hobby, please process the PDF I just added." Hobby finds it in his shared dir without the human specifying a path.

Permissions:
- The human has read/write
- The owning Agent has read/write
- Other Agents have no access by default

The shared dir is for things between one specific Agent and the human. Things meant for multiple Agents go in commons.

## Path resolution in fs tools

The fs tools (`fs.read`, `fs.write`, `fs.edit`, `fs.list`, `fs.delete`) resolve three new path prefixes:

| Prefix | Resolves to |
|---|---|
| `/commons/...` | `$2200_HOME/commons/...` |
| `/shared/...` | `$2200_HOME/agents/<calling-agent>/shared/...` |
| `/project/...` | `$2200_HOME/agents/<calling-agent>/project/...` (existing) |
| `/brain/...` | `$2200_HOME/agents/<calling-agent>/brain/...` (existing) |

Cross-agent shared access is explicit: `/agents/<other>/shared/...` requires explicit permission and a path that names the other agent. By default, attempting this path returns a permission denial.

## New perm checks

Two additions to the v1 check types:

**`commons_scope`** — verifies the call's target path is within commons read/write rules for this Agent. Default rules:

- Reads to `/commons/...`: allowed for all Agents
- Writes to `/commons/scratch/...` and subdirs: allowed for all Agents
- Writes to `/commons/reference/...`: denied (human-only)
- Writes to other `/commons/...` paths: allowed for all Agents (unstructured space)

The default rules can be overridden per Agent via Identity file or per directory via metadata. v1 ships with the defaults; richer permission configuration lands in a future epic.

**`shared_scope`** — verifies the call's target is within the Agent's own shared directory or has explicit access to another Agent's shared dir. Default: only the calling Agent's own shared dir is accessible.

Both checks slot into the `checks[]` array on perm records same as the existing six check types.

## What 2200 doesn't do

Explicit non-scope:

- **Sync.** 2200 doesn't sync data across devices. The user's storage solution does (Dropbox, iCloud, Syncthing, NAS, whatever).
- **Backup.** 2200 doesn't back up data. The user's backup approach does (rclone to S3, time machine, restic, whatever).
- **Version history.** 2200 doesn't track file versions. The user's storage might (Dropbox keeps 30 days, NAS snapshots, Git if the user wants to git the directory).
- **Mobile access.** 2200 doesn't expose data on mobile. The user's storage does, via whatever app the storage provider ships.
- **Sharing with non-team-members.** 2200 doesn't share files with people outside the team. The user's storage might (Dropbox shared folders, Google Drive sharing, whatever).
- **Conflict resolution.** Last-write-wins at v1. If two Agents write to the same file simultaneously, the second write wins. Agents that need coordination should use the inbox first. Users can layer their storage's conflict resolution on top if needed (Dropbox conflict copies, NAS file locking, etc.).

This list is the v1 scope discipline. Each item is a thing 2200 deliberately does not own. Users compose 2200 with their existing tools to get the behavior they want.

## Storage solution compatibility

v1 supports anything that presents as a posix filesystem to the runtime. The runtime opens files, reads them, writes them, lists directories. Standard filesystem operations.

This means:

- ✓ Local disk
- ✓ Mounted NAS (NFS, SMB, AFP)
- ✓ Dropbox folder, iCloud folder, Google Drive folder (when synced as local files)
- ✓ Tailscale-shared folders, Syncthing folders
- ✓ Object storage via posix interface (rclone mount, s3fs, etc.) — works but with caveats around latency and atomicity

This means **not**:

- ✗ Direct S3 or other object storage as primary storage (no posix interface)
- ✗ Browser-based-only storage (Google Drive web UI, Dropbox web UI)
- ✗ Storage that requires app-mediated access

If a user wants object storage as primary, they install a posix-compatible mount tool (rclone, s3fs) and point 2200 at the mount.

Users with sync solutions should be aware of platform-specific quirks:

- **Dropbox** can have sync delays with many small files. Plan/run/perm records are tiny but frequent during heavy Agent activity. This is fine for v1; if it becomes a bottleneck, future epics may add a flag to direct records to local storage even when 2200_HOME is on Dropbox.
- **iCloud** does aggressive offloading. Files might be marked "in cloud" and require download on access. Acceptable but adds latency.
- **NAS over slow networks** has latency and potential disconnection. The atomic-write pattern (already implemented in PR #4) handles brief disconnections; longer outages may require manual recovery.
- **Google Drive** historically had issues with symlinks and unusual permissions. 2200 doesn't use either, so this should be fine.

## Implementation guidance for PR #8

Concrete spec changes for Hobby:

1. Add `2200_HOME` to the configuration system. `2200 init --home <path>` writes it to user config. All path resolution uses it as the root.
2. Create the directory structure (`commons/reference/`, `commons/scratch/`, `state/`, `config/`) on `2200 init`. Per-Agent directories created on `agent create`.
3. Add path-prefix resolution to fs tools. The three new prefixes (`/commons/`, `/shared/`, plus existing `/project/`, `/brain/`) resolve relative to 2200_HOME and the calling Agent's identity.
4. Add the two new perm check types (`commons_scope`, `shared_scope`) to the `checks[]` array. Implement the default rules.
5. Done When additions:
   - User can `2200 init --home /path/to/dropbox/2200` and the directory structure appears
   - An Agent can `fs.write /commons/scratch/draft.md` successfully
   - An Agent attempting `fs.write /commons/reference/brand.md` is denied at perm with `commons_scope` denial reason
   - The human can drop a PDF in `commons/reference/` and an Agent can read it via `fs.read /commons/reference/<name>.pdf`
   - Two Agents can both read from `/commons/scratch/` simultaneously without conflicts
   - An Agent's `fs.read /shared/some-file.md` resolves to its own shared dir; attempting to read another Agent's `/agents/<other>/shared/...` is denied

## Future scope (out of Epic 2)

Things deliberately deferred to later epics:

- **Per-directory permission overrides** beyond the v1 defaults. (Future Behavior dashboard epic, probably.)
- **Conflict detection beyond last-write-wins.** (May land in a coordination epic if real conflicts emerge.)
- **Cross-agent shared dir access patterns.** (May land in Extension framework epic if Skills need to coordinate via per-Agent shared dirs.)
- **Storage solution-specific optimizations** (e.g., Dropbox-aware buffering for record writes). (Lands when real users hit real performance issues.)
- **A "librarian" Agent role** that maintains commons organization. (Lands when commons gets unwieldy enough that manual curation hurts.)

## References

- [[02-agent-runtime-minimum]] — Epic 2 spec; commons integrates here
- [[2026-04-25-tool-baseline]] — baseline tool decision; fs tools land in PR #8
- [[upgrade-readiness]] — discipline 5 (SecretRef-style indirection); commons doesn't need SecretRef but uses similar config-resolution pattern

---

*Spec addendum authored 2026-04-26. Bakes into Epic 2 PR #8 from the start.*
