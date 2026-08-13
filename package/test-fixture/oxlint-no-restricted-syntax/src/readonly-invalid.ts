import {
  type OpaqueExternalService,
  opaqueExternalMutation,
} from './readonly-external.fixture.js';

/**
 * Mutable local projection used to test projected callable-capability retention.
 */
type ReadonlyDeep<T> = {
  readonly [Key in keyof T]: ReadonlyDeep<T[Key]>;
};

/**
 * Reads mutable object through unnecessarily writable contract.
 *
 * @param state - Caller state read without mutation.
 */
export function mutableReadonlyFixture(state: { value: string; },): string {
  return state.value;
}

/**
 * Claims mutation that implementation does not perform.
 *
 * @param controller - Capability inspected without transition.
 *
 * @mutates controller - Claims a transition absent from body.
 */
export function staleMutationContract(controller: AbortController,): AbortSignal {
  return controller.signal;
}

/**
 * Claims readonly projection while retaining cancellation capability.
 *
 * @param controller - Readonly projection retaining callable capability.
 */
export function projectedReadonlyCapability(
  controller: ReadonlyDeep<AbortController>,
): AbortSignal {
  return controller.signal;
}

/**
 * Sends parameter through uncatalogued external boundary.
 *
 * @param state - State crossing unresolved external callable.
 */
export function opaqueReadonlyEffect(state: { readonly value: string; },): string {
  return JSON.stringify(state,);
}

/**
 * Documents uncertainty while retaining contradictory readonly type.
 *
 * @param state - Readonly state crossing unresolved serializer.
 *
 * @returns serialized state.
 *
 * @mutates state - JSON.stringify may invoke caller-owned accessors, proxy traps, or toJSON hooks.
 */
export function documentedUncertaintyReadonly(
  state: { readonly value: string; },
): string {
  return JSON.stringify(state,);
}

/**
 * Documents direct unresolved effect for transitive propagation fixture.
 *
 * @param state - Mutable state crossing unresolved serializer.
 *
 * @returns serialized state.
 *
 * @mutates state - JSON.stringify may invoke caller-owned accessors, proxy traps, or toJSON hooks.
 */
function documentedUncertaintyAdapter(state: { value: string; },): string {
  return JSON.stringify(state,);
}

/**
 * Forwards documented uncertainty without its own required contract.
 *
 * @param state - Mutable state forwarded to uncertain adapter.
 *
 * @returns serialized state.
 */
export function undocumentedUncertaintyWrapper(state: { value: string; },): string {
  return documentedUncertaintyAdapter(state,);
}

/**
 * Calls unknown method through external service input.
 *
 * @param service - External service with unavailable implementation.
 */
export function opaqueMethodEffect(service: OpaqueExternalService,): void {
  service
    .write();
}

/**
 * Converts unknown value through global String coercion hooks.
 *
 * @param error - Unknown value that may carry caller-owned conversion methods.
 *
 * @returns coerced text.
 */
export function stringObjectCoercionEffect(error: unknown,): string {
  return String(error,);
}

/**
 * Documents only part of global String's possible coercion behavior.
 *
 * @param incomplete - Unknown value with incompletely documented hooks.
 *
 * @returns coerced text.
 *
 * @mutates incomplete - String may invoke toString on this input.
 */
export function incompleteStringCoercionContract(incomplete: unknown,): string {
  return String(incomplete,);
}

/**
 * Sends destructured inputs through unsafe serialization.
 *
 * @param state - Structured value sent to serializer.
 *
 * @param label - Label packaged with structured value.
 */
export function destructuredOpaqueEffect({
  state,
  label,
}: {
  readonly state: { readonly value: string; };
  readonly label: string;
},): string {
  return JSON.stringify({ state, label, },);
}

/**
 * Uses unrelated URL instead of naming opaque upstream callable.
 *
 * @param state - State sent through undocumented external boundary.
 *
 * @mutates state - See https://example.test/unrelated-contract.
 */
export function unrelatedLinkReadonlyAdapter(state: { value: string; },): void {
  opaqueExternalMutation(state,);
}
