/**
 * Alias hops between a verified member result and the position that decides its escape.
 *
 * Every escaping case here was offered `readonly` before the holder set followed aliases,
 * because `resultHolderSymbolIds` collected only the identifier a call directly
 * initializes. The controls carry the other half: enlarging the holder set without
 * skipping declaration and assignment-target occurrences reports every alias and every
 * destructured binding, so a fix that over-reports fails on them rather than passing.
 *
 * @module
 */

/**
 * Mutable nested shape, reachable through a row.
 */
type Child = {
  name: string;
};

/**
 * Mutable element shape carrying both nested state and a primitive.
 */
type Row = {
  label: string;
  child: Child;
};

/**
 * Caller-owned holder reached by property.
 */
type Sink = {
  value: Row | undefined;
};

/**
 * Hands an element back after one alias hop.
 *
 * @param rows - Rows whose first element escapes.
 *
 * @returns first row.
 *
 * @example
 * ```ts
 * returnAfterAliasHop([],);
 * ```
 */
export function returnAfterAliasHop(rows: Row[],): Row | undefined {
  /**
   * Row reached by a verified member call.
   */
  const selected = rows.at(0,);
  /**
   * Alias holding the same row.
   */
  const alias = selected;
  return alias;
}

/**
 * Stores an element into a caller-owned property after one alias hop.
 *
 * Pairs the hop with the store classification added for the unreachable assignment
 * branch, which the hop defeated on its own: the store was reached only from the call's
 * own ascent, and an aliased result never presented one.
 *
 * @param rows - Rows whose first element is stored beyond the callable.
 *
 * @param sink - Holder receiving that element.
 *
 * @example
 * ```ts
 * storeAfterAliasHop([], { value: undefined, },);
 * ```
 */
export function storeAfterAliasHop(rows: Row[], sink: Sink,): void {
  /**
   * Row reached by a verified member call.
   */
  const selected = rows.at(0,);
  /**
   * Alias holding the same row.
   */
  const alias = selected;
  sink.value = alias;
}

/**
 * Hands nested state back after destructuring the element.
 *
 * @param rows - Rows whose first child escapes.
 *
 * @returns first row's child.
 *
 * @example
 * ```ts
 * destructureThenReturn([],);
 * ```
 */
export function destructureThenReturn(rows: Row[],): Child | undefined {
  /**
   * Row reached by a verified member call.
   */
  const selected = rows.at(0,);
  if (selected === undefined)
    return undefined;
  /**
   * Nested state extracted from that row.
   */
  const { child, } = selected;
  return child;
}

/**
 * Hands a primitive back after destructuring the element.
 *
 * @param rows - Rows whose first label is read.
 *
 * @returns first row's label.
 *
 * @example
 * ```ts
 * destructurePrimitiveThenReturn([],);
 * ```
 */
export function destructurePrimitiveThenReturn(rows: Row[],): string {
  /**
   * Row reached by a verified member call.
   */
  const selected = rows.at(0,);
  if (selected === undefined)
    return '';
  /**
   * Primitive extracted from that row, which can hold no caller state.
   */
  const { label, } = selected;
  return label;
}

/**
 * Reads through destructured nested state, never letting it leave.
 *
 * Isolates the binding-element half of the occurrence filter. The escaping destructuring
 * case cannot discriminate it, because that one already keeps opacity through its return,
 * so treating a binding name as an escape would change nothing observable there.
 *
 * @param rows - Rows whose first child name is measured.
 *
 * @returns child name length.
 *
 * @example
 * ```ts
 * destructureReadInPlace([],);
 * ```
 */
export function destructureReadInPlace(rows: Row[],): number {
  /**
   * Row reached by a verified member call.
   */
  const selected = rows.at(0,);
  if (selected === undefined)
    return 0;
  /**
   * Nested state extracted from that row, which stays inside this callable.
   */
  const { child, } = selected;
  return child.name
    .length;
}

/**
 * Reads a primitive through an alias, never letting the element leave.
 *
 * @param rows - Rows whose first label is measured.
 *
 * @returns label length.
 *
 * @example
 * ```ts
 * aliasReadInPlace([],);
 * ```
 */
export function aliasReadInPlace(rows: Row[],): number {
  /**
   * Row reached by a verified member call.
   */
  const selected = rows.at(0,);
  /**
   * Alias holding the same row.
   */
  const alias = selected;
  return alias?.label
    .length ?? 0;
}

/**
 * Reads a primitive through an alias established by assignment.
 *
 * @param rows - Rows whose first label is measured.
 *
 * @returns label length.
 *
 * @example
 * ```ts
 * assignAliasReadInPlace([],);
 * ```
 */
export function assignAliasReadInPlace(rows: Row[],): number {
  /**
   * Local receiving the looked-up row by assignment rather than initializer.
   */
  let held: Row | undefined;
  held = rows.at(0,);
  /**
   * Alias holding the same row.
   */
  const alias = held;
  return alias?.label
    .length ?? 0;
}
