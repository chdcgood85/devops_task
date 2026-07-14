# syntax=docker/dockerfile:1

# --- Stage 1: build the React single-page app -------------------------------
FROM node:20-slim AS frontend
WORKDIR /frontend
# Install against the lockfile first so this layer caches until deps change.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build        # emits /frontend/dist


# --- Stage 2: install Python dependencies -----------------------------------
FROM python:3.12-slim AS builder
ENV PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1
WORKDIR /build
COPY backend/requirements.txt .
RUN pip install --prefix=/install --no-warn-script-location -r requirements.txt


# --- Stage 3: runtime -------------------------------------------------------
FROM python:3.12-slim AS runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DJANGO_SETTINGS_MODULE=config.settings \
    FRONTEND_DIST_DIR=/app/frontend_dist \
    PYTHONPATH=/app/backend

# pg_isready for scripts/wait-for-db.sh
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system app && useradd --system --gid app --create-home app

WORKDIR /app
COPY --from=builder /install /usr/local
COPY backend/ ./backend/
COPY scripts/ ./scripts/
COPY --from=frontend /frontend/dist ./frontend_dist
# Explicit mode so it isn't affected by the build host's umask.
RUN chmod 0755 scripts/*.sh

# Gather the compiled SPA + Django assets into STATIC_ROOT at build time so the
# image is immutable and does no static work at startup. The throwaway secret
# is fine here — collectstatic never touches the database.
RUN DJANGO_SECRET_KEY=build-only python backend/manage.py collectstatic --noinput

RUN chown -R app:app /app
USER app
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:5000/api/health', timeout=4).status == 200 else 1)"

# migrate, then launch Gunicorn (see scripts/entrypoint.sh).
CMD ["/app/scripts/entrypoint.sh"]
