/**
 fast-check generators for `deepmergeCustom` option plans
 (see `./options-model.ts`).

 @module
 */

import {
  boolean,
  constantFrom,
  integer,
  oneof,
  record,
  type Arbitrary,
} from 'fast-check';

import type {
  CustomChoice,
  FilterChoice,
  MaxDepthChoice,
  OptionsPlan,
} from './options-plan.ts';

/**
 Largest valid `maxDepth` drawn; generated trees nest at most four containers.
 */
const MAX_PLANNED_DEPTH = 5;

/**
 Choice generator for one merge function.

 @param skip - Whether `skipNested` may be drawn; off for FastUnsafe, where no
   call has metadata, so a planned skip could not tell the root apart.

 @returns Generator of choices.

 @example
 ```ts
 const choices = choiceArbitrary({ skip: true, });
 ```
 */
function choiceArbitrary({ skip, }: { readonly skip: boolean; },): Arbitrary<CustomChoice> {
  return constantFrom<CustomChoice>(
    'absent',
    'false',
    'defaultMerge',
    'undefined',
    'first',
    ...(skip ? ['skipNested',] as const : []),
  );
}

/**
 Plan generator.

 @param fast - Whether the plan is for a FastUnsafe variant (no skips,
   `maxDepth` ignored by the library).

 @returns Generator of option plans.

 @example
 ```ts
 const plans = optionsPlanArbitrary({ fast: false, });
 ```
 */
export function optionsPlanArbitrary({ fast, }: { readonly fast: boolean; },): Arbitrary<OptionsPlan> {
  /**
   Choice generator shared by the five functions.
   */
  const choice = choiceArbitrary({ skip: !fast, },);
  return record({
    filter: constantFrom<FilterChoice>(
      'absent',
      'false',
      'dropNull',
    ),
    implicit: boolean(),
    maxDepth: oneof(
      constantFrom<MaxDepthChoice>(
        'absent',
        'invalidNaN',
        'invalidNegative',
        'invalidString',
      ),
      integer({
        min: 0,
        max: MAX_PLANNED_DEPTH,
      },),
    ),
    mergeArrays: choice,
    mergeMaps: choice,
    mergeOthers: choice,
    mergeRecords: choice,
    mergeSets: choice,
  },);
}

/**
 Plan generator for the `Into` variants.

 Into custom functions mutate a target reference, so plans use only
 `absent`, `false`, and `defaultMerge`. `mergeRecords` is never `false`:
 at the root that makes the whole call a silent no-op (known defect,
 `./known-defect-options.unit.test.ts`). `filterValues` never drops `null`:
 a filtered first value at a key hits the known `deepmergeInto` first-value
 typing defect (`./known-defect.unit.test.ts`).

 @param fast - Whether the plan is for `deepmergeIntoFastUnsafeCustom`.

 @returns Generator of option plans.

 @example
 ```ts
 const plans = intoPlanArbitrary({ fast: false, });
 ```
 */
export function intoPlanArbitrary({ fast, }: { readonly fast: boolean; },): Arbitrary<OptionsPlan> {
  /**
   Choice generator for every function except `mergeRecords`.
   */
  const choice = constantFrom<CustomChoice>(
    'absent',
    'false',
    'defaultMerge',
  );
  return record({
    filter: constantFrom<FilterChoice>(
      'absent',
      'false',
    ),
    implicit: boolean(),
    maxDepth: fast
      ? constantFrom<MaxDepthChoice>('absent',)
      : oneof(
        constantFrom<MaxDepthChoice>(
          'absent',
          'invalidNaN',
          'invalidNegative',
          'invalidString',
        ),
        integer({
          min: 1,
          max: MAX_PLANNED_DEPTH,
        },),
      ),
    mergeArrays: choice,
    mergeMaps: choice,
    mergeOthers: choice,
    mergeRecords: constantFrom<CustomChoice>(
      'absent',
      'defaultMerge',
    ),
    mergeSets: choice,
  },);
}
