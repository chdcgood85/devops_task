# Reference Pipeline: A Tested Full-Stack Image, Published on Merge

*A CircleCI reference implementation for a containerized web application — a
Django REST API and a React single-page app — with a database, built for teams
who want a clear, safe, and efficient path from commit to a deployed artifact.*

---

## 1. What this pipeline does

This repository contains a small **Task Manager** application that exists purely
to anchor a **production-shaped CI/CD pipeline**:

- **Backend** — a **Django 5 + Django REST Framework** JSON API (Python),
  backed by **PostgreSQL**.
- **Frontend** — a **React (Vite)** single-page app that consumes the API.

On every push, CircleCI:

1. **Builds** the backend (dependency install + Django system checks) and the
   frontend (Vite production build) in parallel.
2. **Tests** the backend against a real **PostgreSQL sidecar** (pytest) and the
   frontend in `jsdom` (Vitest) — both emitting **JUnit** results CircleCI collects.
3. **Builds one multi-stage Docker image** that compiles the React app and bakes
   it into the Django/Gunicorn runtime, then runs **container-structure tests**
   (`goss`) on it.
4. On the **default branch only**, **publishes** that exact image to
   **Google Artifact Registry** (keyless, via **OIDC**), then **deploys** it to
   **Google Cloud Run** (also via OIDC).

The application (Python + JavaScript) and the pipeline's shell scripts together
satisfy the "scripting + non-scripting language" requirement: the app is the
non-scripting language under test, and `ci/scripts/*.sh` plus
`scripts/wait-for-db.sh` / `scripts/entrypoint.sh` are the shell layer.

## 2. Overall architecture

```
 push / PR
    │
    ├───────────────┐
    ▼               ▼
┌──────────────┐  ┌───────────────┐
│ backend-build│  │ frontend-build│   (run in parallel)
└──────┬───────┘  └───────┬───────┘
       ▼                  │
┌──────────────┐          │
│ backend-test │          │   pytest vs. postgres:16 sidecar (JUnit)
└──────┬───────┘          │   Vite build + Vitest (JUnit)
       └────────┬─────────┘
                ▼
        ┌───────────────┐
        │  build-image  │   multi-stage docker build + goss (+ docs-only halt)
        └───────┬───────┘
                │  (main only, restricted gcp-oidc context)
                ▼
        ┌───────────────┐
        │  publish-gcp  │   push image → Artifact Registry (keyless, OIDC)
        └───────┬───────┘
                ▼
           ┌────────┐
           │ deploy │   Cloud Run (OIDC, main only)
           └────────┘
```

- **`backend-build`** (`cimg/python:3.12`) — installs dependencies (cached on
  `backend/requirements.txt` checksum) and runs `manage.py check` plus a
  `makemigrations --check` gate so a model change without a migration fails fast.
- **`frontend-build`** (`cimg/node:20.18`) — `npm ci` (cached on the lockfile),
  a Vite **production build** (fails the pipeline if the bundle doesn't compile),
  and **Vitest** component tests emitting JUnit XML.
- **`backend-test`** (`cimg/python:3.12` **+ `postgres:16-alpine` sidecar**) —
  `ci/scripts/run-tests.sh` waits for the database, then runs the pytest-django
  suite (30 tests exercising the full HTTP → ORM → PostgreSQL path). Results are
  **JUnit XML** collected with `store_test_results`; `coverage.xml` is an artifact.
- **`build-image`** (`machine` executor) — `should-build.sh` gates the job (§4),
  then builds the **multi-stage image** (React build stage → Python runtime with
  the compiled SPA baked in) and runs **`goss`/`dgoss` structure tests**
  (`ci/goss.yaml`): the Django project and compiled SPA are present, Python is
  3.12, Django/DRF import, and the container runs as a **non-root** user. The
  tested image is saved to the **workspace**.
- **`publish-gcp`** (`machine`, **`main` only**) — loads the exact tested image
  from the workspace and pushes it to **Google Artifact Registry** using **OIDC**
  (no stored key). This is the published artifact.
- **`deploy`** (**`main` only**) — deploys the published image to **Cloud Run**
  using the same keyless OIDC flow.

## 3. How the components map together

| Requirement | Where it lives |
| --- | --- |
| Custom image built in-pipeline | `build-image` job → `ci/scripts/build-image.sh` + multi-stage `Dockerfile` (non-root) |
| Testing collected by CircleCI | `backend-test` → `pytest` (JUnit); `frontend-build` → `vitest` (JUnit); both `store_test_results` |
| Database as a sidecar container | `backend-test` job's secondary container `postgres:16-alpine` |
| Conditional work | `should-build.sh` halt + `requires` DAG + `branches: only: main` filters |
| Shell + non-scripting language | `ci/scripts/*.sh`, `scripts/*.sh` (shell) + Django/Python + React/JS |
| Publish artifact to PaaS/IaaS, main only | `publish-gcp` → GAR (**OIDC**), `deploy` → Cloud Run, both `main`-only |
| Credentials only in approved builds | Restricted **contexts** attached only to `main`-filtered jobs; the OIDC jobs store **no** key |
| OIDC | `publish-gcp` + `deploy` use **Workload Identity Federation** — short-lived tokens exchanged at runtime |

The image built and structure-tested in `build-image` is the **same bytes**
published and deployed (passed via the CircleCI **workspace** as a gzipped
`docker save` tarball) — we never rebuild an unverified image for release.

## 4. Unique value & CircleCI optimizations

**Parallel build/test fan-out.** `backend-build` and `frontend-build` have no
dependency on each other, so CircleCI runs them concurrently; `build-image`
fans back in via `requires: [backend-test, frontend-build]`. Wall-clock time is
the slower of the two branches, not their sum.

**Three independent layers of conditional work** keep the pipeline lean and safe:

1. **File-based early halt.** On non-default branches, `should-build.sh` inspects
   the diff against `main`; a documentation-only change (`*.md` / `docs/`) calls
   `circleci-agent step halt`, skipping the expensive image build + structure tests.
2. **Branch-gated release.** `publish`, `publish-gcp`, and `deploy` carry
   `filters: { branches: { only: main } }`, so artifacts ship *only* on merge to
   the default branch.
3. **`requires` DAG chaining.** Each job runs only on its upstream's success, so a
   failed test never produces a published image.

**Credential isolation via a context.** Cloud access lives in a restricted
CircleCI **context** (`gcp-oidc`) attached *only* to the `main`-filtered jobs. A
fork PR or feature-branch build physically never has these secrets in its
environment — satisfying "credentials may not be accessible outside of approved
builds." And because publish/deploy use OIDC, the context holds only non-secret
config (project, provider, service-account) — **no long-lived key at all**.

**Keyless publish & deploy with OIDC.** CircleCI mints a short-lived per-build
OIDC token (`$CIRCLE_OIDC_TOKEN`); Google STS exchanges it via **Workload
Identity Federation** for a federated token that impersonates a service account
to push to Artifact Registry and deploy to Cloud Run. **No long-lived cloud key
is stored** anywhere in CircleCI.

**Build-once, verify, then release.** The image is built and `goss`-tested once,
then carried to publish/deploy through the workspace — release ships exactly what
was tested, with no drift and no wasted second build.

**Right executor for the job.** Lightweight `docker` executors (with a Postgres
service container) run the fast build/test jobs; the heavier `machine` executor
is used only where a real Docker build + `dgoss` are needed.

## 5. Future optimizations & trade-offs

- **Multi-arch / multi-region publish.** Add `linux/arm64` via `docker buildx`
  and mirror the image to a second Artifact Registry region for locality and
  redundancy — the single OIDC publish already generalises to both.
- **Image supply-chain hardening.** Add `docker scout`/Trivy scanning and Cosign
  signing + SBOM generation in `build-image` before publish.
- **Test depth & speed.** Add `mypy`/ESLint gates and split suites for
  **parallelism** (`parallelism:` + test splitting) as they grow; add a smoke
  test that boots the published image against an ephemeral DB.
- **Deploy safety.** The Cloud Run deploy is a straight roll-forward; a
  production setup would add a post-deploy health gate, automated rollback, and a
  manual `approval` job for promotion.
- **Migrations at boot.** `entrypoint.sh` runs `migrate` on start — simple and
  correct for one instance, but with many concurrent instances a dedicated
  one-shot migration step (or job) avoids racing migrations.
- **Cache trade-off accepted.** Dependency installs are cached per lockfile but
  re-run per job; acceptable at this size, revisit with a shared base image if
  build minutes matter.

---

### Appendix A — Rubric coverage

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Public VCS repo connected to CircleCI | ✅ | See repo + build links at top of submission |
| 2 | Custom Docker image generated in pipeline | ✅ | `build-image` job, multi-stage `Dockerfile` |
| 3 | Testing collected by CircleCI | ✅ | `pytest` + `vitest` JUnit → `store_test_results` |
| 4 | Database (postgres) as sidecar/secondary container | ✅ | `backend-test` job `postgres:16-alpine` |
| 5 | Conditional work to limit unnecessary work | ✅ | `should-build.sh` halt + `requires` + branch filters |
| 6 | Shell + non-scripting language | ✅ | `ci/scripts/*.sh` + Python (Django) + JS (React) |
| 7 | Publish artifact to PaaS/FaaS/IaaS, default branch only | ✅ | GAR publish + Cloud Run deploy, `only: main` |
| 8 | Credentials inaccessible outside approved builds | ✅ | Restricted contexts on `main`-only jobs |
| 9 | Ideally uses OIDC | ✅ | `publish-gcp` + `deploy` via Workload Identity Federation (no stored key) |

### Appendix B — Local verification performed

Before this pipeline was committed, every stage was reproduced locally:

- Backend: `manage.py check` + `makemigrations --check` → **clean**;
  pytest suite → **30 passed**, JUnit + coverage emitted.
- Frontend: `vite build` → **success**; Vitest → **21 passed**, JUnit emitted.
- `docker build` of the multi-stage image → **success**; the SPA is served at
  `/`, its hashed assets via WhiteNoise, and `/api/*` returns JSON.
- `goss` against the image → non-root user, Python 3.12, Django/DRF import,
  compiled SPA + Django project present.
