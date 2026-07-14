# GCP Workload Identity Federation (OIDC) Setup

This wires CircleCI to **Google Artifact Registry** using **OIDC / Workload
Identity Federation** — so the `publish-gcp` job authenticates with a
**short-lived token exchanged at runtime**, and **no long-lived key is ever
stored** in CircleCI.

You'll run the commands in **Google Cloud Shell** (in-browser, nothing to
install). Estimated time: ~15 minutes.

---

## Prerequisites

1. A Google Cloud account with a project (the free trial is fine).
   - Create a project: <https://console.cloud.google.com/projectcreate>
2. Your **CircleCI Organization ID** (a UUID):
   - CircleCI → **Organization Settings** → **Overview** → copy **Organization ID**.

---

## Step 1 — Open Cloud Shell and set your values

Go to <https://console.cloud.google.com/> and click the **Cloud Shell** icon
(`>_`, top-right). Then paste this, **editing the first six values**:

```bash
export PROJECT_ID="YOUR_PROJECT_ID"          # e.g. task-api-oidc-123456
export REGION="us-central1"                   # Artifact Registry region
export REPO="task-api"                        # Artifact Registry repo name
export POOL="circleci-pool"
export PROVIDER="circleci-provider"
export SA_NAME="circleci-publisher"
export CIRCLE_ORG_ID="YOUR_CIRCLECI_ORG_ID"   # UUID from CircleCI Org Settings

gcloud config set project "$PROJECT_ID"
export PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
export SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
echo "Project number: $PROJECT_NUMBER"
```

## Step 2 — Enable the required APIs

```bash
gcloud services enable \
  artifactregistry.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com
```

## Step 3 — Create the Artifact Registry repository

```bash
gcloud artifacts repositories create "$REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --description="Task API images (pushed from CircleCI via OIDC)"
```

## Step 4 — Create the service account and grant push access

```bash
gcloud iam service-accounts create "$SA_NAME" \
  --display-name="CircleCI publisher"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/artifactregistry.writer"
```

## Step 5 — Create the Workload Identity Pool + OIDC provider

This is the trust anchor: it tells Google to trust identity tokens issued by
**your** CircleCI organization.

```bash
gcloud iam workload-identity-pools create "$POOL" \
  --location="global" \
  --display-name="CircleCI Pool"

gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
  --location="global" \
  --workload-identity-pool="$POOL" \
  --display-name="CircleCI Provider" \
  --issuer-uri="https://oidc.circleci.com/org/${CIRCLE_ORG_ID}" \
  --allowed-audiences="${CIRCLE_ORG_ID}" \
  --attribute-mapping="google.subject=assertion.sub"
```

> `issuer-uri` and `allowed-audiences` must match the claims in CircleCI's OIDC
> token (`iss` and `aud`). Both are derived from your org ID.

## Step 6 — Let the pool impersonate the service account

```bash
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/*"
```

> This grants *only* identities from your CircleCI pool the ability to
> impersonate the publisher service account — nothing else can.

## Step 7 — Print the values for the CircleCI context

```bash
echo "----- paste these into the CircleCI 'gcp-oidc' context -----"
echo "WIF_PROVIDER=projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"
echo "GCP_SA_EMAIL=${SA_EMAIL}"
echo "GCP_PROJECT_ID=${PROJECT_ID}"
echo "GCP_REGION=${REGION}"
echo "GAR_REPO=${REPO}"
```

---

## Step 8 — Create the CircleCI context (NO secrets — this is the point)

1. CircleCI → **Organization Settings** → **Contexts** → **Create Context**
2. Name it exactly **`gcp-oidc`**
3. Add these 5 environment variables from Step 7's output:

   | Name | Example value |
   | --- | --- |
   | `WIF_PROVIDER` | `projects/123456789/locations/global/workloadIdentityPools/circleci-pool/providers/circleci-provider` |
   | `GCP_SA_EMAIL` | `circleci-publisher@your-project.iam.gserviceaccount.com` |
   | `GCP_PROJECT_ID` | `your-project-id` |
   | `GCP_REGION` | `us-central1` |
   | `GAR_REPO` | `task-api` |

> None of these are secrets — that is the whole benefit of OIDC. There is no
> access key to leak or rotate.

4. (Recommended) **Restrict** the context to approved users/groups.

---

## Step 9 — Run it

Push to `main` (or trigger the pipeline). The `publish-gcp` job will:
1. Receive a CircleCI OIDC token (`$CIRCLE_OIDC_TOKEN`)
2. Exchange it at Google STS for a federated token
3. Impersonate the service account for an access token
4. `docker push` the image to Artifact Registry

Verify the image landed:

```bash
gcloud artifacts docker images list "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}"
```

---

## Cleanup (avoid any charges after the demo)

```bash
gcloud artifacts repositories delete "$REPO" --location="$REGION" --quiet
```

Or delete the whole project: <https://console.cloud.google.com/iam-admin/settings>.

---

## Troubleshooting

- **`token exchange failed`** — `WIF_PROVIDER` wrong, or the provider's
  `issuer-uri`/`allowed-audiences` don't match your CircleCI org ID.
- **`impersonation failed` / permission denied** — the Step 6 binding is
  missing or the `principalSet` project number is wrong.
- **`denied` on docker push** — the service account is missing
  `roles/artifactregistry.writer`, or `GCP_REGION`/`GAR_REPO` don't match the
  repo you created.
- **`CIRCLE_OIDC_TOKEN not available`** — the job isn't attached to a context;
  confirm `context: gcp-oidc` is present on the `publish-gcp` job.
