/**
 * Fixture probing what a verified-inert collection member may discharge.
 *
 * @module
 */

/**
 * Element carrying mutable state, so interior escape is observable.
 */
type Labelled = {
  label: string;
};

/**
 * Reads through a member that exposes no interior state at all.
 *
 * `has` returns a boolean, so nothing reachable from the receiver leaves the
 * call. A verified-inert member with a stateless result is the one case where
 * receiver opacity is dischargeable.
 *
 * @param entries - Read-only view whose membership is queried.
 *
 * @returns whether a fixed key is present.
 *
 * @example
 * ```ts
 * statelessResultEffect(new Map());
 * ```
 */
export function statelessResultEffect(entries: ReadonlyMap<string, Labelled>,): boolean {
  return entries.has('label',);
}

/**
 * Mutates state obtained from an inert member's result.
 *
 * `at` runs no user code, yet hands back an element of the receiver. Nothing
 * registers a call result as an alias of the receiver's parameter, so the
 * assignment below is attributed to no parameter and only the opaque boundary
 * reports it. Discharging receiver opacity for members whose result can carry
 * mutable state would drop this entirely.
 *
 * @param values - Array whose first element is rewritten through a result.
 *
 * @example
 * ```ts
 * interiorEscapeEffect([{ label: 'a' }]);
 * ```
 */
export function interiorEscapeEffect(values: Labelled[],): void {
  /**
   * Element obtained from an inert accessor, aliasing receiver interior.
   */
  const first = values.at(0,);
  if (first === undefined)
    throw new Error('Expected a first element to rewrite.',);
  first.label = 'rewritten';
}

/**
 * Mutates state obtained from an observer member whose result is one element.
 *
 * `find` takes an owned observer, so the element-flow derivation answers what
 * user code runs, and its result is `Labelled | undefined`, a union rather than
 * a generic instantiation. A species gate reading only the result's type
 * arguments sees none and discharges the whole call, dropping the assignment
 * below.
 *
 * @param values - Array whose matching element is rewritten through a result.
 *
 * @example
 * ```ts
 * observerResultEscapeEffect([{ label: 'target' }]);
 * ```
 */
export function observerResultEscapeEffect(values: Labelled[],): void {
  /**
   * Matching element obtained through an owned predicate.
   */
  const found = values.find(function isTarget(candidate: { readonly label: string; },): boolean {
    return candidate.label === 'target';
  },);
  if (found === undefined)
    throw new Error('Expected a match to rewrite.',);
  found.label = 'rewritten';
}
