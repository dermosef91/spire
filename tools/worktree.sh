#!/usr/bin/env bash
# Per-session git worktrees, so parallel Claude sessions never share a
# working tree (shared checkouts = one session's git reset/stash/checkout
# clobbers the other's staged work).
#
#   tools/worktree.sh new <topic>    create ../spire-wt-<topic> on branch claude/<topic> (off origin/main)
#   tools/worktree.sh done <topic>   remove the worktree; delete the branch if it's merged
#   tools/worktree.sh list           show all worktrees + their branches
#
# Open each Claude session on its own worktree folder. The script symlinks the
# primary checkout's node_modules into the worktree (playwright for
# `npm run smoke` / `npm run qa`; the game itself is dependency-free) and
# prints a stable per-topic PORT so two sessions can run `npm start` at once.
set -euo pipefail

cmd="${1:-list}"
topic="${2:-}"

primary="$(cd "$(dirname "$0")/.." && git rev-parse --path-format=absolute --git-common-dir)"
primary="$(dirname "$primary")"          # repo root of the primary checkout
parent="$(dirname "$primary")"

slug() { printf '%s' "$1" | tr 'A-Z' 'a-z' | tr -cs 'a-z0-9' '-' | sed -e 's/^-*//' -e 's/-*$//'; }

case "$cmd" in
  new)
    [ -n "$topic" ] || { echo "usage: tools/worktree.sh new <topic>"; exit 1; }
    t="$(slug "$topic")"
    dir="$parent/spire-wt-$t"
    branch="claude/$t"
    [ -e "$dir" ] && { echo "already exists: $dir"; exit 1; }
    git -C "$primary" fetch origin main -q
    git -C "$primary" worktree add -b "$branch" "$dir" origin/main
    # Share the primary checkout's node_modules (untracked, so worktrees don't
    # get one). Needed for smoke/qa's ambient playwright; harmless otherwise.
    [ -d "$primary/node_modules" ] && ln -s "$primary/node_modules" "$dir/node_modules"
    # Stable per-topic dev-server port (8100-8199), away from 8080/8091.
    port=$((8100 + $(printf '%s' "$t" | cksum | cut -d' ' -f1) % 100))
    echo ""
    echo "worktree : $dir"
    echo "branch   : $branch (from origin/main)"
    echo "dev port : PORT=$port npm start   →  http://localhost:$port"
    echo "qa port  : QA_PORT=$((port + 100)) npm run qa"
    echo ""
    echo "Open this folder in a new Claude session. When the branch is merged:"
    echo "  tools/worktree.sh done $t"
    ;;
  done)
    [ -n "$topic" ] || { echo "usage: tools/worktree.sh done <topic>"; exit 1; }
    t="$(slug "$topic")"
    dir="$parent/spire-wt-$t"
    branch="claude/$t"
    # Drop the node_modules symlink we planted — git counts it as an
    # untracked file and refuses to remove the worktree otherwise.
    [ -L "$dir/node_modules" ] && rm "$dir/node_modules"
    git -C "$primary" worktree remove "$dir" || {
      echo "worktree has uncommitted changes; commit/stash them there, or:"
      echo "  git -C $primary worktree remove --force $dir"; exit 1; }
    # -d only deletes if merged; unmerged branches survive on purpose.
    git -C "$primary" branch -d "$branch" 2>/dev/null \
      && echo "removed $dir and merged branch $branch" \
      || echo "removed $dir (branch $branch kept — not merged yet)"
    ;;
  list)
    git -C "$primary" worktree list
    ;;
  *)
    echo "usage: tools/worktree.sh {new|done|list} [topic]"; exit 1;;
esac
