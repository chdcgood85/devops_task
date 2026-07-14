import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import TaskModal from "./TaskModal.jsx";

function renderModal(props = {}) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  const onDelete = vi.fn();
  render(
    <TaskModal
      mode="create"
      task={null}
      onSubmit={onSubmit}
      onClose={onClose}
      onDelete={onDelete}
      {...props}
    />
  );
  return { onSubmit, onClose, onDelete };
}

describe("TaskModal — create mode", () => {
  it("submits a trimmed payload with defaults", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderModal();

    await user.type(screen.getByLabelText(/^task title$/i), "  New thing  ");
    await user.click(screen.getByRole("button", { name: /add task/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: "New thing",
      description: "",
      status: "todo",
      due_date: null,
    });
  });

  it("includes description, status, and due date when provided", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderModal();

    await user.type(screen.getByLabelText(/^task title$/i), "Full");
    await user.type(screen.getByLabelText(/^task description$/i), "details");
    await user.selectOptions(screen.getByLabelText(/^status$/i), "in_progress");
    await user.type(screen.getByLabelText(/^due date$/i), "2026-08-01");
    await user.click(screen.getByRole("button", { name: /add task/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: "Full",
      description: "details",
      status: "in_progress",
      due_date: "2026-08-01",
    });
  });

  it("does not submit an empty title", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderModal();

    await user.click(screen.getByRole("button", { name: /add task/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("has no delete button in create mode", () => {
    renderModal();
    expect(screen.queryByRole("button", { name: /delete task/i })).not.toBeInTheDocument();
  });
});

describe("TaskModal — edit mode", () => {
  const task = {
    id: 7,
    title: "Existing",
    description: "old details",
    status: "in_progress",
    due_date: "2026-09-15",
  };

  it("pre-fills the fields from the task", () => {
    renderModal({ mode: "edit", task });
    expect(screen.getByLabelText(/^task title$/i)).toHaveValue("Existing");
    expect(screen.getByLabelText(/^task description$/i)).toHaveValue("old details");
    expect(screen.getByLabelText(/^status$/i)).toHaveValue("in_progress");
    expect(screen.getByLabelText(/^due date$/i)).toHaveValue("2026-09-15");
  });

  it("submits changed fields with 'Save changes'", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderModal({ mode: "edit", task });

    const title = screen.getByLabelText(/^task title$/i);
    await user.clear(title);
    await user.type(title, "Renamed");
    await user.selectOptions(screen.getByLabelText(/^status$/i), "done");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: "Renamed",
      description: "old details",
      status: "done",
      due_date: "2026-09-15",
    });
  });

  it("calls onDelete from the delete button", async () => {
    const user = userEvent.setup();
    const { onDelete } = renderModal({ mode: "edit", task });
    await user.click(screen.getByRole("button", { name: /delete task/i }));
    expect(onDelete).toHaveBeenCalled();
  });
});

describe("TaskModal — dismissal", () => {
  it("closes on the close button", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes when the backdrop is clicked but not the dialog", () => {
    const { onClose } = renderModal();
    const dialog = screen.getByRole("dialog");

    // Clicking inside the dialog must not dismiss it.
    fireEvent.mouseDown(dialog);
    expect(onClose).not.toHaveBeenCalled();

    // Clicking the backdrop (the dialog's parent) dismisses it.
    fireEvent.mouseDown(dialog.parentElement);
    expect(onClose).toHaveBeenCalled();
  });
});
