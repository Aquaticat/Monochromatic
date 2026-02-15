import type { Task } from "../../lib/types.ts";

type TaskCardOptions = {
  showBlockedBadge?: boolean;
  onOpen: (taskId: string) => void;
  onToggleComplete?: (taskId: string) => Promise<void>;
};

function formatTrackedTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    const dayHours = Math.floor(hours / 24);
    const remainHours = hours % 24;
    if (dayHours > 0) {
      return `${dayHours}d${remainHours}h${minutes}min${remainingSeconds}s`;
    }
    return `${hours}h${minutes}min${remainingSeconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}min${remainingSeconds}s`;
  }

  return `${totalSeconds}s`;
}

const TASK_CARD_STYLES = `
  :host {
    display: flex;
    flex-direction: column;
    gap: var(--min-gap, 16px);
    background: var(--gray-bg, #eee);
    overflow: hidden;
    cursor: pointer;
  }
  .row {
    display: flex;
    gap: var(--min-gap, 16px);
    align-items: flex-start;
  }
  .checkbox {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
  }
  .checkbox-box {
    width: 28px;
    height: 28px;
    border: 4px solid var(--gray-fg, #111);
  }
  .title {
    font-size: 1.25rem;
    font-weight: 400;
    line-height: normal;
    flex: 1;
    min-width: 0;
  }
  .chips {
    display: flex;
    gap: var(--min-gap, 16px);
    align-items: flex-start;
    overflow-x: auto;
    overflow-y: clip;
    scrollbar-width: none;
  }
  .chips::-webkit-scrollbar { display: none; }
  .chip {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    white-space: nowrap;
    font-size: 1rem;
    line-height: 1.5;
  }
  .chip.blocked { border-color: #a00; color: #a00; }
`;

class TaskCard extends HTMLElement {
  #shadow: ShadowRoot;
  #task: Task | null = null;
  #options: TaskCardOptions | null = null;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  configure(task: Task, options: TaskCardOptions): void {
    this.#task = task;
    this.#options = options;
    this.#render();
  }

  getChipElement(prefix: string): HTMLSpanElement | null {
    for (const chip of this.#shadow.querySelectorAll(".chip")) {
      if (chip.textContent?.startsWith(prefix)) {
        return chip as HTMLSpanElement;
      }
    }
    return null;
  }

  #render(): void {
    const task = this.#task;
    const options = this.#options;
    if (task === null || options === null) return;

    const chips: string[] = [];

    if (task.tags.length > 0) {
      chips.push(`# ${task.tags.join(", ")}`);
    }
    chips.push(`tracked: ${formatTrackedTime(task.trackedTime)}`);
    if (task.locations.length > 0) {
      chips.push(`where: ${task.locations.join(", ")}`);
    }
    if (task.priority !== null) {
      chips.push(`priority: ${task.priority}`);
    }
    if (task.dueDate !== null) {
      chips.push(`due: ${task.dueDate}`);
    }
    if (task.complexity !== null) {
      chips.push(`complexity: ${task.complexity}`);
    }
    if (task.reminders.length > 0) {
      chips.push(`reminders: ${task.reminders[0]}`);
    }
    if (task.blockedBy.length > 0) {
      chips.push(`blockedBy: ${task.blockedBy.length}`);
    } else {
      chips.push("blockedBy: none");
    }

    const blockedChip = options.showBlockedBadge === true ? `<span class="chip blocked">blocked</span>` : "";

    this.#shadow.innerHTML = `
      <style>${TASK_CARD_STYLES}</style>
      <div class="row">
        <button class="checkbox" title="Complete task">
          <span class="checkbox-box"></span>
        </button>
        <span class="title">${task.title}</span>
      </div>
      <div class="chips">
        ${chips.map((text) => `<span class="chip">${text}</span>`).join("")}
        ${blockedChip}
      </div>
    `;

    this.#shadow.querySelector(".checkbox")?.addEventListener("click", async (event) => {
      event.stopPropagation();
      if (options.onToggleComplete !== undefined) {
        await options.onToggleComplete(task.id);
      }
    });

    this.#shadow.querySelector(".row")?.addEventListener("click", () => {
      options.onOpen(task.id);
    });
  }
}

customElements.define("task-card", TaskCard);

export function createTaskCard(task: Task, options: TaskCardOptions): TaskCard {
  const card = document.createElement("task-card") as TaskCard;
  card.configure(task, options);
  return card;
}

export function formatRunningTrackedTime(task: Task): string {
  if (task.timerStartedAt === null) {
    return formatTrackedTime(task.trackedTime);
  }

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - Date.parse(task.timerStartedAt)) / 1000));
  return formatTrackedTime(task.trackedTime + elapsedSeconds);
}
