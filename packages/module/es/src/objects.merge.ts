import { equal, } from './any.equal.ts';
import { functionsMapWith, } from './functions.mapWith.ts';
import type { Logged, } from './logged.basic.ts';
import { getDefaultLogger, } from './string.log.ts';

/**
 * Rules configuration for object merging behavior based on JavaScript types.
 */
export type MergeRules = {
  readonly function?: (params: {
    readonly key: string;
    readonly values: ((...args: unknown[]) => unknown)[];
  },) => unknown;
  readonly string?: (params: {
    readonly key: string;
    readonly values: string[];
  },) => unknown;
  readonly number?: (params: {
    readonly key: string;
    readonly values: number[];
  },) => unknown;
  readonly boolean?: (params: {
    readonly key: string;
    readonly values: boolean[];
  },) => unknown;
  readonly object?: (params: {
    readonly key: string;
    readonly values: object[];
  },) => unknown;
  readonly undefined?: (params: {
    readonly key: string;
    readonly values: undefined[];
  },) => unknown;
  readonly bigint?: (params: {
    readonly key: string;
    readonly values: bigint[];
  },) => unknown;
  readonly symbol?: (params: {
    readonly key: string;
    readonly values: symbol[];
  },) => unknown;
};

/**
 * Default rules for handling conflicts by type.
 */
const defaultRules: Required<MergeRules> = {
  function: ({ key, values, },) => {
    // Default: create a function that calls functionsMapWith
    return (...args: unknown[]) => {
      return functionsMapWith({
        fns: values,
        args: args as any,
        l: getDefaultLogger(),
      },);
    };
  },
  string: ({ key, },) => {
    throw new TypeError(
      `No resolution rule provided for string conflicts on property "${key}"`,
    );
  },
  number: ({ key, },) => {
    throw new TypeError(
      `No resolution rule provided for number conflicts on property "${key}"`,
    );
  },
  boolean: ({ key, },) => {
    throw new TypeError(
      `No resolution rule provided for boolean conflicts on property "${key}"`,
    );
  },
  object: ({ key, values, },) => {
    // Default: recursively merge objects
    return objectsMerge({
      objs: values as Record<string, unknown>[],
      l: getDefaultLogger(),
    },);
  },
  undefined: ({ key, },) => {
    throw new TypeError(
      `No resolution rule provided for undefined conflicts on property "${key}"`,
    );
  },
  bigint: ({ key, },) => {
    throw new TypeError(
      `No resolution rule provided for bigint conflicts on property "${key}"`,
    );
  },
  symbol: ({ key, },) => {
    throw new TypeError(
      `No resolution rule provided for symbol conflicts on property "${key}"`,
    );
  },
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
 * @param params - Configuration object for merging operation
 * @param params.objs - Array of objects to merge
 * @param params.rules - Type-specific rules for handling conflicts
 * @param params.l - Logger for tracing operations
 * @returns Merged object with all properties from input objects
 * @throws {TypeError} When no rule provided for conflicting values
 * @throws {TypeError} When functions have incompatible parameters
 * @throws {TypeError} When objs array is empty
 *
 * @example
 * ```ts
 * // Default behavior (throws on conflicts without rules)
 * objectsMerge({ objs: [{ a: 1 }, { a: 1 }] });
 * // Returns: { a: 1 }
 *
 * // Functions with incompatible parameters throw error
 * objectsMerge({ objs: [{ a: () => 1 }, { a: (c: string) => c }] });
 * // Throws: "fn params incompatible"
 *
 * // Custom function resolution
 * objectsMerge({
 *   objs: [{ a: (c: string) => c }, { a: () => true }],
 *   rules: {
 *     function: ({ values }) => values.length
 *   }
 * });
 * // Returns: { a: 2 }
 *
 * // Handle number conflicts
 * objectsMerge({
 *   objs: [{ a: 1 }, { a: 2 }],
 *   rules: {
 *     number: ({ values }) => Math.max(...values)
 *   }
 * });
 * // Returns: { a: 2 }
 *
 * // Handle string conflicts
 * objectsMerge({
 *   objs: [{ name: 'John' }, { name: 'Jane' }],
 *   rules: {
 *     string: ({ values }) => values.join(' & ')
 *   }
 * });
 * // Returns: { name: 'John & Jane' }
 * ```
 */
export function objectsMerge<
  const TObjects extends readonly Record<string, unknown>[],
>(
  {
    objs,
    rules = {},
    l = getDefaultLogger(),
  }: {
    readonly objs: TObjects;
    readonly rules?: MergeRules;
  } & Partial<Logged>,
): Record<string, unknown> {
  l.debug('objectsMerge',);

  if (objs.length === 0)
    throw new TypeError('objs array cannot be empty',);

  if (objs.length === 1)
    return { ...objs[0], };

  // Merge user rules with defaults
  const effectiveRules = { ...defaultRules, ...rules, };

  // Collect all unique property names
  const allKeys = new Set<string>();
  for (const obj of objs)
    Object.keys(obj,).forEach(key => allKeys.add(key,));

  const result: Record<string, unknown> = {};

  // Process each property
  for (const key of allKeys) {
    const valuesByType = new Map<string, unknown[]>();

    // Collect all values for this key grouped by type
    for (const obj of objs) {
      if (key in obj) {
        const value = obj[key];
        const valueType = typeof value;

        if (!valuesByType.has(valueType,))
          valuesByType.set(valueType, [],);
        valuesByType.get(valueType,)!.push(value,);
      }
    }

    l.debug(
      `Processing key "${key}": types found: ${
        Array
          .from(valuesByType.keys(),)
          .join(', ',)
      }`,
    );

    // Check if we have multiple types for the same property
    if (valuesByType.size > 1) {
      throw new TypeError(
        `Cannot merge property "${key}": mixed types found: ${
          Array
            .from(valuesByType.keys(),)
            .join(', ',)
        }`,
      );
    }

    // Get the single type and its values
    const entryArray = Array.from(valuesByType.entries(),);
    const firstEntry = entryArray[0];
    if (!firstEntry) {
      // This should never happen if we have values, but TypeScript needs the check
      continue;
    }
    const [valueType, values,] = firstEntry;

    if (values.length === 1) {
      // Only one value, use it directly
      result[key] = values[0];
    }
    else {
      // Multiple values of the same type
      // Check for consensus first
      const firstValue = values[0];
      const allEqual = values.every((value: unknown,) => equal(firstValue, value,));

      if (allEqual)
        result[key] = firstValue;
      else {
        // Handle conflicts based on type
        result[key] = resolveTypeConflict(key, valueType, values, effectiveRules, l,);
      }
    }
  }

  return result;
}

/**
 * Internal function to resolve conflicts for a specific type.
 */
function resolveTypeConflict(
  key: string,
  valueType: string,
  values: unknown[],
  rules: Required<MergeRules>,
  l: ReturnType<typeof getDefaultLogger>,
): unknown {
  l.debug(`Resolving ${valueType} conflict for key "${key}"`,);

  switch (valueType) {
    case 'function': {
      const fns = values as ((...args: unknown[]) => unknown)[];

      // Check function parameter compatibility
      if (!areParametersCompatible(fns,))
        throw new TypeError('fn params incompatible',);

      return rules.function({ key, values: fns, },);
    }

    case 'string':
      return rules.string({ key, values: values as string[], },);

    case 'number':
      return rules.number({ key, values: values as number[], },);

    case 'boolean':
      return rules.boolean({ key, values: values as boolean[], },);

    case 'object':
      return rules.object({ key, values: values as object[], },);

    case 'undefined':
      return rules.undefined({ key, values: values as undefined[], },);

    case 'bigint':
      return rules.bigint({ key, values: values as bigint[], },);

    case 'symbol':
      return rules.symbol({ key, values: values as symbol[], },);

    default:
      throw new TypeError(`Unknown type "${valueType}" for property "${key}"`,);
  }
}

/**
 * Check if functions have compatible parameter signatures.
 * Functions are compatible if they have the same number of parameters.
 */
function areParametersCompatible(fns: ((...args: unknown[]) => unknown)[],): boolean {
  if (fns.length <= 1)
    return true;

  const firstFn = fns[0];
  if (!firstFn)
    return false;

  const firstLength = firstFn.length;
  return fns.every(fn => fn.length === firstLength);
}
