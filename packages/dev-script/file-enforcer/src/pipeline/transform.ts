import { getProperty as dotPropGet, } from 'dot-prop';

/**
 * Removes duplicate lines from a string, preserving first occurrence order.
 *
 * @param content - Multiline string to deduplicate
 *
 * @returns Content with duplicate lines removed
 *
 * @example
 * ```ts
 * dedup('a\nb\na\nc');
 * // 'a\nb\nc'
 * ```
 */
export function dedup(content: string,): string {
  return [...new Set(content.split('\n',),),].join('\n',);
}

/**
 * Extracts a nested property from JSON content using a dot-separated path.
 * Uses `dot-prop` under the hood -- supports simple dot notation (`.a.b.c`),
 * not the full JSONPath query language.
 *
 * @param path - Dot-separated path with leading dot (e.g., `.rules`, `.settings.env`)
 *
 * @param content - JSON string to parse and extract from
 *
 * @returns Extracted value as a string (stringified if not already a string)
 *
 * @example
 * ```ts
 * getProperty('.rules', '{"rules":{"no-var":"error"}}');
 * // '{"no-var":"error"}'
 * ```
 */
export function getProperty(
  path: string,
  content: string,
): string {
  /** Parsed JSON value */
  const parsed: unknown = JSON.parse(content,);
  /** Extracted value at the dot-path (slice(1) removes leading dot) */
  const extracted: unknown = dotPropGet(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse returns unknown, dot-prop requires Record
    parsed as Record<string, unknown>,
    path.slice(1,),
  );
  return typeof extracted === 'string' ? extracted : JSON.stringify(
    extracted,
    null,
    2,
  );
}
