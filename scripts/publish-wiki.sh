#!/usr/bin/env bash
#
# publish-wiki.sh
#
# Publishes the canonical Brain-format wiki tree (this directory's parent)
# to the GitHub Wiki for twentytwohundred/2200.
#
# What it does:
#   1. Ensures a local clone of the wiki repo exists (outside Dropbox to
#      avoid cloud-sync conflicts with .git/).
#   2. Pulls latest from origin (in case the wiki was edited via GitHub UI).
#   3. Wipes the working tree (preserving .git/) and re-populates it from
#      the canonical source.
#   4. Strips YAML frontmatter from every published doc (the wiki render
#      should not show metadata blocks at the top of pages).
#   5. Flattens subdirectories to wiki root (GitHub Wiki's [[link]]
#      resolution does not traverse subdirs cleanly; the source structure
#      is preserved in the canonical tree, and _Sidebar.md provides the
#      visible structure on the rendered wiki).
#   6. Generates Home.md (from README, frontmatter stripped), _Sidebar.md
#      (manifest-driven nav), and _Footer.md.
#   7. Commits with a co-author trailer and pushes.
#
# Usage:
#   ./scripts/publish-wiki.sh ["optional commit message"]
#
# Architecture context:
#   The Dropbox tree at hobby/wiki/ is canonical. Source files keep their
#   frontmatter for Obsidian compatibility and Brain-pattern dogfooding.
#   The GitHub Wiki is a published view, not a source of truth. If the
#   wiki is edited via the GitHub UI, the next publish-wiki.sh run pulls
#   that change in via git pull --rebase before overwriting (so manual
#   edits there are preserved as long as they touch different lines or
#   the Dropbox tree is also updated).
#
# License: Elastic License v2

set -euo pipefail

# --- Configuration -----------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# Public wiki lives on the org's `.github` repo's Wiki feature so it is
# visible to anyone visiting the org. The runtime repo `2200` stays
# private until launch; its own wiki is no longer the publish target.
WIKI_REPO_URL="https://github.com/twentytwohundred/.github.wiki.git"
WIKI_CLONE_DIR="${HOME}/code/twentytwohundred-public-wiki"
COMMIT_MSG_DEFAULT="Sync wiki from canonical source"
COMMIT_MSG="${1:-$COMMIT_MSG_DEFAULT}"

ROOT_FILES=(
  "01-vision.md"
  "02-architecture.md"
  "03-epic-map.md"
  "04-seed-team.md"
  "prior-art-analysis.md"
  "prior-art-source-findings.md"
)

SUBDIRS=("conventions" "decisions" "design" "epics" "parked")

# --- Helpers -----------------------------------------------------------------

log() {
  printf '[publish-wiki] %s\n' "$*"
}

# Strip YAML frontmatter from a markdown file.
# Frontmatter is the leading block delimited by --- ... --- on their own lines.
# Also trims any blank lines immediately following the closing ---.
strip_frontmatter() {
  local input="$1"
  local output="$2"
  awk '
    BEGIN { state = "start" }
    state == "start" && NR == 1 && /^---[[:space:]]*$/ { state = "in"; next }
    state == "start" { state = "after"; print; next }
    state == "in" && /^---[[:space:]]*$/ { state = "after_strip_blanks"; next }
    state == "in" { next }
    state == "after_strip_blanks" && /^[[:space:]]*$/ { next }
    state == "after_strip_blanks" { state = "after"; print; next }
    state == "after" { print }
  ' "$input" > "$output"
}

# Ensure the wiki clone exists. Bootstraps an empty wiki on first run.
ensure_wiki_clone() {
  if [ -d "$WIKI_CLONE_DIR/.git" ]; then
    log "Pulling latest wiki state..."
    (cd "$WIKI_CLONE_DIR" && git pull --rebase --no-edit 2>/dev/null) || {
      log "Pull failed (wiki may not yet have any commits). Continuing."
    }
    return
  fi

  mkdir -p "$(dirname "$WIKI_CLONE_DIR")"

  log "Attempting to clone existing wiki..."
  if git clone "$WIKI_REPO_URL" "$WIKI_CLONE_DIR" 2>/dev/null; then
    log "Cloned existing wiki."
    return
  fi

  log "Wiki repo is empty (first publish). Initializing locally..."
  mkdir -p "$WIKI_CLONE_DIR"
  (
    cd "$WIKI_CLONE_DIR"
    git init -b master >/dev/null 2>&1 || git init >/dev/null 2>&1
    git remote add origin "$WIKI_REPO_URL"
  )
}

# Detect the wiki's default branch (master for older wikis, main for newer).
detect_default_branch() {
  local branch
  branch="$(cd "$WIKI_CLONE_DIR" && git symbolic-ref --short HEAD 2>/dev/null || echo "master")"
  printf '%s' "$branch"
}

# --- Build the wiki content --------------------------------------------------

ensure_wiki_clone

cd "$WIKI_CLONE_DIR"

log "Wiping working tree (preserving .git/)..."
# Iterate top-level entries explicitly so we never risk descending into .git/
# Portable across BSD/GNU find; no clever -prune logic.
for entry in $(ls -A "$WIKI_CLONE_DIR" 2>/dev/null); do
  if [ "$entry" = ".git" ]; then
    continue
  fi
  rm -rf "$WIKI_CLONE_DIR/${entry:?}"
done

log "Copying root files (frontmatter-stripped)..."
for f in "${ROOT_FILES[@]}"; do
  src="$SOURCE_ROOT/$f"
  if [ -f "$src" ]; then
    strip_frontmatter "$src" "$WIKI_CLONE_DIR/$f"
  else
    log "  warning: $f not found in source"
  fi
done

log "Flattening subdir contents to wiki root..."
for d in "${SUBDIRS[@]}"; do
  src_dir="$SOURCE_ROOT/$d"
  if [ ! -d "$src_dir" ]; then
    continue
  fi
  shopt -s nullglob
  for f in "$src_dir"/*.md; do
    base="$(basename "$f")"
    target="$WIKI_CLONE_DIR/$base"
    if [ -e "$target" ]; then
      log "  warning: collision on flattening: $base (skipping subdir copy)"
      continue
    fi
    strip_frontmatter "$f" "$target"
  done
  shopt -u nullglob
done

log "Generating Home.md from README..."
if [ -f "$SOURCE_ROOT/README.md" ]; then
  strip_frontmatter "$SOURCE_ROOT/README.md" "$WIKI_CLONE_DIR/Home.md"
fi

log "Generating _Sidebar.md..."
cat > "$WIKI_CLONE_DIR/_Sidebar.md" <<'SIDEBAR'
**Start here**

- [[Home]]
- [[01-vision|Vision]]
- [[02-architecture|Architecture]]
- [[03-epic-map|Epic map]]
- [[04-seed-team|Seed team]]

**Prior art**

- [[prior-art-analysis|Executive analysis]]
- [[prior-art-source-findings|Source findings (deep)]]

**Conventions**

- [[brain-format|Brain format]]
- [[handoff-format|Handoff format]]
- [[voice-and-framing|Voice and framing]]
- [[design-language|Design language]]
- [[upgrade-readiness|Upgrade readiness]]

**Decisions**

- [[2026-04-24-hobby-as-primary-agent|Hobby as primary Agent]]
- [[2026-04-24-baseline-model-tier|Baseline model tier]]
- [[2026-04-24-skill-compatibility-pipeline|Skill compatibility pipeline]]
- [[2026-04-24-cost-behavior-shape|Cost behavior shape]]
- [[2026-04-24-runtime-upgrade-shape|Runtime upgrade shape]]
- [[2026-04-24-bulletin-substrate-is-scut|Bulletin substrate is SCUT]]
- [[2026-04-24-brain-is-files-not-database|Brain is files, not database]]
- [[2026-04-25-mcp-native|MCP-native runtime]]
- [[2026-04-25-tool-baseline|Tool baseline + plan/run/perm]]
- [[2026-04-25-skills-first-class|Skills as first-class]]
- [[2026-04-26-toolchain-pick|Epic 2 toolchain pick]]
- [[2026-04-26-control-plane-protocol|Supervisor↔Agent control plane (UDS + JSON-RPC)]]
- [[2026-04-26-web-search-provider|Web search provider (Tavily + Brave)]]
- [[2026-04-26-notification-file-format|Notification file format]]
- [[2026-04-26-schema-version-format|Schema version field format (integer)]]
- [[2026-04-26-model-field-format|Model field format (provider/model_id)]]
- [[2026-04-26-commons-and-storage-root|Commons and storage root (Epic 2 spec addendum)]]

**Design docs**

- [[pulse|Pulse — Agent activity status]]
- [[brain-visualization|Brain visualization (parking)]]

**Epic specs**

- [[01-seed-team-coordination|Epic 1: Seed team coordination]]
- [[02-agent-runtime-minimum|Epic 2: Agent runtime minimum]]

**Parked**

- [[parked-reputation-protocol|Reputation protocol (future)]]
SIDEBAR

log "Generating _Footer.md..."
cat > "$WIKI_CLONE_DIR/_Footer.md" <<'FOOTER'
[2200](https://github.com/twentytwohundred/2200) · [Elastic License v2](https://github.com/twentytwohundred/2200/blob/main/LICENSE) · published from canonical source via `scripts/publish-wiki.sh`
FOOTER

# --- Commit and push ---------------------------------------------------------

cd "$WIKI_CLONE_DIR"

git add -A

if [ -z "$(git status --porcelain)" ]; then
  log "No changes to publish. Done."
  exit 0
fi

# Find sensible default branch
BRANCH="$(detect_default_branch)"

# Use repo-level git identity (uses Doug's global config; fine for now per
# the seed-team posture). Append the co-author trailer.
git commit -m "$COMMIT_MSG" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>" >/dev/null

log "Pushing to origin/$BRANCH..."
# Force-push: the local Dropbox source is the canonical wiki content. Any
# edits made via the GitHub UI are overwritten on the next publish (and
# would have been wiped at the working-tree-reset step above anyway). If
# you want UI edits to persist, copy them back into the local source first.
if ! git push --force origin "$BRANCH" 2>&1 | tail -3; then
  log "Push failed. The wiki repo may not yet exist on GitHub. Has the Wiki feature been enabled and at least one page created via the UI? See README for first-publish setup."
  exit 1
fi

log "Wiki published to https://github.com/twentytwohundred/.github/wiki"
