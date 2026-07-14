"""Top-level URL routing.

The API lives under /api/, Django's admin under /admin/, and everything else
falls through to the React single-page app.
"""
from __future__ import annotations

from pathlib import Path

from django.conf import settings
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path, re_path

# Read the built index.html once at import time; None until the frontend is built.
_INDEX_HTML = Path(settings.FRONTEND_DIST_DIR) / "index.html"


def spa(request) -> HttpResponse:
    """Serve the compiled React index.html for any non-API route.

    The file is returned verbatim (not run through Django's template engine),
    and a friendly message stands in when the frontend hasn't been built yet.
    """
    if _INDEX_HTML.exists():
        return HttpResponse(_INDEX_HTML.read_bytes())
    return HttpResponse(
        "Frontend build not found. Run `npm run build` in ./frontend, "
        "or use the Docker image which builds it for you.",
        content_type="text/plain",
    )


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("tasks.urls")),
    # Catch-all: hand client-side routing to the SPA. Static assets are served
    # by WhiteNoise before requests ever reach this pattern.
    re_path(r"^.*$", spa, name="spa"),
]
