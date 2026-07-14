"""Serializers translate between Task rows and JSON, and validate input."""
from rest_framework import serializers

from .models import Task


class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = [
            "id",
            "title",
            "description",
            "status",
            "due_date",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_title(self, value: str) -> str:
        # Reject whitespace-only titles and store the trimmed form.
        trimmed = value.strip()
        if not trimmed:
            raise serializers.ValidationError("This field may not be blank.")
        return trimmed
