/**
 * Query parameter helpers for import attribute rewriting.
 *
 * Encodes and decodes the `__importattr` query parameter
 * used to tag rewritten specifiers.
 *
 * @module
 */

//region Constants

/** Query parameter name used to encode the attribute type in rewritten specifiers. */
export const ATTR_QUERY_KEY = '__importattr';

//endregion Constants

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
  /** Offset of the attribute marker; -1 signals the ID has no encoded attribute. */
  const queryIndex = id.indexOf(`?${ATTR_QUERY_KEY}=`,);
  if (queryIndex === -1)
    return undefined;
  /** Position immediately after `?<key>=`, where the value substring begins. */
  const valueStart = queryIndex + ATTR_QUERY_KEY.length + 2;
  /** Boundary `&` introducing a subsequent query parameter, if any. */
  const ampIndex = id.indexOf(
    '&',
    valueStart,
  );
  if (ampIndex === -1)
    return id.slice(valueStart,);
  return id.slice(
    valueStart,
    ampIndex,
  );
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
  /** Offset of the attribute marker; -1 means the ID is already clean. */
  const queryIndex = id.indexOf(`?${ATTR_QUERY_KEY}=`,);
  if (queryIndex === -1)
    return id;
  return id.slice(
    0,
    queryIndex,
  );
}

//endregion Query helpers
