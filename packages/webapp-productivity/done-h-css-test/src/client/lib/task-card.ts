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
 *
 * Exceeds 100 lines: the TaskCard class, its Shadow DOM styles, and helper
 * functions (`formatTrackedTime`, `buildChipTexts`) form a single cohesive
 * unit -- splitting the class from its styles or chip-building logic would
 * create circular or tightly-coupled imports for no readability gain.
 */
import type { Task } from "../../lib/types.ts";
import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import { $ as css } from "../css.ts";
import { cssRem, cssVar } from "@monochromatic-dev/module-es/h-css";
import { appearanceNone, flexCenter, flexRow, focusOutline, scrollRow, whitespaceNowrap, flexColumn } from "../mixins.ts";

/** Configuration for a `<task-card>` instance, passed via `createTaskCard`. */
type TaskCardOptions = {
  /** Whether to show a red "blocked" badge chip. */
  showBlockedBadge?: boolean;
  /** Callback when the card body is clicked (navigates to task detail). */
  onOpen: (taskId: string) => void;
  /** Callback when the checkbox is clicked (completes the task). */
  onToggleComplete?: (taskId: string) => Promise<void>;
};

/**
 * Formats a duration in seconds as a human-readable string (e.g. "1h30min15s").
 *
 * @param seconds - Non-negative duration in seconds
 */
function formatTrackedTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
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

const TASK_CARD_STYLES = [
  css({
    rule: ':host',
    decls: { ...flexColumn(), gap: cssVar('min-gap'), 'background-color': cssVar('bg'), 'overflow-x': 'hidden', 'overflow-y': 'hidden', cursor: 'pointer' },
  }),
  css({
    rule: '.row',
    decls: { ...flexRow(), gap: cssVar('min-gap'), 'align-items': 'flex-start' },
  }),
  css({
    rule: '.checkbox',
    decls: { ...appearanceNone(), ...flexCenter(), 'inline-size': cssRem(2), 'block-size': cssRem(2) },
    children: [
      css({ rule: '&:focus-visible', decls: focusOutline() }),
    ],
  }),
  css({
    rule: '.checkbox-box',
    decls: {
      'inline-size': cssRem(1.75),
      'block-size': cssRem(1.75),
      'border-width': cssRem(0.25),
      'border-style': 'solid',
      'border-color': cssVar('fg'),
    },
  }),
  css({
    rule: '.title',
    decls: { 'font-size': cssRem(1.25), 'font-weight': 400, 'line-height': 'normal', 'flex-grow': 1, 'min-inline-size': 0 },
  }),
  css({
    rule: '.chips',
    decls: scrollRow(),
  }),
  css({ rule: '.chips::-webkit-scrollbar', decls: { display: 'none' } }),
  css({
    rule: '.chip',
    decls: { ...flexRow(), ...whitespaceNowrap(), gap: cssRem(0.25), 'font-size': cssRem(1), 'line-height': 1.5 },
  }),
  css({
    rule: '.chip.blocked',
    decls: { 'border-color': cssVar('red-fg'), color: cssVar('red-fg') },
  }),
].join('');

/**
 * Collects all metadata chip labels for a task (tags, tracked time, location, etc.).
 * Each entry becomes a `<span class="chip">` in the card's shadow DOM.
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
    chips.push(`blockedBy: ${task.blockedBy.length}`);
  } else {
    chips.push("blockedBy: none");
  }

  return chips;
}

/**
 * `<task-card>` -- displays a task as a clickable card with checkbox, title, and metadata chips.
 * Created programmatically via `createTaskCard()`, not placed in server HTML.
 */
class TaskCard extends HTMLElement {
  #shadow: ShadowRoot;
  #task: Task | null = null;
  #options: TaskCardOptions | null = null;

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
   */
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

/**
 * Factory: creates and configures a `<task-card>` element ready for DOM insertion.
 *
 * @param task - Task data to display
 *
 * @param options - Callbacks for open/complete interactions
 */
export function createTaskCard(task: Task, options: TaskCardOptions): TaskCard {
  const card = document.createElement("task-card") as TaskCard;
  card.configure(task, options);
  return card;
}

/**
 * Formats tracked time including elapsed seconds from a running timer.
 * If no timer is active, returns the static `trackedTime` formatted.
 */
export function formatRunningTrackedTime(task: Task): string {
  if (task.timerStartedAt === null) {
    return formatTrackedTime(task.trackedTime);
  }

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - Date.parse(task.timerStartedAt)) / 1_000));
  return formatTrackedTime(task.trackedTime + elapsedSeconds);
}
