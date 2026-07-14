"""Django settings for the Task Management service.

Everything that changes between environments is read from environment
variables (12-factor style), so the same image runs locally, in CI, and on
Cloud Run without edits.
"""
from __future__ import annotations

import os
from pathlib import Path

import dj_database_url

# backend/  — the directory that holds manage.py and this project package.
BASE_DIR = Path(__file__).resolve().parent.parent


def _env_bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


# --- Core -------------------------------------------------------------------
# A real deployment must set DJANGO_SECRET_KEY; the fallback only exists so
# build-time steps (collectstatic) and local runs work out of the box.
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-insecure-key-change-me")
DEBUG = _env_bool("DJANGO_DEBUG", False)

# Comma-separated hostnames. Defaults to "*" so the container is reachable on
# Cloud Run's generated URL without extra configuration.
ALLOWED_HOSTS = [h.strip() for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "*").split(",") if h.strip()]

# Cloud Run (and most proxies) terminate TLS upstream and forward over HTTP.
# Trust the standard header so CSRF's HTTPS origin checks line up.
CSRF_TRUSTED_ORIGINS = [
    o.strip() for o in os.environ.get("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()
]
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")


# --- Applications -----------------------------------------------------------
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "tasks",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # WhiteNoise serves the compiled React assets straight from the app, so no
    # separate web server or bucket is needed for static files.
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

# Where the built single-page app lives. In Docker the frontend build is copied
# to /app/frontend_dist; in local dev it's frontend/dist next to backend/.
FRONTEND_DIST_DIR = Path(
    os.environ.get("FRONTEND_DIST_DIR", BASE_DIR.parent / "frontend" / "dist")
)

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        # Only Django's own apps (admin) need templates; the SPA index.html is
        # served as a static file by the catch-all view, not rendered here.
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


# --- Database ---------------------------------------------------------------
def _database_config() -> dict:
    """Resolve the database from DATABASE_URL, or assemble it from POSTGRES_*.

    Managed Postgres providers hand out `postgres://` URLs and this project's
    older tooling used the SQLAlchemy `postgresql+psycopg2://` form; normalise
    both to something dj-database-url understands.
    """
    url = os.environ.get("DATABASE_URL")
    if not url:
        user = os.environ.get("POSTGRES_USER", "postgres")
        password = os.environ.get("POSTGRES_PASSWORD", "postgres")
        host = os.environ.get("POSTGRES_HOST", "localhost")
        port = os.environ.get("POSTGRES_PORT", "5432")
        name = os.environ.get("POSTGRES_DB", "tasks")
        url = f"postgres://{user}:{password}@{host}:{port}/{name}"

    url = url.replace("postgresql+psycopg2://", "postgresql://")
    # pool up connections so Cloud Run doesn't reconnect on every request.
    return dj_database_url.parse(url, conn_max_age=600, conn_health_checks=True)


DATABASES = {"default": _database_config()}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# --- Django REST Framework --------------------------------------------------
# This is a public demo API: no auth, JSON only, and a sane default ordering.
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
}


# --- Static files (compiled React app) --------------------------------------
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
# Vite emits content-hashed filenames into dist/; collectstatic gathers them.
STATICFILES_DIRS = [FRONTEND_DIST_DIR] if FRONTEND_DIST_DIR.exists() else []
# Compress but don't re-hash — Vite already fingerprints the assets.
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}


# --- Password validation (only relevant to the admin site) ------------------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
