/**
 * `\<task-card\>` web component and its factory function `createTaskCard()`.
 *
 * Unlike other web components that live in `components/`, task-card is in `lib/`
 * because it's always created programmatically (never placed in server HTML).
 * Client entry scripts call `createTaskCard(task, options)` which creates the
 * element, calls `configure()` to pass data, and returns it for appending to the DOM.
 *
 * The `css()` call below expands \@apply rules at runtime (see css.ts) --
 * `\@apply --flex-column` etc. are replaced with the actual mixin CSS.
 *
 * Exceeds 100 lines: the TaskCard class, its Shadow DOM styles, and helper
 * functions (`formatTrackedTime`, `buildChipTexts`) form a single cohesive
 * unit -- splitting the class from its styles or chip-building logic would
 * create circular or tightly-coupled imports for no readability gain.
 */
import type { Task } from "../../lib/types.ts";
import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import { css } from "../css.ts";

/** Configuration for a `\<task-card\>` instance, passed via `createTaskCard`. */
type TaskCardOptions = {
  /** Whether to show a red "blocked" badge chip. */
  showBlockedBadge?: boolean;
  /** Callback when the card body is clicked (navigates to task detail). */
  onOpen: (taskId: string) => void;
  /** Callback when the checkbox is clicked (completes the task). */
  onToggleComplete?: (taskId: string) => Promise<void>;
};

/** Seconds per minute. */
const SECONDS_PER_MINUTE = 60;

/** Seconds per hour. */
const SECONDS_PER_HOUR = 3_600;

/** Hours per day. */
const HOURS_PER_DAY = 24;

/** Milliseconds per second. */
const MS_PER_SECOND = 1_000;

/**
 * Formats a duration in seconds as a human-readable string (e.g. "1h30min15s").
 *
 * @param seconds - Non-negative duration in seconds
 *
 * @returns Formatted duration string
 */
function formatTrackedTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const remainingSeconds = totalSeconds % SECONDS_PER_MINUTE;

  if (hours > 0) {
    const dayHours = Math.floor(hours / HOURS_PER_DAY);
    const remainHours = hours % HOURS_PER_DAY;
    if (dayHours > 0) {
      return `${String(dayHours)}d${String(remainHours)}h${String(minutes)}min${String(remainingSeconds)}s`;
    }
    return `${String(hours)}h${String(minutes)}min${String(remainingSeconds)}s`;
  }

  if (minutes > 0) {
    return `${String(minutes)}min${String(remainingSeconds)}s`;
  }

  return `${String(totalSeconds)}s`;
}

/** Shadow DOM styles for the `\<task-card\>` component. */
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

/**
 * Collects all metadata chip labels for a task (tags, tracked time, location, etc.).
 * Each entry becomes a `\<span class="chip"\>` in the card's shadow DOM.
 *
 * @param task - Task whose metadata to extract
 *
 * @returns Array of chip label strings
 */
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
    chips.push(`blockedBy: ${String(task.blockedBy.length)}`);
  } else {
    chips.push("blockedBy: none");
  }

  return chips;
}

/**
 * `\<task-card\>` -- displays a task as a clickable card with checkbox, title, and metadata chips.
 * Created programmatically via `createTaskCard()`, not placed in server HTML.
 */
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
   * Used by the in-progress timer to update the "tracked:" chip live.
   *
   * @param prefix - Text prefix to match (e.g. `"tracked:"`)
   *
   * @returns Matching chip element, or null if not found
   */
  getChipElement(prefix: string): HTMLSpanElement | null {
    for (const chip of this.#shadow.querySelectorAll(".chip")) {
      if (chip.textContent !== null && chip.textContent !== undefined && chip.textContent.startsWith(prefix)) {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- querySelectorAll(".chip") returns span elements created by buildChipTexts
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

    const chipTexts = buildChipTexts(task);
    const chipElements: HTMLElement[] = chipTexts.map(function createChip(text) {
      return h({ tag: "span", class: "chip", text });
    });
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
            // oxlint-disable-next-line typescript/no-misused-promises -- DOM event handler; fire-and-forget async
            click: async function onCheckboxClick(event) {
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
        click: function onRowClick() {
          options.onOpen(task.id);
        },
      },
    });

    const chips = h({ tag: "div", class: "chips", children: chipElements });

    this.#shadow.replaceChildren(styleEl, row, chips);
  }
}

customElements.define("task-card", TaskCard);

/**
 * Factory: creates and configures a `\<task-card\>` element ready for DOM insertion.
 *
 * @param task - Task data to display
 *
 * @param options - Callbacks for open/complete interactions
 *
 * @returns Configured TaskCard element
 */
export function createTaskCard(task: Task, options: TaskCardOptions): TaskCard {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- custom element registered as "task-card" returns TaskCard
  const card = document.createElement("task-card") as TaskCard;
  card.configure(task, options);
  return card;
}

/**
 * Formats tracked time including elapsed seconds from a running timer.
 * If no timer is active, returns the static `trackedTime` formatted.
 *
 * @param task - Task with optional running timer
 *
 * @returns Formatted duration string
 */
export function formatRunningTrackedTime(task: Task): string {
  if (task.timerStartedAt === null) {
    return formatTrackedTime(task.trackedTime);
  }

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - Date.parse(task.timerStartedAt)) / MS_PER_SECOND));
  return formatTrackedTime(task.trackedTime + elapsedSeconds);
}
