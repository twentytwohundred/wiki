# Hobby Brief: 2200 Installer — Day 1
**Date: 2026-05-20**
**Goal: Working install path for 2200 on Heisenberg by end of day**

---

## Context

Doug is pivoting visibility strategy and needs the 2200 public repo to be installable by anyone who lands on it from LinkedIn, X, or a cold visitor. The installer is the gating dependency for a lot of the public-facing work this week.

The acceptance test for today: Simon and Doug install 2200 on Heisenberg using a public install path, run a basic wizard, and see the system working end-to-end. If that works, the rest of the public-readiness work unblocks.

This is build-state software. The goal is NOT production hardening. The goal is **a working install path that a curious developer can run and see something meaningful happen.**

---

## The three install paths to consider

In order of priority for today:

### 1. Universal shell installer: `curl -fsSL https://install.2200.ai | sh`

This is the primary path. Most modern dev tools (Bun, Deno, Rust, Homebrew itself) install this way. Works on macOS and Linux without prerequisites.

**What it does:**
- Detects platform (macOS arm64, macOS x86_64, Linux x86_64, Linux arm64)
- Downloads the appropriate pre-built binary or installs from npm/source
- Places the `2200` CLI on the user's PATH (typically `~/.local/bin/` or `/usr/local/bin/`)
- Optionally sets up `~/.2200/` directory structure for state
- Prints a "you're installed, here's what to do next" message

**Today's target:** Get this working on Heisenberg specifically. Don't over-engineer the cross-platform detection yet. Focus on Linux x86_64 first (Heisenberg) and macOS arm64 second (Doug's MacBook).

**Infrastructure needed:**
- A hosting destination for the install script. Either `install.2200.ai` (subdomain, Simon's lane) or `raw.githubusercontent.com/twentytwohundred/2200/main/install.sh` as a temporary location until the subdomain is live.
- Decide where the binary or package lives. Could be GitHub Releases (easiest for now), could be npm, could be a CDN.

### 2. npm global install: `npm install -g 2200`

Secondary path for developers who already have Node.

**Requires:**
- Package name `2200` published to npm (verify availability... if taken, fall back to `@twentytwohundred/2200` or `twentytwohundred`)
- `bin` field in package.json pointing to a CLI entry point
- The CLI bootstraps the daemon, similar to how pm2 or nodemon work

**Today's target:** Get the npm publish working. Even if the binary path is preferred, npm install is a fallback that works on more environments.

### 3. Homebrew: `brew install 2200`

Tertiary path. Requires submitting a formula to homebrew-core or running a tap. NOT for today. Note it as a future deliverable, don't build it.

---

## What Hobby should actually do today

### Step 1: Inventory the current install state (~30 min)

- Read the current 2200 repo and identify what's needed to install
- Is there already an install script? If so, what does it do?
- Are there pre-built binaries, or does it install from source?
- What are the actual runtime dependencies? Node version? Other binaries?
- Document the manual install steps a developer would currently need to take

This is the baseline. Don't skip this. Hobby pause-and-surfaces here if the install story is more complicated than it looks.

### Step 2: Pick the install architecture (decision required, surface to Doug)

Two main options:

**Option A: npm-based install with CLI bootstrap**
- Publish 2200 to npm
- `npm install -g 2200` installs the CLI
- CLI runs setup wizard on first invocation
- Daemon lives in `~/.2200/`
- Updates via `npm update -g 2200`

Pros: simple, fast to ship, works for developers, npm handles the distribution
Cons: requires Node on the user's machine, global npm permissions can be flaky

**Option B: Standalone binary with shell installer**
- Build platform-specific binaries (could use `pkg` or `nexe` to bundle Node + 2200 into a single executable)
- Host binaries in GitHub Releases
- Shell installer downloads correct binary and places on PATH
- Daemon lives in `~/.2200/`
- Updates via `2200 update` or re-running installer

Pros: no Node prerequisite, works for non-developers, single command
Cons: more build complexity, need to build for multiple platforms

**Doug's preference (likely):** Start with Option A this week, plan for Option B as v2. Option A gets us shipping today; Option B is the polished version.

**Hobby should pause-and-surface the decision** before committing to one path. Doug needs to weigh in.

### Step 3: Build the install path (most of the day)

Once architecture is decided, execute:

For Option A (npm path):
1. Verify npm package name availability
2. Add `bin` field and CLI entry point to package.json
3. Build the CLI bootstrap that handles first-run setup
4. Test `npm install -g .` from local checkout first
5. Once that works, publish to npm (Doug needs to do the actual publish... credentials)
6. Test install on Heisenberg via `npm install -g 2200`

For Option B (shell installer):
1. Build platform binary (start with linux-x64 for Heisenberg)
2. Tag a release on GitHub with the binary attached
3. Write `install.sh` that detects platform and downloads correct binary
4. Place install.sh somewhere fetchable (GitHub raw URL for now, install.2200.ai when Simon has DNS)
5. Test on Heisenberg

### Step 4: First-run experience (critical)

When the user runs `2200` for the first time after install:
- A welcome message that explains what's about to happen
- A wizard that handles initial setup:
  - Where to put `2200_HOME` (default: `~/.2200/`)
  - Pick a model provider (Anthropic / OpenAI / Grok / local)
  - Authenticate (API key or OAuth or skip-for-now)
  - Confirm setup
- A working "hello world" Agent that demonstrates the system is running
- A "what to do next" message with links to the wiki and docs

The wow-factor moment is the working hello-world Agent. The user types `2200` and within 5 minutes sees an Agent doing something. If we can't deliver that today, we don't have an installer worth showing.

### Step 5: Update mechanism (test before declaring done)

Once install works, immediately test update:
- Change something in the codebase
- Bump the version
- Run the update command
- Verify the new version runs and state is preserved

If install works but update is broken, we're going to ship something we'll regret. Test both paths.

### Step 6: README + install docs (afternoon)

Update the public-facing repo with:
- A clear "How to install" section at the top of the README
- One-command install instructions
- A short "what you can do once installed" section
- Link to the wiki for deeper documentation

The README is what people see when they land on GitHub from a LinkedIn comment. Treat it like the storefront.

---

## What Hobby should NOT do today

- Build the Homebrew formula
- Build Windows install path
- Build a Docker container (good idea, but not today)
- Optimize for production deployment scenarios
- Build an auto-update notification system
- Set up a usage telemetry pipeline
- Build a "2200 cloud" hosted version
- Touch the visibility Agent spec (separate work track)

Stay focused. Install on Heisenberg. Make it real. Everything else this week.

---

## Pause-and-surface triggers

Hobby should stop and surface to Doug if any of these occur:

1. **Architecture decision needed** (Option A vs Option B above)
2. **npm name `2200` is taken** — needs Doug's call on alternate naming
3. **Required runtime dependencies turn out to be heavier than expected** (e.g., the daemon needs Postgres, Redis, or other infrastructure on the user's machine — that materially changes the install story)
4. **The "hello world" Agent demo is harder to ship than expected** — Doug needs to know if the wow-factor moment isn't going to be there today
5. **Anything that requires Doug's GitHub or npm credentials** to proceed

Default to surfacing too much rather than too little today. This is the gating dependency for a lot of downstream work and Doug wants visibility into the decisions.

---

## End-of-day deliverable

By 6pm CT, Doug expects:
- A working install path on Heisenberg (one command, fresh box)
- A working first-run experience that demonstrates 2200 is real
- A working update mechanism
- An updated README on the public repo
- A handoff doc summarizing what shipped, what's parked, what's next

If any of those four pieces aren't done, Hobby surfaces the gap clearly with a recommendation for tomorrow.

---

## On the `npm install 2200` question

Doug asked specifically whether install could be as simple as `npm install 2200`. The honest answer is `npm install -g 2200` is feasible as Option A and is probably what gets shipped this week. The `-g` is critical (without it, npm treats it as a project dependency, which 2200 is not). It's not quite as clean as `npm install 2200` but it's one extra character and developers understand the convention.

The cleaner answer for non-developers will eventually be `curl | sh` or a platform-specific installer, but those are v2.

Hobby should ship Option A today and document Option B as the next milestone.
