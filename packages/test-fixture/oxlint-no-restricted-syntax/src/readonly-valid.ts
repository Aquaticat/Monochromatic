/**
 * Reads honestly readonly data.
 *
 * @param state - Immutable caller state.
 */
export function readReadonlyState(state: { readonly value: string; },): string {
  return state.value;
}

/**
 * Clears caller-owned set intentionally.
 *
 * @param values - Mutable caller collection.
 *
 * @mutates values - Clears caller-owned values before reuse.
 */
export function clearReadonlyFixture(values: Set<string>,): void {
  values.clear();
}

/**
 * Reads capability without invoking mutation.
 *
 * @param controller - Cancellation capability inspected without transition.
 */
export function readControllerSignal(controller: AbortController,): AbortSignal {
  return controller.signal;
}

/**
 * Bodyless owned mutation contract.
 */
export type ReadonlyFixtureMutator = {
  /**
   * Changes supplied state.
   *
   * @param state - Mutable state supplied by caller.
   *
   * @mutates state - Changes state according to implementation contract.
   */
  (state: { value: string; },): void;
};
