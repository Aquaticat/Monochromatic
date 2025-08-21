import type { UnknownRecord } from 'type-fest';
import { equal, } from './any.equal.ts';
import { anyThrows } from './any.throws.ts';
import { notUndefinedOrThrow, } from './error.throw.ts';
import { throws, } from './error.throws.ts';
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
  } & Partial<Logged>,) => unknown;
  readonly string?: (params: {
    readonly key: string;
    readonly values: string[];
  } & Partial<Logged>,) => unknown;
  readonly number?: (params: {
    readonly key: string;
    readonly values: number[];
  } & Partial<Logged>,) => unknown;
  readonly boolean?: (params: {
    readonly key: string;
    readonly values: boolean[];
  } & Partial<Logged>,) => unknown;
  readonly object?: (params: {
    readonly key: string;
    readonly values: object[];
  } & Partial<Logged>,) => unknown;
  readonly undefined?: (params: {
    readonly key: string;
    readonly values: undefined[];
  } & Partial<Logged>,) => unknown;
  readonly bigint?: (params: {
    readonly key: string;
    readonly values: bigint[];
  } & Partial<Logged>,) => unknown;
  readonly symbol?: (params: {
    readonly key: string;
    readonly values: symbol[];
  } & Partial<Logged>,) => unknown;
};

/**
 * Default rules for handling conflicts by type.
 */
const defaultRules: Required<MergeRules> = {
  function: function combineFunction({ key, values, l = getDefaultLogger(), },) {
    l.debug(
      `Default: create a function that calls functionsMapWith for property ${key}`,
    );
    return function combinedFunction(...args: unknown[]) {
      return functionsMapWith({
        fns: values,
        args,
        l,
      },);
    };
  },
  string: anyThrows,
  number: anyThrows,
  boolean: anyThrows,
  object: function recursiveMerge({ key, values, l = getDefaultLogger(), },)  {
    if (values.every(function isRecord(value): value is UnknownRecord {return Object.prototype.toString.call(value) === '[object Object]'})) {
      l.debug(`Recursively merging objects for "${key}"`,);
      return objectsMerge({
        objs: values,
        l,
      },);
    }

    if (values.every(Array.isArray)) {
      l.debug(`merging arrays for ${key}`);
      return new Set(values.flat());
    }

    throw new TypeError(`cannot merge values ${JSON.stringify(values)}`);
  },
  // Shouldn't happen because undefined === undefined. Here for coherence.
  undefined: anyThrows,
  bigint: anyThrows,
  symbol: anyThrows,
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
  const TObjects extends readonly UnknownRecord[],
>(
  {
    objs,
    rules = {},
    l = getDefaultLogger(),
  }: {
    readonly objs: TObjects;
    readonly rules?: MergeRules;
  } & Partial<Logged>,
): UnknownRecord {
  l.debug(objectsMerge.name,);

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
    // Collect all values for this key across objects
    const allValuesForKey: unknown[] = [];

    for (const obj of objs) {
      if (key in obj)
        allValuesForKey.push(obj[key],);
    }

    // Group values by type
    const valuesByType = Map.groupBy(allValuesForKey, value => typeof value,);

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
    const firstEntry = notUndefinedOrThrow(entryArray[0],);
    const [valueType, values,] = firstEntry;

    if (values.length === 1) {
      // Only one value, use it directly
      result[key] = values[0];
    }
    else {
      // Multiple values of the same type
      // Check for consensus using Map.groupBy
      const firstValue = values[0];
      const groupedByEquality = Map.groupBy(values, value =>
        equal(firstValue, value,) ? 'equal' : 'different',);
      const allEqual = !groupedByEquality.has('different',);

      if (allEqual)
        result[key] = firstValue;
      else {
        // Handle conflicts based on type
        result[key] = resolveTypeConflict({ key, valueType, values, rules: effectiveRules,
          l, },);
      }
    }
  }

  return result;
}

/**
 * Internal function to resolve conflicts for a specific type.
 */
function resolveTypeConflict(
  {
    key,
    valueType,
    values,
    rules,
    l = getDefaultLogger(),
  }: Partial<Logged> & {
    readonly key: string;
    readonly valueType: string;
    readonly values: unknown[];
    readonly rules: Required<MergeRules>;
  },
): unknown {
  l.debug(
    `${resolveTypeConflict.name}, Resolving ${valueType} conflict for key "${key}"`,
  );

  switch (valueType) {
    case 'function': {
      const fns = values as ((...args: unknown[]) => unknown)[];

      // Check function parameter compatibility
      if (!areParametersCompatible({ fns, },))
        throw new TypeError('fn params incompatible',);

      return rules.function({ key, values: fns, l, },);
    }

    case 'string':
      return rules.string({ key, values: values as string[], l, },);

    case 'number':
      return rules.number({ key, values: values as number[], l, },);

    case 'boolean':
      return rules.boolean({ key, values: values as boolean[], l, },);

    case 'object':
      return rules.object({ key, values: values as object[], l, },);

    case 'undefined':
      return rules.undefined({ key, values: values as undefined[], l, },);

    case 'bigint':
      return rules.bigint({ key, values: values as bigint[], l, },);

    case 'symbol':
      return rules.symbol({ key, values: values as symbol[], l, },);

    default:
      throw new TypeError(`Unknown type "${valueType}" for property "${key}"`,);
  }
}

/**
 * Check if functions have compatible parameter signatures.
 * Functions are compatible if they have the same number of parameters.
 */
function areParametersCompatible(
  { fns, l = getDefaultLogger(), }:
    & { readonly fns: ((...args: unknown[]) => unknown)[]; }
    & Partial<Logged>,
): boolean {
  l.debug(areParametersCompatible.name,);
  if (fns.length <= 1)
    return true;

  const firstFn = fns[0];
  if (!firstFn)
    return false;

  const firstLength = firstFn.length;
  return fns.every(fn => fn.length === firstLength);
}
