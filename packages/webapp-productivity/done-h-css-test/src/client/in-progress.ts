/**
 * Client entry script for the In-Progress page.
 *
 * Same hydration pattern as inbox.ts: injectCSS → readPageData → build DOM into #app.
 * Additionally runs a 1-second interval to live-update tracked-time chip text.
 */
import type { Task } from "../lib/types.ts";
import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import { api } from "./lib/api.ts";
import { injectCSS } from "./lib/inject-css.ts";
import { globalStyles } from "./styles.ts";
import { readPageData } from "./lib/page-data.ts";
import { createTaskCard, formatRunningTrackedTime } from "./lib/task-card.ts";
import "./components/side-drawer.ts";
import "./components/top-nav.ts";

/** Shape of the JSON blob embedded in the in-progress page by the server. */
type InProgressPageData = {
  tasks: Task[];
};

injectCSS(globalStyles);

const pageData = readPageData<InProgressPageData>();
const appElement = document.getElementById("app");
if (!(appElement instanceof HTMLElement)) {
  throw new Error("Missing app element");
}
const app = appElement;

if (pageData.tasks.length === 0) {
  app.append(h({ tag: "p", class: "empty", text: "No active timers." }));
}

const list = h({ tag: "ul", class: "task-list" });

for (const task of pageData.tasks) {
  list.append(
    createTaskCard(task, {
      onOpen: (taskId) => {
        window.location.href = `/tasks/${taskId}`;
      },
      onToggleComplete: async (taskId) => {
        await api(`/api/tasks/${taskId}/stop`, { method: "POST" });
        window.location.reload();
      },
    }),
  );
}

if (pageData.tasks.length > 0) {
  app.append(list);
}

// Live timer updates -- correlate each card with its task by DOM order
setInterval(() => {
  const cards = list.querySelectorAll("task-card");
  cards.forEach((card, cardIndex) => {
    const task = pageData.tasks[cardIndex];
    if (task === undefined) return;
    const chipEl = (card as unknown as { getChipElement?: (prefix: string) => HTMLSpanElement | null }).getChipElement?.("tracked:");
    if (chipEl instanceof HTMLSpanElement) {
      chipEl.textContent = `tracked: ${formatRunningTrackedTime(task)}`;
    }
  });
}, 1000);
