/**
 In-container differential check of mutant bundles against the unmutated
 bundle, run by the `mutation:differential` mise task after
 `mutation:sweep` wrote `/out/mutants/`.

 Each mutant runs the same fixed-seed cases as the baseline in six
 categories (alias graphs through `deepmerge` and `deepmergeInto`, alias
 graphs with option plans through both custom entry points, exotic arguments
 through the four default entry points, and trees with FastUnsafe option
 plans), and each outcome is compared by `./mutation-canon.ts`. A mutant
 that never differs is only "not separated here"; calling it equivalent
 still needs a source argument (see the audit report).

 Two controls run first and must hold, or the task fails: the baseline
 against itself shows no difference, and the control mutant (one the
 sidecar detects) shows one.

 @module
 */

import { appendFile, } from 'node:fs/promises';
import { join, } from 'node:path';
import { pathToFileURL, } from 'node:url';

import {
  type Arbitrary,
  sample,
  tuple,
} from 'fast-check';

import {
  graphSpecArbitrary,
  materialize,
} from './alias-graph.ts';
import { mergeArgumentsArbitrary, } from './arbitraries.ts';
import { exoticArgumentsArbitrary, } from './exotic-arbitraries.ts';
import { outcomeOf, } from './mutation-canon.ts';
import {
  MutationStepError,
  OUT,
} from './mutation-container.ts';
import {
  intoPlanArbitrary,
  optionsPlanArbitrary,
} from './options-arbitraries.ts';
import {
  buildIntoOptions,
  buildOptions,
} from './options-build.ts';

/**
 Seed shared by every category, so baseline and mutant see the same cases.
 */
const SEED = 20_260_924;

/**
 Characters of each differing outcome kept in the report.
 */
const OUTCOME_EXCERPT = 600;

/**
 A loaded deepmerge-ts bundle's exports.
 */
type Library = Readonly<Record<string, unknown>>;

/**
 One call: its inputs (labelled before it runs) and the call itself.
 */
type Call = {
  readonly inputs: readonly unknown[];
  readonly run: () => readonly unknown[];
};

/**
 One category: draws fresh cases for a library.
 */
type DifferentialCase = {
  readonly name: string;
  readonly calls: (options: {
    readonly library: Library;
    readonly runs: number;
  },) => readonly Call[];
};

/**
 Call a default entry point of a bundle.

 @param library - Bundle exports.

 @param name - Export name, such as `deepmerge`.

 @param args - Arguments.

 @returns Its return value.

 @throws {@link MutationStepError} When the export is not a function.

 @example
 ```ts
 callEntry({ args: [{}, {},], library, name: 'deepmerge', });
 ```
 */
function callEntry(
  {
    library,
    name,
    args,
  }: {
    readonly library: Library;
    readonly name: string;
    readonly args: readonly unknown[];
  },
): unknown {
  /**
   Export under test.
   */
  const entry = library[name];
  if ((typeof entry) !== 'function')
    throw new MutationStepError(`bundle has no function export ${name}`,);
  return Reflect.apply(entry as (...values: readonly unknown[]) => unknown, undefined, args,);
}

/**
 Call a custom entry point's merge function.

 @param library - Bundle exports.

 @param name - Custom export name, such as `deepmergeCustom`.

 @param options - Built options.

 @param args - Merge arguments.

 @returns The merge function's return value.

 @example
 ```ts
 callCustom({ args, library, name: 'deepmergeCustom', options, });
 ```
 */
function callCustom(
  {
    library,
    name,
    options,
    args,
  }: {
    readonly library: Library;
    readonly name: string;
    readonly options: Readonly<Record<string, unknown>>;
    readonly args: readonly unknown[];
  },
): unknown {
  return callEntry({
    args,
    library: { merge: callEntry({ args: [options,], library, name, },), },
    name: 'merge',
  },);
}

/**
 Build a category from a generator and a call shape.

 @param name - Category name in the report.

 @param arbitrary - Case generator.

 @param call - Call shape for one drawn case.

 @returns Category drawing fresh cases per library.

 @example
 ```ts
 defineCase({ arbitrary, call, name: 'graph-deepmerge', });
 ```
 */
function defineCase<const TCase,>(
  {
    name,
    arbitrary,
    call,
  }: {
    readonly name: string;
    readonly arbitrary: Arbitrary<TCase>;
    readonly call: (options: {
      readonly library: Library;
      readonly value: TCase;
    },) => Call;
  },
): DifferentialCase {
  return {
    calls: function drawCalls({ library, runs, },) {
      return sample(arbitrary, { numRuns: runs, seed: SEED, },)
        .map(function toCall(value,) {
          return call({ library, value, },);
        },);
    },
    name,
  };
}

/**
 The six categories of the audit's differential check.
 */
const CASES: readonly DifferentialCase[] = [
  defineCase({
    arbitrary: graphSpecArbitrary({ exoticLeaves: true, recordRoots: false, },),
    call: function graphMerge({ library, value, },) {
      /**
       Fresh graph inputs.
       */
      const inputs = materialize(value,);
      return {
        inputs,
        run: function run() {
          return [callEntry({ args: inputs, library, name: 'deepmerge', },), ...inputs,];
        },
      };
    },
    name: 'graph-deepmerge',
  },),
  defineCase({
    arbitrary: graphSpecArbitrary({ exoticLeaves: true, recordRoots: true, },),
    call: function graphInto({ library, value, },) {
      /**
       Fresh graph inputs; the first is the target.
       */
      const inputs = materialize(value,);
      return {
        inputs,
        run: function run() {
          return [callEntry({ args: inputs, library, name: 'deepmergeInto', },), ...inputs,];
        },
      };
    },
    name: 'graph-into',
  },),
  defineCase({
    arbitrary: tuple(graphSpecArbitrary({ exoticLeaves: true, recordRoots: false, },), optionsPlanArbitrary({ fast: false, },),),
    call: function graphCustom({ library, value: [spec, plan,], },) {
      /**
       Fresh graph inputs.
       */
      const inputs = materialize(spec,);
      return {
        inputs,
        run: function run() {
          return [callCustom({ args: inputs, library, name: 'deepmergeCustom', options: buildOptions(plan,), },), ...inputs,];
        },
      };
    },
    name: 'graph-custom',
  },),
  defineCase({
    arbitrary: tuple(graphSpecArbitrary({ exoticLeaves: true, recordRoots: true, },), intoPlanArbitrary({ fast: false, },),),
    call: function graphIntoCustom({ library, value: [spec, plan,], },) {
      /**
       Fresh graph inputs; the first is the target.
       */
      const inputs = materialize(spec,);
      return {
        inputs,
        run: function run() {
          return [callCustom({ args: inputs, library, name: 'deepmergeIntoCustom', options: buildIntoOptions(plan,), },), ...inputs,];
        },
      };
    },
    name: 'graph-into-custom',
  },),
  defineCase({
    arbitrary: exoticArgumentsArbitrary,
    call: function exoticAll({ library, value, },) {
      return {
        inputs: value,
        run: function run() {
          return [
            callEntry({ args: value, library, name: 'deepmerge', },),
            callEntry({ args: value, library, name: 'deepmergeFastUnsafe', },),
            callEntry({ args: [{}, ...value,], library, name: 'deepmergeInto', },),
            callEntry({ args: [{}, ...value,], library, name: 'deepmergeIntoFastUnsafe', },),
            ...value,
          ];
        },
      };
    },
    name: 'exotic-all',
  },),
  defineCase({
    arbitrary: tuple(mergeArgumentsArbitrary({ exotic: true, },), optionsPlanArbitrary({ fast: true, },),),
    call: function treeFastCustom({ library, value: [values, plan,], },) {
      return {
        inputs: values,
        run: function run() {
          return [
            callCustom({ args: values, library, name: 'deepmergeFastUnsafeCustom', options: buildOptions(plan,), },),
            callEntry({ args: [{}, ...values,], library, name: 'deepmergeIntoFastUnsafe', },),
            ...values,
          ];
        },
      };
    },
    name: 'tree-fast-custom',
  },),
];

/**
 Load one bundle written by the sweep.

 @param id - Mutant id, or `baseline`.

 @returns The bundle's exports.

 @example
 ```ts
 const baseline = await loadBundle('baseline');
 ```
 */
async function loadBundle(id: string,): Promise<Library> {
  /**
   Module namespace of the bundle.
   */
  const loaded: unknown = await import(pathToFileURL(join(OUT, 'mutants', `${id}.mjs`,),).href);
  if (((typeof loaded) !== 'object') || (loaded === null))
    throw new MutationStepError(`bundle ${id} did not load as a module`,);
  return loaded as Library;
}

/**
 First case where two bundles leave different outcomes.

 @param left - Reference bundle.

 @param right - Bundle under test.

 @param runs - Cases per category.

 @returns Category, case index, and both outcomes; `undefined` when none differ.

 @example
 ```ts
 firstDifference({ left: baseline, right: mutant, runs: 1000, });
 ```
 */
function firstDifference(
  {
    left,
    right,
    runs,
  }: {
    readonly left: Library;
    readonly right: Library;
    readonly runs: number;
  },
): {
  readonly category: string;
  readonly index: number;
  readonly expected: string;
  readonly actual: string;
} | undefined {
  for (const differentialCase of CASES) {
    /**
     Reference calls.
     */
    const expectedCalls = differentialCase.calls({ library: left, runs, },);
    /**
     Calls under test, drawn fresh from the same seed.
     */
    const actualCalls = differentialCase.calls({ library: right, runs, },);
    for (const [index, expectedCall,] of expectedCalls.entries()) {
      /**
       Matching call under test.
       */
      const actualCall = actualCalls[index];
      if (actualCall === undefined)
        throw new MutationStepError(`category ${differentialCase.name} drew fewer cases for the second bundle`,);
      /**
       Reference outcome.
       */
      const expected = outcomeOf(expectedCall,);
      /**
       Outcome under test.
       */
      const actual = outcomeOf(actualCall,);
      if (expected !== actual) {
        return {
          actual: actual.slice(0, OUTCOME_EXCERPT,),
          category: differentialCase.name,
          expected: expected.slice(0, OUTCOME_EXCERPT,),
          index,
        };
      }
    }
  }
  return undefined;
}

/**
 Run both controls, then compare every requested mutant with the baseline.

 @param runs - Cases per category.

 @param controlId - Mutant the sidecar detects; it must differ.

 @param ids - Mutants to compare.

 @throws {@link MutationStepError} When a control fails.

 @example
 ```ts
 await runDifferential({ controlId: '34', ids: ['35',], runs: 1000, });
 ```
 */
export async function runDifferential(
  {
    runs,
    controlId,
    ids,
  }: {
    readonly runs: number;
    readonly controlId: string;
    readonly ids: readonly string[];
  },
): Promise<void> {
  /**
   Unmutated bundle.
   */
  const baseline = await loadBundle('baseline',);
  if (firstDifference({ left: baseline, right: baseline, runs, },) !== undefined)
    throw new MutationStepError('control failed: the baseline differs from itself, so outcomes are not deterministic',);
  if (firstDifference({ left: baseline, right: await loadBundle(controlId,), runs, },) === undefined)
    throw new MutationStepError(`control failed: mutant ${controlId} shows no difference, so the check cannot separate mutants`,);
  console.log(`controls passed (baseline stable, mutant ${controlId} separated) at ${String(runs,)} cases per category`,);
  for (const id of ids) {
    /**
     First difference for this mutant.
     */
    // oxlint-disable-next-line eslint/no-await-in-loop -- bundles load one at a time to keep memory flat.
    const difference = firstDifference({ left: baseline, right: await loadBundle(id,), runs, },);
    // oxlint-disable-next-line eslint/no-await-in-loop -- one log line per mutant, in request order.
    await appendFile(join(OUT, 'differential.jsonl',), `${JSON.stringify({ difference: difference ?? null, id, runs, },)}\n`,);
    console.log(`${id}\t${(difference === undefined) ? 'no difference' : `differs in ${difference.category} case ${String(difference.index,)}`}`,);
  }
}

if (import.meta.main) {
  /**
   Cases per category, control mutant, and mutants to compare, from the task.
   */
  const [runsText, controlId, ...ids] = process.argv.slice(2,);
  /**
   Cases per category.
   */
  const runs = Number(runsText,);
  if ((!Number.isInteger(runs,)) || (runs <= 0) || (controlId === undefined))
    throw new MutationStepError('usage: mutation-differential.ts <runs> <control mutant id> [mutant ids...]',);
  await runDifferential({ controlId, ids, runs, },);
}
