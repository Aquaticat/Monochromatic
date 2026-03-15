/**
 * `\<task-card\>` web component and its factory function `createTaskCard()`.
 *
 * Unlike other web components that live in `components/`, task-card is in `lib/`
 * because it's always created programmatically (never placed in server HTML).
 * Client entry scripts call `createTaskCard(task, options)` which creates the
 * element, calls `configure()` to pass data, and returns it for appending to the DOM.
 */
import type { Task } from "../../lib/types.ts";
import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import { formatRunningTrackedTime } from "./format-tracked-time.ts";
import { TASK_CARD_STYLES } from "./task-card-styles.ts";

export { formatRunningTrackedTime } from "./format-tracked-time.ts";

/** Configuration for a `\<task-card\>` instance, passed via `createTaskCard`. */
type TaskCardOptions = {
  /** Whether to show a red "blocked" badge chip. */
  showBlockedBadge?: boolean;
  /** Callback when the card body is clicked (navigates to task detail). */
  onOpen: (taskId: string) => void;
  /** Callback when the checkbox is clicked (completes the task). */
  onToggleComplete?: (taskId: string) => Promise<void>;
};

/**
 * Collects all metadata chip labels for a task.
 *
 * @param task - Task whose metadata to extract
 *
 * @returns Array of chip label strings
 */
function buildChipTexts(task: Task): string[] {
  const chips: string[] = [];
  if (task.tags.length > 0) chips.push(`# ${task.tags.join(", ")}`);
  chips.push(`tracked: ${formatRunningTrackedTime(task)}`);
  if (task.locations.length > 0) chips.push(`where: ${task.locations.join(", ")}`);
  if (task.priority !== null) chips.push(`priority: ${task.priority}`);
  if (task.dueDate !== null) chips.push(`due: ${task.dueDate}`);
  if (task.complexity !== null) chips.push(`complexity: ${task.complexity}`);
  if (task.reminders.length > 0) chips.push(`reminders: ${task.reminders[0]}`);
  if (task.blockedBy.length > 0) { chips.push(`blockedBy: ${String(task.blockedBy.length)}`); } else { chips.push("blockedBy: none"); }
  return chips;
}

/** `\<task-card\>` -- displays a task as a clickable card with checkbox, title, and metadata chips. */
class TaskCard extends HTMLElement {
  /** Shadow root for encapsulated rendering. */
  #shadow: ShadowRoot;

  /** Currently displayed task, or null before configuration. */
  #task: Task | null = null;

  /** Current rendering options, or null before configuration. */
  #options: TaskCardOptions | null = null;

  /** Initializes the shadow root for encapsulated rendering. */
  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  /**
   * Sets the task data and rendering options, then triggers a full render.
   *
   * @param task - Task to display
   *
   * @param options - Callbacks and display flags
   */
  configure(task: Task, options: TaskCardOptions): void {
    this.#task = task;
    this.#options = options;
    this.#render();
  }

  /**
   * Finds a chip element whose text starts with the given prefix.
   *
   * @param prefix - Text prefix to match (e.g. `"tracked:"`)
   *
   * @returns Matching chip element, or null if not found
   */
  getChipElement(prefix: string): HTMLSpanElement | null {
    for (const chip of this.#shadow.querySelectorAll<HTMLSpanElement>(".chip")) {
      if (chip.textContent.startsWith(prefix)) {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- querySelectorAll(".chip") returns span elements
        return chip as HTMLSpanElement;
      }
    }
    return null;
  }

  /** Renders the full card content into the shadow root. */
  #render(): void {
    const task = this.#task;
    const options = this.#options;
    if (task === null || options === null) return;

    const chipElements: HTMLElement[] = buildChipTexts(task).map(function createChip(text): HTMLElement {
      return h({ tag: "span", class: "chip", text });
    });
    if (options.showBlockedBadge === true) {
      chipElements.push(h({ tag: "span", class: "chip blocked", text: "blocked" }));
    }

    this.#shadow.replaceChildren(
      h({ tag: "style", text: TASK_CARD_STYLES }),
      h({
        tag: "div",
        class: "row",
        children: [
          h({
            tag: "button",
            class: "checkbox",
            attrs: { title: "Complete task" },
            children: [h({ tag: "span", class: "checkbox-box" })],
            on: {
              // oxlint-disable-next-line typescript/no-misused-promises -- DOM event handler
              click: async function onCheckboxClick(event): Promise<void> {
                event.stopPropagation();
                if (options.onToggleComplete !== undefined) {
                  await options.onToggleComplete(task.id);
                }
              },
            },
          }),
          h({ tag: "span", class: "title", text: task.title }),
        ],
        on: { click: function onRowClick(): void { options.onOpen(task.id); } },
      }),
      h({ tag: "div", class: "chips", children: chipElements }),
    );
  }
}

customElements.define("task-card", TaskCard);

/**
 * Factory: creates and configures a `\<task-card\>` element.
 *
 * @param task - Task data to display
 *
 * @param options - Callbacks for open/complete interactions
 *
 * @returns Configured TaskCard element
 */
export function createTaskCard(task: Task, options: TaskCardOptions): TaskCard {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- custom element registered as "task-card"
  const card = document.createElement("task-card") as TaskCard;
  card.configure(task, options);
  return card;
}
