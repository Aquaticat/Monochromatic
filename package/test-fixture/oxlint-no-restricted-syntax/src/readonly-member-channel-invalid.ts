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

/**
 * Iterates the keys of a map whose key type is primitive.
 *
 * The one shape a channel entry discharges on its own. `keys` returns
 * `MapIterator<string>`, whose only type argument is primitive, so nothing reachable
 * from the receiver comes back and the verified channel is the sole outstanding
 * claim. Removing the iterator entries from the authority puts an opacity report for
 * `entries.keys` back.
 *
 * @param entries - Read-only view whose keys are counted.
 *
 * @returns total key length.
 *
 * @example
 * ```ts
 * primitiveKeyIterationEffect(new Map());
 * ```
 */
export function primitiveKeyIterationEffect(
  entries: ReadonlyMap<string, SealedLabel>,
): number {
  /**
   * Running total, accumulated across every key.
   */
  const measured = { total: 0, };
  for (const key of entries.keys())
    measured.total += key.length;
  return measured.total;
}

/**
 * Iterates the indices of an array, which are primitive whatever it holds.
 *
 * `Array.keys` yields numbers, so the element type never reaches the result and the
 * discharge does not depend on what the array holds. This is the array half of the
 * same claim, and it is the member whose drainage fetches no element at all.
 *
 * @param values - Elements whose indices are summed.
 *
 * @returns total of every index.
 *
 * @example
 * ```ts
 * indexIterationEffect([]);
 * ```
 */
export function indexIterationEffect(values: readonly SealedLabel[],): number {
  /**
   * Running total, accumulated across every index.
   */
  const measured = { total: 0, };
  for (const index of values.keys())
    measured.total += index;
  return measured.total;
}

/**
 * Iterates the values of a map, which hands back what the receiver holds.
 *
 * A verified channel proves nothing about what comes back, and `values` returns
 * `MapIterator<SealedLabel>`, whose type argument is an object. Nothing tracks the
 * yielded element as an alias of the receiver, so the boundary stays. Deeply
 * read-only elements do not change this: the exposure test asks whether an object can
 * be reached, not whether it can be written.
 *
 * @param entries - Read-only view whose values are counted.
 *
 * @returns total label length.
 *
 * @example
 * ```ts
 * heldValueIterationEffect(new Map());
 * ```
 */
export function heldValueIterationEffect(
  entries: ReadonlyMap<string, SealedLabel>,
): number {
  /**
   * Running total, accumulated across every held value.
   */
  const measured = { total: 0, };
  for (const held of entries.values())
    measured.total += held.label.length;
  return measured.total;
}

/**
 * Iterates the pairs of a map whose keys and values are both primitive.
 *
 * The limit the entries do not lift. `entries` returns `MapIterator<[string, string]>`,
 * and a tuple is an object however primitive its positions are, so the exposure test
 * answers yes and the boundary stays even here. Lifting it needs a relation
 * describing a container whose elements are receiver state, which
 * `FRESH_CONTAINER_MEMBER_NAMES` records as unbuilt.
 *
 * @param entries - Read-only view whose pairs are counted.
 *
 * @returns total of every key and value length.
 *
 * @example
 * ```ts
 * primitivePairIterationEffect(new Map());
 * ```
 */
export function primitivePairIterationEffect(
  entries: ReadonlyMap<string, string>,
): number {
  /**
   * Running total, accumulated across every pair.
   */
  const measured = { total: 0, };
  for (const [key, held,] of entries.entries())
    measured.total += key.length + held.length;
  return measured.total;
}

/**
 * Folds a fresh array of receiver elements down to a number.
 *
 * The control deciding what a container result relation would be worth. The array
 * literal carries the parameter's origin today, with no new relation needed, so this
 * measures the one gate that would then matter: whether a higher-order member with an
 * owned callback and a primitive result is answered before the channel check.
 * `recordReadonlyViewApplications` runs first and requires exactly what this call
 * supplies, a result carrying nothing, an argument carrying nothing, and a callback
 * resolving to owned source.
 *
 * Its sibling `observerAccumulatorEscapeEffect` is the same member answering the other
 * way, because its result aliases the receiver's own element type. The pair is the
 * point: `reduce` is not opaque by virtue of being higher-order.
 *
 * @param records - Elements folded to a total.
 *
 * @returns total label length.
 *
 * @example
 * ```ts
 * spreadAccumulatorEffect([]);
 * ```
 */
export function spreadAccumulatorEffect(records: readonly SealedLabel[],): number {
  return [...records,].reduce(function total(
    count: number,
    held: SealedLabel,
  ): number {
    return count + held.label.length;
  }, 0,);
}
