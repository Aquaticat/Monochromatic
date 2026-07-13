// Fixture: bodyless mutation-contract target violations.
// Expected violations:
//   tsdoc(check-mutates): unknown targets on method, call, and ambient signatures

/**
 * Service with a mutating method.
 */
type MutatingService = {
  /**
   * Changes caller-owned state.
   *
   * @param value - Caller-owned state.
   *
   * @mutates wrong - Changes caller-owned state.
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
   * @mutates wrong - Changes caller-owned state.
   */
  (value: { count: number; },): void;
};

/**
 * Changes caller-owned state through an ambient signature.
 *
 * @param value - Caller-owned state.
 *
 * @mutates wrong - Changes caller-owned state.
 */
declare function mutateAmbient(value: { count: number; },): void;

export type {
  MutatingCallback,
  MutatingService,
};

export { mutateAmbient, };
