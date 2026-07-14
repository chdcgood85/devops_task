// Thin wrapper around the Task API. Everything the UI needs to talk to Django
// lives here so the components stay focused on rendering.

const BASE = "/api";

// DRF reports validation problems as {field: ["msg", ...]} and other errors as
// {detail: "msg"}. Fold either shape into one readable sentence.
async function readError(response) {
  try {
    const body = await response.json();
    if (body.detail) return body.detail;
    const messages = Object.values(body).flat();
    if (messages.length) return messages.join(" ");
  } catch {
    /* Non-JSON error body — fall through to a generic message. */
  }
  return `Request failed (${response.status}).`;
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  // 204 No Content (delete) has no body to parse.
  return response.status === 204 ? null : response.json();
}

export const api = {
  listTasks: () => request("/tasks"),
  createTask: (task) => request("/tasks", { method: "POST", body: JSON.stringify(task) }),
  updateTask: (id, changes) =>
    request(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(changes) }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: "DELETE" }),
  getVersion: () => request("/version"),
};
