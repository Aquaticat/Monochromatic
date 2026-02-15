import type { Task } from "../lib/types.ts";
import styles from "../../dist/client/styles.css" with { type: "text" };
import { api } from "./lib/api.ts";
import { injectCSS } from "./lib/inject-css.ts";
import { readPageData } from "./lib/page-data.ts";
import { createTaskCard, formatRunningTrackedTime } from "./lib/task-card.ts";
import "./components/side-drawer.ts";
import "./components/top-nav.ts";

type InProgressPageData = {
  tasks: Task[];
};

injectCSS(styles);

const pageData = readPageData<InProgressPageData>();
const appElement = document.getElementById("app");
if (!(appElement instanceof HTMLElement)) {
  throw new Error("Missing app element");
}
const app = appElement;

if (pageData.tasks.length === 0) {
  const emptyState = document.createElement("p");
  emptyState.className = "empty";
  emptyState.textContent = "No active timers.";
  app.append(emptyState);
}

const list = document.createElement("ul");
list.className = "task-list";

for (const task of pageData.tasks) {
  const card = createTaskCard(task, {
    onOpen: (taskId) => {
      window.location.href = `/tasks/${taskId}`;
    },
    onToggleComplete: async (taskId) => {
      await api(`/api/tasks/${taskId}/stop`, { method: "POST" });
      window.location.reload();
    },
  });
  list.append(card);
}

if (pageData.tasks.length > 0) {
  app.append(list);
}

// Live timer updates
setInterval(() => {
  for (const task of pageData.tasks) {
    const cards = list.querySelectorAll("task-card");
    for (const card of cards) {
      const chipEl = (card as any).getChipElement?.("tracked:");
      if (chipEl instanceof HTMLSpanElement) {
        chipEl.textContent = `tracked: ${formatRunningTrackedTime(task)}`;
      }
    }
  }
}, 1000);
