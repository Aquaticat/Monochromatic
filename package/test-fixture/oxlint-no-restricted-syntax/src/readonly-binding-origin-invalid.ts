/**
 * Fixture probing which parameters a local alias is credited with holding.
 *
 * @module
 */

/**
 * Element carrying mutable state, so a structural mutation is observable.
 */
type Labelled = {
  label: string;
};

/**
 * Mutates through a local reassigned from a second parameter.
 *
 * Both parameters reach the `push`, because either can be what `cursor` holds when
 * the call runs, so neither may be offered as read-only. An earlier revision stored
 * one origin per binding and overwrote on the second registration, which credited
 * the mutation to whichever branch registered last and offered the other parameter
 * as read-only. Applying that suggestion failed to compile with
 * `error TS2339: Property 'push' does not exist on type 'readonly Labelled[]'`.
 *
 * Reverting accumulation to overwrite in `registerBindingOrigin` must fail the
 * assertion naming this function.
 *
 * @param first - Candidate mutated when flag is set.
 *
 * @param second - Candidate mutated when flag is clear.
 *
 * @param flag - Selects which parameter alias holds.
 *
 * @example
 * ```ts
 * reassignedAliasEffect([], [], true);
 * ```
 */
export function reassignedAliasEffect(
  first: Labelled[],
  second: Labelled[],
  flag: boolean,
): void {
  /**
   * Alias holding either parameter by the time the mutation runs.
   */
  let cursor = second;
  if (flag)
    cursor = first;
  cursor.push({ label: 'appended', },);
}

/**
 * Mutates through a local reassigned from a parameter and a local array.
 *
 * The control separating "accumulates every origin" from "credits every parameter".
 * Only `only` is a parameter, so only `only` may be reported; the fresh array
 * contributes no origin and must not widen the report to anything else.
 *
 * @param only - Sole parameter reachable through alias.
 *
 * @param flag - Selects whether alias holds parameter or fresh array.
 *
 * @example
 * ```ts
 * partiallyForeignAliasEffect([], true);
 * ```
 */
export function partiallyForeignAliasEffect(
  only: Labelled[],
  flag: boolean,
): void {
  /**
   * Alias holding either the parameter or state this callable owns.
   */
  let cursor: Labelled[] = [];
  if (flag)
    cursor = only;
  cursor.push({ label: 'appended', },);
}

/**
 * Mutates through a local whose first origin is unconditionally overwritten.
 *
 * The documented cost of accumulating origins without tracking flow. Only `reached`
 * can be what the alias holds when the mutation runs, yet `shadowed` is credited too
 * and loses a read-only offer it deserves. That direction is safe, unlike the
 * overwrite it replaced: withholding an offer costs a suggestion, while making one
 * for a mutated parameter emits an annotation that does not compile.
 *
 * @param shadowed - Parameter aliased and then displaced before any use.
 *
 * @param reached - Parameter actually mutated through alias.
 *
 * @example
 * ```ts
 * flowInsensitiveAliasEffect([], []);
 * ```
 */
export function flowInsensitiveAliasEffect(
  shadowed: Labelled[],
  reached: Labelled[],
): void {
  /**
   * Alias whose only reachable value at the mutation is the second parameter.
   */
  let cursor = shadowed;
  cursor = reached;
  cursor.push({ label: 'appended', },);
}

/**
 * Reads a parameter through an alias without mutating anything.
 *
 * The positive control proving this fixture reaches the rule at all. Every other
 * assertion here checks that a parameter is *not* offered as read-only, which a file
 * nothing linted would satisfy just as well. This function must be offered, so the
 * absence of its diagnostic means the fixture stopped being analyzed rather than
 * that the analysis got stricter.
 *
 * @param values - Parameter read through alias and never written.
 *
 * @returns element count.
 *
 * @example
 * ```ts
 * readAliasEffect([]);
 * ```
 */
export function readAliasEffect(values: Labelled[],): number {
  /**
   * Alias carrying the parameter into a read.
   */
  const cursor = values;
  return cursor.length;
}
