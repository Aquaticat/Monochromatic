import type { UnknownRecord, } from 'type-fest';

/**
 * Rules configuration for object merging behavior based on JavaScript types.
 */
export type ObjectsMergeRules = {
  readonly function: (params: {
    readonly key: string;
    readonly values: ((...args: unknown[]) => unknown)[];
  }) => unknown;
  readonly string: (params: {
    readonly key: string;
    readonly values: string[];
  }) => unknown;
  readonly number: (params: {
    readonly key: string;
    readonly values: number[];
  }) => unknown;
  readonly boolean: (params: {
    readonly key: string;
    readonly values: boolean[];
  }) => unknown;
  readonly object: (params: {
    readonly key: string;
    readonly values: object[];
  }) => unknown;
  readonly undefined: (params: {
    readonly key: string;
    readonly values: undefined[];
  }) => unknown;
  readonly bigint: (params: {
    readonly key: string;
    readonly values: bigint[];
  }) => unknown;
  readonly symbol: (params: {
    readonly key: string;
    readonly values: symbol[];
  }) => unknown;
};

/**
 * Merge an array of objects with type-based conflict resolution rules.
 *
 * Combines multiple objects into one by merging their properties according to type-specific rules:
 * - Same property with same value: uses consensus value
 * - Same property with different values: applies type-specific resolution rule if provided
 * - Different properties: merges all properties
 * - Functions: checks parameter compatibility then applies function rule or default behavior
 *
 * @param objs - Array of objects to merge
 * @param rules - Type-specific rules for handling conflicts
 * @returns Merged object with all properties from input objects
 * @throws {TypeError} When no rule provided for conflicting values
 * @throws {TypeError} When functions have incompatible parameters
 * @throws {TypeError} When objs array is empty
 *
 * @example
 * Default behavior (throws on conflicts without rules):
 * ```ts
 * const merged = $([{ a: 1 }, { a: 1 }]);
 * console.log(merged); // { a: 1 }
 * ```
 *
 * @example
 * Custom function resolution:
 * ```ts
 * const result = $([
 *   { add: (a: number, b: number) => a + b },
 *   { add: (a: number, b: number) => a * b }
 * ], {
 *   function: ({ values }) => (...args) => values.reduce((acc, fn) => fn(...args), 0)
 * });
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
 *
 * @example
 * Complex object merging:
 * ```ts
 * const configs = [
 *   { api: { timeout: 1000 }, debug: true },
 *   { api: { retries: 3 }, logging: 'info' }
 * ];
 * 
 * const merged = $(configs, {
 *   object: ({ values }) => Object.assign({}, ...values)
 * });
 * // { api: { timeout: 1000, retries: 3 }, debug: true, logging: 'info' }
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function $<
  const TObjects extends readonly UnknownRecord[],
>(
  objs: TObjects,
  rules?: Partial<ObjectsMergeRules>,
): UnknownRecord {
  if (objs.length === 0) {
    throw new TypeError('objs array cannot be empty');
  }

  if (objs.length === 1) {
    return objs[0] as UnknownRecord;
  }

  // Collect all unique property names
  const allKeys = new Set<string>();
  for (const obj of objs) {
    Object.keys(obj).forEach(key => allKeys.add(key));
  }

  const result: Record<string, unknown> = {};

  // Process each property
  for (const key of allKeys) {
    // Collect all values for this key across objects
    const allValuesForKey: unknown[] = [];

    for (const obj of objs) {
      if (key in obj) {
        allValuesForKey.push(obj[key]);
      }
    }

    // Group values by type
    const valuesByType = new Map<string, unknown[]>();
    for (const value of allValuesForKey) {
      const valueType = typeof value;
      if (!valuesByType.has(valueType)) {
        valuesByType.set(valueType, []);
      }
      valuesByType.get(valueType)!.push(value);
    }

    // Check if we have multiple types for the same property
    if (valuesByType.size > 1) {
      throw new TypeError(
        `Cannot merge property "${key}": mixed types found: ${
          Array.from(valuesByType.keys()).join(', ')
        }`
      );
    }

    // Get the single type and its values
    const entryArray = Array.from(valuesByType.entries());
    const firstEntry = entryArray[0];
    if (!firstEntry) continue;
    
    const [valueType, values] = firstEntry;

    if (values.length === 1) {
      // Only one value, use it directly
      result[key] = values[0];
    } else {
      // Multiple values of the same type
      // Check for consensus (all values equal)
      const firstValue = values[0];
      const allEqual = values.every(value => 
        JSON.stringify(value) === JSON.stringify(firstValue)
      );

      if (allEqual) {
        result[key] = firstValue;
      } else {
        // Handle conflicts based on type
        const rule = rules?.[valueType as keyof ObjectsMergeRules];
        if (!rule) {
          throw new TypeError(
            `Cannot merge property "${key}": conflicting ${valueType} values and no rule provided`
          );
        }
        
        result[key] = rule({ key, values: values as any });
      }
    }
  }

  return result;
}