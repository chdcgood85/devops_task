import { vi } from "vitest";

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Installs an in-memory fake of the Task API on globalThis.fetch so component
// tests never touch the network. Pass { failList: true } to simulate a GET
// /tasks failure and exercise the error path.
export function installMockApi({ failList = false } = {}) {
  let tasks = [];
  let nextId = 1;

  globalThis.fetch = vi.fn(async (url, options = {}) => {
    const method = options.method || "GET";

    if (url === "/api/version") {
      return jsonResponse({ name: "Task Management API", version: "2.0.0" });
    }
    if (url === "/api/tasks" && method === "GET") {
      return failList ? jsonResponse({ detail: "Server exploded" }, 500) : jsonResponse(tasks);
    }
    if (url === "/api/tasks" && method === "POST") {
      const body = JSON.parse(options.body);
      const task = {
        id: nextId++,
        title: body.title,
        description: body.description || "",
        status: body.status || "todo",
        due_date: body.due_date || null,
      };
      tasks.push(task);
      return jsonResponse(task, 201);
    }
    if (method === "PATCH") {
      const id = Number(url.split("/").pop());
      tasks = tasks.map((t) => (t.id === id ? { ...t, ...JSON.parse(options.body) } : t));
      return jsonResponse(tasks.find((t) => t.id === id));
    }
    if (method === "DELETE") {
      const id = Number(url.split("/").pop());
      tasks = tasks.filter((t) => t.id !== id);
      return new Response(null, { status: 204 });
    }
    return jsonResponse({ detail: "not found" }, 404);
  });
}
