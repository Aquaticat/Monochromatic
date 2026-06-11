import type { UnknownRecord, } from 'type-fest';

import type { ObjectsMergeRules, } from './rules.ts';

export type { ObjectsMergeRules, } from './rules.ts';

/**
 * Merge an array of objects with type-based conflict resolution rules.
 *
 * Combines multiple objects into one by merging their properties according to type-specific rules:
 * - Same property with same value: uses consensus value
 * - Same property with different values: applies type-specific resolution rule if provided
 * - Different properties: merges all properties
 *
 * @param objs - Array of objects to merge
 *
 * @param rules - Type-specific rules for handling conflicts
 *
 * @returns Merged object with all properties from input objects
 *
 * @throws TypeError when no rule provided for conflicting values
 *
 * @throws TypeError when objs array is empty
 *
 * @example
 * Default behavior (throws on conflicts without rules):
 * ```ts
 * const merged = $({ objs: [{ a: 1 }, { a: 1 }] });
 * console.log(merged); // { a: 1 }
 * ```
 *
 * @example
 * Handle number conflicts:
 * ```ts
 * const merged = $({
 *   objs: [{ count: 1 }, { count: 2 }],
 *   rules: { number: ({ values }) => Math.max(...values) },
 * });
 * console.log(merged); // { count: 2 }
 * ```
 *
 * @example
 * Handle string conflicts:
 * ```ts
 * const merged = $({
 *   objs: [{ name: 'John' }, { name: 'Jane' }],
 *   rules: { string: ({ values }) => values.join(' & ') },
 * });
 * console.log(merged); // { name: 'John & Jane' }
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function $<
  const TObjects extends readonly UnknownRecord[],
>({
  objs,
  rules,
}: {
  objs: TObjects;
  rules?: Partial<ObjectsMergeRules>;
},): UnknownRecord {
  if (objs.length
    === 0)
    throw new TypeError('objs array cannot be empty',);

  if (objs.length
    === 1) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- single-element array guaranteed by length check
    return objs[0] as UnknownRecord;
  }

  /**
   * Union of every property name observed across the input objects; drives the per-property merge loop below.
   */
  const allKeys = new Set<string>();
  for (const obj of objs) {
    for (const key of Object.keys(obj,))
      allKeys.add(key,);
  }

  /**
   * Accumulator that receives the resolved value for each property in {@link allKeys}.
   */
  const result: Record<string, unknown> = {};

  // Process each property
  for (const key of allKeys) {
    result[key] = resolveProperty({
      key,
      objs,
      rules,
    },);
  }

  return result;
}

/**
 * Resolves a single property across all objects.
 *
 * @param key - Property key to resolve
 *
 * @param objs - Source objects
 *
 * @param rules - Conflict resolution rules
 *
 * @returns Resolved value for the property
 *
 * @example
 * ```ts
 * const value = resolveProperty({
 *   key: 'count',
 *   objs: [{ count: 1 }, { count: 1 }],
 *   rules: undefined,
 * });
 * // 1
 * ```
 */
function resolveProperty({
  key,
  objs,
  rules,
}: {
  key: string;
  objs: readonly UnknownRecord[];
  rules: Partial<ObjectsMergeRules> | undefined;
},): unknown {
  /**
   * Values seen at `key` across every input object that defined the property; basis for consensus and conflict checks.
   */
  const allValuesForKey: unknown[] = objs
    .filter(function hasKey(obj,) {
      return key in obj;
    },)
    .map(function getValue(obj,) {
      return obj[key];
    },);

  /**
   * Bucketing of {@link allValuesForKey} by `typeof`; lets the mixed-types guard report which types collided.
   */
  const valuesByType = new Map<string, unknown[]>();
  for (const value of allValuesForKey) {
    /**
     * Discriminator used as the {@link valuesByType} key; intentionally `typeof` so the merge rules can target it by name.
     */
    const valueType = typeof value;
    /**
     * Existing bucket for this type, or undefined when this is the first value of that type.
     */
    const existing = valuesByType.get(valueType,);
    if (existing !== undefined)
      existing.push(value,);
    else {
      valuesByType.set(
        valueType,
        [value,],
      );
    }
  }

  // Reject mixed types for the same property
  if (valuesByType.size
    > 1) {
    throw new TypeError(
      `Cannot merge property "${key}": mixed types found: ${
        [...valuesByType.keys(),].join(', ',)
      }`,
    );
  }

  /**
   * Materialised entries of {@link valuesByType}; needed because Map iteration is consumed in a single pass.
   */
  const entries = [...valuesByType.entries(),];
  /**
   * Only entry in the map (the mixed-types guard above ruled out more than one), or undefined when no object defined the key.
   */
  const [firstEntry,] = entries;
  if (firstEntry === undefined)
    return undefined;

  /**
   * Bucket destructured from {@link firstEntry}: the shared typeof and every value seen at this key.
   */
  const [valueType, values,] = firstEntry;

  if (values.length
    === 1)
    return values[0];

  // Check for consensus using structuredClone round-trip for deep equality
  /**
   * Reference value compared against every other value in {@link values} to detect consensus.
   */
  const [firstValue,] = values;
  /**
   * True when every value in {@link values} is deep-equal to {@link firstValue}; lets us skip the rule when the conflict is only apparent.
   */
  const allEqual = values.every(function checkEqual(value,) {
    try {
      /**
       * Deep clone of {@link firstValue}; JSON-stringified for structural comparison without identity coupling.
       */
      const clonedFirst = structuredClone(firstValue,);
      /**
       * Deep clone of the value under test; paired with {@link clonedFirst} for structural comparison.
       */
      const clonedValue = structuredClone(value,);
      return JSON.stringify(clonedFirst,)
        === JSON
        .stringify(clonedValue,);
    }
    catch {
      // Fall back to strict equality for non-cloneable values (functions, symbols)
      return value === firstValue;
    }
  },);

  if (allEqual)
    return firstValue;

  // Apply type-specific conflict resolution rule
  /* oxlint-disable typescript/no-unsafe-type-assertion -- runtime typeof string narrowed to ObjectsMergeRules key */
  /**
   * Resolver registered for {@link valueType} in `rules`, or undefined when the caller did not register one.
   */
  const rule = rules?.[valueType as keyof ObjectsMergeRules];
  /* oxlint-enable typescript/no-unsafe-type-assertion */
  if (!rule) {
    throw new TypeError(
      `Cannot merge property "${key}": conflicting ${valueType} values and no rule provided`,
    );
  }

  return rule({
    key,
    // oxlint-disable-next-line typescript/no-explicit-any, typescript/no-unsafe-type-assertion, typescript/no-unsafe-assignment -- values array type depends on runtime typeof check
    values: values as any,
  },);
}
