#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"

chmod +x "$REPO_ROOT/.githooks/secret-guard" \
  "$REPO_ROOT/.githooks/pre-commit" \
  "$REPO_ROOT/.githooks/pre-push"

git -C "$REPO_ROOT" config core.hooksPath .githooks

cat <<'EOF'
Git hooks enabled for this repository.

Protected:
- pre-commit: blocks sensitive files and common secret formats
- pre-push: blocks pushing old branches that reintroduce sensitive history
EOF
