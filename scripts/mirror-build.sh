#!/usr/bin/env bash
# This worktree already lives on an ASCII path (C:\Users\Public\plant-life),
# so no mirroring is needed: just build in the repo root.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
