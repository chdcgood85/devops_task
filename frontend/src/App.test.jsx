import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App.jsx";
import { installMockApi } from "./test/mockApi.js";

// Open the "New task" modal, fill it in, submit, and wait for the row to appear.
async function create(user, { title, description = "", status } = {}) {
  await user.click(screen.getByRole("button", { name: /new task/i }));
  await user.type(screen.getByLabelText(/^task title$/i), title);
  if (description) await user.type(screen.getByLabelText(/^task description$/i), description);
  if (status) await user.selectOptions(screen.getByLabelText(/^status$/i), status);
  await user.click(screen.getByRole("button", { name: /add task/i }));
  await screen.findByText(title);
}

describe("App", () => {
  afterEach(() => vi.restoreAllMocks());

  describe("loading & header", () => {
    beforeEach(() => installMockApi());

    it("shows the empty state when there are no tasks", async () => {
      render(<App />);
      expect(await screen.findByText(/nothing here yet/i)).toBeInTheDocument();
    });

    it("renders the API version badge", async () => {
      render(<App />);
      expect(await screen.findByText("v2.0.0")).toBeInTheDocument();
    });

    it("updates the progress summary as tasks complete", async () => {
      const user = userEvent.setup();
      render(<App />);
      await screen.findByText(/nothing here yet/i);

      await create(user, { title: "One" });
      await create(user, { title: "Two", status: "done" });

      expect(screen.getByText("1 of 2 done")).toBeInTheDocument();
    });
  });

  describe("creating & editing", () => {
    beforeEach(() => installMockApi());

    it("creates a task with a description via the modal", async () => {
      const user = userEvent.setup();
      render(<App />);
      await screen.findByText(/nothing here yet/i);

      await create(user, { title: "Write the pipeline", description: "green build please" });

      expect(screen.getByText("Write the pipeline")).toBeInTheDocument();
      expect(screen.getByText("green build please")).toBeInTheDocument();
    });

    it("edits a task through the modal", async () => {
      const user = userEvent.setup();
      render(<App />);
      await screen.findByText(/nothing here yet/i);
      await create(user, { title: "Old name" });

      await user.click(screen.getByRole("button", { name: /edit "Old name"/i }));
      const titleField = screen.getByLabelText(/^task title$/i);
      await user.clear(titleField);
      await user.type(titleField, "New name");
      await user.click(screen.getByRole("button", { name: /save changes/i }));

      expect(await screen.findByText("New name")).toBeInTheDocument();
      expect(screen.queryByText("Old name")).not.toBeInTheDocument();
    });
  });

  describe("status, filters & clearing", () => {
    beforeEach(() => installMockApi());

    it("changes status from the row select", async () => {
      const user = userEvent.setup();
      render(<App />);
      await screen.findByText(/nothing here yet/i);
      await create(user, { title: "Move me" });

      await user.selectOptions(
        screen.getByRole("combobox", { name: /status of "Move me"/i }),
        "in_progress"
      );

      // The subtitle reflects 0 done still, but the select now holds the new value.
      expect(screen.getByRole("combobox", { name: /status of "Move me"/i })).toHaveValue(
        "in_progress"
      );
    });

    it("filters the list by status", async () => {
      const user = userEvent.setup();
      render(<App />);
      await screen.findByText(/nothing here yet/i);
      await create(user, { title: "A todo" });
      await create(user, { title: "B doing", status: "in_progress" });
      await create(user, { title: "C done", status: "done" });

      await user.click(screen.getByRole("tab", { name: /in progress/i }));
      expect(screen.getByText("B doing")).toBeInTheDocument();
      expect(screen.queryByText("A todo")).not.toBeInTheDocument();
      expect(screen.queryByText("C done")).not.toBeInTheDocument();
    });

    it("shows an empty message for a filter with no matches", async () => {
      const user = userEvent.setup();
      render(<App />);
      await screen.findByText(/nothing here yet/i);
      await create(user, { title: "Only todo" });

      await user.click(screen.getByRole("tab", { name: /^done$/i }));
      expect(screen.getByText(/no tasks in this view/i)).toBeInTheDocument();
    });

    it("clears done tasks", async () => {
      const user = userEvent.setup();
      render(<App />);
      await screen.findByText(/nothing here yet/i);
      await create(user, { title: "Finish me", status: "done" });

      await user.click(screen.getByRole("button", { name: /clear done/i }));
      await waitFor(() => expect(screen.queryByText("Finish me")).not.toBeInTheDocument());
    });
  });

  describe("deleting & errors", () => {
    it("deletes a task from the row", async () => {
      installMockApi();
      const user = userEvent.setup();
      render(<App />);
      await screen.findByText(/nothing here yet/i);
      await create(user, { title: "Temporary" });

      await user.click(screen.getByRole("button", { name: /delete "Temporary"/i }));
      await waitFor(() => expect(screen.queryByText("Temporary")).not.toBeInTheDocument());
    });

    it("surfaces an error when the list fails to load", async () => {
      installMockApi({ failList: true });
      render(<App />);
      expect(await screen.findByRole("alert")).toHaveTextContent(/server exploded/i);
    });
  });
});
