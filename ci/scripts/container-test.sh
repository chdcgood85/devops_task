#!/usr/bin/env bash
# Run goss container-structure tests against the built image.
set -euo pipefail

IMAGE="${IMAGE_NAME:-task-api}"
TAG="${CIRCLE_SHA1:-local}"
GOSS_VERSION="${GOSS_VERSION:-v0.4.9}"

BIN_DIR="$(mktemp -d)"
curl -fsSL "https://github.com/goss-org/goss/releases/download/${GOSS_VERSION}/goss-linux-amd64" -o "${BIN_DIR}/goss"
curl -fsSL "https://raw.githubusercontent.com/goss-org/goss/${GOSS_VERSION}/extras/dgoss/dgoss" -o "${BIN_DIR}/dgoss"
chmod +x "${BIN_DIR}/goss" "${BIN_DIR}/dgoss"

export PATH="${BIN_DIR}:${PATH}"
export GOSS_PATH="${BIN_DIR}/goss"
export GOSS_FILES_PATH="$(pwd)/ci"
export GOSS_SLEEP="${GOSS_SLEEP:-2}"

# Override CMD with sleep so the container stays up (no DB) while goss runs.
dgoss run "${IMAGE}:${TAG}" sleep 60
