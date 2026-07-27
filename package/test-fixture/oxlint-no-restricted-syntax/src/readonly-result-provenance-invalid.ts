/**
 * Fixture probing where a collection member's result carries receiver state.
 *
 * Every function here mutates caller-owned state reached through a call result
 * rather than through the receiver directly. Nothing currently records that a
 * result aliases the receiver, so each lands on the opaque boundary instead of
 * being attributed to the parameter it actually changes.
 *
 * @module
 */

/**
 * Element carrying mutable state, so an interior write is observable.
 */
type Labelled = {
  label: string;
};

/**
 * Mutates a looked-up value through an intermediate binding.
 *
 * The shape the rule's own `addUncertaintyProvenance` uses, and the reason
 * `readonlyEffectSelfHostingOverride` cannot narrow: `Map.get` reaches no user code
 * and returns a value that carries state, and the body mutates exactly that value.
 *
 * @param facts - Map whose stored set is extended.
 *
 * @param key - Lookup key.
 *
 * @example
 * ```ts
 * boundLookupMutationEffect(new Map(), 'k');
 * ```
 */
export function boundLookupMutationEffect(
  facts: Map<string, Set<string>>,
  key: string,
): void {
  /**
   * Stored set obtained from the receiver, or a fresh accumulator.
   */
  const stored = facts.get(key,) ?? new Set<string>();
  stored.add('recorded',);
  facts.set(
    key,
    stored,
  );
}

/**
 * Mutates a looked-up value with no intermediate binding at all.
 *
 * The chained form. Provenance that only registers variable declarations cannot
 * see this, because there is no binding to register: the receiver of `add` is
 * itself a call expression.
 *
 * @param facts - Map whose stored set is extended in place.
 *
 * @param key - Lookup key.
 *
 * @example
 * ```ts
 * chainedLookupMutationEffect(new Map(), 'k');
 * ```
 */
export function chainedLookupMutationEffect(
  facts: Map<string, Set<string>>,
  key: string,
): void {
  facts.get(key,)
    ?.add('recorded',);
}

/**
 * Writes through a result reached by property access, with no binding.
 *
 * `values.at(0)` hands back an element, and the write targets a property of that
 * element. The write target's root is a call expression rather than an identifier,
 * so root resolution stops before reaching the parameter.
 *
 * @param values - Array whose first element is rewritten.
 *
 * @example
 * ```ts
 * chainedElementWriteEffect([]);
 * ```
 */
export function chainedElementWriteEffect(values: Labelled[],): void {
  /**
   * Element obtained without binding, whose property is overwritten.
   */
  const element = values.at(0,);
  if (element !== undefined)
    element.label = 'rewritten';
}

/**
 * Destructures a looked-up value and mutates the extracted part.
 *
 * Provenance must survive destructuring, or the extracted binding carries no
 * origin and the write is attributed to nothing.
 *
 * @param rows - Map whose stored row is rewritten through a destructured element.
 *
 * @param key - Lookup key.
 *
 * @example
 * ```ts
 * destructuredLookupMutationEffect(new Map(), 'k');
 * ```
 */
export function destructuredLookupMutationEffect(
  rows: Map<string, Labelled[]>,
  key: string,
): void {
  /**
   * Stored row, destructured to its first element.
   */
  const [first,] = rows.get(key,) ?? [];
  if (first !== undefined)
    first.label = 'rewritten';
}

/**
 * Passes a looked-up value to a callee this rule cannot inspect.
 *
 * The escape case. Attributing the mutation is not enough here: once the result
 * leaves through an unresolved call, the parameter it came from must be reported as
 * reaching that call, exactly as a direct argument would be.
 *
 * @param facts - Map whose stored set escapes into an unresolved call.
 *
 * @param key - Lookup key.
 *
 * @example
 * ```ts
 * escapingLookupEffect(new Map(), 'k');
 * ```
 */
export function escapingLookupEffect(
  facts: Map<string, Set<string>>,
  key: string,
): void {
  /**
   * Stored set handed to a host serializer.
   */
  const stored = facts.get(key,);
  if (stored !== undefined)
    JSON.stringify([...stored,],);
}

/**
 * Returns a looked-up value, letting caller-owned state leave the callable.
 *
 * Provenance says this result is reachable from `facts`. Whether a returned alias
 * is itself an effect is a separate question from attribution, and this function
 * exists to pin whichever answer the model gives rather than to assert one.
 *
 * @param facts - Map whose stored set is handed back.
 *
 * @param key - Lookup key.
 *
 * @returns stored set, aliasing receiver interior.
 *
 * @example
 * ```ts
 * returnedLookupEffect(new Map(), 'k');
 * ```
 */
export function returnedLookupEffect(
  facts: Map<string, Set<string>>,
  key: string,
): Set<string> | undefined {
  return facts.get(key,);
}

/**
 * Reads a looked-up value without mutating it.
 *
 * The control. Provenance must not turn every lookup into an effect: this receiver
 * is only read, so it must still be offered as read-only. Absent this, every
 * assertion here would hold against a fixture nothing linted.
 *
 * @param facts - Map read through a lookup.
 *
 * @param key - Lookup key.
 *
 * @returns stored count.
 *
 * @example
 * ```ts
 * readOnlyLookupEffect(new Map(), 'k');
 * ```
 */
export function readOnlyLookupEffect(
  facts: Map<string, Set<string>>,
  key: string,
): number {
  return (facts.get(key,) ?? new Set<string>()).size;
}

/**
 * Mutates a looked-up value reached through computed member access.
 *
 * The syntax-shape probe. `facts['get']` is an element access rather than a property
 * access, and both the result relation and the opaque boundary test for a property
 * access before doing anything, so this call may be invisible to each. Any diagnostic
 * at all is the minimum; silence means a mutation of caller state went unreported.
 *
 * @param facts - Map whose stored set is extended through a computed lookup.
 *
 * @param key - Lookup key.
 *
 * @example
 * ```ts
 * computedLookupMutationEffect(new Map(), 'k');
 * ```
 */
export function computedLookupMutationEffect(
  facts: Map<string, Set<string>>,
  key: string,
): void {
  const stored = facts['get'](key,) ?? new Set<string>();
  stored.add('recorded',);
  facts['set'](key, stored,);
}

/**
 * Mutates a looked-up value narrowed by an assertion.
 *
 * The transparent-form probe: `as` erases at runtime, so the value is the lookup's own.
 *
 * @param facts - Map whose stored set is extended after an assertion.
 *
 * @param key - Lookup key.
 *
 * @example
 * ```ts
 * assertedLookupMutationEffect(new Map(), 'k');
 * ```
 */
export function assertedLookupMutationEffect(
  facts: Map<string, Set<string>>,
  key: string,
): void {
  const stored = facts.get(key,) as Set<string>;
  stored.add('recorded',);
}

/**
 * Restructures a receiver through computed member access.
 *
 * The sharpened syntax-shape probe. Unlike the map cases, `string[]` has an honest
 * deeply read-only projection, so nothing suppresses a suggestion here on grounds of
 * the value type. If computed access is invisible to the collection handling, this
 * parameter is offered as read-only while the body pushes to it, and applying that
 * suggestion does not compile.
 *
 * @param values - Array restructured through a computed member call.
 *
 * @example
 * ```ts
 * computedStructureEffect([]);
 * ```
 */
export function computedStructureEffect(values: string[],): void {
  values['push']('appended',);
}
