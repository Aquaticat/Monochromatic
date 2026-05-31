/**
 * Destructured parameter name extraction for TSDoc rules.
 *
 * Extracted from `tsdoc-params.ts` to keep files under 100 countable lines.
 *
 * @module
 */

import type { Span, } from '@oxlint/plugins';

import {
  extractRawParams,
  isRecord,
  isRecordArray,
  type ReadonlyRecord,
} from './ast-access.ts';

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
  node: Span & ReadonlyRecord,
): ReadonlySet<string> {
  /**
   * Accumulator populated by the recursive walk; returned as a read-only view.
   */
  const names = new Set<string>();

  /**
   * Recursively collects property names from a binding pattern into the
   * enclosing `names` set.
   *
   * @param pattern - AST binding pattern node
   */
  function collect(pattern: ReadonlyRecord,): void {
    if (pattern.type
      === 'Identifier') {
      // Named params are handled by extractParamNames, skip here
      return;
    }
    if (pattern.type
      === 'AssignmentPattern') {
      /**
       * Binding side of `name = default`; recurse on it to collect the actual names.
       */
      const { left, } = pattern;
      if (isRecord(left,))
        collect(left,);
      return;
    }
    if (pattern.type
      === 'RestElement') {
      /**
       * Inner binding pattern of `...rest`; recurse on it to extract its names.
       */
      const { argument, } = pattern;
      if (isRecord(argument,))
        collect(argument,);
      return;
    }
    if (pattern.type
      === 'TSParameterProperty') {
      /**
       * Inner parameter of a TS constructor `public/private` param; recurse on it.
       */
      const { parameter, } = pattern;
      if (isRecord(parameter,))
        collect(parameter,);
      return;
    }
    if (pattern.type
      === 'ObjectPattern') {
      /**
       * Property list of the `{ a, b }` pattern; iterated to collect named keys.
       */
      const { properties, } = pattern;
      if (!isRecordArray(properties,))
        return;
      for (const prop of properties) {
        if (prop.type
          === 'RestElement') {
          // `{ ...rest }` inside object destructuring
          collect(prop,);
          continue;
        }
        // Property node; only `Identifier` keys contribute a name
        /**
         * Key node of a destructured property; only `Identifier` keys contribute a name.
         */
        const { key, } = prop;
        if (!isRecord(key,))
          continue;
        if (key.type
          !== 'Identifier')
          continue;
        /**
         * Identifier text of the key; added to `names` only when it is a string.
         */
        const { name, } = key;
        if ((typeof name)
          === 'string')
          names.add(name,);
      }
      return;
    }
    if (pattern.type
      === 'ArrayPattern') {
      // Array destructuring `[a, , c]`: hole slots (non-records) contribute no name
      /**
       * Slot list of `[a, , c]`; non-record hole slots contribute no name.
       */
      const { elements, } = pattern;
      if (!isRecordArray(elements,))
        return;
      for (const element of elements) {
        if (isRecord(element,))
          collect(element,);
      }
    }
    // Unknown pattern types are silently ignored
  }

  for (const param of extractRawParams(node,))
    collect(param,);

  return names;
}
