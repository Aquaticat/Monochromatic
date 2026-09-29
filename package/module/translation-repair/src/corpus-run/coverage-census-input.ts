import { parseArgs, } from 'node:util';

import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';

import {
  isJsonArray,
  isJsonRecord,
} from '../json-guard.ts';
import { StatedRefusalError, } from '../stated-refusal.ts';
import type { CensusStretch, } from './coverage-census-report.ts';

//region Coverage census input
// Ledger T8: what the coverage census is asked to do, read from its command
// line, and the earlier census a batch is read against. Kept apart from the
// entry so both are tested without a subprocess.
//
// A FLAG WRITTEN WITHOUT ITS VALUE IS REFUSED, not read as absent: the
// settled-audit report once read `--run` written last as "the newest run" in
// silence (`rendering-audit-settled-args.ts`). `parseArgs` in strict mode
// refuses that shape, and an unknown flag, itself.

/**
 Marker the test runner prints for a passing test.
 */
export const PASS_MARKER = '[PASS]';

/**
 Marker the test runner prints for a failing test.
 */
export const FAIL_MARKER = '[FAIL]';

/**
 How often a marker appears in the suite's log.

 @param text - log text

 @param marker - marker counted

 @returns Occurrences, not lines: two tests' lines can share one line of a
 log written by processes in parallel (the 2026-09-29 coverage run printed
 1,356 passes on 1,355 lines)

 @example
 ```ts
 markerCount({ text: 'a [PASS] b [PASS]', marker: '[PASS]', },); // 2
 ```
 */
export function markerCount(
  {
    text,
    marker,
  }: {
    readonly text: string;
    readonly marker: string;
  },
): number {
  return text.split(marker,)
    .length
    - 1;
}

/**
 What the census was asked to do.

 @example
 ```ts
 const asked: CensusArguments = { testFiles: [], baseline: [], sources: [], };
 ```
 */
export type CensusArguments = {
  /**
   Unit test files to run under coverage, empty for the whole unit suite.
   */
  readonly testFiles: readonly string[];

  /**
   Earlier census to read this run against, in a one-element list, empty
   when none was named.
   */
  readonly baseline: readonly string[];

  /**
   Sources whose baseline stretches to read, empty for every source.
   */
  readonly sources: readonly string[];
};

/**
 The census's flags and positionals, as strict `parseArgs` reads them.

 @param args - arguments after the script path

 @returns Flag values and test files

 @throws StatedRefusalError where a flag is unknown or written without its value

 @example
 ```ts
 const { values, positionals, } = parsedCommandLine({ args: ['src/nap.unit.test.ts',], },);
 ```
 */
function parsedCommandLine({ args, }: { readonly args: readonly string[]; },): {
  readonly values: {
    readonly baseline?: string;
    readonly source?: readonly string[];
  };
  readonly positionals: readonly string[];
} {
  try {
    return parseArgs({
      args: [...args,],
      options: {
        baseline: { type: 'string', },
        source: {
          type: 'string',
          multiple: true,
        },
      },
      allowPositionals: true,
      strict: true,
    },);
  }
  catch (error) {
    throw new StatedRefusalError({
      says: `coverage-census cannot read its arguments (${caughtValueText(error,)}); `
        + 'write unit test files, then --baseline <census.json> and --source <src/file.ts> as needed',
    },);
  }
}

/**
 Reads the census's command line.

 @param argv - process arguments

 @returns Test files, baseline and sources asked for

 @throws StatedRefusalError where a flag is unknown, a flag is written
 without its value, or `--source` is named with no `--baseline` to read

 @example
 ```ts
 const asked = readCensusArguments({ argv: process.argv, },);
 ```
 */
export function readCensusArguments({ argv, }: { readonly argv: readonly string[]; },): CensusArguments {
  /**
   The command line as `parseArgs` reads it.
   */
  const parsed = parsedCommandLine({ args: argv.slice(2,), },);
  /**
   Sources named.
   */
  const sources = parsed.values
    .source
    ?? [];
  /**
   Baseline named.
   */
  const { baseline, } = parsed.values;
  if ((sources.length > 0) && (baseline === undefined))
    throw new StatedRefusalError({
      says: '--source picks the baseline stretches to read, so it needs --baseline <census.json> beside it',
    },);
  return {
    testFiles: parsed.positionals,
    baseline: (baseline === undefined) ? [] : [baseline,],
    sources,
  };
}

/**
 An earlier census file that does not read as one this census wrote.

 @example
 ```ts
 throw new CensusBaselineError({ path: '/tmp/census.json', says: 'it has no stretches', },);
 ```
 */
export class CensusBaselineError extends Error {
  /**
   Declares this message safe to forward: it names a file the operator named
   and a shape this module describes.
   */
  readonly messageNamesOnly: true = true;

  /**
   Builds the refusal.

   @param path - baseline read

   @param says - what in it did not read

   @example
   ```ts
   new CensusBaselineError({ path: '/tmp/census.json', says: 'it has no stretches', },);
   ```
   */
  constructor({
    path,
    says,
  }: {
    readonly path: string;
    readonly says: string;
  },) {
    super(`baseline ${path} does not read as a census this command wrote: ${says}`,);
    this.name = 'CensusBaselineError';
  }
}

/**
 Narrows one recorded stretch.

 @param value - candidate from parsed JSON

 @returns Whether it carries a census stretch's fields

 @example
 ```ts
 isCensusStretch({ bundle: 'index.mjs', start: 0, end: 4, name: '', source: 'src/nap.ts', startLine: 1, endLine: 1, },); // true
 ```
 */
function isCensusStretch(value: unknown,): value is CensusStretch {
  return isJsonRecord(value,)
    && ((typeof value.bundle) === 'string')
    && Number.isInteger(value.start,)
    && Number.isInteger(value.end,)
    && ((typeof value.name) === 'string')
    && ((typeof value.source) === 'string')
    && Number.isInteger(value.startLine,)
    && Number.isInteger(value.endLine,);
}

/**
 Reads the stretches out of an earlier census file.

 @param path - file read, named in the refusal

 @param text - its contents

 @returns Its stretches

 @throws CensusBaselineError where the file holds no list of stretches

 @example
 ```ts
 const stretches = readBaselineStretches({ path, text, },);
 ```
 */
export function readBaselineStretches(
  {
    path,
    text,
  }: {
    readonly path: string;
    readonly text: string;
  },
): readonly CensusStretch[] {
  /**
   The file as JSON.
   */
  const parsed: unknown = JSON.parse(text,);
  if (!isJsonRecord(parsed,))
    throw new CensusBaselineError({
      path,
      says: 'it is not an object',
    },);
  /**
   Its stretches as parsed.
   */
  const { stretches, } = parsed;
  if ((!isJsonArray(stretches,)) || (!stretches.every(isCensusStretch,)))
    throw new CensusBaselineError({
      path,
      says: 'it has no list of stretches, each with a bundle, offsets, a source and lines',
    },);
  return stretches;
}

//endregion Coverage census input
