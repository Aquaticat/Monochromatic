/**
 * Regex patterns and query parameter helpers for import attribute rewriting.
 *
 * Contains the static/dynamic import matching patterns and functions
 * to encode/decode the `__importattr` query parameter.
 *
 * @module
 */

//region Constants

/** Query parameter name used to encode the attribute type in rewritten specifiers. */
export const ATTR_QUERY_KEY = '__importattr';

//endregion Constants

//region Transform patterns

/**
 * Matches static import/export declarations with `with { type: '...' }` attributes.
 *
 * Captures:
 * - Group 1: Everything before the specifier (e.g. `import x from `)
 * - Group 2: Quote character used for the specifier
 * - Group 3: The specifier string (e.g. `./file.sql`)
 * - Group 4: The quote + `with` clause including the type value
 * - Group 5: The attribute type value (e.g. `text`)
 *
 * Handles both single and double quotes, and optional semicolons.
 * Does not match dynamic `import()` expressions (handled separately).
 */
export const STATIC_IMPORT_WITH_RE = new RegExp(
  String.raw`((?:import|export)\s+(?:(?:type\s+)?(?:(?:[\w$*{}\s,]+)\s+from|)\s+))(['"])([^'"]+)(\2\s+with\s*\{\s*type\s*:\s*['"](\w+)['"]\s*\})`,
  'g',
);

/**
 * Matches dynamic `import()` expressions with attribute options containing `with: { type: '...' }`.
 *
 * Captures:
 * - Group 1: `import(`
 * - Group 2: Quote character
 * - Group 3: The specifier string
 * - Group 4: Everything after the specifier up through the `with` clause
 * - Group 5: The attribute type value
 *
 * @example Matches `import('./file.sql', { with: { type: 'text' } })`
 */
export const DYNAMIC_IMPORT_WITH_RE = new RegExp(
  String.raw`(import\s*\(\s*)(['"])([^'"]+)(\2\s*,\s*\{\s*with\s*:\s*\{\s*type\s*:\s*['"](\w+)['"]\s*\}\s*\})`,
  'g',
);

//endregion Transform patterns

//region Query helpers

/**
 * Extracts the attribute type from a module ID's query parameter.
 *
 * @param id - Module ID potentially containing `?__importattr=<type>`
 *
 * @returns Attribute type string if present, `undefined` otherwise
 *
 * @example
 * ```ts
 * extractAttrType('./file.sql?__importattr=text'); // 'text'
 * extractAttrType('./file.sql'); // undefined
 * ```
 */
export function extractAttrType(id: string,): string | undefined {
  const queryIndex = id.indexOf(`?${ATTR_QUERY_KEY}=`,);
  if (queryIndex === -1)
    return undefined;
  const valueStart = queryIndex + ATTR_QUERY_KEY.length + 2;
  const ampIndex = id.indexOf('&', valueStart,);
  if (ampIndex === -1)
    return id.slice(valueStart,);
  return id.slice(valueStart, ampIndex,);
}

/**
 * Strips the `__importattr` query parameter from a module ID,
 * returning the clean file path.
 *
 * @param id - Module ID with `?__importattr=<type>`
 *
 * @returns File path without the attribute query parameter
 *
 * @example
 * ```ts
 * stripAttrQuery('./file.sql?__importattr=text'); // './file.sql'
 * ```
 */
export function stripAttrQuery(id: string,): string {
  const queryIndex = id.indexOf(`?${ATTR_QUERY_KEY}=`,);
  if (queryIndex === -1)
    return id;
  return id.slice(0, queryIndex,);
}

//endregion Query helpers
