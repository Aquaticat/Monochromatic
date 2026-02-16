/**
 * Client entry script for the Inbox page.
 *
 * Loaded by the browser as `<script type="module" src="/dist/client/inbox.js">`.
 *
 * Hydration flow:
 * 1. `injectCSS()` inserts the compiled global stylesheet into `<head>`
 * 2. `readPageData()` deserializes the `<script id="page-data">` JSON blob
 *    that the server embedded in the HTML shell (see layout.ts / renderPage)
 * 3. The script builds DOM elements via `h()` and appends them to `<main id="app">`
 *
 * Web component side-effect imports register custom elements with the browser
 * so that tags like `<top-nav>`, `<task-card>`, etc. are recognized.
 */
import type { Task } from "../lib/types.ts";
import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import styles from "../../dist/client/styles.css" with { type: "text" };
import { api } from "./lib/api.ts";
import { injectCSS } from "./lib/inject-css.ts";
import { readPageData } from "./lib/page-data.ts";
import { createTaskCard } from "./lib/task-card.ts";
import { TaskDetail } from "./components/task-detail.ts";
// Side-effect imports: register custom elements so the browser recognizes them in the DOM
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

// Page-scoped styles for inbox controls (not shared with other pages)
injectCSS(`
.task-children {
  margin-inline-start: 1.5rem;
  border-inline-start-width: 0.125rem;
  border-inline-start-style: solid;
  border-inline-start-color: var(--bg-weaker);
  padding-inline-start: 0.75rem;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--gap);
  align-items: flex-start;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: var(--min-padding);
  flex: 1 0 0;
  min-inline-size: 100%;
  overflow: hidden;
}

.subsection-heading {
  font-size: 1.25rem;
  font-weight: 400;
}

.subsection-desc {
  font-size: calc(15 / 16 * 1rem);
  line-height: 1.5;
  color: var(--fg-weaker);
}

.location-options {
  display: flex;
  gap: var(--min-gap);
  align-items: center;
  min-block-size: 3rem;
  flex-wrap: wrap;
}

.autodetect-toggle {
  display: flex;
  gap: var(--min-padding);
  align-items: center;
  cursor: pointer;
  background-color: transparent;
  border-style: none;
  font: inherit;
  color: var(--fg);
  padding-block: 0;
  padding-inline: 0;
}
`);

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

/** Builds a task list with optional blocked-child nesting */
function buildTaskList(tasks: readonly Task[], blockedTasksByBlocker: Record<string, BlockedTaskLink[] | undefined>): HTMLUListElement {
  const list = h({ tag: "ul", class: "task-list" });

  for (const task of tasks) {
    list.append(createTaskCard(task, { onOpen: openTask, onToggleComplete: completeTask }));

    const childLinks = blockedTasksByBlocker[task.id] ?? [];
    if (childLinks.length > 0) {
      list.append(
        h({
          tag: "div",
          class: "task-children",
          children: [
            h({
              tag: "ul",
              class: "task-list",
              children: childLinks.map((childLink) =>
                createTaskCard(childLink.task, { showBlockedBadge: true, onOpen: openTask, onToggleComplete: completeTask }),
              ),
            }),
          ],
        }),
      );
    }
  }

  return list;
}

//region Suggested section

const suggestedSection = h({ tag: "section-heading", attrs: { icon: "\u2728", label: "Suggested" } });

const suggestedContent = h({
  tag: "div",
  style: { display: "flex", flexDirection: "column", gap: "var(--gap)" },
  children: [
    h({
      tag: "div",
      class: "controls",
      children: [
        h({
          tag: "div",
          class: "control-group",
          children: [
            h({ tag: "h3", class: "subsection-heading", text: "My location" }),
            h({ tag: "p", class: "subsection-desc", text: "Suggesting tasks can be done near the location." }),
            h({
              tag: "div",
              class: "location-options",
              children: [
                h({
                  tag: "button",
                  class: "autodetect-toggle",
                  children: [
                    h({ tag: "span", text: "autodetect" }),
                    h({ tag: "toggle-switch", attrs: { on: "" } }),
                  ],
                }),
              ],
            }),
          ],
        }),
        h({
          tag: "div",
          class: "control-group",
          children: [
            h({ tag: "h3", class: "subsection-heading", text: "My focus" }),
            h({ tag: "p", class: "subsection-desc", text: "Additional instructions on which tasks to suggest." }),
            h({ tag: "focus-dropdown", attrs: { value: "Adulting tasks first" } }),
          ],
        }),
      ],
    }),
    pageData.suggestedTasks.length === 0
      ? h({ tag: "p", class: "empty", text: "No tasks yet." })
      : buildTaskList(pageData.suggestedTasks, pageData.blockedTasksByBlocker),
  ],
});

suggestedSection.append(suggestedContent);
app.append(suggestedSection);

//endregion Suggested section

app.append(h({ tag: "div", class: "divider" }));

//region All section

const allSection = h({ tag: "section-heading", attrs: { icon: "\u221E", label: "All" } });

const allContent = h({
  tag: "div",
  style: { display: "flex", flexDirection: "column", gap: "var(--gap)" },
  children: [
    pageData.allTasks.length === 0
      ? h({ tag: "p", class: "empty", text: "No tasks yet." })
      : buildTaskList(pageData.allTasks, pageData.blockedTasksByBlocker),
  ],
});

allSection.append(allContent);
app.append(allSection);

//endregion All section

//region New-task dialog -- FAB opens a modal <dialog> with task-detail in create mode

/** Blank task template used when creating a new task. */
const emptyTask: Task = {
  id: "",
  title: "",
  description: null,
  tags: [],
  locations: [],
  priority: null,
  dueDate: null,
  complexity: null,
  reminders: [],
  blockedBy: [],
  trackedTime: 0,
  timerStartedAt: null,
  status: "inbox",
  source: "local",
  sourceId: null,
  sourceMeta: null,
  createdAt: "",
  updatedAt: "",
};

const newTaskDialog = h({ tag: "dialog", class: "new-task-dialog" }) as HTMLDialogElement;
const newTaskDetail = document.createElement("task-detail") as TaskDetail;

newTaskDetail.addEventListener("action", ((event: CustomEvent) => {
  const { action, title, description } = event.detail as {
    action: string;
    title: string;
    description: string;
  };

  if (action === "close") {
    newTaskDialog.close();
    return;
  }

  if (action === "save") {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) return;

    const metadata = newTaskDetail.getMetadata();
    api("/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        title: trimmedTitle,
        description: description.length === 0 ? null : description,
        tags: metadata.tags,
        locations: metadata.locations,
        priority: metadata.priority,
        complexity: metadata.complexity,
      }),
    }).then(() => {
      window.location.reload();
    });
  }
}) as EventListener);

newTaskDialog.append(newTaskDetail);
document.body.append(newTaskDialog);

function openNewTaskDialog(): void {
  // Re-configure with a fresh empty task each time the dialog opens
  newTaskDetail.configure({ task: emptyTask, blockerSummaries: [], mode: "create" });
  newTaskDialog.showModal();

  requestAnimationFrame(() => {
    const titleInput = newTaskDetail.shadowRoot?.querySelector(".title-input") as HTMLInputElement | null;
    titleInput?.focus();
  });
}

document.body.append(
  h({
    tag: "fab-button",
    attrs: { label: "Add task" },
    on: { click: openNewTaskDialog },
  }),
);

//endregion New-task dialog
