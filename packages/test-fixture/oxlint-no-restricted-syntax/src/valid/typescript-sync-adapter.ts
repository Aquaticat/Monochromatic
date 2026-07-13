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
