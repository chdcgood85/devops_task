"""Happy-path CRUD and lifecycle tests for the tasks API."""
from __future__ import annotations

import pytest
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


def test_list_starts_empty(client: APIClient) -> None:
    response = client.get("/api/tasks")
    assert response.status_code == 200
    assert response.json() == []


def test_create_applies_sensible_defaults(client: APIClient) -> None:
    response = client.post("/api/tasks", {"title": "Write tests"}, format="json")
    assert response.status_code == 201

    body = response.json()
    assert body["id"] > 0
    assert body["title"] == "Write tests"
    assert body["status"] == "todo"
    assert body["description"] == ""
    assert body["due_date"] is None
    assert body["created_at"] is not None
    assert body["updated_at"] is not None


def test_create_persists_full_payload(client: APIClient) -> None:
    payload = {
        "title": "Ship it",
        "description": "Merge to main and watch the pipeline go green.",
        "status": "in_progress",
        "due_date": "2026-08-01",
    }
    body = client.post("/api/tasks", payload, format="json").json()
    assert body["description"] == payload["description"]
    assert body["status"] == "in_progress"
    assert body["due_date"] == "2026-08-01"


def test_title_is_trimmed(make_task) -> None:
    assert make_task(title="  padded  ")["title"] == "padded"


@pytest.mark.parametrize("status", ["todo", "in_progress", "done"])
def test_every_valid_status_is_accepted(make_task, status: str) -> None:
    assert make_task(status=status)["status"] == status


def test_list_is_ordered_by_id(client: APIClient, make_task) -> None:
    make_task(title="first")
    make_task(title="second")
    make_task(title="third")

    titles = [t["title"] for t in client.get("/api/tasks").json()]
    assert titles == ["first", "second", "third"]


def test_retrieve_single_task(client: APIClient, make_task) -> None:
    created = make_task(title="Task A")
    response = client.get(f"/api/tasks/{created['id']}")
    assert response.status_code == 200
    assert response.json()["id"] == created["id"]


def test_full_update_with_put(client: APIClient, make_task) -> None:
    created = make_task(title="Draft")
    response = client.put(
        f"/api/tasks/{created['id']}",
        {"title": "Final", "status": "done", "description": "wrapped up"},
        format="json",
    )
    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Final"
    assert body["status"] == "done"
    assert body["description"] == "wrapped up"


def test_partial_update_status_only(client: APIClient, make_task) -> None:
    created = make_task(title="Keep me")
    response = client.patch(
        f"/api/tasks/{created['id']}", {"status": "in_progress"}, format="json"
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "in_progress"
    assert body["title"] == "Keep me"


def test_update_advances_updated_at(client: APIClient, make_task) -> None:
    created = make_task(title="Track me")
    updated = client.patch(
        f"/api/tasks/{created['id']}", {"status": "done"}, format="json"
    ).json()
    # updated_at is auto-managed and moves forward on save (ISO strings sort).
    assert updated["updated_at"] >= created["updated_at"]
    assert updated["created_at"] == created["created_at"]


def test_task_str_is_its_title(make_task) -> None:
    from tasks.models import Task

    task = Task.objects.get(pk=make_task(title="Readable name")["id"])
    assert str(task) == "Readable name"


def test_delete_then_gone(client: APIClient, make_task) -> None:
    created = make_task(title="Temporary")
    assert client.delete(f"/api/tasks/{created['id']}").status_code == 204
    assert client.get(f"/api/tasks/{created['id']}").status_code == 404
