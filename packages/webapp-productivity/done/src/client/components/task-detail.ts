/**
 * `\<task-detail\>` web component for viewing and editing a single task.
 *
 * Exceeds 100 lines: the component bundles its Shadow DOM styles, autofill
 * debounce/fetch logic, and the full render tree in one class because the
 * private state (`#tags`, `#autofilled`, `#autofillAbort`) is tightly
 * coupled to both rendering and the autofill lifecycle -- splitting would
 * require exposing internal state across module boundaries.
 */
import type { Task, TaskComplexity, TaskPriority } from "../../lib/types.ts";
import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import { formatRunningTrackedTime } from "../lib/task-card.ts";
import { css } from "../css.ts";

/** Blocker task summary displayed as a pill in the task detail view. */
type BlockerSummary = {
  /** UUID of the blocking task. */
  id: string;
  /** Title of the blocking task. */
  title: string;
  /** Current status of the blocking task. */
  status: string;
};

/** Shape of the JSON response from the `/api/ai/autofill` endpoint. */
type AutofillResult = {
  /** Suggested tags for the task. */
  tags: string[];
  /** Suggested locations for the task. */
  locations: string[];
  /** Suggested priority level. */
  priority: TaskPriority | null;
  /** Suggested complexity level. */
  complexity: TaskComplexity | null;
};

/** Determines whether the component renders as a new-task creator or an editor. */
type TaskDetailMode = "create" | "edit";

/** Configuration payload passed to `TaskDetail.configure()`. */
type TaskDetailData = {
  /** Task being viewed or edited. */
  task: Task;
  /** Summaries of tasks that block this one. */
  blockerSummaries: BlockerSummary[];
  /** Display mode: "create" for new tasks, "edit" for existing. */
  mode?: TaskDetailMode;
};

/** Shadow DOM styles for the `\<task-detail\>` component. */
const STYLES = css(`
  :host {
    @apply --flex-column;
    gap: 1rem;
    padding-block: 1rem;
    padding-inline: 1rem;
  }
  .header {
    @apply --flex-row;
    justify-content: space-between;
  }
  .close {
    @apply --appearance-none;
    @apply --flex-center;
    @apply --min-touch-target;

    &:focus-visible {
      outline-width: 0.125rem;
      outline-style: solid;
      outline-color: var(--fg);
      outline-offset: -0.125rem;
    }

    & svg {
      inline-size: 2rem;
      block-size: 2rem;
      stroke: var(--fg);
      stroke-width: 4;
    }
  }
  .heading {
    font-size: 1.5rem;
    font-weight: 400;
  }
  .title-input {
    font-size: 1.5rem;
    font-weight: 400;
    border-style: none;
    border-block-end-width: calc(1 / 16 * 1rem);
    border-block-end-style: solid;
    border-block-end-color: var(--fg);
    background-color: transparent;
    inline-size: 100%;
    padding-block: 0.25rem;
    padding-inline: 0;
    outline: none;
    font-family: inherit;
    color: var(--fg);
  }
  .desc-input {
    border-width: calc(1 / 16 * 1rem);
    border-style: solid;
    border-color: var(--fg);
    padding-block: 0.5rem;
    padding-inline: 0.5rem;
    min-block-size: 4.5rem;
    resize: vertical;
    font: inherit;
    color: var(--fg);
    background-color: transparent;

  }
  .actions {
    display: flex;
    gap: 1rem;
  }
  .pills {
    @apply --scroll-row;
    flex-wrap: wrap;
  }
  .pill {
    @apply --flex-center;
    @apply --whitespace-nowrap;
    border-width: calc(1 / 16 * 1rem);
    border-style: solid;
    border-color: var(--fg);
    @apply --border-radius-full;
    padding-block: 0.5rem;
    padding-inline: 0.5rem;
    gap: 0.25rem;
    font-size: 1rem;
    line-height: 1.5;

    &[data-autofilled] {
      border-color: var(--red-fg);
      color: var(--red-fg);
    }

    &[data-loading] {
      opacity: 0.5;
    }
  }
  .btn-row {
    @apply --flex-row;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-block-start: 1rem;

    &[data-hidden] {
      display: none;
    }
  }
  .btn-outline {
    @apply --button-outlined;

    &:focus-visible {
      outline-width: 0.125rem;
      outline-style: solid;
      outline-color: var(--fg);
      outline-offset: 0.125rem;
    }
  }
  .btn-primary {
    @apply --button-outlined;
    background-color: var(--fg);
    color: var(--bg);

    &:focus-visible {
      outline-width: 0.125rem;
      outline-style: solid;
      outline-color: var(--fg);
      outline-offset: 0.125rem;
    }
  }
  @apply --shadow-dom-globals;
`);

/** Delay before triggering AI autofill after the user stops typing. */
const AUTOFILL_DEBOUNCE_MS = 500;

/**
 * `\<task-detail\>` -- full-page task editor with title, description, metadata pills,
 * action buttons (start/stop/complete/delete), and debounced AI autofill.
 * Used in both "edit" and "create" modes (controlled by `TaskDetailData.mode`).
 */
class TaskDetail extends HTMLElement {
  /** Shadow root for encapsulated rendering. */
  #shadow: ShadowRoot;

  /** Current task configuration data, or null before configuration. */
  #data: TaskDetailData | null = null;

  /** Current display mode. */
  #mode: TaskDetailMode = "edit";

  /** Mutable metadata state -- updated by autofill, read on save. */
  #tags: string[] = [];

  /** Mutable locations state. */
  #locations: string[] = [];

  /** Mutable priority state. */
  #priority: TaskPriority | null = null;

  /** Mutable complexity state. */
  #complexity: TaskComplexity | null = null;

  /** Tracks which fields were filled by the AI (for accent styling). */
  #autofilled = new Set<string>();

  /** Handle for the autofill debounce timer. */
  #autofillTimer: ReturnType<typeof setTimeout> | null = null;

  /** Abort controller for in-flight autofill requests. */
  #autofillAbort: AbortController | null = null;

  /** Whether an autofill request is currently in flight. */
  #autofillLoading = false;

  /** Initializes the shadow root. */
  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  /**
   * Sets task data, resets metadata state, and triggers a full render.
   * Called by the parent page to initialize or reconfigure the component.
   *
   * @param data - Task data and configuration
   */
  configure(data: TaskDetailData): void {
    console.log("[task-detail] configure() called, mode:", data.mode ?? "edit");
    this.#data = data;
    this.#mode = data.mode ?? "edit";
    this.#tags = [...data.task.tags];
    this.#locations = [...data.task.locations];
    this.#priority = data.task.priority;
    this.#complexity = data.task.complexity;
    this.#autofilled.clear();
    this.#render();
  }

  /**
   * Returns the current metadata state so the parent can include it in save payloads.
   * Exposed alongside the "action" custom event detail.
   *
   * @returns Current metadata values for tags, locations, priority, and complexity
   */
  getMetadata(): { tags: string[]; locations: string[]; priority: TaskPriority | null; complexity: TaskComplexity | null } {
    return {
      tags: this.#tags,
      locations: this.#locations,
      priority: this.#priority,
      complexity: this.#complexity,
    };
  }

  //region Pill display -- builds and updates the metadata pill row

  /**
   * Applies autofill/loading data attributes to a pill element based on field state.
   *
   * @param element - Pill element to decorate
   *
   * @param field - Metadata field name for autofill tracking
   */
  #applyPillAttrs(element: HTMLElement, field: string): void {
    if (this.#autofillLoading) {
      element.dataset["loading"] = "";
    } else if (this.#autofilled.has(field)) {
      element.dataset["autofilled"] = "";
    }
  }

  /** Rebuilds the pill elements in the `.pills` container from current metadata state. */
  #updatePillsDisplay(): void {
    const pillsContainer = this.#shadow.querySelector(".pills");
    if (pillsContainer === null) return;

    const task = this.#data?.task;
    if (task === undefined) return;

    const pillData = [
      { field: "tags", text: this.#tags.length > 0 ? `# ${this.#tags.join(", ")}` : "# ?" },
      { field: "tracked", text: `tracked: ${formatRunningTrackedTime(task)}` },
      { field: "locations", text: this.#locations.length > 0 ? `where: ${this.#locations.join(", ")}` : "where: ?" },
      { field: "priority", text: `priority: ${this.#priority ?? "?"}` },
      { field: "due", text: `due: ${task.dueDate ?? "?"}` },
      { field: "complexity", text: `complexity: ${this.#complexity ?? "?"}` },
      { field: "reminders", text: task.reminders.length > 0 ? `reminders: ${task.reminders[0]}` : "reminders: None" },
      { field: "blockedBy", text: task.blockedBy.length > 0 ? `blockedBy: ${String(task.blockedBy.length)}` : "blockedBy: none" },
    ];

    const pillElements = pillData.map(function buildPill(pill) {
      const element = h({ tag: "span", class: "pill", text: pill.text });
      this.#applyPillAttrs(element, pill.field);
      return element;
    }.bind(this));

    pillsContainer.replaceChildren(...pillElements);
  }

  //endregion Pill display

  //region Autofill -- debounced AI metadata suggestion

  /**
   * Debounces autofill requests so rapid typing does not flood the endpoint.
   *
   * @param title - Current title input value
   */
  #requestAutofill(title: string): void {
    if (this.#autofillTimer !== null) {
      clearTimeout(this.#autofillTimer);
    }

    if (this.#autofillAbort !== null) {
      this.#autofillAbort.abort();
      this.#autofillAbort = null;
    }

    if (title.trim().length === 0) return;

    this.#autofillTimer = setTimeout(function triggerAutofill() {
      // oxlint-disable-next-line @typescript-eslint/no-floating-promises -- fire-and-forget; errors handled inside #fetchAutofill
      this.#fetchAutofill(title.trim());
    }.bind(this), AUTOFILL_DEBOUNCE_MS);
  }

  /**
   * Sends an autofill request to the server and merges results into empty metadata fields.
   * Abortable: a new request cancels any in-flight one.
   *
   * @param title - Trimmed title text to send for autofill
   */
  async #fetchAutofill(title: string): Promise<void> {
    const controller = new AbortController();
    this.#autofillAbort = controller;
    this.#autofillLoading = true;
    this.#updatePillsDisplay();

    try {
      const response = await fetch("/api/ai/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
        signal: controller.signal,
      });

      if (!response.ok) return;

      // oxlint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- API response shape matches AutofillResult
      const result = (await response.json()) as AutofillResult;
      // Only apply autofill fields that currently have no user-set value
      this.#autofilled.clear();

      if (result.tags.length > 0 && this.#tags.length === 0) {
        this.#tags = result.tags;
        this.#autofilled.add("tags");
      }

      if (result.locations.length > 0 && this.#locations.length === 0) {
        this.#locations = result.locations;
        this.#autofilled.add("locations");
      }

      if (result.priority !== null && this.#priority === null) {
        this.#priority = result.priority;
        this.#autofilled.add("priority");
      }

      if (result.complexity !== null && this.#complexity === null) {
        this.#complexity = result.complexity;
        this.#autofilled.add("complexity");
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Autofill request failed:", error);
    } finally {
      this.#autofillLoading = false;
      this.#updatePillsDisplay();
    }
  }

  //endregion Autofill

  //region Render -- builds the full Shadow DOM tree

  /** Builds the complete Shadow DOM: header, inputs, pills, action buttons, and event wiring. */
  #render(): void {
    const data = this.#data;
    if (data === null) return;
    const {task} = data;
    const isCreate = this.#mode === "create";

    // Close button uses innerHTML for SVG because h() creates HTML-namespace
    // elements -- SVG requires the SVG namespace.
    const closeButton = h({
      tag: "button",
      class: "close",
      attrs: { "data-action": "close", "aria-label": "Close" },
    });
    closeButton.innerHTML = `<svg viewBox="0 0 48 48" fill="none"><line x1="14" y1="14" x2="34" y2="34"/><line x1="34" y1="14" x2="14" y2="34"/></svg>`;

    const titleInput = h({
      tag: "input",
      class: "title-input",
      attrs: { type: "text", value: task.title, placeholder: "Title", required: "" },
    });

    const descInput = h({ tag: "textarea", class: "desc-input", attrs: { placeholder: "description" } });
    if (task.description !== null) {
      descInput.textContent = task.description;
    }

    const startAttrs: Record<string, string> = { "data-action": "start" };
    if (task.timerStartedAt !== null) startAttrs["disabled"] = "";
    const stopAttrs: Record<string, string> = { "data-action": "stop" };
    if (task.timerStartedAt === null) stopAttrs["disabled"] = "";
    const completeAttrs: Record<string, string> = { "data-action": "complete" };
    if (task.blockedBy.length > 0) completeAttrs["disabled"] = "";

    const btnRow = h({
      tag: "div",
      class: "btn-row",
      children: [
        h({ tag: "button", class: "btn-outline", attrs: startAttrs, text: "Start" }),
        h({ tag: "button", class: "btn-outline", attrs: stopAttrs, text: "Stop" }),
        h({ tag: "button", class: "btn-primary", attrs: completeAttrs, text: "Complete" }),
        h({ tag: "button", class: "btn-outline", attrs: { "data-action": "delete" }, text: "Delete" }),
      ],
    });
    if (isCreate) btnRow.dataset["hidden"] = "";

    this.#shadow.replaceChildren(
      h({ tag: "style", text: STYLES }),
      h({
        tag: "div",
        class: "header",
        children: [
          closeButton,
          h({ tag: "span", class: "heading", text: isCreate ? "New task" : "Task details" }),
          h({
            tag: "button",
            class: isCreate ? "btn-primary" : "btn-outline",
            attrs: { "data-action": "save" },
            text: isCreate ? "Create" : "Save",
          }),
        ],
      }),
      titleInput,
      descInput,
      h({
        tag: "div",
        class: "actions",
        children: [
          h({ tag: "button", class: "btn-outline", attrs: { "data-action": "attach" }, text: "Attach file" }),
          h({ tag: "button", class: "btn-outline", attrs: { "data-action": "photo" }, text: "Take photo" }),
        ],
      }),
      h({ tag: "div", class: "pills" }),
      btnRow,
    );

    this.#updatePillsDisplay();

    // Debounced autofill on title input
    titleInput.addEventListener("input", function onTitleInput() {
      this.#requestAutofill(titleInput.value);
    }.bind(this));

    this.#shadow.addEventListener("click", function onAction(event) {
      // oxlint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- event.target is always an Element in shadow DOM click handlers
      const target = event.target as HTMLElement;
      const button = target.closest("[data-action]");
      if (button === null) return;
      // oxlint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- closest returns HTMLElement with dataset
      const {action} = (button as HTMLElement).dataset;

      this.dispatchEvent(new CustomEvent("action", {
        bubbles: true,
        detail: {
          action,
          title: titleInput.value,
          description: descInput.value,
        },
      }));
    });
  }

  //endregion Render
}

customElements.define("task-detail", TaskDetail);
console.log("[task-detail] custom element registered");

export { TaskDetail };
