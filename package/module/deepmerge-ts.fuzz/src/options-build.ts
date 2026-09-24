/**
 Turn generated option plans (`./options-plan.ts`) into real options objects
 for the customizable deepmerge-ts entry points.

 @module
 */

import {
  type CustomChoice,
  MERGE_FUNCTION_NAMES,
  type OptionsPlan,
} from './options-plan.ts';

/**
 Minimal view of the utils deepmerge-ts passes to custom functions.
 */
export type ActionUtils = {
  readonly actions: {
    readonly defaultMerge: symbol;
    readonly skip: symbol;
  };
};

/**
 Raw `maxDepth` value of each invalid choice.
 */
const INVALID_MAX_DEPTH: Readonly<Record<'invalidNaN' | 'invalidNegative' | 'invalidString', unknown>> = {
  invalidNaN: Number.NaN,
  invalidNegative: -1,
  invalidString: '2',
};

/**
 Custom filter dropping `undefined` and `null`.

 @param values - Values at one position.

 @returns Values without `undefined` and `null`.

 @example
 ```ts
 dropNullish([1, null, undefined,]); // [1]
 ```
 */
function dropNullish(values: readonly unknown[],): unknown[] {
  return values.filter(function present(value,) {
    return (value !== undefined) && (value !== null);
  },);
}

/**
 Build one custom merge function with deepmerge-ts's `(values, utils, meta)`
 signature.

 @param choice - Behaviour to implement; `absent` and `false` never reach here.

 @returns Custom merge function.

 @example
 ```ts
 const first = customFunction('first');
 ```
 */
function customFunction(choice: CustomChoice,): (
  values: readonly unknown[],
  utils: ActionUtils,
  meta: unknown,
) => unknown {
  return function planned(
    values,
    utils,
    meta,
  ) {
    if (choice === 'defaultMerge')
      return utils.actions
        .defaultMerge;
    if (choice === 'undefined')
      return undefined;
    if (choice === 'first')
      return values[0];
    // skipNested: the root has no metadata under the default updater, and skipping there leaks the symbol.
    return meta === undefined ? utils.actions
      .defaultMerge : utils.actions
        .skip;
  };
}

/**
 Turn a plan into options for `deepmergeCustom` or
 `deepmergeFastUnsafeCustom`, including deliberately invalid `maxDepth`.

 @param plan - Generated plan.

 @returns Options object.

 @example
 ```ts
 const options = buildOptions(plan);
 ```
 */
export function buildOptions(plan: OptionsPlan,): Record<string, unknown> {
  /**
   Options accumulated from the plan.
   */
  const options: Record<string, unknown> = { enableImplicitDefaultMerging: plan.implicit, };
  for (const name of MERGE_FUNCTION_NAMES) {
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
    options.filterValues = false;
  if (plan.filter === 'dropNull')
    options.filterValues = dropNullish;
  if ((typeof plan.maxDepth) === 'number')
    options.maxDepth = plan.maxDepth;
  else if (plan.maxDepth !== 'absent')
    options.maxDepth = INVALID_MAX_DEPTH[plan.maxDepth];
  return options;
}

/**
 Turn an into plan (`absent`, `false`, `defaultMerge` only) into options for
 the `Into` variants, whose functions take the target reference first.

 @param plan - Plan from `intoPlanArbitrary`.

 @returns Options object.

 @throws When the plan holds a choice the into variants cannot express.

 @example
 ```ts
 const options = buildIntoOptions(plan);
 ```
 */
export function buildIntoOptions(plan: OptionsPlan,): Record<string, unknown> {
  /**
   Non-function options from the shared builder.
   */
  const options: Record<string, unknown> = buildOptions({
    ...plan,
    mergeArrays: 'absent',
    mergeMaps: 'absent',
    mergeOthers: 'absent',
    mergeRecords: 'absent',
    mergeSets: 'absent',
  },);
  for (const name of MERGE_FUNCTION_NAMES) {
    /**
     Choice for this function.
     */
    const choice = plan[name];
    if (choice === 'false')
      options[name] = false;
    else if (choice === 'defaultMerge')
      options[name] = function intoDefaultMerge(
        _target: unknown,
        _values: unknown,
        utils: ActionUtils,
      ): symbol {
        return utils.actions
          .defaultMerge;
      };
    else if (choice !== 'absent')
      throw new Error(`buildIntoOptions: ${choice} has no into form`,);
  }
  return options;
}
