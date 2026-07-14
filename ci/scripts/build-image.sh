#!/usr/bin/env bash
# Build the image and save it to the workspace for the publish jobs.
set -euo pipefail

IMAGE="${IMAGE_NAME:-task-api}"
TAG="${CIRCLE_SHA1:-local}"
WORKSPACE="${WORKSPACE_DIR:-/tmp/workspace}"

docker build -t "${IMAGE}:${TAG}" -t "${IMAGE}:latest" .

mkdir -p "$WORKSPACE"
docker save "${IMAGE}:${TAG}" "${IMAGE}:latest" | gzip > "${WORKSPACE}/image.tar.gz"
