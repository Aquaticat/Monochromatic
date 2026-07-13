import { opaqueExternalMutation, } from './readonly-external.fixture.js';

/**
 * Mutable local projection used to test dishonest capability retention.
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
 * Mutates collection without publishing effect contract.
 *
 * @param values - Caller collection cleared by body.
 */
export function missingMutationContract(values: Set<string>,): void {
  values.clear();
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
 * @param controller - Dishonestly projected capability.
 */
export function dishonestReadonlyCapability(
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
