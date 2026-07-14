#!/usr/bin/env bash
# Deploy the published image to Cloud Run using OIDC (same keyless flow as
# publish-gcp.sh).
set -euo pipefail

if [ "${CIRCLE_BRANCH:-}" != "main" ]; then
  echo "Not on main; skipping deploy."
  exit 0
fi

: "${WIF_PROVIDER:?WIF_PROVIDER must be set}"
: "${GCP_SA_EMAIL:?GCP_SA_EMAIL must be set}"
: "${GCP_PROJECT_ID:?GCP_PROJECT_ID must be set}"
: "${GCP_REGION:?GCP_REGION must be set}"
: "${GAR_REPO:?GAR_REPO must be set}"
: "${CLOUD_RUN_SERVICE:?CLOUD_RUN_SERVICE must be set}"
: "${CIRCLE_OIDC_TOKEN:?CIRCLE_OIDC_TOKEN not available}"

IMAGE="${IMAGE_NAME:-task-api}"
TAG="${CIRCLE_SHA1:-latest}"
img="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${GAR_REPO}/${IMAGE}:${TAG}"

echo "Exchanging OIDC token for a Google federated token..."
federated_token="$(curl -sf -X POST 'https://sts.googleapis.com/v1/token' \
  -H 'Content-Type: application/json' \
  -d "{\"grantType\":\"urn:ietf:params:oauth:grant-type:token-exchange\",\"audience\":\"//iam.googleapis.com/${WIF_PROVIDER}\",\"scope\":\"https://www.googleapis.com/auth/cloud-platform\",\"requestedTokenType\":\"urn:ietf:params:oauth:token-type:access_token\",\"subjectToken\":\"${CIRCLE_OIDC_TOKEN}\",\"subjectTokenType\":\"urn:ietf:params:oauth:token-type:jwt\"}" \
  | python3 -c 'import sys, json; print(json.load(sys.stdin)["access_token"])')"

echo "Impersonating ${GCP_SA_EMAIL}..."
access_token="$(curl -sf -X POST \
  "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${GCP_SA_EMAIL}:generateAccessToken" \
  -H "Authorization: Bearer ${federated_token}" \
  -H 'Content-Type: application/json' \
  -d '{"scope":["https://www.googleapis.com/auth/cloud-platform"]}' \
  | python3 -c 'import sys, json; print(json.load(sys.stdin)["accessToken"])')"

echo "Deploying ${img} to Cloud Run service ${CLOUD_RUN_SERVICE}..."
export CLOUDSDK_AUTH_ACCESS_TOKEN="$access_token"
# --image only: keeps the service's existing env vars (DATABASE_URL) and config.
gcloud run deploy "$CLOUD_RUN_SERVICE" \
  --image="$img" \
  --project="$GCP_PROJECT_ID" \
  --region="$GCP_REGION" \
  --platform=managed \
  --quiet
