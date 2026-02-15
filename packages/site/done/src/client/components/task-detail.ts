import type { Task } from "../../lib/types.ts";
import { formatRunningTrackedTime } from "../lib/task-card.ts";

type BlockerSummary = {
  id: string;
  title: string;
  status: string;
};

type TaskDetailData = {
  task: Task;
  blockerSummaries: BlockerSummary[];
};

const STYLES = `
  :host {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .close {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .close svg {
    width: 32px;
    height: 32px;
    stroke: var(--gray-fg, #111);
    stroke-width: 4;
  }
  .heading {
    font-size: 1.5rem;
    font-weight: 400;
  }
  .title-input {
    font-size: 1.5rem;
    font-weight: 400;
    border: none;
    border-bottom: 1px solid var(--gray-fg, #111);
    background: transparent;
    width: 100%;
    padding: 0.25rem 0;
    outline: none;
    font-family: inherit;
    color: var(--gray-fg, #111);
  }
  .desc-input {
    border: 1px solid var(--gray-fg, #111);
    padding: 0.5rem;
    min-height: 4.5rem;
    resize: vertical;
    font: inherit;
    color: var(--gray-fg, #111);
    background: transparent;
  }
  .desc-input::placeholder { color: var(--gray-medium, #888); }
  .actions {
    display: flex;
    gap: 1rem;
  }
  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: var(--min-gap, 16px);
    align-items: flex-start;
    overflow-x: auto;
    overflow-y: clip;
  }
  .pill {
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #111;
    border-radius: 999px;
    padding: 0.5rem;
    gap: 0.25rem;
    white-space: nowrap;
    font-size: 1rem;
    line-height: 1.5;
  }
  .btn-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 1rem;
  }
  .btn-outline {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    border: 1px solid var(--gray-fg, #111);
    padding: 0.5rem;
    height: 48px;
    background: transparent;
    color: var(--gray-fg, #111);
    font: inherit;
    cursor: pointer;
  }
  .btn-primary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    border: 1px solid var(--gray-fg, #111);
    padding: 0.5rem;
    height: 48px;
    background: var(--gray-fg, #111);
    color: var(--gray-bg, #eee);
    font: inherit;
    cursor: pointer;
  }
  button:disabled { opacity: 0.45; cursor: not-allowed; }
`;

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
