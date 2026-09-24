/**
 Reference model of the customizable entry points for generated option plans
 (`./options-plan.ts`), predicting results from `docs/API.md` and
 `docs/deepmergeCustom.md`.

 Where the docs are silent, the model follows the current dispatch, and each
 such point is pinned separately as an intent question in
 `./known-defect-options.unit.test.ts`:

 - a container present in only one input, and every value at or past
   `maxDepth`, goes to `mergeOthers`, never to the container's function;
 - an option set to `false` resolves to the default `mergeOthers` (the last
   value), not a custom one;
 - invalid `maxDepth` values fall back to 1000.

 Plans never return `actions.skip` at the root: that leaks the symbol to the
 caller (known defect).

 @module
 */

import {
  DEFAULT_MAX_DEPTH,
  kindOf,
  recordKeys,
  type ValueKind,
} from './model.ts';
import type {
  CustomChoice,
  FilterChoice,
  MaxDepthChoice,
  MergeFunctionName,
  OptionsPlan,
} from './options-plan.ts';

/**
 Option key of each value kind.
 */
const FUNCTION_OF_KIND: Readonly<Record<ValueKind, MergeFunctionName>> = {
  array: 'mergeArrays',
  map: 'mergeMaps',
  other: 'mergeOthers',
  record: 'mergeRecords',
  set: 'mergeSets',
};

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
  readonly metaAlwaysAbsent: boolean;
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
  return ((typeof choice) === 'number') && (choice >= 0) ? choice : DEFAULT_MAX_DEPTH;
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
function applyFilter({
  values,
  filter,
}: {
  readonly values: readonly unknown[];
  readonly filter: FilterChoice
},): readonly unknown[] {
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

 @param metaAbsent - Whether the call carries no metadata.

 @returns Returned value, or a model marker.

 @example
 ```ts
 customResult({ choice: 'first', values: [1, 2,], metaAbsent: true, }); // 1
 ```
 */
function customResult(
  {
    choice,
    values,
    metaAbsent,
  }: {
    readonly choice: CustomChoice;
    readonly values: readonly unknown[];
    readonly metaAbsent: boolean
  },
): unknown {
  if (choice === 'defaultMerge')
    return DEFAULT;
  if (choice === 'undefined')
    return undefined;
  if (choice === 'first')
    return values[0];
  return metaAbsent ? DEFAULT : SKIP;
}

/**
 Merges one child position; injected so the kind steps precede recursion.
 */
type MergeChild = (values: readonly unknown[],) => unknown;

/**
 Default merge of one kind, with children merged through `mergeChild`.

 @param kind - Kind of every value.

 @param values - Filtered values of that kind.

 @param mergeChild - Child merge one level deeper.

 @returns Default merge result.

 @example
 ```ts
 defaultMerge({ kind: 'array', values: [[1,], [2,],], mergeChild, }); // [1, 2]
 ```
 */
function defaultMerge(
  {
    kind,
    values,
    mergeChild,
  }: {
    readonly kind: ValueKind;
    readonly values: readonly unknown[];
    readonly mergeChild: MergeChild
  },
): unknown {
  if (kind === 'array') {
    return values.flatMap(function items(value,): unknown[] {
      return Array.isArray(value,) ? [...(value as readonly unknown[]),] : [];
    },);
  }
  if (kind === 'set') {
    return new Set(values.flatMap(function items(value,): unknown[] {
      return value instanceof Set ? [...(value as ReadonlySet<unknown>),] : [];
    },),);
  }
  if (kind === 'map') {
    /**
     Maps being merged.
     */
    const maps = values.filter(function isMap(value,): value is ReadonlyMap<unknown, unknown> {
      return value instanceof Map;
    },);
    /**
     Union of keys in first-seen order.
     */
    const keys = [...new Set(maps.flatMap(function mapKeys(map,) {
      return [...map.keys(),];
    },),),];
    return new Map(keys.flatMap(function entry(key,): (readonly [
      unknown,
      unknown,
    ])[] {
      /**
       Merged value for this key.
       */
      const merged = mergeChild(maps.filter(function hasKey(map,) {
        return map.has(key,);
      },)
        .map(function valueOf(map,) {
        return map.get(key,);
      },),);
      return merged === SKIP ? [] : [[
        key,
        merged,
      ],];
    },),);
  }
  if (kind === 'record') {
    /**
     Records being merged.
     */
    const records = values.filter(function isObject(value,): value is object {
      return ((typeof value) === 'object') && (value !== null);
    },);
    /**
     Union of keys in first-seen order.
     */
    const keys = [...new Set(records.flatMap(function keysOf(record,) {
      return recordKeys(record,);
    },),),];
    return keys.reduce<object>(
      function addKey(
        result,
        key,
      ) {
      /**
       Merged value for this key.
       */
      const merged = mergeChild(records.filter(function hasKey(record,) {
        return Object.prototype
          .propertyIsEnumerable
          .call(
            record,
            key,
          );
      },)
        .map(function valueOf(record,): unknown {
        return Reflect.get(
          record,
          key,
        );
      },),);
      if (merged !== SKIP) {
        Reflect.defineProperty(
          result,
          key,
          {
          configurable: true,
          enumerable: true,
          value: merged,
          writable: true,
        },
        );
      }
      return result;
    },
      {},
    );
  }
  return values.at(-1,);
}

/**
 Call the function the plan resolves for a kind, with default fallback.

 @param kind - Kind the dispatch chose (`other` for the mergeOthers path).

 @param values - Filtered values.

 @param metaAbsent - Whether the call carries no metadata.

 @param context - Plan context.

 @param mergeChild - Child merge one level deeper.

 @returns Result, possibly the model's skip marker.

 @example
 ```ts
 const merged = dispatch({ kind: 'other', values: [1, 2,], metaAbsent: true, context, mergeChild, });
 ```
 */
function dispatch(
  {
    kind,
    values,
    metaAbsent,
    context,
    mergeChild,
  }: {
    readonly kind: ValueKind;
    readonly values: readonly unknown[];
    readonly metaAbsent: boolean;
    readonly context: ModelContext;
    readonly mergeChild: MergeChild;
  },
): unknown {
  /**
   Plan choice for this kind's function.
   */
  const choice = context.plan[FUNCTION_OF_KIND[kind]];
  if (choice === 'absent')
    return defaultMerge({
      kind,
      mergeChild,
      values,
    },);
  // `false` resolves to the default mergeOthers: the last value.
  if (choice === 'false')
    return values.at(-1,);
  /**
   Custom result before fallback.
   */
  const result = customResult({
    choice,
    metaAbsent,
    values,
  },);
  if ((result === DEFAULT) || (context.plan
    .implicit
    && (result === undefined)))
    return defaultMerge({
      kind,
      mergeChild,
      values,
    },);
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
  {
    values,
    depth,
    context,
  }: {
    readonly values: readonly unknown[];
    readonly depth: number;
    readonly context: ModelContext
  },
): unknown {
  /**
   Values after the plan's filter.
   */
  const present = applyFilter({
    filter: context.plan
      .filter,
    values,
  },);
  if (present.length === 0)
    return undefined;
  /**
   Merge one child position one level deeper.

   @param childValues - Values under one key.

   @returns Merged child, possibly the skip marker.

   @example
   ```ts
   mergeChild([1, 2,]);
   ```
   */
  function mergeChild(childValues: readonly unknown[],): unknown {
    return mergeAt({
      context,
      depth: depth + 1,
      values: childValues,
    },);
  }
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
  return dispatch({
    context,
    kind: toOthers ? 'other' : kind,
    mergeChild,
    metaAbsent: context.metaAlwaysAbsent || (depth === 0),
    values: present,
  },);
}

/**
 Predict a customized merge for a plan: `deepmergeCustom` (or the into
 variants' final target), or the FastUnsafe variants when `fast` is set
 (no depth limit, no metadata anywhere).

 @param values - Tree inputs, target first for the into variants.

 @param plan - Option plan.

 @param fast - Whether to model a FastUnsafe variant.

 @returns Predicted result.

 @throws When a planned skip reaches the root, which plans must not allow.

 @example
 ```ts
 const expected = modelMergeWithOptions({ values, plan, fast: false, });
 ```
 */
export function modelMergeWithOptions(
  {
    values,
    plan,
    fast,
  }: {
    readonly values: readonly unknown[];
    readonly plan: OptionsPlan;
    readonly fast: boolean
  },
): unknown {
  /**
   Merge result.
   */
  const merged = mergeAt({
    context: {
      maxDepth: fast ? Number.POSITIVE_INFINITY : effectiveMaxDepth(plan.maxDepth,),
      metaAlwaysAbsent: fast,
      plan,
    },
    depth: 0,
    values,
  },);
  if (merged === SKIP)
    throw new Error('modelMergeWithOptions: a planned skip reached the root',);
  return merged;
}
