/**
 * AST-based extraction of import attribute types.
 *
 * Extracts `type` values from import attributes on static import/export
 * declarations and from dynamic import options, using the parsed AST
 * instead of fragile regex patterns.
 *
 * OXC's runtime AST uses `type: "Literal"` for all literals while the
 * `@oxc-project/types` declarations use `"StringLiteral"`. This module
 * uses `typeof value === 'string'` checks for safe narrowing.
 *
 * @module
 */

// oxlint-disable typescript/no-unsafe-type-assertion -- runtime AST types differ from @oxc-project/types declarations

import type { ESTree, } from 'rolldown/utils';

import { HANDLERS, } from './handlers.ts';

//region Helpers

/**
 * Extracts a string property key name from an AST property key node.
 * Handles both identifier keys and string literal keys.
 *
 * @param key - AST property key node
 *
 * @returns key name as string, or `undefined` for computed/non-string keys
 */
function getPropertyKeyName(key: ESTree.PropertyKey,): string | undefined {
  if (key.type === 'Identifier')
    return key.name;
  if ('value' in key && typeof key.value === 'string')
    return key.value;
  return undefined;
}

/**
 * Extracts a string value from an AST expression node if it is a string literal.
 *
 * @param node - AST expression node
 *
 * @returns string value if the node is a string literal, `undefined` otherwise
 */
export function getStringLiteralValue(node: ESTree.Expression,): string | undefined {
  if ('value' in node && typeof node.value === 'string')
    return node.value as string;
  return undefined;
}

//endregion Helpers

/**
 * Extracts the attribute type value from a static import/export declaration's
 * `attributes` array.
 *
 * Looks for an attribute with key `type` whose value is a supported handler type.
 *
 * @param attributes - import attribute nodes from the AST
 *
 * @returns supported attribute type string, or `undefined` if none found
 *
 * @example
 * ```ts
 * // For: import x from './file.sql' with { type: 'text' }
 * extractTypeFromAttributes(node.attributes); // 'text'
 * ```
 */
export function extractTypeFromAttributes(
  attributes: readonly ESTree.ImportAttribute[],
): string | undefined {
  for (const attr of attributes) {
    const key = attr.key.type === 'Identifier'
      ? attr.key.name
      : attr.key.value;
    if (key === 'type' && HANDLERS[attr.value.value] !== undefined)
      return attr.value.value;
  }
  return undefined;
}

/**
 * Extracts the attribute type from a dynamic import's options expression.
 *
 * Handles the `{ with: { type: '...' } }` pattern used in dynamic `import()`.
 *
 * @param options - options expression from `ImportExpression.options`
 *
 * @returns supported attribute type string, or `undefined` if the options
 * do not contain a recognized `with.type` value
 *
 * @example
 * ```ts
 * // For: import('./file.sql', { with: { type: 'text' } })
 * extractTypeFromOptions(node.options); // 'text'
 * ```
 */
export function extractTypeFromOptions(
  options: ESTree.Expression,
): string | undefined {
  if (options.type !== 'ObjectExpression')
    return undefined;

  for (const prop of options.properties) {
    if (prop.type !== 'Property')
      continue;

    const key = getPropertyKeyName(prop.key,);
    if (key !== 'with' || prop.value.type !== 'ObjectExpression')
      continue;

    for (const innerProp of prop.value.properties) {
      if (innerProp.type !== 'Property')
        continue;

      const innerKey = getPropertyKeyName(innerProp.key,);
      const innerValue = getStringLiteralValue(innerProp.value,);
      if (innerKey === 'type'
        && innerValue !== undefined
        && HANDLERS[innerValue] !== undefined)
      {
        return innerValue;
      }
    }
  }

  return undefined;
}
