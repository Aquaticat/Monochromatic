/**
 * Autofill controller for the `\<task-detail\>` component.
 *
 * Manages debounced AI metadata suggestion requests with
 * abort support and loading state tracking.
 */
import type { AutofillResult, } from './task-detail-types.ts';

/** Delay before triggering AI autofill after the user stops typing. */
const AUTOFILL_DEBOUNCE_MS = 500;

/** Callback interface for the autofill controller to update the host component. */
export type AutofillCallbacks = {
  /** Returns current metadata values. */
  getState: () => { tags: string[]; locations: string[]; priority: string | null;
    complexity: string | null; };
  /** Applies new metadata values. */
  setState: (
    update: { tags?: string[]; locations?: string[]; priority?: string | null;
      complexity?: string | null; },
  ) => void;
  /** Refreshes the pill display. */
  updateDisplay: () => void;
};

/**
 * Manages debounced autofill requests and loading state.
 * Delegates display and state updates to the host via callbacks.
 */
export class AutofillController {
  /** Tracks which fields were filled by the AI. */
  autofilled = new Set<string>();

  /** Whether an autofill request is currently in flight. */
  loading = false;

  /** Handle for the debounce timer. */
  #timer: ReturnType<typeof setTimeout> | null = null;

  /** Abort controller for in-flight requests. */
  #abort: AbortController | null = null;

  /** Host callbacks for state and display updates. */
  #callbacks: AutofillCallbacks;

  /**
   * @param callbacks - Host component callbacks
   */
  constructor(callbacks: AutofillCallbacks,) {
    this.#callbacks = callbacks;
  }

  /**
   * Debounces an autofill request.
   *
   * @param title - Current title input value
   */
  request(title: string,): void {
    if (this.#timer !== null)
      clearTimeout(this.#timer,);
    if (this.#abort !== null) {
      this.#abort.abort();
      this.#abort = null;
    }
    if (title.trim().length === 0)
      return;

    this.#timer = setTimeout(function triggerAutofill(): void {
      // oxlint-disable-next-line typescript/no-floating-promises -- fire-and-forget
      this.#fetch(title.trim(),);
    }
      .bind(this,), AUTOFILL_DEBOUNCE_MS,);
  }

  /**
   * Sends an autofill request and merges results into empty metadata fields.
   *
   * @param title - Trimmed title text
   */
  async #fetch(title: string,): Promise<void> {
    const controller = new AbortController();
    this.#abort = controller;
    this.loading = true;
    this.#callbacks.updateDisplay();

    try {
      const response = await fetch('/api/ai/autofill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ title, },),
        signal: controller.signal,
      },);

      if (response.ok) {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- API response shape
        const result = (await response.json()) as AutofillResult;
        this.autofilled.clear();
        const state = this.#callbacks.getState();
        const update: Record<string, unknown> = {};

        if (result.tags.length > 0 && state.tags.length === 0) {
          update.tags = result.tags;
          this.autofilled.add('tags',);
        }
        if (result.locations.length > 0 && state.locations.length === 0) {
          update.locations = result.locations;
          this.autofilled.add('locations',);
        }
        if (result.priority !== null && state.priority === null) {
          update.priority = result.priority;
          this.autofilled.add('priority',);
        }
        if (result.complexity !== null && state.complexity === null) {
          update.complexity = result.complexity;
          this.autofilled.add('complexity',);
        }

        this.#callbacks.setState(update,);
      }
    }
    catch (error: unknown) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        console.error('Autofill request failed:', error,);
    }

    this.loading = false;
    this.#callbacks.updateDisplay();
  }
}
