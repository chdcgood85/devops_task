#!/usr/bin/env bash
# Wait for Postgres, then run the Django test suite (used by the CI test job).
# pytest-django creates a throwaway test database on the configured connection.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"

echo "Waiting for PostgreSQL..."
python - <<'PY'
import os
import sys
import time

import psycopg2

# psycopg2 wants a plain libpq URL, not the SQLAlchemy '+psycopg2' form.
dsn = os.environ["DATABASE_URL"].replace("+psycopg2", "")

for attempt in range(1, 31):
    try:
        psycopg2.connect(dsn).close()
        break
    except psycopg2.OperationalError:
        print(f"  attempt {attempt}/30: not ready")
        time.sleep(2)
else:
    sys.exit("database did not become ready in time")
PY

pytest
