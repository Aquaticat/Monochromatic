/**
 * `\<task-detail\>`: full-page task editor with title, description, metadata pills,
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
  readonly #shadow: ShadowRoot;

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
  readonly #autofill: AutofillController;

  /** Initializes the shadow root and autofill controller. */
  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open', },);
    this.#autofill = new AutofillController({
      // oxlint-disable-next-line unicorn/consistent-function-scoping -- bound to class instance via .bind(this)
      getState: function getState(
        this: TaskDetail,
      ): {
        tags: string[];
        locations: string[];
        priority: string | null;
        complexity: string | null;
      } {
        return {
          tags: this.#tags,
          locations: this.#locations,
          priority: this.#priority,
          complexity: this.#complexity,
        };
      }
        .bind(this,),
      setState: function setState(
        this: TaskDetail,
        update: {
          tags?: string[];
          locations?: string[];
          priority?: string | null;
          complexity?: string | null;
        },
      ): void {
        if (update.tags !== undefined)
          this.#tags = update.tags as string[];
        if (update.locations !== undefined)
          this.#locations = update.locations as string[];
        if (update.priority !== undefined) {
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- narrowing from string to TaskPriority union
          this.#priority = update.priority as TaskPriority | null;
        }
        if (update.complexity !== undefined) {
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- narrowing from string to TaskComplexity union
          this.#complexity = update.complexity as TaskComplexity | null;
        }
      }
        .bind(this,),
      // oxlint-disable-next-line unicorn/consistent-function-scoping -- bound to class instance via .bind(this)
      updateDisplay: function updateDisplay(this: TaskDetail,): void {
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
    console.log(
      '[task-detail] configure() called, mode:',
      data.mode ?? 'edit',
    );
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
  getMetadata(): {
    tags: string[];
    locations: string[];
    priority: TaskPriority | null;
    complexity: TaskComplexity | null;
  } {
    return {
      tags: this.#tags,
      locations: this.#locations,
      priority: this.#priority,
      complexity: this.#complexity,
    };
  }

  /** Rebuilds pill elements from current metadata state. */
  #updatePillsDisplay(): void {
    /** Container the pill list is rendered into; absent before initial render. */
    const pillsContainer = this.#shadow.querySelector<HTMLElement>('.pills',);
    if (pillsContainer === null)
      return;
    /** Task data extracted from `#data`; updates are skipped until `configure()` has run. */
    const task = this.#data?.task;
    if (task === undefined)
      return;

    /** Descriptor list driving the pill render below. */
    const pills = buildPillData({
      task,
      tags: this.#tags,
      locations: this.#locations,
      priority: this.#priority,
      complexity: this.#complexity,
    },);
    pillsContainer.replaceChildren(
      ...buildPillElements({
        pills,
        loading: this.#autofill.loading,
        autofilled: this.#autofill.autofilled,
      },),
    );
  }

  /** Delegates to renderTaskDetail and wires autofill on title input. */
  #render(): void {
    /** Snapshot of `#data` to satisfy the null check and stable destructure below. */
    const data = this.#data;
    if (data === null)
      return;
    /** Title input returned by the shared renderer; autofill is wired on its `input` events. */
    const { titleInput, } = renderTaskDetail({
      shadow: this.#shadow,
      task: data.task,
      mode: this.#mode,
      host: this,
    },);
    this.#updatePillsDisplay();
    titleInput.addEventListener(
      'input',
      function onTitleInput(this: TaskDetail,): void {
        this.#autofill.request(titleInput.value,);
      }
        .bind(this,),
    );
  }
}

customElements.define(
  'task-detail',
  TaskDetail,
);
console.log('[task-detail] custom element registered',);

export { TaskDetail, };
