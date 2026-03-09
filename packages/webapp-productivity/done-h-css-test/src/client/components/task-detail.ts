/**
 * `<task-detail>` web component for viewing and editing a single task.
 *
 * Exceeds 100 lines: the component bundles its Shadow DOM styles, autofill
 * debounce/fetch logic, and the full render tree in one class because the
 * private state (`#tags`, `#autofilled`, `#autofillAbort`) is tightly
 * coupled to both rendering and the autofill lifecycle -- splitting would
 * require exposing internal state across module boundaries.
 */
import type { Task, TaskComplexity, TaskPriority } from "../../lib/types.ts";
import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import { cssCalc, cssInt, cssPercent, cssRem, cssVar } from "@monochromatic-dev/module-es/h-css";
import { formatRunningTrackedTime } from "../lib/task-card.ts";
import { $ as css } from "../css.ts";
import {
  appearanceNone,
  borderRadiusFull,
  buttonOutlined,
  flexCenter,
  flexColumn,
  flexRow,
  focusOutline,
  minTouchTarget,
  scrollRow,
  shadowDomGlobals,
  whitespaceNowrap,
} from "../mixins.ts";

/** Blocker task summary displayed as a pill in the task detail view. */
type BlockerSummary = {
  id: string;
  title: string;
  status: string;
};

/** Shape of the JSON response from the `/api/ai/autofill` endpoint. */
type AutofillResult = {
  tags: string[];
  locations: string[];
  priority: TaskPriority | null;
  complexity: TaskComplexity | null;
};

/** Determines whether the component renders as a new-task creator or an editor. */
type TaskDetailMode = "create" | "edit";

/** Configuration payload passed to `TaskDetail.configure()`. */
type TaskDetailData = {
  task: Task;
  blockerSummaries: BlockerSummary[];
  mode?: TaskDetailMode;
};

const STYLES = [
  css({
    rule: ':host',
    decls: { ...flexColumn(), gap: cssRem(1), 'padding-block': cssRem(1), 'padding-inline': cssRem(1) },
  }),
  css({
    rule: '.header',
    decls: { ...flexRow(), 'justify-content': 'space-between' },
  }),
  css({
    rule: '.close',
    decls: { ...appearanceNone(), ...flexCenter(), ...minTouchTarget() },
    children: [
      css({ rule: '&:focus-visible', decls: focusOutline({ offset: cssRem(-0.125) }) }),
      css({
        rule: '& svg',
        decls: { 'inline-size': cssRem(2), 'block-size': cssRem(2), stroke: cssVar('fg'), 'stroke-width': cssInt(4) },
      }),
    ],
  }),
  css({
    rule: '.heading',
    decls: { 'font-size': cssRem(1.5), 'font-weight': cssInt(400) },
  }),
  css({
    rule: '.title-input',
    decls: {
      'font-size': cssRem(1.5),
      'font-weight': cssInt(400),
      'border-style': 'none',
      'border-block-end-width': cssCalc(`${cssRem(1)} / 16`),
      'border-block-end-style': 'solid',
      'border-block-end-color': cssVar('fg'),
      'background-color': 'transparent',
      'inline-size': cssPercent(100),
      'padding-block': cssRem(0.25),
      'padding-inline': 0,
      'outline-style': 'none',
      'font-family': 'inherit',
      color: cssVar('fg'),
    },
  }),
  css({
    rule: '.desc-input',
    decls: {
      'border-width': cssCalc(`${cssRem(1)} / 16`),
      'border-style': 'solid',
      'border-color': cssVar('fg'),
      'padding-block': cssRem(0.5),
      'padding-inline': cssRem(0.5),
      'min-block-size': cssRem(4.5),
      resize: 'vertical',
      'font-family': 'inherit',
      'font-size': 'inherit',
      'font-style': 'inherit',
      'font-weight': 'inherit',
      'line-height': 'inherit',
      color: cssVar('fg'),
      'background-color': 'transparent',
    },
  }),
  css({
    rule: '.actions',
    decls: { display: 'flex', gap: cssRem(1) },
  }),
  css({
    rule: '.pills',
    decls: { ...scrollRow(), 'flex-wrap': 'wrap' },
  }),
  css({
    rule: '.pill',
    decls: {
      ...flexCenter(),
      ...whitespaceNowrap(),
      'border-width': cssCalc(`${cssRem(1)} / 16`),
      'border-style': 'solid',
      'border-color': cssVar('fg'),
      ...borderRadiusFull(),
      'padding-block': cssRem(0.5),
      'padding-inline': cssRem(0.5),
      gap: cssRem(0.25),
      'font-size': cssRem(1),
      'line-height': 1.5,
    },
    children: [
      css({ rule: '&[data-autofilled]', decls: { 'border-color': cssVar('red-fg'), color: cssVar('red-fg') } }),
      css({ rule: '&[data-loading]', decls: { opacity: 0.5 } }),
    ],
  }),
  css({
    rule: '.btn-row',
    decls: { ...flexRow(), gap: cssRem(0.5), 'flex-wrap': 'wrap', 'margin-block-start': cssRem(1) },
    children: [
      css({ rule: '&[data-hidden]', decls: { display: 'none' } }),
    ],
  }),
  css({
    rule: '.btn-outline',
    decls: buttonOutlined(),
    children: [
      css({ rule: '&:focus-visible', decls: focusOutline() }),
    ],
  }),
  css({
    rule: '.btn-primary',
    decls: { ...buttonOutlined(), 'background-color': cssVar('fg'), color: cssVar('bg') },
    children: [
      css({ rule: '&:focus-visible', decls: focusOutline() }),
    ],
  }),
  ...shadowDomGlobals(),
].join('');

/** Delay before triggering AI autofill after the user stops typing. */
const AUTOFILL_DEBOUNCE_MS = 500;

/**
 * `<task-detail>` -- full-page task editor with title, description, metadata pills,
 * action buttons (start/stop/complete/delete), and debounced AI autofill.
 * Used in both "edit" and "create" modes (controlled by `TaskDetailData.mode`).
 */
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

  /**
   * Sets task data, resets metadata state, and triggers a full render.
   * Called by the parent page to initialize or reconfigure the component.
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

  /** Applies autofill/loading data attributes to a pill element based on field state. */
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

    const pillElements = pillData.map((pill) => {
      const element = h({ tag: "span", class: "pill", text: pill.text });
      this.#applyPillAttrs(element, pill.field);
      return element;
    });

    pillsContainer.replaceChildren(...pillElements);
  }

  //endregion Pill display

  //region Autofill -- debounced AI metadata suggestion

  /** Debounces autofill requests so rapid typing does not flood the endpoint. */
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

  /**
   * Sends an autofill request to the server and merges results into empty metadata fields.
   * Abortable: a new request cancels any in-flight one.
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
    const task = data.task;
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
    titleInput.addEventListener("input", () => {
      this.#requestAutofill(titleInput.value);
    });

    this.#shadow.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const button = target.closest("[data-action]") as HTMLElement | null;
      if (button === null) return;
      const action = button.dataset["action"];

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
