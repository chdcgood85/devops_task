"""API views: a CRUD viewset for tasks plus health and version endpoints."""
from django.db import connection
from rest_framework import viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Task
from .serializers import TaskSerializer

API_VERSION = "2.0.0"


class TaskViewSet(viewsets.ModelViewSet):
    """Full CRUD for tasks — list, create, retrieve, update, destroy.

    DRF gives us the right status codes for free: 201 on create, 204 on
    delete, 400 for validation errors, and 404 for a missing id.
    """

    queryset = Task.objects.all()
    serializer_class = TaskSerializer


@api_view(["GET"])
def health(request) -> Response:
    """Report service health, including a real database round-trip."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        db_ok = True
    except Exception:
        db_ok = False

    body = {
        "status": "ok" if db_ok else "degraded",
        "database": "connected" if db_ok else "disconnected",
    }
    return Response(body, status=200 if db_ok else 503)


@api_view(["GET"])
def version(request) -> Response:
    return Response({"name": "Task Management API", "version": API_VERSION})
