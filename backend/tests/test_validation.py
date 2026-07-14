"""Validation, error-handling, and edge-case tests for the tasks API."""
from __future__ import annotations

import pytest
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


def test_blank_title_is_rejected(client: APIClient) -> None:
    response = client.post("/api/tasks", {"title": "   "}, format="json")
    assert response.status_code == 400
    assert "title" in response.json()


def test_missing_title_is_rejected(client: APIClient) -> None:
    response = client.post("/api/tasks", {"description": "no title"}, format="json")
    assert response.status_code == 400
    assert "title" in response.json()


def test_title_at_max_length_is_accepted(make_task) -> None:
    make_task(title="x" * 255)  # fixture asserts a 201


def test_title_over_max_length_is_rejected(client: APIClient) -> None:
    response = client.post("/api/tasks", {"title": "x" * 256}, format="json")
    assert response.status_code == 400
    assert "title" in response.json()


def test_invalid_status_is_rejected(client: APIClient) -> None:
    response = client.post("/api/tasks", {"title": "ok", "status": "banana"}, format="json")
    assert response.status_code == 400
    assert "status" in response.json()


def test_invalid_due_date_is_rejected(client: APIClient) -> None:
    response = client.post("/api/tasks", {"title": "ok", "due_date": "not-a-date"}, format="json")
    assert response.status_code == 400
    assert "due_date" in response.json()


def test_put_requires_title(client: APIClient, make_task) -> None:
    """PUT is a full replacement, so omitting the title is a 400."""
    created = make_task(title="Has title")
    response = client.put(f"/api/tasks/{created['id']}", {"status": "done"}, format="json")
    assert response.status_code == 400
    assert "title" in response.json()


def test_id_is_read_only_on_create(client: APIClient) -> None:
    """A client-supplied id is ignored; the server assigns its own."""
    body = client.post("/api/tasks", {"title": "ok", "id": 999}, format="json").json()
    assert body["id"] != 999


def test_fetch_missing_task_returns_404(client: APIClient) -> None:
    assert client.get("/api/tasks/99999").status_code == 404


def test_update_missing_task_returns_404(client: APIClient) -> None:
    assert client.patch("/api/tasks/99999", {"status": "done"}, format="json").status_code == 404


def test_delete_missing_task_returns_404(client: APIClient) -> None:
    assert client.delete("/api/tasks/99999").status_code == 404


def test_delete_is_not_repeatable(client: APIClient, make_task) -> None:
    created = make_task(title="Once")
    assert client.delete(f"/api/tasks/{created['id']}").status_code == 204
    assert client.delete(f"/api/tasks/{created['id']}").status_code == 404


def test_method_not_allowed_on_collection(client: APIClient) -> None:
    """The collection endpoint accepts GET/POST, so DELETE is a 405."""
    assert client.delete("/api/tasks").status_code == 405
