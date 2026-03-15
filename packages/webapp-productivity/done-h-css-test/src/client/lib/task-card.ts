/**
 * `<task-card>` web component and its factory function `createTaskCard()`.
 *
 * Unlike other web components that live in `components/`, task-card is in `lib/`
 * because it's always created programmatically (never placed in server HTML).
 */
import {
  $ as h,
} from '@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts';
import type { Task, } from '../../lib/types.ts';
import type { TaskCardOptions, } from './task-card-helpers.ts';
import {
  buildChipTexts,
  formatTrackedTime,
} from './task-card-helpers.ts';
import { TASK_CARD_STYLES, } from './task-card-styles.ts';

/**
 * `<task-card>` -- displays a task as a clickable card with checkbox, title, and metadata chips.
 * Created programmatically via `createTaskCard()`, not placed in server HTML.
 */
class TaskCard extends HTMLElement {
  /** Shadow root for encapsulated rendering. */
  #shadow: ShadowRoot;

  /** Task data to display, set via `configure()`. */
  #task: Task | null = null;

  /** Interaction callbacks and display flags, set via `configure()`. */
  #options: TaskCardOptions | null = null;

  /** Initializes the shadow root. */
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
  configure(task: Task, options: TaskCardOptions,): void {
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
  getChipElement(prefix: string,): HTMLSpanElement | null {
    for (const chip of this.#shadow.querySelectorAll<HTMLSpanElement>('.chip',)) {
      if (chip.textContent.startsWith(prefix,))
        return chip;
    }
    return null;
  }

  /** Renders the card content (checkbox, title, chips) into the shadow root. */
  #render(): void {
    const task = this.#task;
    const options = this.#options;
    if (task === null || options === null)
      return;

    const chipTexts = buildChipTexts(task,);
    const chipElements: HTMLElement[] = chipTexts.map(function toChipElement(text,) {
      return h({ tag: 'span', class: 'chip', text, },);
    },);
    if (options.showBlockedBadge === true)
      chipElements.push(h({ tag: 'span', class: 'chip blocked', text: 'blocked', },),);

    this.#shadow.replaceChildren(
      h({ tag: 'style', text: TASK_CARD_STYLES, },),
      h({
        tag: 'div',
        class: 'row',
        children: [
          h({
            tag: 'button',
            class: 'checkbox',
            attrs: { title: 'Complete task', },
            children: [h({ tag: 'span', class: 'checkbox-box', },),],
            on: {
              click: async function handleCheckboxClick(event,) {
                event.stopPropagation();
                if (options.onToggleComplete !== undefined)
                  await options.onToggleComplete(task.id,);
              },
            },
          },),
          h({ tag: 'span', class: 'title', text: task.title, },),
        ],
        on: {
          click: function handleCardClick() {
            options.onOpen(task.id,);
          },
        },
      },),
      h({ tag: 'div', class: 'chips', children: chipElements, },),
    );
  }
}

customElements.define('task-card', TaskCard,);

/**
 * Factory: creates and configures a `<task-card>` element ready for DOM insertion.
 *
 * @param task - Task data to display
 *
 * @param options - Callbacks for open/complete interactions
 */
export function createTaskCard(task: Task, options: TaskCardOptions,): TaskCard {
  const card = document.createElement('task-card',) as TaskCard;
  card.configure(task, options,);
  return card;
}

/**
 * Formats tracked time including elapsed seconds from a running timer.
 * If no timer is active, returns the static `trackedTime` formatted.
 *
 * @param task - Task with optional running timer
 */
export function formatRunningTrackedTime(task: Task,): string {
  if (task.timerStartedAt === null)
    return formatTrackedTime(task.trackedTime,);

  const elapsedSeconds = Math.max(0,
    Math.floor((Date.now() - Date.parse(task.timerStartedAt,)) / 1_000,),);
  return formatTrackedTime(task.trackedTime + elapsedSeconds,);
}
