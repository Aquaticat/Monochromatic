/**
 * Destructured parameter name extraction for TSDoc rules.
 *
 * Extracted from `tsdoc-params.ts` to keep files under 100 countable lines.
 *
 * @module
 */

import type { Span, } from '@oxlint/plugins';

/**
 * Unwraps a MethodDefinition or TSAbstractMethodDefinition to its inner
 * function value, or returns the node itself for other function-like types.
 *
 * @param node - AST node representing a function-like declaration
 *
 * @returns inner function node, or undefined when node has no `.value`
 */
function unwrapMethodDefinition(
  node: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if ((node.type === 'MethodDefinition')
    || (node.type === 'TSAbstractMethodDefinition'))
  {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    return node.value as Record<string, unknown> | undefined;
  }
  return node;
}

/**
 * Extracts the raw `params` array from a function-like AST node.
 *
 * @param node - AST node representing a function-like declaration
 *
 * @returns raw parameter AST nodes, or empty array when absent
 */
function extractRawParams(
  node: Record<string, unknown>,
): readonly Record<string, unknown>[] {
  /** Inner function value (for methods) or the node itself; the `.params` array lives here. */
  const target = unwrapMethodDefinition(node,);
  if (target === undefined)
    return [];
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
  return target.params as Record<string, unknown>[] | undefined ?? [];
}

/**
 * Parameters for {@link collectDestructuredNames}.
 */
type CollectDestructuredNamesParams = {
  /** AST binding pattern node. */
  pattern: Record<string, unknown>;
  /** Mutable set to collect names into. */
  names: Set<string>;
};

/**
 * Recursively collects property names from a destructured parameter pattern
 * into the provided set.
 */
function collectDestructuredNames({
  pattern,
  names,
}: CollectDestructuredNamesParams,): void {
  if (pattern.type === 'Identifier') {
    // Named params are handled by extractParamNames, skip here
    return;
  }
  if (pattern.type === 'AssignmentPattern') {
    // `{ a = defaultValue }`: unwrap to the left side
    /** Binding side of `name = default`; recurse on this to collect the actual names. */
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    const left = pattern.left as Record<string, unknown>;
    collectDestructuredNames({
      pattern: left,
      names,
    },);
    return;
  }
  if (pattern.type === 'RestElement') {
    // `...rest` inside destructuring
    /** Inner binding pattern of `...rest`; recurse on this to extract its names. */
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    const argument = pattern.argument as Record<string, unknown>;
    collectDestructuredNames({
      pattern: argument,
      names,
    },);
    return;
  }
  if (pattern.type === 'TSParameterProperty') {
    /** Inner parameter of a TS constructor `public/private` param; recurse on this. */
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    const parameter = pattern.parameter as Record<string, unknown>;
    collectDestructuredNames({
      pattern: parameter,
      names,
    },);
    return;
  }
  if (pattern.type === 'ObjectPattern') {
    /** Property list of the `{ a, b }` pattern; iterated to collect named keys. */
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    const properties = pattern.properties as Record<string, unknown>[] | undefined;
    if (properties === undefined)
      return;
    for (const prop of properties) {
      if (prop.type === 'RestElement') {
        // `{ ...rest }` inside object destructuring
        collectDestructuredNames({
          pattern: prop,
          names,
        },);
      }
      else {
        // Property node; extract the key name
        /** Key node of a destructured property; only `Identifier` keys contribute a name. */
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const key = prop.key as Record<string, unknown> | undefined;
        if ((key !== undefined) && (key.type === 'Identifier')) {
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
          names.add(key.name as string,);
        }
      }
    }
    return;
  }
  if (pattern.type === 'ArrayPattern') {
    // Array destructuring: `[a, b]`: elements are binding patterns
    /** Slot list of `[a, , c]`; `null` slots represent holes that contribute no name. */
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    const elements = pattern.elements as (Record<string, unknown> | null)[] | undefined;
    if (elements === undefined)
      return;
    for (const element of elements) {
      if (element !== null) {
        collectDestructuredNames({
          pattern: element,
          names,
        },);
      }
    }
  }
  // Unknown pattern types are silently ignored
}

/**
 * Collects property names from destructured parameters (ObjectPattern/ArrayPattern).
 *
 * For `function foo({ a, b }: Options)`, returns `['a', 'b']`.
 * For `function foo(x: number, { a }: Options)`, returns `['a']`.
 * Named parameters (Identifier) are excluded since `extractParamNames`
 * already handles those.
 *
 * Supports nested unwrapping through AssignmentPattern (default values),
 * RestElement (rest patterns), and TSParameterProperty (constructor params).
 *
 * @param node - AST node representing a function-like declaration
 *
 * @returns set of property name strings from all destructured parameters
 *
 * @example
 * ```ts
 * // function foo({ value, strs }: Options): void
 * const destructured = extractDestructuredParamNames(node);
 * // Set { 'value', 'strs' }
 * ```
 */
export function extractDestructuredParamNames(
  node: Span & Record<string, unknown>,
): ReadonlySet<string> {
  /** Accumulator populated by the recursive walk; returned as a read-only view. */
  const names = new Set<string>();

  for (const param of extractRawParams(node,)) {
    collectDestructuredNames({
      pattern: param,
      names,
    },);
  }

  return names;
}
