/**
 * `<task-detail>` web component for viewing and editing a single task.
 */
import type { TaskComplexity, TaskPriority } from "../../lib/types.ts";
import type { MetadataState, TaskDetailData, TaskDetailMode } from "./task-detail-types.ts";
import { TASK_DETAIL_STYLES } from "./task-detail-styles.ts";
import { AutofillManager } from "./task-detail-autofill.ts";
import { buildTaskDetailTree } from "./task-detail-render.ts";
import { buildPillElements } from "./task-detail-pills.ts";

/**
 * `<task-detail>` -- full-page task editor with title, description, metadata pills,
 * action buttons (start/stop/complete/delete), and debounced AI autofill.
 */
class TaskDetail extends HTMLElement {
  #shadow: ShadowRoot;
  #data: TaskDetailData | null = null;
  #mode: TaskDetailMode = "edit";
  #metadata: MetadataState = { tags: [], locations: [], priority: null, complexity: null };
  #autofill = new AutofillManager();

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  /**
   * Sets task data, resets metadata state, and triggers a full render.
   *
   * @param data - Task data and mode configuration
   */
  configure(data: TaskDetailData): void {
    console.log("[task-detail] configure() called, mode:", data.mode ?? "edit");
    this.#data = data;
    this.#mode = data.mode ?? "edit";
    this.#metadata = {
      tags: [...data.task.tags],
      locations: [...data.task.locations],
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
  getMetadata(): { tags: string[]; locations: string[]; priority: TaskPriority | null; complexity: TaskComplexity | null } {
    return { ...this.#metadata };
  }

  /** Rebuilds pill elements in the `.pills` container from current metadata state. */
  #updatePillsDisplay(): void {
    const pillsContainer = this.#shadow.querySelector(".pills");
    if (pillsContainer === null) return;
    const task = this.#data?.task;
    if (task === undefined) return;

    const pillElements = buildPillElements({
      task,
      metadata: this.#metadata,
      autofillLoading: this.#autofill.loading,
      autofilled: this.#autofill.autofilled,
    });
    pillsContainer.replaceChildren(...pillElements);
  }

  /** Builds the complete Shadow DOM and wires up event listeners. */
  #render(): void {
    const data = this.#data;
    if (data === null) return;
    const { task } = data;
    const isCreate = this.#mode === "create";

    const { elements, refs } = buildTaskDetailTree({ task, isCreate, styles: TASK_DETAIL_STYLES });
    this.#shadow.replaceChildren(...elements);
    this.#updatePillsDisplay();

    refs.titleInput.addEventListener("input", () => {
      this.#autofill.request({
        title: refs.titleInput.value,
        metadata: this.#metadata,
        onUpdate: () => { this.#updatePillsDisplay(); },
      });
    });

    this.#shadow.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const button = target.closest("[data-action]");
      if (button === null) return;
      const { action } = button.dataset;
      this.dispatchEvent(new CustomEvent("action", {
        bubbles: true,
        detail: { action, title: refs.titleInput.value, description: refs.descInput.value },
      }));
    });
  }
}

customElements.define("task-detail", TaskDetail);
console.log("[task-detail] custom element registered");

export { TaskDetail };
