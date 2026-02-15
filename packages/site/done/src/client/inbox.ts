import type { Task } from "../lib/types.ts";
import styles from "../../dist/client/styles.css" with { type: "text" };
import { api } from "./lib/api.ts";
import { injectCSS } from "./lib/inject-css.ts";
import { readPageData } from "./lib/page-data.ts";
import { createTaskCard } from "./lib/task-card.ts";
import "./components/side-drawer.ts";
import "./components/top-nav.ts";
import "./components/section-heading.ts";
import "./components/toggle-switch.ts";
import "./components/focus-dropdown.ts";
import "./components/fab-button.ts";

type BlockedTaskLink = {
  blockerId: string;
  task: Task;
};

type InboxPageData = {
  suggestedTasks: Task[];
  allTasks: Task[];
  blockedTasksByBlocker: Record<string, BlockedTaskLink[] | undefined>;
};

injectCSS(styles);

const pageData = readPageData<InboxPageData>();
const appElement = document.getElementById("app");
if (!(appElement instanceof HTMLElement)) {
  throw new Error("Missing app element");
}
const app = appElement;

function openTask(taskId: string): void {
  window.location.href = `/tasks/${taskId}`;
}

async function completeTask(taskId: string): Promise<void> {
  await api(`/api/tasks/${taskId}/complete`, { method: "POST" });
  window.location.reload();
}

//region Suggested section

const suggestedSection = document.createElement("section-heading") as HTMLElement;
suggestedSection.setAttribute("icon", "\u2728");
suggestedSection.setAttribute("label", "Suggested");

const suggestedContent = document.createElement("div");
suggestedContent.style.display = "flex";
suggestedContent.style.flexDirection = "column";
suggestedContent.style.gap = "var(--gap)";

// Location controls
const locationGroup = document.createElement("div");
locationGroup.className = "control-group";

const locationTitle = document.createElement("h3");
locationTitle.className = "subsection-heading";
locationTitle.textContent = "My location";

const locationDesc = document.createElement("p");
locationDesc.className = "subsection-desc";
locationDesc.textContent = "Suggesting tasks can be done near the location.";

const locationOptions = document.createElement("div");
locationOptions.className = "location-options";

const autodetectBtn = document.createElement("button");
autodetectBtn.className = "autodetect-toggle";
autodetectBtn.innerHTML = `<span>autodetect</span>`;
const autoToggle = document.createElement("toggle-switch");
autoToggle.setAttribute("on", "");
autodetectBtn.append(autoToggle);

locationOptions.append(autodetectBtn);
locationGroup.append(locationTitle, locationDesc, locationOptions);

// Focus controls
const focusGroup = document.createElement("div");
focusGroup.className = "control-group";

const focusTitle = document.createElement("h3");
focusTitle.className = "subsection-heading";
focusTitle.textContent = "My focus";

const focusDesc = document.createElement("p");
focusDesc.className = "subsection-desc";
focusDesc.textContent = "Additional instructions on which tasks to suggest.";

const focusDropdown = document.createElement("focus-dropdown");
focusDropdown.setAttribute("value", "Adulting tasks first");

focusGroup.append(focusTitle, focusDesc, focusDropdown);

const controls = document.createElement("div");
controls.className = "controls";
controls.append(locationGroup, focusGroup);

suggestedContent.append(controls);

// Suggested task list
const suggestedList = document.createElement("ul");
suggestedList.className = "task-list";

for (const task of pageData.suggestedTasks) {
  const card = createTaskCard(task, {
    onOpen: openTask,
    onToggleComplete: completeTask,
  });
  suggestedList.append(card);

  const childLinks = pageData.blockedTasksByBlocker[task.id] ?? [];
  if (childLinks.length > 0) {
    const childContainer = document.createElement("div");
    childContainer.className = "task-children";
    const childList = document.createElement("ul");
    childList.className = "task-list";
    for (const childLink of childLinks) {
      childList.append(
        createTaskCard(childLink.task, {
          showBlockedBadge: true,
          onOpen: openTask,
          onToggleComplete: completeTask,
        })
      );
    }
    childContainer.append(childList);
    suggestedList.append(childContainer);
  }
}

if (pageData.suggestedTasks.length === 0) {
  const emptyState = document.createElement("p");
  emptyState.className = "empty";
  emptyState.textContent = "No tasks yet.";
  suggestedContent.append(emptyState);
} else {
  suggestedContent.append(suggestedList);
}

suggestedSection.append(suggestedContent);
app.append(suggestedSection);

//endregion Suggested section

// Divider
const divider = document.createElement("div");
divider.className = "divider";
app.append(divider);

//region All section

const allSection = document.createElement("section-heading") as HTMLElement;
allSection.setAttribute("icon", "\u221E");
allSection.setAttribute("label", "All");

const allContent = document.createElement("div");
allContent.style.display = "flex";
allContent.style.flexDirection = "column";
allContent.style.gap = "var(--gap)";

const allList = document.createElement("ul");
allList.className = "task-list";

for (const task of pageData.allTasks) {
  const card = createTaskCard(task, {
    onOpen: openTask,
    onToggleComplete: completeTask,
  });
  allList.append(card);

  const childLinks = pageData.blockedTasksByBlocker[task.id] ?? [];
  if (childLinks.length > 0) {
    const childContainer = document.createElement("div");
    childContainer.className = "task-children";
    const childList = document.createElement("ul");
    childList.className = "task-list";
    for (const childLink of childLinks) {
      childList.append(
        createTaskCard(childLink.task, {
          showBlockedBadge: true,
          onOpen: openTask,
          onToggleComplete: completeTask,
        })
      );
    }
    childContainer.append(childList);
    allList.append(childContainer);
  }
}

if (pageData.allTasks.length === 0) {
  const emptyState = document.createElement("p");
  emptyState.className = "empty";
  emptyState.textContent = "No tasks yet.";
  allContent.append(emptyState);
} else {
  allContent.append(allList);
}

allSection.append(allContent);
app.append(allSection);

//endregion All section

// FAB button for creating tasks
const fab = document.createElement("fab-button");
fab.setAttribute("label", "Add task");
fab.addEventListener("click", () => {
  const title = prompt("New task title:");
  if (title !== null && title.trim().length > 0) {
    api("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ title: title.trim() }),
    }).then(() => {
      window.location.reload();
    });
  }
});
document.body.append(fab);
