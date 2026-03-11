/**
 * Client entry script for the Task Detail page.
 *
 * Same hydration pattern as inbox.ts: injectCSS → readPageData → build DOM into #app.
 * The server renders its own HTML shell (not via renderPage) without `<top-nav>`,
 * because the `<task-detail>` component provides its own back-button header.
 */
import type { Task } from "../lib/types.ts";
import styles from "../../dist/css/styles.css" with { type: "text" };
import { api } from "./lib/api.ts";
import { injectCSS } from "./lib/inject-css.ts";
import { readPageData } from "./lib/page-data.ts";
import "./components/side-drawer.ts";
import type { TaskDetail } from "./components/task-detail.ts";
// Side-effect import: registers the `<task-detail>` custom element
import "./components/task-detail.ts";

/** Minimal task info shown in the blocker picker dropdown. */
type BlockerCandidate = {
  id: string;
  title: string;
};

/** Summary of a task that blocks the current task (shown as a chip/badge). */
type BlockerSummary = {
  id: string;
  title: string;
  status: string;
};

/** Shape of the JSON blob embedded in the task detail page by the server. */
type TaskDetailsPageData = {
  task: Task;
  blockerCandidates: BlockerCandidate[];
  blockerSummaries: BlockerSummary[];
};

injectCSS(styles);

const pageData = readPageData<TaskDetailsPageData>();
const task = pageData.task;

const appElement = document.getElementById("app");
if (!(appElement instanceof HTMLElement)) {
  throw new Error("Missing app element");
}
const app = appElement;

const detail = document.createElement("task-detail") as TaskDetail;
detail.configure({
  task,
  blockerSummaries: pageData.blockerSummaries,
});

detail.addEventListener("action", async (event) => {
  if (!(event instanceof CustomEvent)) throw new TypeError("Expected CustomEvent for 'action' listener");
  const { action, title, description } = event.detail as {
    action: string;
    title: string;
    description: string;
  };

  switch (action) {
    case "close":
      window.location.href = "/";
      break;
    case "save": {
      const metadata = detail.getMetadata();
      const payload = {
        title,
        description: description.length === 0 ? null : description,
        tags: metadata.tags,
        locations: metadata.locations,
        priority: metadata.priority,
        complexity: metadata.complexity,
        dueDate: task.dueDate,
        blockedBy: task.blockedBy,
      };
      await api(`/api/tasks/${task.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      window.location.reload();
      break;
    }
    case "start":
      await api(`/api/tasks/${task.id}/start`, { method: "POST" });
      window.location.reload();
      break;
    case "stop":
      await api(`/api/tasks/${task.id}/stop`, { method: "POST" });
      window.location.reload();
      break;
    case "complete":
      await api(`/api/tasks/${task.id}/complete`, { method: "POST" });
      window.location.href = "/";
      break;
    case "delete":
      await api(`/api/tasks/${task.id}`, { method: "DELETE" });
      window.location.href = "/";
      break;
  }
});

app.append(detail);
