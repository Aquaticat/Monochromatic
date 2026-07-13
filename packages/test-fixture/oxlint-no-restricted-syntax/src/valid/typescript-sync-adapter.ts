import {
  clearSemanticEffectFixture,
  visitSemanticEffectFixture,
} from './semantic-effects-helper.ts';

/**
 * Generic object used by TypeScript bridge fixture.
 */
export type SemanticFixtureBox<T> = {
  /**
   * Stored fixture value.
   */
  value: T;
};

/**
 * Recursive readonly projection used without package dependency in fixture.
 */
type ReadonlyDeep<T> = {
  readonly [Key in keyof T]: ReadonlyDeep<T[Key]>;
};

/**
 * Reads semantic fixture value.
 *
 * @param box - Fixture box resolved by TypeScript bridge.
 *
 * @returns stored fixture value.
 *
 * @example
 * ```ts
 * readSemanticFixtureBox({ value: 'fixture' });
 * ```
 */
export function readSemanticFixtureBox(box: SemanticFixtureBox<string>,): string {
  return box.value;
}

/**
 * Adds value through ECMAScript collection capability.
 *
 * @param values - Mutable set used for intrinsic provenance fixture.
 */
export function addSemanticFixtureValue(values: Set<string>,): void {
  values.add('fixture',);
}

/**
 * Aborts through DOM capability.
 *
 * @param controller - Abort controller used for intrinsic provenance fixture.
 */
export function abortSemanticFixture(controller: AbortController,): void {
  controller.abort();
}

/**
 * Accepts mutable structural data for classifier fixture.
 *
 * @param mutableObject - Writable structural data.
 */
export function classifyMutableObject(mutableObject: { value: string; },): void {
  void mutableObject;
}

/**
 * Accepts deeply readonly structural data for classifier fixture.
 *
 * @param readonlyObject - Deeply readonly structural data.
 */
export function classifyReadonlyObject(
  readonlyObject: Readonly<SemanticFixtureBox<string>>,
): void {
  void readonlyObject;
}

/**
 * Accepts projected capability that retains abort operation.
 *
 * @param projectedController - Dishonest readonly capability projection.
 */
export function classifyProjectedController(
  projectedController: ReadonlyDeep<AbortController>,
): void {
  void projectedController;
}

/**
 * Accepts original capability for effect-dependent classification.
 *
 * @param capabilityController - Original cancellation capability.
 */
export function classifyCapabilityController(capabilityController: AbortController,): void {
  void capabilityController;
}

/**
 * Accepts standard readonly collection interface.
 *
 * @param readonlyMap - Observational readonly collection.
 */
export function classifyReadonlyMap(
  readonlyMap: ReadonlyMap<string, Readonly<SemanticFixtureBox<string>>>,
): void {
  void readonlyMap;
}

/**
 * Mutates parameter directly.
 *
 * @param directState - Writable caller state.
 */
export function directSemanticEffect(directState: { value: string; },): void {
  directState.value = 'changed';
}

/**
 * Mutates parameter through cross-file helper.
 *
 * @param crossFileValues - Set forwarded to clearing helper.
 */
export function crossFileSemanticEffect(crossFileValues: Set<string>,): void {
  clearSemanticEffectFixture(crossFileValues,);
}

/**
 * Mutates parameter through immediate generic callback invocation.
 *
 * @param callbackState - State forwarded through callback relation.
 */
export function callbackSemanticEffect(callbackState: { value: string; },): void {
  visitSemanticEffectFixture(
    callbackState,
    function mutateVisitedState(visitedState,): void {
      visitedState.value = 'changed';
    },
  );
}

/**
 * Reads capability without invoking mutator.
 *
 * @param readOnlyController - Capability inspected without mutation.
 */
export function noSemanticEffect(readOnlyController: AbortController,): AbortSignal {
  return readOnlyController.signal;
}
