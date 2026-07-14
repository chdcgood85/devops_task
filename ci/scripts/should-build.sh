#!/usr/bin/env bash
# Skip the image build for docs-only changes on non-main branches.
set -euo pipefail

branch="${CIRCLE_BRANCH:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)}"

if [ "$branch" = "main" ]; then
  echo "On main; building."
  exit 0
fi

git fetch --quiet origin main 2>/dev/null || true
base="$(git merge-base origin/main HEAD 2>/dev/null || echo "")"
if [ -n "$base" ]; then
  changed="$(git diff --name-only "$base" HEAD)"
else
  changed="$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "")"
fi

echo "Changed files:"
echo "${changed:-<none>}" | sed 's/^/  /'

# Build unless every changed file is a doc.
if echo "$changed" | grep -qvE '^(docs/.*|.*\.md)$'; then
  echo "Code changes detected; building."
  exit 0
fi

echo "Docs-only change; skipping build."
if command -v circleci-agent >/dev/null 2>&1; then
  circleci-agent step halt
fi
