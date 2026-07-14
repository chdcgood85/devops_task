#!/usr/bin/env bash
# Install, build, and test the React frontend (used by the CI frontend job).
# The build proves the assets compile; Vitest emits JUnit XML for CircleCI.
set -euo pipefail

cd frontend

# npm ci installs exactly what's in the lockfile — reproducible and fast.
npm ci

# Fail early if the production bundle doesn't compile.
npm run build

# Vitest always writes JUnit XML to frontend/test-results/ (see vite.config.js);
# CircleCI collects it via store_test_results.
npm test
