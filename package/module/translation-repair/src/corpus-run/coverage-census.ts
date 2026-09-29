import {
  mkdir,
  mkdtemp,
  mkdtempDisposable,
  readdir,
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
import {
  CENSUS_FORMAT,
  type CensusArguments,
  readBaselineStretches,
  readCensusArguments,
} from './coverage-census-input.ts';
import {
  baselineReportLines,
  censusReportLines,
} from './coverage-census-print.ts';
import {
  baselineStatusesOf,
  type CensusStretch,
  censusStretchesOf,
  kindTotalsOf,
  requirePlacedFunctions,
  sourceRowsOf,
} from './coverage-census-report.ts';
import {
  packageCommit,
  readBundle,
  runSuite,
  tallyCoverage,
  unloadedSourcesOf,
} from './coverage-census-steps.ts';
import {
  type BundleLines,
  mapFunction,
} from './coverage-lines.ts';
import { mapStretch, } from './coverage-pieces.ts';
import type { CoverageTally, } from './coverage-tally.ts';

//region Coverage census
// LEDGER T8: WHICH PACKAGE CODE THE UNIT SUITE NEVER RUNS, measured rather
// than guessed from which names a test mentions. The mise task builds the
// package with a source map beside every chunk (`rolldown.coverage.config.ts`),
// runs this, then runs the normal build again. This runs the unit suite, or
// the test files named, under `NODE_V8_COVERAGE`, tallies the cold code over
// every process (`coverage-tally.ts`), maps it to source lines
// (`coverage-lines.ts`), prints the report and writes the census as JSON.
//
// A BATCH OF TESTS PROVES ITS REACH by running its own test files with
// `--baseline <an earlier census.json>` and `--source` for each source it
// claims: every claimed stretch must read as ran. The baseline must be of the
// current census format, and is read before the suite runs.
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
   Its stretches.
   */
  readonly stretches: readonly CensusStretch[];
};

/**
 Maps the tally to source lines, writes the census file and prints the
 report, then the baseline reading when one was asked for.

 @param asked - command line as read

 @param packageDirectory - package directory

 @param distDirectory - build directory

 @param bundles - bundles the build holds

 @param head - commit built from

 @param clean - whether the files matched it

 @param passes - passing markers the suite printed

 @param tally - painted tally

 @param reportDirectory - where the census file goes

 @param baselines - earlier census files named, already read

 @throws StatedRefusalError where the coverage names a bundle the build
 does not hold, or the census places an uncalled function outside its own
 source's stretches

 @example
 ```ts
 await reportCensus({ asked, packageDirectory, distDirectory, bundles, head, clean, passes, tally, reportDirectory, baselines, },);
 ```
 */
async function reportCensus(
  {
    asked,
    packageDirectory,
    distDirectory,
    bundles,
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
    readonly bundles: readonly string[];
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
   Every bundle's lines and sources, by name.
   */
  const read = new Map(
    await Promise.all(bundles.map(async function readOne(bundle,) {
    return [
      bundle,
      await readBundle({
        distDirectory,
        packageDirectory,
        bundle,
      },),
    ] as const;
  },),),
  );
  /**
   Bundles some process loaded.
   */
  const loaded = new Set(tally.loadedBundles(),);
  /**
   Lines of a loaded bundle.

   @param bundle - bundle the coverage names

   @returns Its positions and map
   */
  function linesOf(bundle: string,): BundleLines {
    /**
     Its reading.
     */
    const reading = read.get(bundle,);
    if (reading === undefined)
      throw new StatedRefusalError({ says: `coverage names ${bundle}, which ${distDirectory} does not hold; rebuild and run again`, },);
    return reading.lines;
  }
  /**
   Cold stretches as the census records them, one per piece.
   */
  const stretches = tally.coldStretches()
    .flatMap(function recorded(stretch,) {
    return censusStretchesOf({
      stretch: mapStretch({
        lines: linesOf(stretch.bundle,),
        stretch,
      },),
    },);
  },);
  /**
   Uncalled functions with their lines.
   */
  const uncalled = tally.uncalledFunctions()
    .map(function placed(fn,) {
    return mapFunction({
      lines: linesOf(fn.bundle,),
      uncalled: fn,
    },);
  },);
  requirePlacedFunctions({
    stretches,
    uncalled,
  },);
  /**
   Sources the loaded bundles carry.
   */
  const loadedSources = new Set([...read,].flatMap(function carried([bundle, reading,],): readonly string[] {
    return loaded.has(bundle,) ? reading.sources : [];
  },),);
  /**
   Bundles no process loaded.
   */
  const unloadedBundles = bundles
    .filter(function unloaded(bundle,): boolean {
      return !loaded.has(bundle,);
    },)
    .toSorted();
  /**
   Sources only those bundles carry, with their physical lines.
   */
  const unloadedSources = await unloadedSourcesOf({
    packageDirectory,
    carried: unloadedBundles.flatMap(function carried(bundle,): readonly string[] {
      return read.get(bundle,)
        ?.sources
        ?? [];
    },),
    loadedSources,
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
    JSON.stringify(
      {
        format: CENSUS_FORMAT,
        head,
        clean,
        testFiles: asked.testFiles,
        passes,
        stretches,
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
                .source : `(unmapped) ${fn.bundle}`,
            line: (fn.at
              .kind
              === 'mapped') ? fn.at
                .line : 0,
          };
        },),
        loadedSources: [...loadedSources,].toSorted(),
        unloadedBundles,
        unloadedSources,
      },
      null,
      1,
    ),
  );
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
        uncalled,
        unloadedBundles,
        unloadedSources,
        censusPath,
      },
    },),
    ...baselines.flatMap(function baselineLines({
      path,
      stretches: baseline,
    },): readonly string[] {
      return baselineReportLines({
        path,
        statuses: baselineStatusesOf({
          baseline,
          current: stretches,
          loadedSources,
          sources: new Set(asked.sources,),
        },),
      },);
    },),
  ];
  for (const line of lines)
    console.log(line,);
}

/**
 Runs the census the command line asked for and prints its report.

 Returns nothing: the report on stdout IS the output, and the census file it
 names is the record.

 @throws StatedRefusalError where the build carries no source maps, or the
 suite failed

 @example
 ```ts
 await runCoverageCensus();
 ```
 */
async function runCoverageCensus(): Promise<void> {
  /**
   What was asked.
   */
  const asked = readCensusArguments({ argv: process.argv, },);
  /**
   Each earlier census named, read before the suite runs, so a file that
   does not read as one refuses at once rather than after the whole suite
   (ledger M67's control run spent a suite on one).
   */
  const baselines = await Promise.all(asked.baseline
    .map(async function readBaseline(path,): Promise<Baseline> {
    return {
      path,
      stretches: readBaselineStretches({
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
   Files the build holds.
   */
  const built = await readdir(distDirectory,);
  /**
   Its bundles.
   */
  const bundles = built.filter(function isBundle(name,): boolean {
    return name.endsWith('.mjs',);
  },);
  /**
   The maps beside them.
   */
  const maps = new Set(built.filter(function isMap(name,): boolean {
    return name.endsWith('.mjs.map',);
  },),);
  if (!bundles.every(function mapped(bundle,): boolean {
    return maps.has(`${bundle}.map`,);
  },))
    throw new StatedRefusalError({
      says: `${distDirectory} holds a bundle with no source map beside it; run the census through `
        + 'mise run //package/module/translation-repair:coverage-census, which builds with maps first',
    },);
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
    bundles,
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
    run: runCoverageCensus,
  },);

//endregion Coverage census
