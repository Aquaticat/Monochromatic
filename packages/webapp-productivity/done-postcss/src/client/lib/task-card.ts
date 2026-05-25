/**
 * `\<task-card\>` web component and its factory function `createTaskCard()`.
 *
 * Unlike other web components that live in `components/`, task-card is in `lib/`
 * because it's always created programmatically (never placed in server HTML).
 * Client entry scripts call `createTaskCard(task, options)` which creates the
 * element, calls `configure()` to pass data, and returns it for appending to the DOM.
 */
import type { Task, } from '../../lib/types.ts';
import {
  renderTaskCardContent,
  type TaskCardOptions,
} from './task-card-render.ts';

export { formatRunningTrackedTime, } from './format-tracked-time.ts';

/** `\<task-card\>` -- displays a task as a clickable card with checkbox, title, and metadata chips. */
class TaskCard extends HTMLElement {
  /** Shadow root for encapsulated rendering. */
  readonly #shadow: ShadowRoot;

  /** Currently displayed task, or null before configuration. */
  #task: Task | null = null;

  /** Current rendering options, or null before configuration. */
  #options: TaskCardOptions | null = null;

  /** Initializes the shadow root for encapsulated rendering. */
  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open', },);
  }

  /**
   * Sets the task data and rendering options, then triggers a full render.
   *
   * @param task - Task to display
   *
   * @param options - Callbacks and display flags
   */
  configure(
    task: Task,
    options: TaskCardOptions,
  ): void {
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
  getChipElement(prefix: string,): HTMLSpanElement | null {
    for (const chip of this.#shadow
      .querySelectorAll<HTMLSpanElement>('.chip',)) {
      if (chip.textContent
        .startsWith(prefix,)) {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- querySelectorAll(".chip") returns span elements
        return chip as HTMLSpanElement;
      }
    }
    return null;
  }

  /** Renders the full card content into the shadow root. */
  #render(): void {
    /** Local snapshot used for the null guard and the renderer call below. */
    const task = this.#task;
    /** Local snapshot used for the null guard and the renderer call below. */
    const options = this.#options;
    if ((task === null) || (options === null))
      return;
    renderTaskCardContent({
      shadow: this.#shadow,
      task,
      options,
    },);
  }
}

customElements.define(
  'task-card',
  TaskCard,
);

/**
 * Factory: creates and configures a `\<task-card\>` element.
 *
 * @param task - Task data to display
 *
 * @param options - Callbacks for open/complete interactions
 *
 * @returns Configured TaskCard element
 *
 * @example
 * ```ts
 * const card = createTaskCard({ task, options: { onOpen: openTask, onToggleComplete: completeTask } });
 * list.append(card);
 * ```
 */
export function createTaskCard(
  {
    task,
    options,
  }: {
    task: Task;
    options: TaskCardOptions;
  },
): TaskCard {
  /* oxlint-disable typescript/no-unsafe-type-assertion -- custom element registered as "task-card" */
  /** Configured custom element returned to the caller for DOM insertion. */
  const card = document.createElement('task-card',) as TaskCard;
  /* oxlint-enable typescript/no-unsafe-type-assertion */
  card.configure(
    task,
    options,
  );
  return card;
}
