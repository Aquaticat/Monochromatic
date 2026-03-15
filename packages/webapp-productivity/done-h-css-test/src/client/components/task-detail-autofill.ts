/**
 * Autofill manager for `<task-detail>` -- debounced AI metadata suggestion.
 *
 * Encapsulates the timer, abort controller, and autofill state so the main
 * component class stays focused on rendering and event wiring.
 */
import type { AutofillResult, MetadataState } from "./task-detail-types.ts";
import { AUTOFILL_DEBOUNCE_MS } from "./task-detail-types.ts";

/** Options for an autofill request. */
type AutofillRequestOptions = {
  /** Current title text from the input field. */
  title: string;
  /** Mutable metadata state -- autofill writes directly into this object. */
  metadata: MetadataState;
  /** Called after autofill state changes (loading start/end, result applied). */
  onUpdate: () => void;
};

/**
 * Manages debounced AI autofill requests for task metadata.
 *
 * Tracks loading state and which fields were auto-populated so the UI
 * can style autofilled pills differently.
 */
export class AutofillManager {
  #timer: ReturnType<typeof setTimeout> | null = null;
  #abort: AbortController | null = null;

  /** Whether an autofill request is currently in flight. */
  loading = false;

  /** Set of field names that were populated by the last autofill response. */
  autofilled = new Set<string>();

  /** Clears all pending state -- call on reconfigure. */
  reset(): void {
    this.autofilled.clear();
    this.loading = false;
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    if (this.#abort !== null) {
      this.#abort.abort();
      this.#abort = null;
    }
  }

  /**
   * Debounces an autofill request so rapid typing does not flood the endpoint.
   *
   * @param options - Title, metadata state, and update callback
   */
  request(options: AutofillRequestOptions): void {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
    }
    if (this.#abort !== null) {
      this.#abort.abort();
      this.#abort = null;
    }
    if (options.title.trim().length === 0) return;

    this.#timer = setTimeout(() => {
      this.#fetch(options);
    }, AUTOFILL_DEBOUNCE_MS);
  }

  /**
   * Sends an autofill request and merges results into empty metadata fields.
   * Abortable: a new request cancels any in-flight one.
   */
  async #fetch({ title, metadata, onUpdate }: AutofillRequestOptions): Promise<void> {
    const controller = new AbortController();
    this.#abort = controller;
    this.loading = true;
    onUpdate();

    try {
      const response = await fetch("/api/ai/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
        signal: controller.signal,
      });

      if (!response.ok) return;

      const result = (await response.json()) as AutofillResult;
      this.autofilled.clear();

      if (result.tags.length > 0 && metadata.tags.length === 0) {
        metadata.tags = result.tags;
        this.autofilled.add("tags");
      }
      if (result.locations.length > 0 && metadata.locations.length === 0) {
        metadata.locations = result.locations;
        this.autofilled.add("locations");
      }
      if (result.priority !== null && metadata.priority === null) {
        metadata.priority = result.priority;
        this.autofilled.add("priority");
      }
      if (result.complexity !== null && metadata.complexity === null) {
        metadata.complexity = result.complexity;
        this.autofilled.add("complexity");
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Autofill request failed:", error);
    } finally {
      this.loading = false;
      onUpdate();
    }
  }
}
