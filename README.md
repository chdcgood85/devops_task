# Task Manager

A small, production-style **full-stack** app — a **Django REST Framework** API
and a **React (Vite)** single-page frontend — built to demonstrate **CI/CD best
practices** (containerization, a database sidecar, machine-readable test reports,
and a keyless OIDC publish/deploy) rather than feature breadth.

Stack: **Python 3.12 · Django 5 · Django REST Framework · React 18 · Vite ·
PostgreSQL · Gunicorn · WhiteNoise · Docker · Pytest · Vitest**

---

## Overview

The backend exposes JSON endpoints under `/api/`, backed by PostgreSQL. The React
frontend is compiled to static assets and **served by the same container** (via
WhiteNoise), so a single image runs the whole app. Configuration comes from
environment variables, and both test suites emit JUnit XML so a CI system (e.g.
CircleCI) can collect results without extra glue.

> **CI/CD:** A full CircleCI pipeline lives in [.circleci/config.yml](.circleci/config.yml)
> — parallel backend/frontend build → test (Postgres sidecar + JUnit, Vitest +
> JUnit) → multi-stage Docker image + `goss` structure tests → publish to
> Google Artifact Registry and deploy to Cloud Run (default branch only, via
> **OIDC**). See [WRITEUP.md](WRITEUP.md) for the architecture and
> [docs/GCP_OIDC_SETUP.md](docs/GCP_OIDC_SETUP.md) for the one-time console setup.

## Features

- **Backend:** Django REST Framework CRUD API for tasks (`id`, `title`,
  `description`, `status` = `todo`/`in_progress`/`done`, `due_date`,
  `created_at`, `updated_at`), with validation, correct HTTP status codes, and a
  DB-backed health endpoint.
- **Frontend:** React + Vite single-page app to add tasks (with description and
  due date), move them across statuses, filter by status, and delete them.
- Environment-variable-driven configuration (12-factor friendly).
- Integration tests against a real PostgreSQL instance (pytest-django) and
  component tests in `jsdom` (Vitest) — both producing JUnit + coverage reports.
- Multi-stage Docker build: compiles the SPA, bakes it into a non-root
  Django/Gunicorn runtime, and serves static assets with WhiteNoise.
- `docker-compose` stack with a Postgres service and a DB-readiness gate.

## API

All endpoints are under `/api`.

| Method   | Path              | Description         | Success |
| -------- | ----------------- | ------------------- | ------- |
| `GET`    | `/api/health`     | Service + DB health | `200`   |
| `GET`    | `/api/version`    | API name + version  | `200`   |
| `GET`    | `/api/tasks`      | List all tasks      | `200`   |
| `GET`    | `/api/tasks/<id>` | Fetch one task      | `200`   |
| `POST`   | `/api/tasks`      | Create a task       | `201`   |
| `PUT`    | `/api/tasks/<id>` | Replace a task      | `200`   |
| `PATCH`  | `/api/tasks/<id>` | Update some fields  | `200`   |
| `DELETE` | `/api/tasks/<id>` | Delete a task       | `204`   |

Validation failures return `400` with per-field errors; missing resources
return `404`. Everything else (`/`, client-side routes) serves the React app.

## Project structure

```
.
├── backend/                  # Django + DRF API
│   ├── manage.py
│   ├── config/               # project: settings, urls, wsgi
│   ├── tasks/                # app: models, serializers, views, urls, migrations
│   ├── tests/                # pytest-django integration tests
│   └── requirements.txt
├── frontend/                 # React + Vite single-page app
│   ├── src/                  # App.jsx, api.js, App.test.jsx (Vitest)
│   ├── package.json
│   └── vite.config.js
├── ci/
│   ├── goss.yaml             # container-structure tests
│   └── scripts/*.sh          # build / test / publish / deploy steps
├── scripts/
│   ├── wait-for-db.sh        # blocks until Postgres is ready
│   └── entrypoint.sh         # migrate, then launch Gunicorn
├── Dockerfile                # multi-stage: node build → python runtime
├── docker-compose.yml
├── pytest.ini
└── .circleci/config.yml
```

## Running with Docker (recommended)

The compose stack starts PostgreSQL and the app, waits for the database, runs
migrations, and serves the built SPA + API from one container.

```bash
docker compose up --build
```

Then open <http://localhost:5000> for the UI; the API is under
<http://localhost:5000/api>.

```bash
docker compose down          # stop
docker compose down -v       # stop and remove the database volume
```

## Local development (without Docker)

Requires Python 3.12, Node 20, and a reachable PostgreSQL instance.

**Backend** (terminal 1):

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt

cp .env.example .env               # edit as needed
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tasks
python backend/manage.py migrate
python backend/manage.py runserver 0.0.0.0:5000
```

**Frontend** (terminal 2) — Vite dev server proxies `/api` to Django on :5000:

```bash
cd frontend
npm install
npm run dev                        # http://localhost:5173
```

## Running tests

**Backend** — integration tests need PostgreSQL; pytest-django creates a
throwaway test database on the connection you point it at:

```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tasks
pytest
```

Produces `test-results/junit.xml` (CircleCI `store_test_results`) and
`coverage.xml`.

**Frontend** — component tests run in `jsdom`, no services required:

```bash
cd frontend
npm test                           # add CI=1 to also emit test-results/junit.xml
```

## Environment variables

| Variable               | Default              | Description                                             |
| ---------------------- | -------------------- | ------------------------------------------------------- |
| `DATABASE_URL`         | *(assembled)*        | Full DB URL; overrides the `POSTGRES_*` set             |
| `POSTGRES_USER`        | `postgres`           | Database user (used if `DATABASE_URL` is unset)         |
| `POSTGRES_PASSWORD`    | `postgres`           | Database password                                       |
| `POSTGRES_DB`          | `tasks`              | Database name                                           |
| `POSTGRES_HOST`        | `localhost`          | Database host                                           |
| `POSTGRES_PORT`        | `5432`               | Database port                                           |
| `DJANGO_SECRET_KEY`    | *(insecure default)* | **Set a real value** outside local dev                  |
| `DJANGO_DEBUG`         | `False`              | Enable Django debug mode                                |
| `DJANGO_ALLOWED_HOSTS` | `*`                  | Comma-separated allowed hostnames                       |
| `PORT`                 | `5000`               | Port Gunicorn binds (Cloud Run injects this)            |

## License

Provided as-is for demonstration purposes.
