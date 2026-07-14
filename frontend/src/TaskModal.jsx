import { useEffect, useRef, useState } from "react";

const STATUSES = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

const EMPTY = { title: "", description: "", status: "todo", due_date: "" };

// A dialog for creating a task (mode="create") or editing one (mode="edit").
export default function TaskModal({ mode, task, onSubmit, onDelete, onClose }) {
  const [form, setForm] = useState(() => ({ ...EMPTY, ...task, due_date: task?.due_date || "" }));
  const firstFieldRef = useRef(null);

  // Focus the title on open, lock background scroll, and close on Escape.
  useEffect(() => {
    firstFieldRef.current?.focus();
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const setField = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  function handleSubmit(event) {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) return;
    onSubmit({
      title,
      description: form.description.trim(),
      status: form.status,
      due_date: form.due_date || null,
    });
  }

  const heading = mode === "create" ? "New task" : "Edit task";
  const submitLabel = mode === "create" ? "Add task" : "Save changes";

  return (
    <div className="modal" onMouseDown={onClose}>
      {/* Stop clicks inside the dialog from bubbling to the backdrop. */}
      <div
        className="modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h2>{heading}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <form className="modal__form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field__label">Title</span>
            <input
              ref={firstFieldRef}
              className="field__input"
              value={form.title}
              onChange={setField("title")}
              placeholder="What needs doing?"
              maxLength={255}
              aria-label="Task title"
            />
          </label>

          <label className="field">
            <span className="field__label">Description</span>
            <textarea
              className="field__input"
              value={form.description}
              onChange={setField("description")}
              placeholder="Add more detail (optional)"
              rows={3}
              aria-label="Task description"
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span className="field__label">Status</span>
              <select
                className="field__input"
                value={form.status}
                onChange={setField("status")}
                aria-label="Status"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">Due date</span>
              <input
                className="field__input"
                type="date"
                value={form.due_date}
                onChange={setField("due_date")}
                aria-label="Due date"
              />
            </label>
          </div>

          <div className="modal__foot">
            {mode === "edit" && (
              <button type="button" className="btn btn--danger" onClick={onDelete}>
                Delete task
              </button>
            )}
            <span className="modal__spacer" />
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
