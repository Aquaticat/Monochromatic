import type { Task } from "../../lib/types.ts";
import { formatRunningTrackedTime } from "../lib/task-card.ts";
import { css } from "../css.macro.ts" with { type: "macro" };

type BlockerSummary = {
  id: string;
  title: string;
  status: string;
};

type TaskDetailData = {
  task: Task;
  blockerSummaries: BlockerSummary[];
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
  }
  .close:focus-visible {
    outline-width: 0.125rem;
    outline-style: solid;
    outline-color: var(--fg);
    outline-offset: -0.125rem;
  }
  .close svg {
    inline-size: 2rem;
    block-size: 2rem;
    stroke: var(--fg);
    stroke-width: 4;
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
  .desc-input::placeholder { color: var(--medium); }
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
  }
  .btn-row {
    @apply --flex-row;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-block-start: 1rem;
  }
  .btn-outline {
    @apply --button-outlined;
  }
  .btn-outline:focus-visible {
    outline-width: 0.125rem;
    outline-style: solid;
    outline-color: var(--fg);
    outline-offset: 0.125rem;
  }
  .btn-primary {
    @apply --button-outlined;
    background-color: var(--fg);
    color: var(--bg);
  }
  .btn-primary:focus-visible {
    outline-width: 0.125rem;
    outline-style: solid;
    outline-color: var(--fg);
    outline-offset: 0.125rem;
  }
  button:disabled { opacity: 0.45; cursor: not-allowed; }
`);

class TaskDetail extends HTMLElement {
  #shadow: ShadowRoot;
  #data: TaskDetailData | null = null;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  configure(data: TaskDetailData): void {
    this.#data = data;
    this.#render();
  }

  #render(): void {
    const data = this.#data;
    if (data === null) return;
    const task = data.task;

    const pills: string[] = [];
    pills.push(task.tags.length > 0 ? `# ${task.tags.join(", ")}` : "# ?");
    pills.push(`tracked: ${formatRunningTrackedTime(task)}`);
    pills.push(task.locations.length > 0 ? `where: ${task.locations.join(", ")}` : "where: ?");
    pills.push(`priority: ${task.priority ?? "?"}`);
    pills.push(`due: ${task.dueDate ?? "?"}`);
    pills.push(`complexity: ${task.complexity ?? "?"}`);
    pills.push(task.reminders.length > 0 ? `reminders: ${task.reminders[0]}` : "reminders: None");
    pills.push(task.blockedBy.length > 0 ? `blockedBy: ${task.blockedBy.length}` : "blockedBy: none");

    this.#shadow.innerHTML = `
      <style>${STYLES}</style>
      <div class="header">
        <button class="close" data-action="close" aria-label="Close">
          <svg viewBox="0 0 48 48" fill="none">
            <line x1="14" y1="14" x2="34" y2="34"/>
            <line x1="34" y1="14" x2="14" y2="34"/>
          </svg>
        </button>
        <span class="heading">Task details</span>
        <button class="btn-outline" data-action="save">Save</button>
      </div>
      <input class="title-input" type="text" value="${task.title.replaceAll('"', '&quot;')}" placeholder="Title" required>
      <textarea class="desc-input" placeholder="description">${task.description ?? ""}</textarea>
      <div class="actions">
        <button class="btn-outline" data-action="attach">Attach file</button>
        <button class="btn-outline" data-action="photo">Take photo</button>
      </div>
      <div class="pills">
        ${pills.map((text) => `<span class="pill">${text}</span>`).join("")}
      </div>
      <div class="btn-row">
        <button class="btn-outline" data-action="start" ${task.timerStartedAt !== null ? "disabled" : ""}>Start</button>
        <button class="btn-outline" data-action="stop" ${task.timerStartedAt === null ? "disabled" : ""}>Stop</button>
        <button class="btn-primary" data-action="complete" ${task.blockedBy.length > 0 ? "disabled" : ""}>Complete</button>
        <button class="btn-outline" data-action="delete">Delete</button>
      </div>
    `;

    this.#shadow.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const button = target.closest("[data-action]") as HTMLElement | null;
      if (button === null) return;
      const action = button.dataset["action"];

      const titleInput = this.#shadow.querySelector(".title-input") as HTMLInputElement;
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
