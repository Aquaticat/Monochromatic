/**
 * Client entry script for the Task Detail page.
 *
 * Same hydration pattern as inbox.ts: injectCSS → readPageData → build DOM into #app.
 * The server renders its own HTML shell (not via renderPage) without `<top-nav>`,
 * because the `<task-detail>` component provides its own back-button header.
 */
import type { Task } from "../lib/types.ts";
import styles from "../../dist/client/styles.css" with { type: "text" };
import { api } from "./lib/api.ts";
import { injectCSS } from "./lib/inject-css.ts";
import { readPageData } from "./lib/page-data.ts";
import "./components/side-drawer.ts";
import { TaskDetail } from "./components/task-detail.ts";

type BlockerCandidate = {
  id: string;
  title: string;
};

type BlockerSummary = {
  id: string;
  title: string;
  status: string;
};

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

detail.addEventListener("action", ((event: CustomEvent) => {
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
      const payload = {
        title,
        description: description.length === 0 ? null : description,
        tags: task.tags,
        locations: task.locations,
        priority: task.priority,
        complexity: task.complexity,
        dueDate: task.dueDate,
        blockedBy: task.blockedBy,
      };
      api(`/api/tasks/${task.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }).then(() => {
        window.location.reload();
      });
      break;
    }
    case "start":
      api(`/api/tasks/${task.id}/start`, { method: "POST" }).then(() => {
        window.location.reload();
      });
      break;
    case "stop":
      api(`/api/tasks/${task.id}/stop`, { method: "POST" }).then(() => {
        window.location.reload();
      });
      break;
    case "complete":
      api(`/api/tasks/${task.id}/complete`, { method: "POST" }).then(() => {
        window.location.href = "/";
      });
      break;
    case "delete":
      api(`/api/tasks/${task.id}`, { method: "DELETE" }).then(() => {
        window.location.href = "/";
      });
      break;
  }
}) as EventListener);

app.append(detail);
