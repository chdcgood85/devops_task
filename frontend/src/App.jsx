import { useEffect, useMemo, useState } from "react";

import { api } from "./api.js";
import TaskModal from "./TaskModal.jsx";
import "./App.css";

const STATUSES = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

const FILTERS = [{ value: "all", label: "All" }, ...STATUSES];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// due_date arrives as "YYYY-MM-DD"; format it without timezone drift.
function formatDue(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState(null); // { mode: "create" | "edit", task }
  const [error, setError] = useState("");
  const [version, setVersion] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      setTasks(await api.listTasks());
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    api.getVersion().then((v) => setVersion(v.version)).catch(() => {});
  }, []);

  async function run(action) {
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleSave(payload) {
    const { mode, task } = modal;
    setModal(null);
    run(() => (mode === "create" ? api.createTask(payload) : api.updateTask(task.id, payload)));
  }

  function handleModalDelete() {
    const { task } = modal;
    setModal(null);
    run(() => api.deleteTask(task.id));
  }

  const done = tasks.filter((t) => t.status === "done").length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  const visible = useMemo(
    () => (filter === "all" ? tasks : tasks.filter((t) => t.status === filter)),
    [tasks, filter]
  );

  return (
    <div className="page">
      <main className="card">
        <header className="card__head">
          <div className="card__title">
            <h1>Tasks</h1>
            {version && <span className="badge">v{version}</span>}
            <button
              type="button"
              className="btn btn--primary card__new"
              onClick={() => setModal({ mode: "create", task: null })}
            >
              + New task
            </button>
          </div>
          <p className="card__subtitle">
            {tasks.length === 0 ? "A clean slate." : `${done} of ${tasks.length} done`}
          </p>
          <div className="progress" aria-hidden="true">
            <span className="progress__bar" style={{ width: `${progress}%` }} />
          </div>
        </header>

        <div className="filters" role="tablist" aria-label="Filter tasks">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              className={`filters__tab${filter === f.value ? " is-active" : ""}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}

        {!loading && tasks.length === 0 && (
          <p className="empty">Nothing here yet. Add your first task above.</p>
        )}
        {!loading && tasks.length > 0 && visible.length === 0 && (
          <p className="empty">No tasks in this view.</p>
        )}

        <ul className="tasks">
          {visible.map((task) => (
            <li key={task.id} className={`task task--${task.status}`}>
              <span className="task__dot" aria-hidden="true" />
              <button
                type="button"
                className="task__body"
                onClick={() => setModal({ mode: "edit", task })}
                aria-label={`Edit "${task.title}"`}
              >
                <span className="task__titlerow">
                  <span className="task__title">{task.title}</span>
                  {task.due_date && (
                    <span className="task__due">Due {formatDue(task.due_date)}</span>
                  )}
                </span>
                {task.description && <span className="task__desc">{task.description}</span>}
              </button>

              <select
                className="task__status"
                value={task.status}
                onChange={(e) => run(() => api.updateTask(task.id, { status: e.target.value }))}
                aria-label={`Status of "${task.title}"`}
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="task__delete"
                onClick={() => run(() => api.deleteTask(task.id))}
                aria-label={`Delete "${task.title}"`}
              >
                &times;
              </button>
            </li>
          ))}
        </ul>

        {done > 0 && (
          <footer className="card__foot">
            <span>{tasks.length - done} remaining</span>
            <button
              type="button"
              className="link"
              onClick={() =>
                run(async () => {
                  // Fire the deletes together, then a single refresh reconciles.
                  await Promise.all(
                    tasks.filter((t) => t.status === "done").map((t) => api.deleteTask(t.id))
                  );
                })
              }
            >
              Clear done
            </button>
          </footer>
        )}
      </main>

      {modal && (
        <TaskModal
          mode={modal.mode}
          task={modal.task}
          onSubmit={handleSave}
          onDelete={handleModalDelete}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
