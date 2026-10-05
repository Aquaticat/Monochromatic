import {
  mkdir,
  mkdtemp,
  mkdtempDisposable,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { pathToFileURL, } from 'node:url';

import { runnerEntrySources, } from '../build-entries.ts';
import { contextRoot, } from '../log-context.ts';
import { packageCacheDir, } from '../lookup-cache.ts';
import { StatedRefusalError, } from '../stated-refusal.ts';
import { reportingRefusals, } from './cli-refusal.ts';
import type { CommandLineOf, } from './command-lines.ts';
import {
  type CensusArguments,
  censusFileText,
  readBaselineCensus,
  readCensusArguments,
} from './coverage-census-input.ts';
import { invariantThrowRowsOf, } from './coverage-census-invariant.ts';
import {
  baselineReportLines,
  censusReportLines,
} from './coverage-census-print.ts';
import {
  type BaselineCensus,
  baselineStatusesOf,
  coldSinceOf,
  editedClaimsOf,
  emptyClaimsOf,
} from './coverage-census-baseline.ts';
import {
  packageCommit,
  sourcesEditedSince,
} from './coverage-census-commit.ts';
import {
  kindTotalsOf,
  sourceRowsOf,
} from './coverage-census-report.ts';
import {
  runSuite,
  tallyCoverage,
} from './coverage-census-steps.ts';
import {
  type BundleMaps,
  bundleMapsOf,
  requireUnminifiedBuild,
} from './coverage-bundle-maps.ts';
import { placeTally, } from './coverage-census-place.ts';
import type { CoverageTally, } from './coverage-tally.ts';
import { namesOfKind, } from './directory-listing.ts';

//region Coverage census
// LEDGER T8: WHICH PACKAGE CODE THE UNIT SUITE NEVER RUNS, measured rather
// than guessed from which names a test mentions. The mise task builds the
// package with a source map beside every chunk (`rolldown.coverage.config.ts`),
// runs this, then runs the normal build again. This runs the unit suite, or
// the test files named, under `NODE_V8_COVERAGE`, tallies the cold code over
// every process (`coverage-tally.ts`), maps it to source lines
// (`coverage-lines.ts`), prints the report and writes the census as JSON.
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
 Logger for the census's progress lines, apart from the report on stdout.
 */
const censusLog = contextRoot({ tag: 'coverage-census', },);

/**
 An earlier census named on the command line, read.
 */
type Baseline = {
  /**
   File named.
   */
  readonly path: string;

  /**
   What it recorded.
   */
  readonly census: BaselineCensus;
};

/**
 Maps the tally to source lines, writes the census file and prints the
 report, then the baseline reading when one was asked for.

 @param asked - command line as read

 @param packageDirectory - package directory

 @param distDirectory - build directory

 @param bundleMaps - bundles the build holds, split by whether a map stands
 beside each

 @param head - commit built from

 @param clean - whether the files matched it

 @param passes - passing markers the suite printed

 @param tally - painted tally

 @param reportDirectory - where the census file goes

 @param baselines - earlier census files named, already read

 @throws StatedRefusalError where the coverage names a bundle the build
 does not hold, finds code no test ran in a bundle with no map, or finds
 a bundle no test loaded that has no map to say which sources it carries,
 or where the census places an uncalled function outside its own source's
 stretches

 @example
 ```ts
 await reportCensus({ asked, packageDirectory, distDirectory, bundleMaps, head, clean, passes, tally, reportDirectory, baselines, },);
 ```
 */
async function reportCensus(
  {
    asked,
    packageDirectory,
    distDirectory,
    bundleMaps,
    head,
    clean,
    passes,
    tally,
    reportDirectory,
    baselines,
  }: {
    readonly asked: CensusArguments;
    readonly packageDirectory: string;
    readonly distDirectory: string;
    readonly bundleMaps: BundleMaps;
    readonly head: string;
    readonly clean: boolean;
    readonly passes: number;
    readonly tally: CoverageTally;
    readonly reportDirectory: string;
    readonly baselines: readonly Baseline[];
  },
): Promise<void> {
  /**
   Runner entry sources.
   */
  const entryFiles = runnerEntrySources();
  /**
   The tally placed on source lines.
   */
  const {
    stretches,
    invariantThrows,
    uncalled,
    loadedSources,
    unloadedBundles,
    unloadedSources,
  } = await placeTally({
    packageDirectory,
    distDirectory,
    bundleMaps,
    tally,
    entryFiles,
  },);
  /**
   One row per source holding cold code.
   */
  const rows = sourceRowsOf({
    stretches,
    uncalled,
    entryFiles,
  },);
  /**
   Where the census goes.
   */
  const censusPath = join(
    reportDirectory,
    'census.json',
  );
  await writeFile(
    censusPath,
    censusFileText({
      head,
      clean,
      testFiles: asked.testFiles,
      passes,
      stretches,
      invariantThrows,
      uncalled,
      loadedSources,
      unloadedBundles,
      unloadedSources,
    },),
  );
  /**
   Sources the batch claims, empty for every source.
   */
  const claimed = new Set(asked.sources,);
  /**
   Each baseline reading, sources edited since its commit read apart.
   */
  const baselineReadings = await Promise.all(baselines.map(async function baselineLines({
    path,
    census: baseline,
  },): Promise<readonly string[]> {
    /**
     Files of the work tree changed since the baseline's commit, named as
     the census names sources, whose baseline lines name other code now.
     */
    const edited = await sourcesEditedSince({
      packageDirectory,
      head: baseline.head,
    },);
    return baselineReportLines({
      path,
      head: baseline.head,
      statuses: baselineStatusesOf({
        baseline: baseline.stretches,
        current: stretches,
        loadedSources,
        sources: claimed,
        edited,
      },),
      coldSince: coldSinceOf({
        baseline,
        current: stretches,
        sources: claimed,
        edited,
      },),
      emptyClaims: emptyClaimsOf({
        baseline,
        edited,
        current: stretches,
        loadedSources,
        sources: claimed,
      },),
      editedClaims: editedClaimsOf({
        baseline,
        edited,
        current: stretches,
        loadedSources,
        sources: claimed,
      },),
    },);
  },),);
  /**
   Every line of the report, then each baseline reading.
   */
  const lines = [
    ...censusReportLines({
      census: {
        head,
        clean,
        testFiles: asked.testFiles,
        passes,
        totals: kindTotalsOf({ rows, },),
        rows,
        invariantThrows: invariantThrowRowsOf({
          invariantThrows,
          entryFiles,
        },),
        uncalled,
        unloadedBundles,
        unloadedSources,
        censusPath,
      },
    },),
    ...baselineReadings.flat(),
  ];
  for (const line of lines)
    console.log(line,);
}

/**
 Runs the census the command line asked for and prints its report.

 Returns nothing: the report on stdout IS the output, and the census file it
 names is the record.

 @param line - the census's command line, read whole by `reportingRefusals`

 @throws StatedRefusalError where the build carries no source maps, or the
 suite failed

 @example
 ```ts
 await runCoverageCensus({ line, },);
 ```
 */
async function runCoverageCensus({ line, }: { readonly line: CommandLineOf<'coverage-census'>; },): Promise<void> {
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
      census: readBaselineCensus({
        path,
        text: await readFile(
          path,
          'utf8',
        ),
      },),
    };
  },),);
  /**
   Package directory, where the mise task runs.
   */
  const packageDirectory = process.cwd();
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
  const bundleMaps = bundleMapsOf({
    built: await namesOfKind({
      dir: distDirectory,
      kind: 'file',
    },),
    distDirectory,
  },);
  /**
   Bundles without a map, named so a census that reads none of them says so.
   */
  const {
    mapped,
    unmapped,
  } = bundleMaps;
  // Before the suite, so a minified build costs no suite run (ledger M79).
  requireUnminifiedBuild({
    texts: await Promise.all(mapped.map(function textOf(bundle,): Promise<string> {
      return readFile(
        join(
          distDirectory,
          bundle,
        ),
        'utf8',
      );
    },),),
    distDirectory,
  },);
  censusLog.info(`bundles with no source map, read only where the census must place code in them: ${(unmapped.length === 0) ? 'none' : unmapped.join(', ',)}`,);
  /**
   The commit and whether the files match it.
   */
  const {
    head,
    clean,
  } = await packageCommit({ packageDirectory, },);
  /**
   The census's home on disk, under the package's cache directory.
   */
  const censusHome = join(
    packageCacheDir({ env: process.env, },),
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
  censusLog.info(`at ${head}${clean ? '' : ' with uncommitted changes'}; coverage in ${coverage.path}, report in ${reportDirectory}`,);
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
  const suite = await runSuite({
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
      says: `the suite failed (exit ${String(suite.exitCode,)}, ${String(suite.failures,)} FAIL markers); its log is `
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
    tally: await tallyCoverage({
      coverageDirectory: coverage.path,
      bundleUrlPrefix: `${pathToFileURL(distDirectory,)
        .href}/`,
    },),
    reportDirectory,
    baselines,
  },);
}

if (import.meta.main)
  await reportingRefusals({
    what: 'coverage-census',
    argv: process.argv,
    run: runCoverageCensus,
  },);

//endregion Coverage census
