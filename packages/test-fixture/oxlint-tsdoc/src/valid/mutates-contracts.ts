// Fixture: valid mutation-contract documentation.
// Expected: zero tsdoc rule violations.

/**
 * Mutable state used by mutation-contract fixtures.
 */
type MutableState = {
  /**
   * Current count.
   */
  count: number;
};

/**
 * Increments caller-owned state.
 *
 * @param value - Caller-owned state.
 *
 * @mutates value - Increments caller-owned count.
 */
function increment(value: MutableState,): void {
  value.count++;
}

/**
 * Increments destructured caller-owned state.
 *
 * @param value - Caller-owned nested state.
 *
 * @mutates value - Increments caller-owned nested count.
 */
function incrementDestructured({ value, }: { value: MutableState; },): void {
  value.count++;
}

export {};
