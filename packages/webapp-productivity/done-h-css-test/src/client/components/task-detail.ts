/**
 * `<task-detail>` web component for viewing and editing a single task.
 */
import type {
  TaskComplexity,
  TaskPriority,
} from '../../lib/types.ts';
import { AutofillManager, } from './task-detail-autofill.ts';
import { buildPillElements, } from './task-detail-pills.ts';
import { buildTaskDetailTree, } from './task-detail-render.ts';
import { TASK_DETAIL_STYLES, } from './task-detail-styles.ts';
import type {
  MetadataState,
  TaskDetailData,
  TaskDetailMode,
} from './task-detail-types.ts';

/**
 * `<task-detail>` -- full-page task editor with title, description, metadata pills,
 * action buttons (start/stop/complete/delete), and debounced AI autofill.
 */
class TaskDetail extends HTMLElement {
  /** Shadow root for encapsulated rendering. */
  #shadow: ShadowRoot;

  /** Current task data and display configuration, or `null` before configure. */
  #data: TaskDetailData | null = null;

  /** Whether the component is in edit or create mode. */
  #mode: TaskDetailMode = 'edit';

  /** Mutable metadata state updated by autofill and user edits. */
  #metadata: MetadataState = {
    tags: [],
    locations: [],
    priority: null,
    complexity: null,
  };

  /** Debounced AI autofill manager. */
  #autofill = new AutofillManager();

  /** Initializes the shadow root. */
  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open', },);
  }

  /**
   * Sets task data, resets metadata state, and triggers a full render.
   *
   * @param data - Task data and mode configuration
   */
  configure(data: TaskDetailData,): void {
    console.log(
      '[task-detail] configure() called, mode:',
      data.mode ?? 'edit',
    );
    this.#data = data;
    this.#mode = data.mode ?? 'edit';
    this.#metadata = {
      tags: [...data.task.tags,],
      locations: [...data.task.locations,],
      priority: data.task.priority,
      complexity: data.task.complexity,
    };
    this.#autofill.reset();
    this.#render();
  }

  /**
   * Returns the current metadata state so the parent can include it in save payloads.
   *
   * @returns Current tags, locations, priority, and complexity
   */
  getMetadata(): {
    tags: string[];
    locations: string[];
    priority: TaskPriority | null;
    complexity: TaskComplexity | null
  }
  {
    return { ...this.#metadata, };
  }

  /** Rebuilds pill elements in the `.pills` container from current metadata state. */
  #updatePillsDisplay(): void {
    const pillsContainer = this.#shadow.querySelector<HTMLElement>('.pills',);
    if (pillsContainer === null)
      return;
    const task = this.#data?.task;
    if (task === undefined)
      return;

    const pillElements = buildPillElements({
      task,
      metadata: this.#metadata,
      autofillLoading: this.#autofill.loading,
      autofilled: this.#autofill.autofilled,
    },);
    pillsContainer.replaceChildren(...pillElements,);
  }

  /** Builds the complete Shadow DOM and wires up event listeners. */
  #render(): void {
    const data = this.#data;
    if (data === null)
      return;
    const { task, } = data;
    const isCreate = this.#mode === 'create';

    const {
      elements,
      refs,
    } = buildTaskDetailTree({
      task,
      isCreate,
      styles: TASK_DETAIL_STYLES,
    },);
    this.#shadow.replaceChildren(...elements,);
    this.#updatePillsDisplay();

    const requestAutofill = this.#autofill.request.bind(this.#autofill,);
    const metadata = this.#metadata;
    const updatePills = this.#updatePillsDisplay.bind(this,);
    const dispatchFn = this.dispatchEvent.bind(this,);

    refs.titleInput.addEventListener(
      'input',
      function handleTitleInput(): void {
      requestAutofill({
        title: refs.titleInput.value,
        metadata,
        onUpdate: function onAutofillUpdate(): void {
          updatePills();
        },
      },);
    },
    );

    this.#shadow.addEventListener(
      'click',
      function handleActionClick(event: Event,): void {
        const { target, } = event;
        if (!(target instanceof HTMLElement))
          return;
        const button = target.closest<HTMLElement>('[data-action]',);
        if (button === null)
          return;
        const { action, } = button.dataset;
        dispatchFn(new CustomEvent('action', {
          bubbles: true,
          detail: { action, title: refs.titleInput.value,
            description: refs.descInput.value, },
        },),);
      },
    );
  }
}

customElements.define(
  'task-detail',
  TaskDetail,
);
console.log('[task-detail] custom element registered',);

export { TaskDetail, };
