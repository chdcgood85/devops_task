#!/usr/bin/env bash
# Push the image to Google Artifact Registry using OIDC (Workload Identity
# Federation). No long-lived key is stored.
set -euo pipefail

if [ "${CIRCLE_BRANCH:-}" != "main" ]; then
  echo "Not on main; skipping publish."
  exit 0
fi

: "${WIF_PROVIDER:?WIF_PROVIDER must be set}"
: "${GCP_SA_EMAIL:?GCP_SA_EMAIL must be set}"
: "${GCP_PROJECT_ID:?GCP_PROJECT_ID must be set}"
: "${GCP_REGION:?GCP_REGION must be set}"
: "${GAR_REPO:?GAR_REPO must be set}"
: "${CIRCLE_OIDC_TOKEN:?CIRCLE_OIDC_TOKEN not available}"

IMAGE="${IMAGE_NAME:-task-api}"
TAG="${CIRCLE_SHA1:-local}"
WORKSPACE="${WORKSPACE_DIR:-/tmp/workspace}"

echo "Exchanging OIDC token for a Google federated token..."
federated_token="$(curl -sf -X POST "https://sts.googleapis.com/v1/token" \
  -H "Content-Type: application/json" \
  -d "{
    \"grantType\": \"urn:ietf:params:oauth:grant-type:token-exchange\",
    \"audience\": \"//iam.googleapis.com/${WIF_PROVIDER}\",
    \"scope\": \"https://www.googleapis.com/auth/cloud-platform\",
    \"requestedTokenType\": \"urn:ietf:params:oauth:token-type:access_token\",
    \"subjectToken\": \"${CIRCLE_OIDC_TOKEN}\",
    \"subjectTokenType\": \"urn:ietf:params:oauth:token-type:jwt\"
  }" | jq -r '.access_token')"

if [ -z "$federated_token" ] || [ "$federated_token" = "null" ]; then
  echo "Token exchange failed (check WIF_PROVIDER, issuer, audience)." >&2
  exit 1
fi

echo "Impersonating ${GCP_SA_EMAIL}..."
access_token="$(curl -sf -X POST \
  "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${GCP_SA_EMAIL}:generateAccessToken" \
  -H "Authorization: Bearer ${federated_token}" \
  -H "Content-Type: application/json" \
  -d '{"scope":["https://www.googleapis.com/auth/cloud-platform"]}' | jq -r '.accessToken')"

if [ -z "$access_token" ] || [ "$access_token" = "null" ]; then
  echo "Service account impersonation failed (check the pool to SA binding)." >&2
  exit 1
fi

registry="${GCP_REGION}-docker.pkg.dev"
remote="${registry}/${GCP_PROJECT_ID}/${GAR_REPO}/${IMAGE}"

echo "Pushing ${remote}..."
echo "$access_token" | docker login -u oauth2accesstoken --password-stdin "$registry"
gunzip -c "${WORKSPACE}/image.tar.gz" | docker load
docker tag "${IMAGE}:${TAG}" "${remote}:${TAG}"
docker tag "${IMAGE}:${TAG}" "${remote}:latest"
docker push "${remote}:${TAG}"
docker push "${remote}:latest"
docker logout "$registry" || true
