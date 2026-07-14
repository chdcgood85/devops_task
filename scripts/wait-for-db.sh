#!/usr/bin/env bash
# Wait until Postgres accepts connections, then optionally exec a command.
# Usage: wait-for-db.sh [host] [port] [command args...]
set -euo pipefail

host="${1:-${POSTGRES_HOST:-db}}"
port="${2:-${POSTGRES_PORT:-5432}}"
[ "$#" -ge 2 ] && shift 2 || shift "$#"

user="${POSTGRES_USER:-postgres}"
max_attempts="${DB_WAIT_MAX_ATTEMPTS:-30}"
attempt=1

echo "Waiting for PostgreSQL at ${host}:${port}..."
until pg_isready --host="$host" --port="$port" --username="$user" >/dev/null 2>&1; do
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "PostgreSQL not ready after ${max_attempts} attempts." >&2
    exit 1
  fi
  echo "  attempt ${attempt}/${max_attempts}: retrying in 2s"
  attempt=$((attempt + 1))
  sleep 2
done

echo "PostgreSQL is ready."

if [ "$#" -gt 0 ]; then
  exec "$@"
fi
