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
