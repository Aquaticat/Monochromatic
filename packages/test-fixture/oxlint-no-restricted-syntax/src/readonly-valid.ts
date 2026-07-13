import { opaqueExternalMutation, } from './readonly-external.fixture.js';

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

/**
 * Documents uncatalogued external effect at local adapter boundary.
 *
 * @param state - State forwarded to external mutation boundary.
 *
 * @mutates state - Delegates caller state to opaqueExternalMutation.
 */
export function readonlyExternalAdapter(state: { value: string; },): void {
  opaqueExternalMutation(state,);
}

/**
 * Propagates verified local adapter effect to caller contract.
 *
 * @param state - State forwarded through verified adapter.
 *
 * @mutates state - Delegates caller state to readonlyExternalAdapter.
 */
export function callReadonlyExternalAdapter(state: { value: string; },): void {
  readonlyExternalAdapter(state,);
}
