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
 * const merged = $([{ a: 1 }, { a: 1 }]);
 * console.log(merged); // { a: 1 }
 * ```
 *
 * @example
 * Handle number conflicts:
 * ```ts
 * const merged = $([{ count: 1 }, { count: 2 }], {
 *   number: ({ values }) => Math.max(...values)
 * });
 * console.log(merged); // { count: 2 }
 * ```
 *
 * @example
 * Handle string conflicts:
 * ```ts
 * const merged = $([{ name: 'John' }, { name: 'Jane' }], {
 *   string: ({ values }) => values.join(' & ')
 * });
 * console.log(merged); // { name: 'John & Jane' }
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function $<
  const TObjects extends readonly UnknownRecord[],
>(
  objs: TObjects,
  rules?: Partial<ObjectsMergeRules>,
): UnknownRecord {
  if (objs.length === 0)
    throw new TypeError('objs array cannot be empty',);

  if (objs.length === 1) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- single-element array guaranteed by length check
    return objs[0] as UnknownRecord;
  }

  // Collect all unique property names
  const allKeys = new Set<string>();
  for (const obj of objs) {
    for (const key of Object.keys(obj,))
      allKeys.add(key,);
  }

  const result: Record<string, unknown> = {};

  // Process each property
  for (const key of allKeys) {
    result[key] = resolveProperty(
      key,
      objs,
      rules,
    );
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
 */
function resolveProperty(
  key: string,
  objs: readonly UnknownRecord[],
  rules: Partial<ObjectsMergeRules> | undefined,
): unknown {
  // Collect all values for this key across objects
  const allValuesForKey: unknown[] = objs
    .filter(function hasKey(obj,) {
      return key in obj;
    },)
    .map(function getValue(obj,) {
      return obj[key];
    },);

  // Group values by typeof
  const valuesByType = new Map<string, unknown[]>();
  for (const value of allValuesForKey) {
    const valueType = typeof value;
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
  if (valuesByType.size > 1) {
    throw new TypeError(
      `Cannot merge property "${key}": mixed types found: ${
        [...valuesByType.keys(),].join(', ',)
      }`,
    );
  }

  const entries = [...valuesByType.entries(),];
  const [firstEntry,] = entries;
  if (firstEntry === undefined)
    return undefined;

  const [valueType, values,] = firstEntry;

  if (values.length === 1)
    return values[0];

  // Check for consensus using structuredClone round-trip for deep equality
  const [firstValue,] = values;
  const allEqual = values.every(function checkEqual(value,) {
    try {
      const clonedFirst = structuredClone(firstValue,);
      const clonedValue = structuredClone(value,);
      return JSON.stringify(clonedFirst,) === JSON.stringify(clonedValue,);
    }
    catch {
      // Fall back to strict equality for non-cloneable values (functions, symbols)
      return value === firstValue;
    }
  },);

  if (allEqual)
    return firstValue;

  // Apply type-specific conflict resolution rule
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- runtime typeof string narrowed to ObjectsMergeRules key
  const rule = rules?.[valueType as keyof ObjectsMergeRules];
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
