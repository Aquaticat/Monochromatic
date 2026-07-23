/**
 * Catalog-free readonly-rule valid fixture.
 *
 * @module
 */

/**
 * Deeply readonly state read without crossing a callable boundary.
 */
type ReadonlyState = {
  readonly label: string;
  readonly nested: {
    readonly count: number;
  };
};

/**
 * Reads primitive leaves from deeply readonly input.
 *
 * @param state - Deeply readonly state.
 *
 * @returns combined primitive description.
 *
 * @example
 * ```ts
 * describeState({ label: 'ready', nested: { count: 1, }, });
 * ```
 */
export function describeState(state: ReadonlyState,): string {
  return `${state.label}:${String(state.nested.count,)}`;
}
