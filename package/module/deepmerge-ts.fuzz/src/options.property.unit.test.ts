/**
 Option-plan properties: the four customizable entry points agree with the
 options-aware model in `./options-model.ts` on generated plans and trees.

 - `deepmergeCustom`: every merge function absent, `false`, or custom
   (`actions.defaultMerge`, `undefined`, first value, `actions.skip` below the
   root), with and without `enableImplicitDefaultMerging`, three
   `filterValues` choices, and valid or invalid `maxDepth` values.
 - `deepmergeFastUnsafeCustom`: the same without skips (no metadata there)
   and without `__proto__` keys (documented as unguarded).
 - `deepmergeIntoCustom` and `deepmergeIntoFastUnsafeCustom`: `absent`,
   `false`, and `defaultMerge` plans on a writable target, minus the regions
   documented in `./options-arbitraries.ts`.

 Run plan and seed policy: see `./fuzz-budget.ts`.

 @module
 */

import {
  array,
  assert,
  property,
  tuple,
} from 'fast-check';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  mergeArgumentsArbitrary,
  treeArbitraries,
} from './arbitraries.ts';
import { fuzzRunPlan, } from './fuzz-budget.ts';
import {
  intoPlanArbitrary,
  optionsPlanArbitrary,
} from './options-arbitraries.ts';
import {
  buildIntoOptions,
  buildOptions,
  modelMergeWithOptions,
} from './options-model.ts';
import {
  NO_MISMATCH,
  shapeMismatch,
  snapshotObject,
} from './shape.ts';
import { target, } from './target.ts';

//region Constants and arbitraries

/**
 Run plan resolved once for every property in this file.
 */
const RUN = fuzzRunPlan();

/**
 Most sources merged into one target.
 */
const MAX_INTO_SOURCES = 3;

/**
 `Into` inputs: a writable plain target and exotic sources, without the
 regions of the known `deepmergeInto` first-value typing defect.

 @param protoKey - Whether records may use the `__proto__` key.

 @returns Generator of a target and its sources.

 @example
 ```ts
 const inputs = intoInputs({ protoKey: true, });
 ```
 */
function intoInputs({ protoKey, }: { readonly protoKey: boolean; },) {
  return tuple(
    treeArbitraries({ exotic: false, objectLeaves: false, protoKey, undefinedLeaves: false, },)
      .record
      .filter(function isPlain(record,) {
        return Object.getPrototypeOf(record,) === Object.prototype;
      },),
    array(treeArbitraries({ exotic: true, objectLeaves: false, protoKey, undefinedLeaves: false, },).record, {
      maxLength: MAX_INTO_SOURCES,
      minLength: 1,
    },),
  );
}

//endregion Constants and arbitraries

await describe({
  name: 'custom options agree with the options model',
  children: [
    it({
      name: 'deepmergeCustom matches the model for generated option plans',
      timeout: RUN.timeout,
      fn: async () => {
        assert(
          property(
            mergeArgumentsArbitrary({ exotic: true, },),
            optionsPlanArbitrary({ fast: false, },),
            function customMatchesModel(values, plan,) {
              expect(shapeMismatch({
                actual: target.deepmergeCustom(buildOptions(plan,),)(...values,),
                expected: modelMergeWithOptions({ fast: false, plan, values, },),
              },),)
                .toBe(NO_MISMATCH,);
            },
          ),
          RUN.params,
        );
      },
    },),
    it({
      name: 'deepmergeFastUnsafeCustom matches the model for generated option plans',
      timeout: RUN.timeout,
      fn: async () => {
        assert(
          property(
            mergeArgumentsArbitrary({ exotic: true, protoKey: false, },),
            optionsPlanArbitrary({ fast: true, },),
            function fastCustomMatchesModel(values, plan,) {
              expect(shapeMismatch({
                actual: target.deepmergeFastUnsafeCustom(buildOptions(plan,),)(...values,),
                expected: modelMergeWithOptions({ fast: true, plan, values, },),
              },),)
                .toBe(NO_MISMATCH,);
            },
          ),
          RUN.params,
        );
      },
    },),
    it({
      name: 'deepmergeIntoCustom leaves the target equal to the model for generated plans',
      timeout: RUN.timeout,
      fn: async () => {
        assert(
          property(
            intoInputs({ protoKey: true, },),
            intoPlanArbitrary({ fast: false, },),
            function intoCustomMatchesModel([generated, sources,], plan,) {
              /**
               Private target this run may mutate.
               */
              const mutableTarget = snapshotObject(generated,);
              /**
               Model prediction from the untouched target.
               */
              const expected = modelMergeWithOptions({ fast: false, plan, values: [generated, ...sources,], },);
              target.deepmergeIntoCustom(buildIntoOptions(plan,),)(mutableTarget, ...sources,);
              expect(shapeMismatch({ actual: mutableTarget, expected, },),).toBe(NO_MISMATCH,);
            },
          ),
          RUN.params,
        );
      },
    },),
    it({
      name: 'deepmergeIntoFastUnsafeCustom leaves the target equal to the model for generated plans',
      timeout: RUN.timeout,
      fn: async () => {
        assert(
          property(
            intoInputs({ protoKey: false, },),
            intoPlanArbitrary({ fast: true, },),
            function fastIntoCustomMatchesModel([generated, sources,], plan,) {
              /**
               Private target this run may mutate.
               */
              const mutableTarget = snapshotObject(generated,);
              /**
               Model prediction from the untouched target.
               */
              const expected = modelMergeWithOptions({ fast: true, plan, values: [generated, ...sources,], },);
              target.deepmergeIntoFastUnsafeCustom(buildIntoOptions(plan,),)(mutableTarget, ...sources,);
              expect(shapeMismatch({ actual: mutableTarget, expected, },),).toBe(NO_MISMATCH,);
            },
          ),
          RUN.params,
        );
      },
    },),
  ],
},);
