"""Routes for the tasks app, mounted under /api/ by the project urlconf."""
from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import TaskViewSet, health, version

# trailing_slash=False keeps the URLs as /api/tasks and /api/tasks/1 so the
# frontend's fetch() calls don't need a trailing slash.
router = SimpleRouter(trailing_slash=False)
router.register("tasks", TaskViewSet, basename="task")

urlpatterns = [
    path("health", health, name="health"),
    path("version", version, name="version"),
    *router.urls,
]
