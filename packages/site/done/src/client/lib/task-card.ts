/**
 * `<task-card>` web component and its factory function `createTaskCard()`.
 *
 * Unlike other web components that live in `components/`, task-card is in `lib/`
 * because it's always created programmatically (never placed in server HTML).
 * Client entry scripts call `createTaskCard(task, options)` which creates the
 * element, calls `configure()` to pass data, and returns it for appending to the DOM.
 *
 * The `css()` call below expands \@apply rules at runtime (see css.ts) --
 * `\@apply --flex-column` etc. are replaced with the actual mixin CSS.
 */
import type { Task } from "../../lib/types.ts";
import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import { css } from "../css.ts";

type TaskCardOptions = {
  showBlockedBadge?: boolean;
  onOpen: (taskId: string) => void;
  onToggleComplete?: (taskId: string) => Promise<void>;
};

function formatTrackedTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    const dayHours = Math.floor(hours / 24);
    const remainHours = hours % 24;
    if (dayHours > 0) {
      return `${dayHours}d${remainHours}h${minutes}min${remainingSeconds}s`;
    }
    return `${hours}h${minutes}min${remainingSeconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}min${remainingSeconds}s`;
  }

  return `${totalSeconds}s`;
}

const TASK_CARD_STYLES = css(`
  :host {
    @apply --flex-column;
    gap: var(--min-gap);
    background-color: var(--bg);
    overflow: hidden;
    cursor: pointer;
  }
  .row {
    @apply --flex-row;
    gap: var(--min-gap);
    align-items: flex-start;
  }
  .checkbox {
    @apply --appearance-none;
    @apply --flex-center;
    inline-size: 2rem;
    block-size: 2rem;
  }
  .checkbox:focus-visible {
    outline-width: 0.125rem;
    outline-style: solid;
    outline-color: var(--fg);
    outline-offset: 0.125rem;
  }
  .checkbox-box {
    inline-size: 1.75rem;
    block-size: 1.75rem;
    border-width: 0.25rem;
    border-style: solid;
    border-color: var(--fg);
  }
  .title {
    font-size: 1.25rem;
    font-weight: 400;
    line-height: normal;
    flex: 1;
    min-inline-size: 0;
  }
  .chips {
    @apply --scroll-row;
  }
  .chips::-webkit-scrollbar { display: none; }
  .chip {
    @apply --flex-row;
    @apply --whitespace-nowrap;
    gap: 0.25rem;
    font-size: 1rem;
    line-height: 1.5;
  }
  .chip.blocked {
    border-color: var(--red-fg);
    color: var(--red-fg);
  }
`);

/** Collects all metadata chips for a task */
function buildChipTexts(task: Task): string[] {
  const chips: string[] = [];

  if (task.tags.length > 0) {
    chips.push(`# ${task.tags.join(", ")}`);
  }
  chips.push(`tracked: ${formatTrackedTime(task.trackedTime)}`);
  if (task.locations.length > 0) {
    chips.push(`where: ${task.locations.join(", ")}`);
  }
  if (task.priority !== null) {
    chips.push(`priority: ${task.priority}`);
  }
  if (task.dueDate !== null) {
    chips.push(`due: ${task.dueDate}`);
  }
  if (task.complexity !== null) {
    chips.push(`complexity: ${task.complexity}`);
  }
  if (task.reminders.length > 0) {
    chips.push(`reminders: ${task.reminders[0]}`);
  }
  if (task.blockedBy.length > 0) {
    chips.push(`blockedBy: ${task.blockedBy.length}`);
  } else {
    chips.push("blockedBy: none");
  }

  return chips;
}

class TaskCard extends HTMLElement {
  #shadow: ShadowRoot;
  #task: Task | null = null;
  #options: TaskCardOptions | null = null;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  configure(task: Task, options: TaskCardOptions): void {
    this.#task = task;
    this.#options = options;
    this.#render();
  }

  getChipElement(prefix: string): HTMLSpanElement | null {
    for (const chip of this.#shadow.querySelectorAll(".chip")) {
      if (chip.textContent?.startsWith(prefix)) {
        return chip as HTMLSpanElement;
      }
    }
    return null;
  }

  #render(): void {
    const task = this.#task;
    const options = this.#options;
    if (task === null || options === null) return;

    const chipTexts = buildChipTexts(task);
    const chipElements: HTMLElement[] = chipTexts.map((text) => h({ tag: "span", class: "chip", text }));
    if (options.showBlockedBadge === true) {
      chipElements.push(h({ tag: "span", class: "chip blocked", text: "blocked" }));
    }

    const styleEl = h({ tag: "style", text: TASK_CARD_STYLES });

    const row = h({
      tag: "div",
      class: "row",
      children: [
        h({
          tag: "button",
          class: "checkbox",
          attrs: { title: "Complete task" },
          children: [h({ tag: "span", class: "checkbox-box" })],
          on: {
            click: async (event) => {
              event.stopPropagation();
              if (options.onToggleComplete !== undefined) {
                await options.onToggleComplete(task.id);
              }
            },
          },
        }),
        h({ tag: "span", class: "title", text: task.title }),
      ],
      on: {
        click: () => {
          options.onOpen(task.id);
        },
      },
    });

    const chips = h({ tag: "div", class: "chips", children: chipElements });

    this.#shadow.replaceChildren(styleEl, row, chips);
  }
}

customElements.define("task-card", TaskCard);

export function createTaskCard(task: Task, options: TaskCardOptions): TaskCard {
  const card = document.createElement("task-card") as TaskCard;
  card.configure(task, options);
  return card;
}

export function formatRunningTrackedTime(task: Task): string {
  if (task.timerStartedAt === null) {
    return formatTrackedTime(task.trackedTime);
  }

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - Date.parse(task.timerStartedAt)) / 1000));
  return formatTrackedTime(task.trackedTime + elapsedSeconds);
}
