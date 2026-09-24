/**
 Shapes of generated `deepmergeCustom` option plans, shared by the plan
 generators (`./options-arbitraries.ts`), the builders of real options
 (`./options-build.ts`), and the options-aware model (`./options-model.ts`).

 @module
 */

/**
 Behaviour of one merge function in a plan: left out, `false`, or a custom
 function returning `actions.defaultMerge`, `undefined`, the first value, or
 `actions.skip` whenever the call carries metadata.
 */
export type CustomChoice = 'absent' | 'defaultMerge' | 'false' | 'first' | 'skipNested' | 'undefined';

/**
 Choice of `filterValues`: left out, `false`, or a custom filter dropping both
 `undefined` and `null`.
 */
export type FilterChoice = 'absent' | 'dropNull' | 'false';

/**
 Choice of `maxDepth`: left out, a valid depth, or an invalid value that the
 library replaces with its default.
 */
export type MaxDepthChoice = 'absent' | 'invalidNaN' | 'invalidNegative' | 'invalidString' | number;

/**
 Names of the five merge functions a plan configures.
 */
export type MergeFunctionName = 'mergeArrays' | 'mergeMaps' | 'mergeOthers' | 'mergeRecords' | 'mergeSets';

/**
 Every merge function name, in a fixed order.
 */
export const MERGE_FUNCTION_NAMES: readonly MergeFunctionName[] = [
  'mergeRecords',
  'mergeArrays',
  'mergeSets',
  'mergeMaps',
  'mergeOthers',
];

/**
 One generated option plan.
 */
export type OptionsPlan = Readonly<Record<MergeFunctionName, CustomChoice>> & {
  readonly implicit: boolean;
  readonly filter: FilterChoice;
  readonly maxDepth: MaxDepthChoice;
};
