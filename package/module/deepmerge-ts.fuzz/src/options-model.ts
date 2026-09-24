/**
 Reference model of `deepmergeCustom` for generated option plans.

 A plan picks, per merge function, one of a few behaviours that are easy to
 predict (absent, `false`, a custom function returning `actions.defaultMerge`,
 `undefined`, the first value, or `actions.skip` below the root), plus
 `enableImplicitDefaultMerging`, a `filterValues` choice, and a `maxDepth`
 choice including invalid values. `buildOptions` turns a plan into a real
 options object; `modelMergeWithOptions` predicts the result from
 `docs/API.md` and `docs/deepmergeCustom.md`.

 Where the docs are silent, the model follows the current dispatch, and each
 such point is pinned separately as an intent question in
 `./known-defect-options.unit.test.ts`:

 - a container present in only one input, and every value at or past
   `maxDepth`, goes to `mergeOthers`, never to the container's function;
 - an option set to `false` resolves to the default `mergeOthers`, not a
   custom one;
 - invalid `maxDepth` values fall back to 1000.

 Plans never return `actions.skip` at the root: that leaks the symbol to the
 caller (known defect).

 @module
 */

import type { DeepMergeOptions, } from 'deepmerge-ts';

import {
  DEFAULT_MAX_DEPTH,
  kindOf,
  recordKeys,
  type ValueKind,
} from './model.ts';

//region Plan shapes

/**
 Behaviour of one merge function in a plan.
 */
export type CustomChoice = 'absent' | 'defaultMerge' | 'false' | 'first' | 'skipNested' | 'undefined';

/**
 Choice of `filterValues`.
 */
export type FilterChoice = 'absent' | 'dropNull' | 'false';

/**
 Choice of `maxDepth`: absent, a valid depth, or an invalid value that must
 fall back to the default.
 */
export type MaxDepthChoice = 'absent' | 'invalidNaN' | 'invalidNegative' | 'invalidString' | number;

/**
 One generated option plan.
 */
export type OptionsPlan = {
  readonly mergeRecords: CustomChoice;
  readonly mergeArrays: CustomChoice;
  readonly mergeSets: CustomChoice;
  readonly mergeMaps: CustomChoice;
  readonly mergeOthers: CustomChoice;
  readonly implicit: boolean;
  readonly filter: FilterChoice;
  readonly maxDepth: MaxDepthChoice;
};

/**
 Option key of each mergeable kind.
 */
const FUNCTION_OF_KIND: Readonly<Record<ValueKind, keyof Pick<OptionsPlan, 'mergeArrays' | 'mergeMaps' | 'mergeOthers' | 'mergeRecords' | 'mergeSets'>>> = {
  array: 'mergeArrays',
  map: 'mergeMaps',
  other: 'mergeOthers',
  record: 'mergeRecords',
  set: 'mergeSets',
};

/**
 Raw `maxDepth` option value of each invalid choice.
 */
const INVALID_MAX_DEPTH: Readonly<Record<'invalidNaN' | 'invalidNegative' | 'invalidString', unknown>> = {
  invalidNaN: Number.NaN,
  invalidNegative: -1,
  invalidString: '2',
};

//endregion Plan shapes

//region Building real options

/**
 Minimal view of the utils deepmerge-ts passes to custom functions.
 */
type ActionUtils = { readonly actions: { readonly defaultMerge: symbol; readonly skip: symbol; }; };

/**
 Build one custom merge function for a choice.

 @param choice - Behaviour to implement; `absent` and `false` never reach here.

 @returns Function with deepmerge-ts's `(values, utils, meta)` signature.

 @example
 ```ts
 const first = customFunction('first');
 ```
 */
function customFunction(choice: CustomChoice,): (values: readonly unknown[], utils: ActionUtils, meta: unknown,) => unknown {
  return function planned(values, utils, meta,) {
    if (choice === 'defaultMerge')
      return utils.actions.defaultMerge;
    if (choice === 'undefined')
      return undefined;
    if (choice === 'first')
      return values[0];
    // skipNested: the root has no metadata under the default updater, and skipping there leaks the symbol.
    return meta === undefined ? utils.actions.defaultMerge : utils.actions.skip;
  };
}

/**
 Turn a plan into a real options object.

 @param plan - Generated plan.

 @returns Options for `deepmergeCustom`, including deliberately invalid
   `maxDepth` values.

 @example
 ```ts
 const options = buildOptions(plan);
 ```
 */
export function buildOptions(plan: OptionsPlan,): DeepMergeOptions {
  /**
   Mutable accumulator, returned as the options object.
   */
  const options: Record<string, unknown> = { enableImplicitDefaultMerging: plan.implicit, };
  for (const name of ['mergeRecords', 'mergeArrays', 'mergeSets', 'mergeMaps', 'mergeOthers',] as const) {
    /**
     Choice for this function.
     */
    const choice = plan[name];
    if (choice === 'false')
      options[name] = false;
    else if (choice !== 'absent')
      options[name] = customFunction(choice,);
  }
  if (plan.filter === 'false')
    options['filterValues'] = false;
  if (plan.filter === 'dropNull') {
    options['filterValues'] = function dropNull(values: readonly unknown[],): unknown[] {
      return values.filter(function present(value,) {
        return (value !== undefined) && (value !== null);
      },);
    };
  }
  if ((typeof plan.maxDepth) === 'number')
    options['maxDepth'] = plan.maxDepth;
  else if (plan.maxDepth !== 'absent')
    options['maxDepth'] = INVALID_MAX_DEPTH[plan.maxDepth as keyof typeof INVALID_MAX_DEPTH];
  return options as DeepMergeOptions;
}

/**
 Turn an into plan (`absent`, `false`, `defaultMerge` only) into options
 for the `Into` variants, whose functions take the target reference first.

 @param plan - Plan from `intoPlanArbitrary`.

 @returns Options for `deepmergeIntoCustom` or `deepmergeIntoFastUnsafeCustom`.

 @throws When the plan holds a choice the into variants cannot express.

 @example
 ```ts
 const options = buildIntoOptions(plan);
 ```
 */
export function buildIntoOptions(plan: OptionsPlan,): Record<string, unknown> {
  /**
   Options accumulated from the plan.
   */
  const options: Record<string, unknown> = {
    ...buildOptions({ ...plan, mergeArrays: 'absent', mergeMaps: 'absent', mergeOthers: 'absent', mergeRecords: 'absent', mergeSets: 'absent', },),
  };
  for (const name of ['mergeRecords', 'mergeArrays', 'mergeSets', 'mergeMaps', 'mergeOthers',] as const) {
    /**
     Choice for this function.
     */
    const choice = plan[name];
    if (choice === 'false')
      options[name] = false;
    else if (choice === 'defaultMerge') {
      options[name] = function plannedInto(_target: unknown, _values: unknown, utils: ActionUtils,): symbol {
        return utils.actions.defaultMerge;
      };
    } else if (choice !== 'absent')
      throw new Error(`buildIntoOptions: ${choice} has no into form`,);
  }
  return options;
}

//endregion Building real options

//region Model

/**
 Marker for "leave this key out", the model's `actions.skip`.
 */
const SKIP: unique symbol = Symbol('model marker for a skipped key or entry',);

/**
 Marker for "use the default merge", the model's `actions.defaultMerge`.
 */
const DEFAULT: unique symbol = Symbol('model marker for falling back to the default merge',);

/**
 Context shared by every step of one model merge.
 */
type ModelContext = {
  readonly plan: OptionsPlan;
  readonly maxDepth: number;
  readonly rootHasNoMeta: boolean;
};

/**
 Effective `maxDepth` after the invalid-option fallback.

 @param choice - Plan choice.

 @returns Depth the merge stops at.

 @example
 ```ts
 effectiveMaxDepth('invalidNaN'); // 1000
 ```
 */
export function effectiveMaxDepth(choice: MaxDepthChoice,): number {
  return ((typeof choice) === 'number') && ((choice as number) >= 0) ? choice as number : DEFAULT_MAX_DEPTH;
}

/**
 Apply the plan's filter.

 @param values - Values at one position.
 @param filter - Filter choice.

 @returns Values that take part in the merge.

 @example
 ```ts
 applyFilter({ values: [1, undefined,], filter: 'absent', }); // [1]
 ```
 */
function applyFilter({ values, filter, }: { readonly values: readonly unknown[]; readonly filter: FilterChoice; },): readonly unknown[] {
  if (filter === 'false')
    return values;
  return values.filter(function kept(value,) {
    return (value !== undefined) && ((filter === 'absent') || (value !== null));
  },);
}

/**
 What a planned custom function returns, before fallback.

 @param choice - Custom choice (never `absent` or `false`).
 @param values - Filtered values.
 @param atRoot - Whether the call has no metadata.

 @returns Returned value, or a model marker.

 @example
 ```ts
 customResult({ choice: 'first', values: [1, 2,], atRoot: true, }); // 1
 ```
 */
function customResult(
  { choice, values, atRoot, }: { readonly choice: CustomChoice; readonly values: readonly unknown[]; readonly atRoot: boolean; },
): unknown {
  if (choice === 'defaultMerge')
    return DEFAULT;
  if (choice === 'undefined')
    return undefined;
  if (choice === 'first')
    return values[0];
  return atRoot ? DEFAULT : SKIP;
}

/**
 Merges one child position; injected so the kind steps precede recursion.
 */
type MergeChild = (values: readonly unknown[],) => unknown;

/**
 Default merge of one kind, with children merged through `mergeChild`.

 @param kind - Kind of every value.
 @param values - Filtered values.
 @param mergeChild - Child merge one level deeper.

 @returns Default merge result.

 @example
 ```ts
 defaultMerge({ kind: 'array', values: [[1,], [2,],], mergeChild: (v) => v.at(-1), }); // [1, 2]
 ```
 */
function defaultMerge(
  { kind, values, mergeChild, }: { readonly kind: ValueKind; readonly values: readonly unknown[]; readonly mergeChild: MergeChild; },
): unknown {
  if (kind === 'array') {
    return (values as readonly (readonly unknown[])[]).flatMap(function items(array,) {
      return [...array,];
    },);
  }
  if (kind === 'set') {
    return new Set((values as readonly ReadonlySet<unknown>[]).flatMap(function items(set,) {
      return [...set,];
    },),);
  }
  if (kind === 'map') {
    /**
     Maps being merged.
     */
    const maps = values as readonly ReadonlyMap<unknown, unknown>[];
    /**
     Union of keys in first-seen order.
     */
    const keys = [...new Set(maps.flatMap(function mapKeys(map,) {
      return [...map.keys(),];
    },),),];
    return new Map(keys.flatMap(function entry(key,) {
      /**
       Merged value for this key.
       */
      const merged = mergeChild(maps.filter(function hasKey(map,) {
        return map.has(key,);
      },).map(function valueOf(map,) {
        return map.get(key,);
      },),);
      return merged === SKIP ? [] : [[key, merged,] as const,];
    },),);
  }
  if (kind === 'record') {
    /**
     Records being merged.
     */
    const records = values as readonly object[];
    /**
     Union of keys in first-seen order.
     */
    const keys = [...new Set(records.flatMap(function keysOf(record,) {
      return recordKeys(record,);
    },),),];
    return keys.reduce<object>(function addKey(result, key,) {
      /**
       Merged value for this key.
       */
      const merged = mergeChild(records.filter(function hasKey(record,) {
        return Object.prototype.propertyIsEnumerable.call(record, key,);
      },).map(function valueOf(record,) {
        return Reflect.get(record, key,);
      },),);
      if (merged !== SKIP) {
        Reflect.defineProperty(result, key, {
          configurable: true,
          enumerable: true,
          value: merged,
          writable: true,
        },);
      }
      return result;
    }, {},);
  }
  return values.at(-1,);
}

/**
 Call the function the plan resolves for a kind, with default fallback.

 @param kind - Kind the dispatch chose (`other` for the mergeOthers path).
 @param values - Filtered values.
 @param atRoot - Whether the call has no metadata.
 @param context - Plan context.
 @param mergeChild - Child merge one level deeper.

 @returns Result, possibly the model's skip marker.

 @example
 ```ts
 const merged = dispatch({ kind: 'other', values: [1, 2,], atRoot: true, context, mergeChild, });
 ```
 */
function dispatch(
  { kind, values, atRoot, context, mergeChild, }: {
    readonly kind: ValueKind;
    readonly values: readonly unknown[];
    readonly atRoot: boolean;
    readonly context: ModelContext;
    readonly mergeChild: MergeChild;
  },
): unknown {
  /**
   Plan choice for this kind's function.
   */
  const choice = context.plan[FUNCTION_OF_KIND[kind]];
  if (choice === 'absent')
    return defaultMerge({ kind, mergeChild, values, },);
  if (choice === 'false') {
    // `false` resolves to the default mergeOthers: the last value.
    return values.at(-1,);
  }
  /**
   Custom result before fallback.
   */
  const result = customResult({ atRoot, choice, values, },);
  if ((result === DEFAULT) || (context.plan.implicit && (result === undefined)))
    return defaultMerge({ kind, mergeChild, values, },);
  return result;
}

/**
 Recursive model step.

 @param values - Unfiltered values at this position.
 @param depth - Depth of this position.
 @param context - Plan context.

 @returns Merged value or the skip marker.

 @example
 ```ts
 const merged = mergeAt({ values, depth: 0, context, });
 ```
 */
function mergeAt(
  { values, depth, context, }: { readonly values: readonly unknown[]; readonly depth: number; readonly context: ModelContext; },
): unknown {
  /**
   Values after the plan's filter.
   */
  const present = applyFilter({ filter: context.plan.filter, values, },);
  if (present.length === 0)
    return undefined;
  /**
   Whether this call carries no metadata, which planned skips treat as the root.
   */
  const atRoot = context.rootHasNoMeta || (depth === 0);
  /**
   Child merge one level deeper.
   */
  const mergeChild: MergeChild = function child(childValues,) {
    return mergeAt({ context, depth: depth + 1, values: childValues, },);
  };
  /**
   Kind of the first value.
   */
  const kind = kindOf(present[0],);
  /**
   Whether the values go to mergeOthers instead of their kind's function.
   */
  const toOthers = (depth >= context.maxDepth)
    || (present.length === 1)
    || (kind === 'other')
    || present.some(function differs(value,) {
      return kindOf(value,) !== kind;
    },);
  return dispatch({ atRoot, context, kind: toOthers ? 'other' : kind, mergeChild, values: present, },);
}

/**
 Predict `deepmergeCustom(buildOptions(plan))(...values)`, or the FastUnsafe
 variant when `fast` is set (no depth limit, no metadata anywhere).

 @param values - Tree inputs.
 @param plan - Option plan.
 @param fast - Whether to model `deepmergeFastUnsafeCustom`.

 @returns Predicted result.

 @example
 ```ts
 const expected = modelMergeWithOptions({ values, plan, fast: false, });
 ```
 */
export function modelMergeWithOptions(
  { values, plan, fast, }: { readonly values: readonly unknown[]; readonly plan: OptionsPlan; readonly fast: boolean; },
): unknown {
  /**
   Merge result, which is never the skip marker because root skips are not planned.
   */
  const merged = mergeAt({
    context: {
      maxDepth: fast ? Number.POSITIVE_INFINITY : effectiveMaxDepth(plan.maxDepth,),
      plan,
      rootHasNoMeta: fast,
    },
    depth: 0,
    values,
  },);
  if (merged === SKIP)
    throw new Error('modelMergeWithOptions: a planned skip reached the root',);
  return merged;
}

//endregion Model
