/**
 * Shared helpers for reading the untyped host AST exposed by `@oxlint/plugins`.
 *
 * The oxlint plugin API surfaces AST nodes as opaque `Span` objects whose
 * child properties are untyped, so reads land on `unknown`. These guards
 * narrow `unknown` to the record / array shapes the TSDoc rules walk,
 * without a banned nullish union and without an unchecked `as` assertion
 * (a type-predicate body carries the narrowing instead).
 *
 * @module
 */

/** Readonly view of an untyped AST node's property bag. */
export type ReadonlyRecord = Readonly<Record<string, unknown>>;

/**
 * Narrows an unknown value to a readonly AST record.
 *
 * @param value - candidate read from an untyped AST property
 *
 * @returns whether value is a non-null object usable as a property bag
 *
 * @example
 * ```ts
 * if (isRecord(node.value)) { node.value.type; }
 * ```
 */
export function isRecord(value: unknown,): value is ReadonlyRecord {
  return ((typeof value)
    === 'object') && (value !== null);
}

/**
 * Narrows an unknown value to a readonly array of AST records.
 *
 * Element membership is not re-checked per item; AST child arrays hold
 * node objects, so callers treat each element as a record and guard the
 * rare hole (`null` array slot) with {@link isRecord} at the use site.
 *
 * @param value - candidate read from an untyped AST property
 *
 * @returns whether value is an array
 *
 * @example
 * ```ts
 * if (isRecordArray(node.params)) { for (const p of node.params) {} }
 * ```
 */
export function isRecordArray(value: unknown,): value is readonly ReadonlyRecord[] {
  return Array.isArray(value,);
}

/**
 * Unwraps a MethodDefinition / TSAbstractMethodDefinition to its inner
 * function value; returns the node itself for other function-like types.
 *
 * Real parsed methods always carry a `.value` FunctionExpression, so the
 * inner lookup never falls through; the node-itself branch covers the
 * non-method function-like types that have no wrapper.
 *
 * @param node - function-like AST node
 *
 * @returns inner function value for methods, otherwise node unchanged
 *
 * @example
 * ```ts
 * const fn = unwrapMethodDefinition(methodNode);
 * ```
 */
export function unwrapMethodDefinition(node: ReadonlyRecord,): ReadonlyRecord {
  if ((node.type
    === 'MethodDefinition')
    || (node.type
      === 'TSAbstractMethodDefinition'))
  {
    /** Inner FunctionExpression of the method; carries the return-type and params info. */
    const { value, } = node;
    if (isRecord(value,))
      return value;
  }
  return node;
}

/**
 * Extracts the raw `params` array from a function-like AST node.
 *
 * @param node - function-like AST node
 *
 * @returns parameter AST records; empty when the node declares none
 *
 * @example
 * ```ts
 * for (const param of extractRawParams(node)) { extractBindingName(param); }
 * ```
 */
export function extractRawParams(node: ReadonlyRecord,): readonly ReadonlyRecord[] {
  /** Inner function value (for methods) or node itself; the `.params` array lives here. */
  const target = unwrapMethodDefinition(node,);
  /** Raw `.params`; unknown until narrowed to an array of records. */
  const { params, } = target;
  if (isRecordArray(params,))
    return params;
  return [];
}
