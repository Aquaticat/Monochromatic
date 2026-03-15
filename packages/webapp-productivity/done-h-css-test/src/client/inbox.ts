/**
 * Client entry script for the Inbox page.
 *
 * Loaded by the browser as `<script type="module" src="/dist/client/inbox.js">`.
 */
import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import { api } from "./lib/api.ts";
import { injectCSS } from "./lib/inject-css.ts";
import { readPageData } from "./lib/page-data.ts";
import { globalStyles } from "./styles.ts";
import { inboxStyles } from "./inbox-styles.ts";
import { createNewTaskDialog } from "./new-task-dialog.ts";
import type { InboxPageData } from "./inbox-builders.ts";
import { buildTaskList } from "./inbox-builders.ts";
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

injectCSS(globalStyles);
injectCSS(inboxStyles);

/** Deserialized page data containing suggested and all inbox tasks. */
const pageData = readPageData<InboxPageData>();

/** Raw DOM element for the `#app` container. */
const appElement = document.querySelector<HTMLElement>("#app");
if (!(appElement instanceof HTMLElement)) {
  throw new Error("Missing app element");
}

/** Validated `#app` container element. */
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

//region Suggested section

/** Collapsible section heading for the suggested tasks block. */
const suggestedSection = h({ tag: "section-heading", attrs: { icon: "\u2728", label: "Suggested" } });

/** Content container for the suggested tasks section. */
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
      : buildTaskList({ tasks: pageData.suggestedTasks, blockedTasksByBlocker: pageData.blockedTasksByBlocker, onOpen: openTask, onToggleComplete: completeTask }),
  ],
});

suggestedSection.append(suggestedContent);
app.append(suggestedSection);

//endregion Suggested section

app.append(h({ tag: "div", class: "divider" }));

//region All section

/** Collapsible section heading for the "All" tasks block. */
const allSection = h({ tag: "section-heading", attrs: { icon: "\u221E", label: "All" } });

/** Content container for the all tasks section. */
const allContent = h({
  tag: "div",
  style: { display: "flex", flexDirection: "column", gap: "var(--gap)" },
  children: [
    pageData.allTasks.length === 0
      ? h({ tag: "p", class: "empty", text: "No tasks yet." })
      : buildTaskList({ tasks: pageData.allTasks, blockedTasksByBlocker: pageData.blockedTasksByBlocker, onOpen: openTask, onToggleComplete: completeTask }),
  ],
});

allSection.append(allContent);
app.append(allSection);

//endregion All section

//region New-task dialog -- FAB opens a modal <dialog> with task-detail in create mode

/** New-task dialog panel and trigger FAB button. */
const { panel: newTaskPanel, fab: newTaskFab } = createNewTaskDialog();
document.body.append(newTaskPanel);
document.body.append(newTaskFab);

//endregion New-task dialog
