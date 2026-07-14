"""Database models."""
from django.db import models

# Shared with the serializer so an over-long title returns a clean 400 rather
# than a database-driven 500.
TITLE_MAX_LENGTH = 255


class Task(models.Model):
    class Status(models.TextChoices):
        TODO = "todo", "To do"
        IN_PROGRESS = "in_progress", "In progress"
        DONE = "done", "Done"

    title = models.CharField(max_length=TITLE_MAX_LENGTH)
    description = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.TODO
    )
    due_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return self.title
