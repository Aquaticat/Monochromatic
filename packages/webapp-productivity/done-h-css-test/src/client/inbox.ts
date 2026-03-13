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
 *
 * Exceeds 100 lines: the suggested and all section builders are deeply nested
 * `h()` call trees that close over `pageData` -- extracting them into separate
 * modules would require threading that binding through function parameters for
 * no structural gain.
 */
import type { BlockedTaskLink, Task } from "../lib/types.ts";
import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import { api } from "./lib/api.ts";
import { injectCSS } from "./lib/inject-css.ts";
import { readPageData } from "./lib/page-data.ts";
import { createTaskCard } from "./lib/task-card.ts";
import { globalStyles } from "./styles.ts";
import { inboxStyles } from "./inbox-styles.ts";
import { createNewTaskDialog } from "./new-task-dialog.ts";
// Side-effect imports: register custom elements so the browser recognizes them in the DOM
// oxlint-disable-next-line import/no-unassigned-import -- side-effect: register custom elements
import "./components/side-drawer.ts";
// oxlint-disable-next-line import/no-unassigned-import -- side-effect: register custom elements
import "./components/top-nav.ts";
// oxlint-disable-next-line import/no-unassigned-import -- side-effect: register custom elements
import "./components/section-heading.ts";
// oxlint-disable-next-line import/no-unassigned-import -- side-effect: register custom elements
import "./components/toggle-switch.ts";
// oxlint-disable-next-line import/no-unassigned-import -- side-effect: register custom elements
import "./components/focus-dropdown.ts";
// oxlint-disable-next-line import/no-unassigned-import -- side-effect: register custom elements
import "./components/fab-button.ts";

/** Shape of the JSON blob embedded in the inbox page by the server. */
type InboxPageData = {
  suggestedTasks: Task[];
  allTasks: Task[];
  blockedTasksByBlocker: Record<string, BlockedTaskLink[] | undefined>;
};

injectCSS(globalStyles);
injectCSS(inboxStyles);

const pageData = readPageData<InboxPageData>();
const appElement = document.querySelector("#app");
if (!(appElement instanceof HTMLElement)) {
  throw new Error("Missing app element");
}
const app = appElement;

/** Navigates to the task detail page for the given task. */
function openTask(taskId: string): void {
  globalThis.location.href = `/tasks/${taskId}`;
}

/** Sends a complete-task API call and reloads the page on success. */
async function completeTask(taskId: string): Promise<void> {
  await api(`/api/tasks/${taskId}/complete`, { method: "POST" });
  globalThis.location.reload();
}

/** Builds a task list with optional blocked-child nesting. */
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

const { panel: newTaskPanel, fab: newTaskFab } = createNewTaskDialog();
document.body.append(newTaskPanel);
document.body.append(newTaskFab);

//endregion New-task dialog
