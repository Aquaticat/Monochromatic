/**
 * `\<task-detail\>` -- full-page task editor with title, description, metadata pills,
 * action buttons (start/stop/complete/delete), and debounced AI autofill.
 */
import type {
  TaskComplexity,
  TaskPriority,
} from '../../lib/types.ts';
import { AutofillController, } from './task-detail-autofill.ts';
import {
  buildPillData,
  buildPillElements,
} from './task-detail-pills.ts';
import { renderTaskDetail, } from './task-detail-render.ts';
import type {
  TaskDetailData,
  TaskDetailMode,
} from './task-detail-types.ts';

/**
 * `\<task-detail\>` web component for viewing and editing a single task.
 */
class TaskDetail extends HTMLElement {
  /** Shadow root for encapsulated rendering. */
  #shadow: ShadowRoot;

  /** Current task configuration data. */
  #data: TaskDetailData | null = null;

  /** Current display mode. */
  #mode: TaskDetailMode = 'edit';

  /** Mutable metadata state. */
  #tags: string[] = [];

  /** Mutable locations state. */
  #locations: string[] = [];

  /** Mutable priority state. */
  #priority: TaskPriority | null = null;

  /** Mutable complexity state. */
  #complexity: TaskComplexity | null = null;

  /** Autofill controller managing debounced AI requests. */
  #autofill: AutofillController;

  /** Initializes the shadow root and autofill controller. */
  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open', },);
    this.#autofill = new AutofillController({
      getState: function getState(): { tags: string[]; locations: string[];
        priority: string | null; complexity: string | null; }
      {
        return { tags: this.#tags, locations: this.#locations, priority: this.#priority,
          complexity: this.#complexity, };
      }
        .bind(this,),
      setState: function setState(update,): void {
        if (update.tags !== undefined)
          this.#tags = update.tags as string[];
        if (update.locations !== undefined)
          this.#locations = update.locations as string[];
        if (update.priority !== undefined)
          this.#priority = update.priority as TaskPriority | null;
        if (update.complexity !== undefined)
          this.#complexity = update.complexity as TaskComplexity | null;
      }
        .bind(this,),
      updateDisplay: function updateDisplay(): void {
        this.#updatePillsDisplay();
      }
        .bind(this,),
    },);
  }

  /**
   * Sets task data, resets metadata state, and triggers a full render.
   *
   * @param data - Task data and configuration
   */
  configure(data: TaskDetailData,): void {
    console.log('[task-detail] configure() called, mode:', data.mode ?? 'edit',);
    this.#data = data;
    this.#mode = data.mode ?? 'edit';
    this.#tags = [...data.task.tags,];
    this.#locations = [...data.task.locations,];
    this.#priority = data.task.priority;
    this.#complexity = data.task.complexity;
    this.#autofill.autofilled.clear();
    this.#render();
  }

  /**
   * Returns the current metadata state for save payloads.
   *
   * @returns Current metadata values
   */
  getMetadata(): { tags: string[]; locations: string[]; priority: TaskPriority | null;
    complexity: TaskComplexity | null; }
  {
    return { tags: this.#tags, locations: this.#locations, priority: this.#priority,
      complexity: this.#complexity, };
  }

  /** Rebuilds pill elements from current metadata state. */
  #updatePillsDisplay(): void {
    const pillsContainer = this.#shadow.querySelector<HTMLElement>('.pills',);
    if (pillsContainer === null)
      return;
    const task = this.#data?.task;
    if (task === undefined)
      return;

    const pills = buildPillData({ task, tags: this.#tags, locations: this.#locations,
      priority: this.#priority, complexity: this.#complexity, },);
    pillsContainer.replaceChildren(
      ...buildPillElements({ pills, loading: this.#autofill.loading,
        autofilled: this.#autofill.autofilled, },),
    );
  }

  /** Delegates to renderTaskDetail and wires autofill on title input. */
  #render(): void {
    const data = this.#data;
    if (data === null)
      return;
    const { titleInput, } = renderTaskDetail({ shadow: this.#shadow, task: data.task,
      mode: this.#mode, host: this, },);
    this.#updatePillsDisplay();
    titleInput.addEventListener('input', function onTitleInput(): void {
      this.#autofill.request(titleInput.value,);
    }
      .bind(this,),);
  }
}

customElements.define('task-detail', TaskDetail,);
console.log('[task-detail] custom element registered',);

export { TaskDetail, };
