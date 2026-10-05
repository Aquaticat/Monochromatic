import { textsInCodePointOrder, } from '../code-points.ts';
import {
  isJsonArray,
  isJsonRecord,
} from '../json-guard.ts';
import { StatedRefusalError, } from '../stated-refusal.ts';
import type { CommandLineOf, } from './command-lines.ts';
import type { BaselineCensus, } from './coverage-census-baseline.ts';
import type { InvariantThrowStretch, } from './coverage-census-invariant.ts';
import type { UnloadedSource, } from './coverage-census-print.ts';
import {
  type CensusStretch,
  unmappedSourceOf,
} from './coverage-census-report.ts';
import type { MappedFunction, } from './coverage-lines.ts';

//region Coverage census input
// Ledger T8: what the coverage census is asked to do, read from its command
// line, and the earlier census a batch is read against. Kept apart from the
// entry so both are tested without a subprocess. The census file is written
// here too (`censusFileText`), beside the one reader of its format
// (`readBaselineCensus`), so a case reads back what the census writes.
//
// A FLAG WRITTEN WITHOUT ITS VALUE IS REFUSED, not read as absent: the
// settled-audit report once read `--run` written last as "the newest run" in
// silence (`rendering-audit-settled-args.ts`). This census had its own strict
// `parseArgs` call for that; the package's one command-line reader now
// refuses that shape and an unknown flag for every runner (ledger B75).

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
 Reads the census's command line.

 @param line - the census's command line, read whole by `reportingRefusals`,
 which refuses an unknown flag or a flag written without its value

 @returns Test files, baseline and sources asked for

 @throws StatedRefusalError where `--source` is named with no `--baseline` to
 read

 @example
 ```ts
 const asked = readCensusArguments({ line, },);
 ```
 */
export function readCensusArguments({ line, }: { readonly line: CommandLineOf<'coverage-census'>; },): CensusArguments {
  /**
   Sources named.
   */
  const sources = line.list('source',);
  /**
   Baseline named.
   */
  const baseline = line.flag('baseline',);
  if ((sources.length > 0) && (baseline.kind === 'unwritten'))
    throw new StatedRefusalError({
      says: '--source picks the baseline stretches to read, so it needs --baseline <census.json> beside it',
    },);
  return {
    testFiles: line.positionals,
    baseline: (baseline.kind === 'written') ? [baseline.value,] : [],
    sources,
  };
}

/**
 Format of the census file, written into it and required of a baseline.
 Format 2 split a cold stretch wherever its source changes (ledger M67); a
 file without it came from the census that recorded a whole stretch under its
 first source, whose stretches no batch can be read against. Format 3 lists
 the stretches that are nothing but invariant throws apart, under
 `invariantThrows`, and leaves them out of `stretches`
 (`coverage-census-invariant.ts`).
 */
export const CENSUS_FORMAT = 3;

/**
 The format written before invariant throws were counted apart. Its
 stretches hold every invariant throw no test reached among the cold code,
 and a stretch records offsets and lines but no text, so nothing in the file
 says which they are, and the bundles its offsets index are rebuilt under
 other names by the next build. Read as though its stretches were cold code
 alone, each of those throws would read as ran against a run that leaves
 them out of its own stretches, a batch credited with reaching a guard no
 test reached. So the file is refused by name, with what to do.
 */
const FORMAT_BEFORE_INVARIANT_THROWS = 2;

/**
 The census file's text: what one run found, in the current format.

 @param head - commit the build was made from

 @param clean - whether the package's files matched that commit

 @param testFiles - test files asked for, empty for the whole unit suite

 @param passes - passing markers the suite printed

 @param stretches - cold stretches, those that are nothing but invariant
 throws left out

 @param invariantThrows - stretches that are nothing but invariant throws,
 kept apart so a later reading never takes one for cold code

 @param uncalled - uncalled functions with their lines

 @param loadedSources - sources the loaded bundles carry

 @param unloadedBundles - bundles no process loaded

 @param unloadedSources - sources only those bundles carry

 @returns JSON, each uncalled function flat with its source and line, a
 function no map places under its bundle at line 0, and the loaded sources
 sorted

 @example
 ```ts
 await writeFile(censusPath, censusFileText({ head, clean, testFiles, passes, stretches, invariantThrows, uncalled, loadedSources, unloadedBundles, unloadedSources, },),);
 ```
 */
export function censusFileText(
  {
    head,
    clean,
    testFiles,
    passes,
    stretches,
    invariantThrows,
    uncalled,
    loadedSources,
    unloadedBundles,
    unloadedSources,
  }: {
    readonly head: string;
    readonly clean: boolean;
    readonly testFiles: readonly string[];
    readonly passes: number;
    readonly stretches: readonly CensusStretch[];
    readonly invariantThrows: readonly InvariantThrowStretch[];
    readonly uncalled: readonly MappedFunction[];
    readonly loadedSources: ReadonlySet<string>;
    readonly unloadedBundles: readonly string[];
    readonly unloadedSources: readonly UnloadedSource[];
  },
): string {
  return JSON.stringify(
    {
      format: CENSUS_FORMAT,
      head,
      clean,
      testFiles,
      passes,
      stretches,
      invariantThrows,
      uncalled: uncalled.map(function flat(fn,) {
        return {
          bundle: fn.bundle,
          start: fn.start,
          end: fn.end,
          name: fn.name,
          nested: fn.nested,
          source: (fn.at
            .kind
            === 'mapped') ? fn.at
              .source : unmappedSourceOf({ bundle: fn.bundle, },),
          line: (fn.at
            .kind
            === 'mapped') ? fn.at
              .line : 0,
        };
      },),
      loadedSources: textsInCodePointOrder({ texts: [...loadedSources,], },),
      unloadedBundles,
      unloadedSources,
    },
    null,
    1,
  );
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
 Narrows one recorded invariant throw.

 @param value - candidate from parsed JSON

 @returns Whether it carries a census stretch's fields and the classes it
 throws

 @example
 ```ts
 isInvariantThrowStretch({ bundle: 'index.mjs', start: 0, end: 4, name: '', source: 'src/nap.ts', startLine: 1, endLine: 1, thrown: ['Error',], },); // true
 ```
 */
function isInvariantThrowStretch(value: unknown,): value is InvariantThrowStretch {
  if (!isJsonRecord(value,))
    return false;
  /**
   What it says it throws, as parsed.
   */
  const { thrown, } = value;
  return isCensusStretch(value,)
    && isJsonArray(thrown,)
    && thrown.every(function isClassName(name,): boolean {
      return (typeof name) === 'string';
    },);
}

/**
 Reads the commit, cold stretches and loaded sources out of an earlier
 census file. Its invariant throws are checked and left unread: a batch is
 read against cold code, and an invariant throw is none in either census.

 TAKEN FROM A TREE MATCHING ITS COMMIT, or refused: a later reading tells
 which sources were edited since by comparing the tree with that commit, and a
 census of uncommitted code has lines no commit holds.

 @param path - file read, named in the refusal

 @param text - its contents

 @returns Its commit, stretches and loaded sources

 @throws CensusBaselineError where the file is of the format written before
 invariant throws were counted apart, is not the current census format,
 holds no list of stretches, of invariant throws or of loaded sources, names
 no commit, does not say whether its tree matched that commit, or was taken
 with uncommitted changes

 @example
 ```ts
 const { head, stretches, loadedSources, } = readBaselineCensus({ path, text, },);
 ```
 */
export function readBaselineCensus(
  {
    path,
    text,
  }: {
    readonly path: string;
    readonly text: string;
  },
): BaselineCensus {
  /**
   The file as JSON.
   */
  const parsed: unknown = JSON.parse(text,);
  if (!isJsonRecord(parsed,))
    throw new CensusBaselineError({
      path,
      says: 'it is not an object',
    },);
  if (parsed.format === FORMAT_BEFORE_INVARIANT_THROWS)
    throw new CensusBaselineError({
      path,
      says: `it is census format ${String(FORMAT_BEFORE_INVARIANT_THROWS,)}, written before invariant throws were `
        + 'counted apart: its cold stretches hold them and record no text to tell them by, and this run leaves '
        + 'them out of its own, so each would read as ran; take the baseline again',
    },);
  if (parsed.format !== CENSUS_FORMAT)
    throw new CensusBaselineError({
      path,
      says: `it is not census format ${String(CENSUS_FORMAT,)}; a census written before stretches were split where their `
        + 'source changes (ledger M67) records cold code under the wrong source, so run a fresh baseline',
    },);
  /**
   Its commit, whether the tree matched it, its stretches, its invariant
   throws and its loaded sources, as parsed.
   */
  const {
    head,
    clean,
    stretches,
    invariantThrows,
    loadedSources,
  } = parsed;
  if ((!isJsonArray(stretches,)) || (!stretches.every(isCensusStretch,)))
    throw new CensusBaselineError({
      path,
      says: 'it has no list of stretches, each with a bundle, offsets, a source and lines',
    },);
  if ((!isJsonArray(invariantThrows,)) || (!invariantThrows.every(isInvariantThrowStretch,)))
    throw new CensusBaselineError({
      path,
      says: 'it has no list of invariant throws, each with a bundle, offsets, a source, lines and the classes it throws',
    },);
  if ((!isJsonArray(loadedSources,)) || (!loadedSources.every(function isSource(source,): source is string {
    return (typeof source) === 'string';
  },)))
    throw new CensusBaselineError({
      path,
      says: 'it has no list of loaded sources, each a path',
    },);
  if (((typeof head) !== 'string') || (head === ''))
    throw new CensusBaselineError({
      path,
      says: 'it names no commit it was taken at',
    },);
  if ((typeof clean) !== 'boolean')
    throw new CensusBaselineError({
      path,
      says: 'it does not say whether its tree matched that commit',
    },);
  if (!clean)
    throw new CensusBaselineError({
      path,
      says: 'it was taken with uncommitted changes under the package, so its lines match no commit a later '
        + 'reading can compare the tree with; commit, then take the baseline again',
    },);
  return {
    head,
    stretches,
    loadedSources: new Set(loadedSources,),
  };
}

//endregion Coverage census input
