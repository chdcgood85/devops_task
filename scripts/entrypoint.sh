#!/usr/bin/env bash
# Container start-up: apply migrations, then hand off to Gunicorn.
# Kept separate from the DB-readiness wait so it works both under docker-compose
# (which waits first) and on Cloud Run (where the database is already up).
set -euo pipefail

cd /app/backend

echo "Applying database migrations..."
python manage.py migrate --noinput

echo "Starting Gunicorn..."
# Honour $PORT when the platform injects one (e.g. Cloud Run), default to 5000.
exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT:-5000}" \
  --workers "${WEB_CONCURRENCY:-2}" \
  --access-logfile -
