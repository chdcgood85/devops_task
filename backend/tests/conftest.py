"""Shared fixtures for the API test suite."""
from __future__ import annotations

import pytest
from rest_framework.test import APIClient


@pytest.fixture()
def client() -> APIClient:
    return APIClient()


@pytest.fixture()
def make_task(client: APIClient):
    """Create a task via the API and return the response body.

    Defaults to a minimal valid payload; override any field via kwargs.
    """

    def _make(**overrides) -> dict:
        payload = {"title": "Sample task"}
        payload.update(overrides)
        response = client.post("/api/tasks", payload, format="json")
        assert response.status_code == 201, response.content
        return response.json()

    return _make
