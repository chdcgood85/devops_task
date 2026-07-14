"""Tests for the non-CRUD endpoints: health, version, and the SPA shell."""
from __future__ import annotations

import pytest
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


def test_health_reports_connected(client: APIClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "connected"}


def test_version_returns_name_and_version(client: APIClient) -> None:
    response = client.get("/api/version")
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Task Management API"
    assert body["version"]


def test_health_degraded_when_db_unavailable(client: APIClient, monkeypatch) -> None:
    """If the database round-trip fails, health reports 503/disconnected."""
    def boom(*args, **kwargs):
        raise Exception("database is down")

    monkeypatch.setattr("tasks.views.connection.cursor", boom)
    response = client.get("/api/health")
    assert response.status_code == 503
    assert response.json() == {"status": "degraded", "database": "disconnected"}


def test_root_serves_spa_shell(client: APIClient) -> None:
    """Any non-API route returns the SPA (or its fallback) with a 200."""
    response = client.get("/")
    assert response.status_code == 200


def test_client_side_route_falls_through_to_spa(client: APIClient) -> None:
    """A deep client-side path is handled by the SPA catch-all, not a 404."""
    response = client.get("/some/board/view")
    assert response.status_code == 200
