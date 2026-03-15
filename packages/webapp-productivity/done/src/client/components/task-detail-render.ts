/**
 * Render function for the `\<task-detail\>` Shadow DOM tree.
 *
 * Builds the complete layout: header with close/save buttons, title input,
 * description textarea, attach/photo actions, pills container, and
 * start/stop/complete/delete buttons.
 */
import type { Task } from "../../lib/types.ts";
import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import type { TaskDetailMode } from "./task-detail-types.ts";
import { TASK_DETAIL_STYLES } from "./task-detail-styles.ts";

/** References to interactive elements needed by the caller after render. */
export type RenderResult = {
  /** Title input for wiring autofill. */
  titleInput: HTMLInputElement;
  /** Description textarea for reading on save. */
  descInput: HTMLTextAreaElement;
};

/**
 * Builds the full task-detail Shadow DOM content.
 *
 * @param shadow - Shadow root to render into
 *
 * @param task - Task data to display
 *
 * @param mode - "create" or "edit" display mode
 *
 * @param host - Host element for dispatching custom events
 *
 * @returns References to title and description inputs
 */
export function renderTaskDetail(
  { shadow, task, mode, host }: {
    shadow: ShadowRoot;
    task: Task;
    mode: TaskDetailMode;
    host: HTMLElement;
  },
): RenderResult {
  const isCreate = mode === "create";

  // Close button uses innerHTML for SVG because h() creates HTML-namespace
  // elements -- SVG requires the SVG namespace.
  const closeButton = h({
    tag: "button",
    class: "close",
    attrs: { "data-action": "close", "aria-label": "Close" },
  });
  closeButton.innerHTML = `<svg viewBox="0 0 48 48" fill="none"><line x1="14" y1="14" x2="34" y2="34"/><line x1="34" y1="14" x2="14" y2="34"/></svg>`;

  const titleInput = h({
    tag: "input",
    class: "title-input",
    attrs: { type: "text", value: task.title, placeholder: "Title", required: "" },
  });

  const descInput = h({ tag: "textarea", class: "desc-input", attrs: { placeholder: "description" } });
  if (task.description !== null) {
    descInput.textContent = task.description;
  }

  const startAttrs: Record<string, string> = { "data-action": "start" };
  if (task.timerStartedAt !== null) startAttrs["disabled"] = "";
  const stopAttrs: Record<string, string> = { "data-action": "stop" };
  if (task.timerStartedAt === null) stopAttrs["disabled"] = "";
  const completeAttrs: Record<string, string> = { "data-action": "complete" };
  if (task.blockedBy.length > 0) completeAttrs["disabled"] = "";

  const btnRow = h({
    tag: "div",
    class: "btn-row",
    children: [
      h({ tag: "button", class: "btn-outline", attrs: startAttrs, text: "Start" }),
      h({ tag: "button", class: "btn-outline", attrs: stopAttrs, text: "Stop" }),
      h({ tag: "button", class: "btn-primary", attrs: completeAttrs, text: "Complete" }),
      h({ tag: "button", class: "btn-outline", attrs: { "data-action": "delete" }, text: "Delete" }),
    ],
  });
  if (isCreate) btnRow.dataset["hidden"] = "";

  shadow.replaceChildren(
    h({ tag: "style", text: TASK_DETAIL_STYLES }),
    h({
      tag: "div",
      class: "header",
      children: [
        closeButton,
        h({ tag: "span", class: "heading", text: isCreate ? "New task" : "Task details" }),
        h({
          tag: "button",
          class: isCreate ? "btn-primary" : "btn-outline",
          attrs: { "data-action": "save" },
          text: isCreate ? "Create" : "Save",
        }),
      ],
    }),
    titleInput,
    descInput,
    h({
      tag: "div",
      class: "actions",
      children: [
        h({ tag: "button", class: "btn-outline", attrs: { "data-action": "attach" }, text: "Attach file" }),
        h({ tag: "button", class: "btn-outline", attrs: { "data-action": "photo" }, text: "Take photo" }),
      ],
    }),
    h({ tag: "div", class: "pills" }),
    btnRow,
  );

  shadow.addEventListener("click", function onAction(event): void {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- event.target is always an Element in shadow DOM click handlers
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLElement>("[data-action]");
    if (button === null) return;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- closest returns HTMLElement with dataset
    const {action} = (button as HTMLElement).dataset;

    host.dispatchEvent(new CustomEvent("action", {
      bubbles: true,
      detail: {
        action,
        title: titleInput.value,
        description: descInput.value,
      },
    }));
  });

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- h() created these elements with the correct tag
  return { titleInput: titleInput as HTMLInputElement, descInput: descInput as HTMLTextAreaElement };
}
