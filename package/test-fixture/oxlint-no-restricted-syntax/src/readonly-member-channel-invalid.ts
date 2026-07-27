/**
 * Fixture probing what a verified member channel may discharge.
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
 * Element exposing nothing writable, so only the call itself can be reported.
 */
type SealedLabel = {
  readonly label: string;
};

/**
 * Reads through a member that exposes no interior state at all.
 *
 * `has` returns a boolean, so nothing reachable from the receiver leaves the call,
 * and `ReadonlyMap.has` reaches no user code. Both conditions hold, so this call
 * must report nothing at all: no opaque boundary, and no read-only offer either,
 * the parameter already being deeply read-only.
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
export function statelessResultEffect(entries: ReadonlyMap<string, SealedLabel>,): boolean {
  return entries.has('label',);
}

/**
 * Reads through a member whose result carries nothing and whose channel is wide.
 *
 * `join` returns a `string`, so nothing reachable from the receiver comes back, and
 * it still calls `toString` on every element. A stateless result therefore proves
 * nothing on its own, which is why the verified channel is a separate condition:
 * `join` is absent from the authority and stays opaque.
 *
 * @param values - Elements coerced by the default separator join.
 *
 * @returns joined text.
 *
 * @example
 * ```ts
 * elementCoercionEffect([]);
 * ```
 */
export function elementCoercionEffect(values: readonly SealedLabel[],): string {
  return values.join(',',);
}

/**
 * Places a caller-owned argument inside a caller-owned receiver.
 *
 * `push` restructures its receiver, reaches nothing but an own-index write, and
 * returns a length. So the receiver claim is fully answered: a mutation, with no
 * remaining uncertainty. The argument claim is untouched by any of that, because
 * `replacement` stays reachable through the array after the call returns.
 *
 * Discharging both claims together is the defect this fixture exists to catch: an
 * answered receiver must not take the argument analysis with it.
 *
 * @param values - Receiver gaining an element.
 *
 * @param replacement - Caller-owned element retained by receiver.
 *
 * @example
 * ```ts
 * retainedArgumentEffect([], { label: 'a' });
 * ```
 */
export function retainedArgumentEffect(
  values: Labelled[],
  replacement: Labelled,
): void {
  values.push(replacement,);
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

/**
 * Rewrites a receiver element handed back by an observer that keeps it.
 *
 * Elements are `string[]`, so the reduce result type is `string[]` as well: a type
 * reference whose only type argument is primitive. Being a generic instantiation
 * says nothing about where the value came from, and reading it as provenance let
 * this discharge while the identical mutation through `rows[0]` was reported.
 * Identity against the instantiated element types separates them.
 *
 * @param rows - Rows whose kept row is rewritten through a result.
 *
 * @example
 * ```ts
 * observerAccumulatorEscapeEffect([]);
 * ```
 */
export function observerAccumulatorEscapeEffect(rows: string[][],): void {
  /**
   * Row returned by an owned observer that keeps the accumulator.
   */
  const first = rows.reduce(function keepFirst(kept: string[],): string[] {
    return kept;
  },);
  first.push('rewritten',);
}

/**
 * Rewrites a receiver element reached by index rather than by a call result.
 *
 * The control for `observerAccumulatorEscapeEffect`: the same caller-owned mutation
 * reached a way the analysis already tracks, so `push` on the alias records a
 * mutation of the parameter and no read-only offer is made. Both functions must
 * agree, and for one build they did not.
 *
 * @param rows - Rows whose first row is rewritten by index.
 *
 * @example
 * ```ts
 * indexedElementControlEffect([]);
 * ```
 */
export function indexedElementControlEffect(rows: string[][],): void {
  /**
   * Row reached by index, whose root is the parameter itself.
   */
  const first = rows[0];
  if (first === undefined)
    throw new Error('Expected a first row to rewrite.',);
  first.push('rewritten',);
}
