// Fixture: valid bodyless mutation contracts.
// Expected: zero tsdoc/check-mutates violations.

/**
 * Service with a mutating method.
 */
type MutatingService = {
  /**
   * Changes caller-owned state.
   *
   * @param value - Caller-owned state.
   *
   * @mutates value - Changes caller-owned state.
   */
  mutate(value: { count: number; },): void;
};

/**
 * Callable mutation contract.
 */
type MutatingCallback = {
  /**
   * Changes caller-owned state.
   *
   * @param value - Caller-owned state.
   *
   * @mutates value - Changes caller-owned state.
   */
  (value: { count: number; },): void;
};

export type {
  MutatingCallback,
  MutatingService,
};
