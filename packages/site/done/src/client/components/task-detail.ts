import type { Task, TaskComplexity, TaskPriority } from "../../lib/types.ts";
import { formatRunningTrackedTime } from "../lib/task-card.ts";
import { css } from "../css.ts";

type BlockerSummary = {
  id: string;
  title: string;
  status: string;
};

type AutofillResult = {
  tags: string[];
  locations: string[];
  priority: TaskPriority | null;
  complexity: TaskComplexity | null;
};

type TaskDetailMode = "create" | "edit";

type TaskDetailData = {
  task: Task;
  blockerSummaries: BlockerSummary[];
  mode?: TaskDetailMode;
};

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

const AUTOFILL_DEBOUNCE_MS = 500;

class TaskDetail extends HTMLElement {
  #shadow: ShadowRoot;
  #data: TaskDetailData | null = null;
  #mode: TaskDetailMode = "edit";

  /** Mutable metadata state -- updated by autofill, read on save. */
  #tags: string[] = [];
  #locations: string[] = [];
  #priority: TaskPriority | null = null;
  #complexity: TaskComplexity | null = null;

  /** Tracks which fields were filled by the AI (for accent styling). */
  #autofilled = new Set<string>();

  #autofillTimer: ReturnType<typeof setTimeout> | null = null;
  #autofillAbort: AbortController | null = null;
  #autofillLoading = false;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  configure(data: TaskDetailData): void {
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
   */
  getMetadata(): { tags: string[]; locations: string[]; priority: TaskPriority | null; complexity: TaskComplexity | null } {
    return {
      tags: this.#tags,
      locations: this.#locations,
      priority: this.#priority,
      complexity: this.#complexity,
    };
  }

  /** Builds the attribute string for a pill span based on current autofill state. */
  #pillAttrs(field: string): string {
    if (this.#autofillLoading) return ' data-loading';
    if (this.#autofilled.has(field)) return ' data-autofilled';
    return "";
  }

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

    pillsContainer.innerHTML = pillData
      .map((pill) => `<span class="pill"${this.#pillAttrs(pill.field)}>${pill.text}</span>`)
      .join("");
  }

  #requestAutofill(title: string): void {
    if (this.#autofillTimer !== null) {
      clearTimeout(this.#autofillTimer);
    }

    if (this.#autofillAbort !== null) {
      this.#autofillAbort.abort();
      this.#autofillAbort = null;
    }

    if (title.trim().length === 0) return;

    this.#autofillTimer = setTimeout(() => {
      this.#fetchAutofill(title.trim());
    }, AUTOFILL_DEBOUNCE_MS);
  }

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

  #render(): void {
    const data = this.#data;
    if (data === null) return;
    const task = data.task;
    const isCreate = this.#mode === "create";

    this.#shadow.innerHTML = `
      <style>${STYLES}</style>
      <div class="header">
        <button class="close" data-action="close" aria-label="Close">
          <svg viewBox="0 0 48 48" fill="none">
            <line x1="14" y1="14" x2="34" y2="34"/>
            <line x1="34" y1="14" x2="14" y2="34"/>
          </svg>
        </button>
        <span class="heading">${isCreate ? "New task" : "Task details"}</span>
        <button class="${isCreate ? "btn-primary" : "btn-outline"}" data-action="save">${isCreate ? "Create" : "Save"}</button>
      </div>
      <input class="title-input" type="text" value="${task.title.replaceAll('"', '&quot;')}" placeholder="Title" required>
      <textarea class="desc-input" placeholder="description">${task.description ?? ""}</textarea>
      <div class="actions">
        <button class="btn-outline" data-action="attach">Attach file</button>
        <button class="btn-outline" data-action="photo">Take photo</button>
      </div>
      <div class="pills"></div>
      <div class="btn-row"${isCreate ? " data-hidden" : ""}>
        <button class="btn-outline" data-action="start" ${task.timerStartedAt !== null ? "disabled" : ""}>Start</button>
        <button class="btn-outline" data-action="stop" ${task.timerStartedAt === null ? "disabled" : ""}>Stop</button>
        <button class="btn-primary" data-action="complete" ${task.blockedBy.length > 0 ? "disabled" : ""}>Complete</button>
        <button class="btn-outline" data-action="delete">Delete</button>
      </div>
    `;

    this.#updatePillsDisplay();

    // Debounced autofill on title input
    const titleInput = this.#shadow.querySelector(".title-input") as HTMLInputElement;
    titleInput.addEventListener("input", () => {
      this.#requestAutofill(titleInput.value);
    });

    this.#shadow.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const button = target.closest("[data-action]") as HTMLElement | null;
      if (button === null) return;
      const action = button.dataset["action"];

      const descInput = this.#shadow.querySelector(".desc-input") as HTMLTextAreaElement;

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
}

customElements.define("task-detail", TaskDetail);

export { TaskDetail };
