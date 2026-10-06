import {
  mkdir,
  mkdtemp,
  mkdtempDisposable,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { pathToFileURL, } from 'node:url';

import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import { wordForCount, } from '../count-word.ts';
import { packageCacheDir, } from '../lookup-cache.ts';
import { StatedRefusalError, } from '../stated-refusal.ts';
import type { CommandLineOf, } from './command-lines.ts';
import type { Baseline, } from './coverage-census-baseline-lines.ts';
import { requireCoverageBuild, } from './coverage-census-build.ts';
import type {
  packageCommit,
  sourcesEditedSince,
} from './coverage-census-commit.ts';
import {
  readBaselineFile,
  readCensusArguments,
} from './coverage-census-input.ts';
import type { placeTally, } from './coverage-census-place.ts';
import { reportCensus, } from './coverage-census-reading.ts';
import type {
  runSuite,
  tallyCoverage,
} from './coverage-census-steps.ts';

//region Coverage census run
// LEDGER T8: WHICH PACKAGE CODE THE UNIT SUITE NEVER RUNS, measured rather
// than guessed from which names a test mentions. The mise task builds the
// package with a source map beside every chunk (`rolldown.coverage.config.ts`),
// runs the command (`coverage-census.ts`), then runs the normal build again.
// This runs the unit suite, or the test files named, under `NODE_V8_COVERAGE`,
// tallies the cold code over every process (`coverage-tally.ts`), maps it to
// source lines (`coverage-lines.ts`), prints the report and writes the census as
// JSON.
//
// An invariant throw is counted apart from the cold code. A stretch no test
// ran that is nothing but throws of a broken invariant, an `Error` whose
// message begins `unreachable:` or a class named `...InvariantError`, is a
// guard no honest input reaches, so no test should; the report prints such
// stretches' count beside the cold counts and lists each, the census file
// keeps them under `invariantThrows`, and no row, total or baseline reading
// counts one as cold (`coverage-census-invariant.ts`). A guard is never
// removed to close a stretch.
//
// A BATCH OF TESTS PROVES ITS REACH by running its own test files with
// `--baseline <an earlier census.json>` and `--source` for each source it
// claims: every claimed stretch must read as ran, and every claimed source the
// baseline holds no stretch in must be loaded by this run with no cold
// stretch left, since a baseline that never loaded a source proves nothing of
// it. No stretch may read as cold since then either, code the baseline ran
// that this run left cold (ledger B61). A claimed source edited since the baseline's commit is held to the same
// standard, this run loading it and leaving no cold stretch, since its
// baseline lines name other code now. The baseline must be of the current
// census format, taken from a tree matching its commit, and is read before the
// suite runs. A census written before invariant throws were counted apart
// holds them among its cold stretches and is refused by name
// (`readBaselineCensus`).
//
// SPENDS NO QUOTA, and the raw coverage (about 8 GB for the whole suite) is
// deleted once the census is written; the census and the suite's log stay in
// a directory the report names. Both sit under the package's cache directory
// (`~/.cache/translation-repair/coverage` unless XDG_CACHE_HOME says
// otherwise), ON DISK, because this host's `/tmp` is a 16 GB tmpfs held in
// memory, which the raw coverage alone would half fill. A suite that fails is
// refused rather than counted, since its failing tests skip code they would
// have run.
//
// RUN FROM THE PACKAGE DIRECTORY, which the task does:
// `mise run //package/module/translation-repair:coverage-census`.

/**
 The steps of the census that touch git, the suite, the coverage and the
 build, which a case scripts.

 @example
 ```ts
 const steps: CoverageCensusSteps = { packageCommit, runSuite, tallyCoverage, placeTally, sourcesEditedSince, };
 ```
 */
export type CoverageCensusSteps = {
  /**
   Asks git for the commit built from and whether the files match it.
   */
  readonly packageCommit: typeof packageCommit;

  /**
   Runs the unit suite or the named test files under coverage.
   */
  readonly runSuite: typeof runSuite;

  /**
   Reads the coverage files into a painted tally.
   */
  readonly tallyCoverage: typeof tallyCoverage;

  /**
   Places the tally on source lines through the build's maps.
   */
  readonly placeTally: typeof placeTally;

  /**
   Asks git which files changed since a commit.
   */
  readonly sourcesEditedSince: typeof sourcesEditedSince;
};

/**
 Runs the census the command line asked for and prints its report.

 Returns nothing: the report on stdout IS the output, and the census file it
 names is the record.

 @param line - the census's command line, read whole by `reportingRefusals`

 @param packageDirectory - package directory, where the mise task runs and
 whose `dist/final/node` the tests import

 @param env - environment the cache directory is read from

 @param steps - the steps that touch git, the suite, the coverage and the
 build

 @param l - logger the progress lines go to, apart from the report on stdout

 @throws StatedRefusalError where --source is named with no --baseline, the
 build directory cannot be listed, holds no bundle or no source map, or is
 minified, or the suite failed

 @throws CensusBaselineError where a baseline named does not read as a census
 this command wrote

 @example
 ```ts
 await runCoverageCensus({ line, packageDirectory: process.cwd(), env: process.env, steps, l, },);
 ```
 */
export async function runCoverageCensus(
  {
    line,
    packageDirectory,
    env,
    steps,
    l,
  }: {
    readonly line: CommandLineOf<'coverage-census'>;
    readonly packageDirectory: string;
    readonly env: Readonly<NodeJS.ProcessEnv>;
    readonly steps: CoverageCensusSteps;
    readonly l: Logger;
  },
): Promise<void> {
  /**
   What was asked.
   */
  const asked = readCensusArguments({ line, },);
  /**
   Each earlier census named, read before the suite runs, so a file that
   does not read as one refuses at once rather than after the whole suite
   (ledger M67's control run spent a suite on one).
   */
  const baselines = await Promise.all(asked.baseline
    .map(async function readBaseline(path,): Promise<Baseline> {
    return {
      path,
      census: await readBaselineFile({ path, },),
    };
  },),);
  /**
   Build directory the tests import.
   */
  const distDirectory = join(
    packageDirectory,
    'dist',
    'final',
    'node',
  );
  /**
   The build's bundles, split by whether a map stands beside each.
   */
  const bundleMaps = await requireCoverageBuild({
    distDirectory,
    l,
  },);
  /**
   The commit and whether the files match it.
   */
  const {
    head,
    clean,
  } = await steps.packageCommit({ packageDirectory, },);
  /**
   The census's home on disk, under the package's cache directory.
   */
  const censusHome = join(
    packageCacheDir({ env, },),
    'coverage',
  );
  await mkdir(
    censusHome,
    { recursive: true, },
  );
  /**
   Where the census and the suite's log are kept.
   */
  const reportDirectory = await mkdtemp(join(
    censusHome,
    'census-',
  ),);
  /**
   Where V8 writes coverage, removed with everything in it when this returns
   or throws.
   */
  await using coverage = await mkdtempDisposable(join(
    censusHome,
    'raw-',
  ),);
  l.info(`at ${head}${clean ? '' : ' with uncommitted changes'}; coverage in ${coverage.path}, report in ${reportDirectory}`,);
  /**
   Where the suite's output goes.
   */
  const logPath = join(
    reportDirectory,
    'suite.log',
  );
  /**
   The suite's result.
   */
  const suite = await steps.runSuite({
    command: [
      'mise',
      'run',
      'test:unit',
      ...asked.testFiles,
    ],
    cwd: packageDirectory,
    coverageDirectory: coverage.path,
    logPath,
  },);
  if ((suite.exitCode !== 0) || (suite.failures > 0))
    throw new StatedRefusalError({
      says: `the suite failed (exit ${String(suite.exitCode,)}, ${String(suite.failures,)} FAIL ${
        wordForCount({
          count: suite.failures,
          one: 'marker',
          many: 'markers',
        },)
      }); its log is `
        + `${logPath}; a census of a failing suite would count code its failing tests skipped`,
    },);
  await reportCensus({
    asked,
    packageDirectory,
    distDirectory,
    bundleMaps,
    head,
    clean,
    passes: suite.passes,
    tally: await steps.tallyCoverage({
      coverageDirectory: coverage.path,
      bundleUrlPrefix: `${pathToFileURL(distDirectory,)
        .href}/`,
    },),
    reportDirectory,
    baselines,
    place: steps.placeTally,
    editedSince: steps.sourcesEditedSince,
  },);
}

//endregion Coverage census run
