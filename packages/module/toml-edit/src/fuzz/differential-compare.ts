/**
 * Type-level semantic equality for two `toml-test` tagged trees.
 *
 * The differential oracle (`differential-oracle.ts`) compares our decoder's
 * tagged JSON against the BurntSushi reference decoder's tagged JSON. The two
 * encode the same TOML value with spec-equivalent but textually different
 * spellings: an offset datetime round-trips through `Date` on our side (a
 * trailing `.000Z`, millisecond resolution) while the reference keeps its source
 * spelling, a float is formatted by two different shortest-decimal routines, and
 * a local datetime may join its date and time with a space or a `T`. This module
 * normalizes those equivalences so a remaining inequality is a genuine parse
 * divergence, not a spelling artifact.
 *
 * Scope is strictly type-level equivalence: a spelling difference that holds for
 * every value of a type lives here. A one-off, impl-defined disagreement on a
 * specific input belongs in the oracle's documented allow-list, never here, so
 * the comparator never silently excuses an input it was not meant to.
 *
 * Offset datetimes compare as instants at millisecond resolution, because our
 * decoder emits them through `Date.toISOString`; sub-millisecond precision is
 * deliberately not distinguished.
 *
 * @module
 */

/**
 * Character length of a `YYYY-MM-DD` date, which is also the index of the
 * date/time separator in a local or offset datetime spelling.
 */
const DATE_SEGMENT_LENGTH = 10;

/**
 * Narrow an unknown value to a non-array object.
 *
 * @param value - Candidate parsed-JSON node.
 *
 * @returns Whether `value` is a plain object (table) rather than an array or
 *          primitive.
 *
 * @example
 * ```ts
 * isRecord({ a: 1, }); // true
 * ```
 */
function isRecord(value: unknown,): value is Record<string, unknown> {
  return ((typeof value) === 'object') && (value !== null)
    && (!Array.isArray(value,));
}

/**
 * Narrow an unknown value to a tagged scalar leaf.
 *
 * A leaf carries a string `type` discriminant; a table never does (a table key
 * literally named `type` maps to an object, not a string), so the string check
 * cleanly separates the two.
 *
 * @param value - Candidate parsed-JSON node.
 *
 * @returns Whether `value` is a `{ type, value }` tagged scalar.
 *
 * @example
 * ```ts
 * isTaggedLeaf({ type: 'integer', value: '1', }); // true
 * ```
 */
function isTaggedLeaf(
  value: unknown,
): value is {
  readonly type: string;
  readonly value: string
} {
  return isRecord(value,) && ((typeof value.type) === 'string')
    && ((typeof value.value) === 'string');
}

/**
 * Parse a `toml-test` float payload to a JS number, including the non-finite
 * spellings TOML defines.
 *
 * @param payload - Float payload string (`inf`, `-inf`, `nan`, or a decimal).
 *
 * @returns Numeric value, with `NaN` for every nan spelling.
 *
 * @example
 * ```ts
 * parseFloatPayload({ payload: '-inf', }); // -Infinity
 * ```
 */
function parseFloatPayload({ payload, }: { readonly payload: string; },): number {
  if ((payload === 'nan') || (payload === '+nan')
    || (payload === '-nan'))
    return Number.NaN;
  if ((payload === 'inf') || (payload === '+inf'))
    return Number.POSITIVE_INFINITY;
  if (payload === '-inf')
    return Number.NEGATIVE_INFINITY;
  return Number(payload,);
}

/**
 * Compare two float payloads numerically, treating any two nan spellings as
 * equal.
 *
 * @param ours - Payload from our decoder.
 *
 * @param reference - Payload from the reference decoder.
 *
 * @returns Whether the two denote the same float value.
 *
 * @example
 * ```ts
 * floatPayloadEquals({ ours: 'nan', reference: '-nan', }); // true
 * ```
 */
function floatPayloadEquals(
  {
    ours,
    reference,
  }: {
    readonly ours: string;
    readonly reference: string
  },
): boolean {
  /**
   * Numeric value of our payload.
   */
  const left = parseFloatPayload({ payload: ours, },);
  /**
   * Numeric value of the reference payload.
   */
  const right = parseFloatPayload({ payload: reference, },);
  if (Number.isNaN(left,) && Number.isNaN(right,))
    return true;
  return left === right;
}

/**
 * Uppercase the date/time separator of a datetime spelling so a space and a `T`
 * compare equal.
 *
 * Dates and times with no separator at the date index pass through unchanged.
 *
 * @param value - Datetime, date, or time spelling.
 *
 * @returns Spelling whose date/time separator, if any, is `T`.
 *
 * @example
 * ```ts
 * normalizeDateTimeSeparator({ value: '1979-05-27 07:32:00', }); // '1979-05-27T07:32:00'
 * ```
 */
function normalizeDateTimeSeparator(
  { value, }: { readonly value: string; },
): string {
  if (value.length <= DATE_SEGMENT_LENGTH)
    return value;
  /**
   * Character occupying the date/time separator position.
   */
  const separator = value[DATE_SEGMENT_LENGTH];
  if ((separator === ' ') || (separator === 't')
    || (separator === 'T'))
    return `${value.slice(
      0,
      DATE_SEGMENT_LENGTH,
    )}T${value.slice(DATE_SEGMENT_LENGTH + 1,)}`;
  return value;
}

/**
 * Compare two offset-datetime payloads as instants at millisecond resolution.
 *
 * @param ours - Payload from our decoder.
 *
 * @param reference - Payload from the reference decoder.
 *
 * @returns Whether the two denote the same instant; unparseable spellings fall
 *          back to exact string equality so a malformed payload is not silently
 *          treated as equal.
 *
 * @example
 * ```ts
 * instantEquals({ ours: '1979-05-27T07:32:00.000Z', reference: '1979-05-27T07:32:00Z', }); // true
 * ```
 */
function instantEquals(
  {
    ours,
    reference,
  }: {
    readonly ours: string;
    readonly reference: string
  },
): boolean {
  /**
   * Our instant in epoch milliseconds.
   */
  const left = Date.parse(normalizeDateTimeSeparator({ value: ours, },),);
  /**
   * Reference instant in epoch milliseconds.
   */
  const right = Date.parse(normalizeDateTimeSeparator({ value: reference, },),);
  if (Number.isNaN(left,) || Number.isNaN(right,))
    return ours === reference;
  return left === right;
}

/**
 * Compare two tagged leaves of the same shape.
 *
 * A type mismatch is a genuine divergence (the two parsers disagree on the
 * value's kind), so it returns false. Otherwise the payload is compared per
 * type: integers as `BigInt`, floats numerically, offset datetimes as instants,
 * local datetimes after separator normalization, and strings and booleans
 * exactly.
 *
 * @param ours - Leaf from our decoder.
 *
 * @param reference - Leaf from the reference decoder.
 *
 * @returns Whether the two leaves denote the same value.
 *
 * @example
 * ```ts
 * leafEquals({
 *   ours: { type: 'integer', value: '255', },
 *   reference: { type: 'integer', value: '255', },
 * }); // true
 * ```
 */
function leafEquals(
  {
    ours,
    reference,
  }: {
    readonly ours: {
      readonly type: string;
      readonly value: string
    };
    readonly reference: {
      readonly type: string;
      readonly value: string
    };
  },
): boolean {
  if (ours.type !== reference.type)
    return false;
  if (ours.type === 'integer')
    return BigInt(ours.value,) === BigInt(reference.value,);
  if (ours.type === 'float')
    return floatPayloadEquals({
      ours: ours.value,
      reference: reference.value,
    },);
  if (ours.type === 'datetime')
    return instantEquals({
      ours: ours.value,
      reference: reference.value,
    },);
  if ((ours.type === 'datetime-local') || (ours.type === 'date-local')
    || (ours.type === 'time-local'))
    return normalizeDateTimeSeparator({ value: ours.value, },)
      === normalizeDateTimeSeparator({ value: reference.value, },);
  return ours.value === reference.value;
}

/**
 * Recursively compare two tagged trees for type-level semantic equality.
 *
 * Leaves compare by {@link leafEquals}; arrays compare element-wise; tables
 * compare key set and each value. A category mismatch (leaf versus array versus
 * table) is a divergence.
 *
 * @param ours - Tagged tree from our decoder.
 *
 * @param reference - Tagged tree from the reference decoder.
 *
 * @returns Whether the two trees are semantically equal.
 *
 * @example
 * ```ts
 * taggedSemanticEquals({
 *   ours: { a: { type: 'integer', value: '1', }, },
 *   reference: { a: { type: 'integer', value: '1', }, },
 * }); // true
 * ```
 */
export function taggedSemanticEquals(
  {
    ours,
    reference,
  }: {
    readonly ours: unknown;
    readonly reference: unknown
  },
): boolean {
  if (isTaggedLeaf(ours,) && isTaggedLeaf(reference,))
    return leafEquals({
      ours,
      reference,
    },);
  if (isTaggedLeaf(ours,) || isTaggedLeaf(reference,))
    return false;
  if (Array.isArray(ours,) && Array.isArray(reference,)) {
    /**
     * Our tree viewed as a generic array.
     */
    const left = ours as readonly unknown[];
    /**
     * Reference tree viewed as a generic array.
     */
    const right = reference as readonly unknown[];
    if (left.length !== right.length)
      return false;
    return left.every(function sameItem(
      item,
      index,
    ) {
      return taggedSemanticEquals({
        ours: item,
        reference: right[index],
      },);
    },);
  }
  if (Array.isArray(ours,) || Array.isArray(reference,))
    return false;
  if (isRecord(ours,) && isRecord(reference,)) {
    /**
     * Keys of our table.
     */
    const keys = Object.keys(ours,);
    if (keys.length
      !== Object.keys(reference,)
      .length)
      return false;
    return keys.every(function sameValue(key,) {
      return Object.hasOwn(
        reference,
        key,
      )
        && taggedSemanticEquals({
          ours: ours[key],
          reference: reference[key],
        },);
    },);
  }
  return false;
}
