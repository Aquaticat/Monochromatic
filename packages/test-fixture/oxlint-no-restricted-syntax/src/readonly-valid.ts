import {
  opaqueExternalMutation,
  opaqueExternalValues,
} from './readonly-external.fixture.js';

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

/** Unique type-only brand for primitive String conversion coverage. */
declare const STRING_PRIMITIVE_BRAND: unique symbol;

/** Primitive string retaining type-only domain identity. */
type BrandedPrimitiveString = string & {
  readonly [STRING_PRIMITIVE_BRAND]: true;
};

/**
 * Converts only primitive input without caller-owned coercion hooks.
 *
 * @param value - Primitive value converted directly by ECMAScript.
 *
 * @returns text representation.
 */
export function primitiveStringConversion(
  value: string | number | symbol,
): string {
  return String(value,);
}

/**
 * Converts type-branded primitive without treating brand as runtime object state.
 *
 * @param value - Branded primitive string.
 *
 * @returns underlying primitive text.
 */
export function brandedPrimitiveStringConversion(
  value: BrandedPrimitiveString,
): string {
  return String(value,);
}

/**
 * Deliberately runs caller-owned global String coercion hooks.
 *
 * @param value - Unknown value whose conversion behavior is intentionally allowed.
 *
 * @returns caller-defined String conversion result.
 *
 * @mutates value - String may invoke getters, proxy traps, Symbol.toPrimitive, toString, or valueOf on this input.
 */
export function deliberateStringObjectCoercion(value: unknown,): string {
  return String(value,);
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
 * Sends a fresh array of primitive elements through an unknown boundary.
 *
 * The fresh container and primitive elements retain no caller-owned state.
 *
 * @param values - Primitive values copied into owned container.
 */
export function copiedPrimitiveArray(values: readonly string[],): void {
  opaqueExternalValues([...values,],);
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

/**
 * Declares mutating overload contract.
 *
 * @param values - Set cleared by implementation.
 *
 * @mutates values - Clears supplied set in overload contract.
 */
export function clearReadonlyOverload(values: Set<string>,): void;

/**
 * Implements mutating overload contract.
 *
 * @param values - Set cleared by implementation.
 *
 * @mutates values - Clears supplied set in implementation.
 */
export function clearReadonlyOverload(values: Set<string>,): void {
  values.clear();
}
