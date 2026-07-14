/**
 * Typed accessors for decoded Figma Kiwi data.
 *
 * `parseFigmaFile` yields deeply dynamic structures whose leaves are `unknown`
 * once a `NodeChange` is treated as a `Record<string, unknown>`. Reading those
 * leaves directly trips the type-safety rules (`no-unsafe-*`,
 * `no-non-null-assertion`, `no-base-to-string`). Routing every read through the
 * guards and coercions here keeps the conversion code free of unchecked casts.
 *
 * @module figma-read
 */

/**
 * Sentinel returned by converters whose input has no Penpot counterpart.
 *
 * The repo bans `T | null` and `T | undefined` unions, so "no result" is
 * expressed with a unique `Symbol` rather than a nullish value; callers compare
 * with `=== SKIP` instead of a truthiness check.
 */
export const SKIP: unique symbol = Symbol('Penpot input has no convertible counterpart',);

/**
 * Read-only view of a decoded Figma node or struct.
 *
 * Conversion functions only read their Figma inputs;
 * this alias records that observer contract at each conversion boundary.
 */
export type FigmaRecord = Readonly<Record<string, unknown>>;

/**
 * Narrow `unknown` to a plain keyed object.
 *
 * Centralises the single safe assertion point so call sites read fields off a
 * narrowed `Record` instead of asserting `as Record<string, unknown>`.
 *
 * @param value - candidate decoded from Figma data
 *
 * @returns whether value is a non-null object usable as a record
 *
 * @example
 * ```ts
 * if (isRecord(nc.guid)) {
 *   const sessionId = numberOr({ value: nc.guid.sessionID, fallback: 0, });
 * }
 * ```
 */
export function isRecord(value: unknown,): value is Record<string, unknown> {
  return ((typeof value) === 'object') && (value !== null);
}

/**
 * Read a numeric field, substituting a fallback when absent or wrong-typed.
 *
 * @param value - raw field value of unknown type
 *
 * @param fallback - number used when value is not a number
 *
 * @returns value when it is a number, otherwise fallback
 *
 * @example
 * ```ts
 * const opacity = numberOr({ value: paint.opacity, fallback: 1, });
 * ```
 */
export function numberOr(
  {
    value,
    fallback,
  }: Readonly<{
    value: unknown;
    fallback: number;
  }>,
): number {
  return ((typeof value) === 'number') ? value : fallback;
}

/**
 * Read a string field, substituting a fallback when absent or wrong-typed.
 *
 * @param value - raw field value of unknown type
 *
 * @param fallback - string used when value is not a string
 *
 * @returns value when it is a string, otherwise fallback
 *
 * @example
 * ```ts
 * const name = stringOr({ value: nc.name, fallback: 'Unnamed', });
 * ```
 */
export function stringOr(
  {
    value,
    fallback,
  }: Readonly<{
    value: unknown;
    fallback: string;
  }>,
): string {
  return ((typeof value) === 'string') ? value : fallback;
}

/**
 * Coerce a primitive-or-absent value to a string without stringifying objects.
 *
 * Replaces `String(value ?? '')`, which trips `no-base-to-string` because an
 * object value would render as `"[object Object]"`. Only primitives are
 * stringified; everything else becomes the empty string.
 *
 * @param value - raw field value of unknown type
 *
 * @returns string form of a primitive value, or empty string otherwise
 *
 * @example
 * ```ts
 * const nodeType = asString(nc.type);
 * ```
 */
export function asString(value: unknown,): string {
  if ((typeof value) === 'string')
    return value;
  if (((typeof value) === 'number') || ((typeof value) === 'boolean'))
    return String(value,);
  return '';
}

/**
 * Read an array field as records, dropping non-object and non-array shapes.
 *
 * Replaces `(value ?? []) as Record<string, unknown>[]` with a checked pass
 * that keeps only record-shaped elements.
 *
 * @param value - raw field value of unknown type
 *
 * @returns record elements of value when it is an array, otherwise empty
 *
 * @example
 * ```ts
 * for (const paint of recordArray(nc.fillPaints)) { ... }
 * ```
 */
export function recordArray(value: unknown,): Record<string, unknown>[] {
  if (!Array.isArray(value,))
    return [];
  /**
   * Record-shaped elements kept from the source array.
   */
  const records: Record<string, unknown>[] = [];
  for (const element of value) {
    if (isRecord(element,))
      records.push(element,);
  }
  return records;
}
