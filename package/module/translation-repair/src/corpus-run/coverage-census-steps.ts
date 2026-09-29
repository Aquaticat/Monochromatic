import {
  open,
  readdir,
  readFile,
} from 'node:fs/promises';
import {
  join,
  relative,
  resolve,
} from 'node:path';

import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import spawn from 'nano-spawn';

import { isJsonRecord, } from '../json-guard.ts';
import { contextRoot, } from '../log-context.ts';
import {
  FAIL_MARKER,
  markerCount,
  PASS_MARKER,
} from './coverage-census-input.ts';
import type { UnloadedSource, } from './coverage-census-print.ts';
import { sourceKindOf, } from './coverage-census-report.ts';
import {
  type BundleScript,
  bundleScriptsOf,
} from './coverage-file.ts';
import {
  type BundleLines,
  bundleLinesOf,
  readSourceMap,
} from './coverage-lines.ts';
import {
  type CoverageTally,
  createCoverageTally,
} from './coverage-tally.ts';
import { resolveGit, } from './git-command.ts';

//region Coverage census steps
// Ledger T8: the steps of the coverage census that touch files and
// processes, apart from the entry so each is tested against a disposable
// directory: which commit the build came from, the suite run under coverage,
// the two readings of the coverage directory, one bundle's text and map, and
// the sources only unloaded bundles carry.

/**
 Logger for the steps' progress lines.
 */
const stepsLog = contextRoot({ tag: 'coverage-census', },);

/**
 The commit the package's files were built from, and whether they match it.

 @param packageDirectory - package directory, inside a git work tree

 @returns Nine-character hash and whether `git status` shows no change under the package

 @example
 ```ts
 const { head, clean, } = await packageCommit({ packageDirectory, },);
 ```
 */
export async function packageCommit({ packageDirectory, }: { readonly packageDirectory: string; },): Promise<{
  readonly head: string;
  readonly clean: boolean;
}> {
  /**
   Git to run.
   */
  const git = await resolveGit();
  /**
   The commit.
   */
  const { stdout: head, } = await spawn(
    git,
    [
      '-C',
      packageDirectory,
      'rev-parse',
      '--short=9',
      'HEAD',
    ],
  );
  /**
   Changes under the package.
   */
  const { stdout: changes, } = await spawn(
    git,
    [
      '-C',
      packageDirectory,
      'status',
      '--porcelain',
      '--',
      '.',
    ],
  );
  return {
    head: head.trim(),
    clean: changes.trim() === '',
  };
}

/**
 Runs a test command with V8 writing coverage, its output in a log file
 rather than in memory.

 @param command - program and arguments, `mise run test:unit` and any test files in the census

 @param cwd - directory it runs in

 @param coverageDirectory - where V8 writes coverage

 @param logPath - where its output goes

 @returns Passing and failing markers the log holds, and the exit code

 @example
 ```ts
 const suite = await runSuite({ command: ['mise', 'run', 'test:unit',], cwd, coverageDirectory, logPath, },);
 ```
 */
export async function runSuite(
  {
    command,
    cwd,
    coverageDirectory,
    logPath,
  }: {
    readonly command: readonly [
      string,
      ...string[]
    ];
    readonly cwd: string;
    readonly coverageDirectory: string;
    readonly logPath: string;
  },
): Promise<{
  readonly passes: number;
  readonly failures: number;
  readonly exitCode: number;
}> {
  /**
   The log, open for the command to write, closed when this returns.
   */
  await using log = await open(
    logPath,
    'w',
  );
  /**
   Program and arguments.
   */
  const [program, ...args] = command;
  /**
   The exit code, 0 unless the command failed.
   */
  const exitCode = await (async function commandExit(): Promise<number> {
    try {
      await spawn(
        program,
        args,
        {
          cwd,
          env: { NODE_V8_COVERAGE: coverageDirectory, },
          stdio: [
            'ignore',
            log.fd,
            log.fd,
          ],
        },
      );
      return 0;
    }
    catch (error) {
      stepsLog.warn(`${program} exited with a failure: ${caughtValueText(error,)}`,);
      return (isJsonRecord(error,) && Number.isInteger(error.exitCode,)) ? Number(error.exitCode,) : 1;
    }
  })();
  /**
   What the command printed.
   */
  const text = await readFile(
    logPath,
    'utf8',
  );
  return {
    passes: markerCount({
      text,
      marker: PASS_MARKER,
    },),
    failures: markerCount({
      text,
      marker: FAIL_MARKER,
    },),
    exitCode,
  };
}

/**
 Reads one coverage file's bundle scripts.

 @param path - coverage file

 @param bundleUrlPrefix - `file://` URL of the build directory with a trailing slash

 @returns Its bundle scripts

 @throws CoverageFileError where the file does not read as V8 writes one

 @example
 ```ts
 const scripts = await readCoverageFile({ path, bundleUrlPrefix, },);
 ```
 */
async function readCoverageFile(
  {
    path,
    bundleUrlPrefix,
  }: {
    readonly path: string;
    readonly bundleUrlPrefix: string;
  },
): Promise<readonly BundleScript[]> {
  return bundleScriptsOf({
    path,
    text: await readFile(
      path,
      'utf8',
    ),
    bundleUrlPrefix,
  },);
}

/**
 Reads each coverage file's bundle scripts in turn, ONE FILE IN MEMORY AT A
 TIME: a whole suite writes about 8 GB, so the files are read in sequence,
 each yielded before the next is opened.

 @param paths - coverage files, in the order to read them

 @param bundleUrlPrefix - `file://` URL of the build directory with a trailing slash

 @returns Each file's bundle scripts

 @throws CoverageFileError where a file does not read as V8 writes one

 @example
 ```ts
 for await (const scripts of coverageReadings({ paths, bundleUrlPrefix, },)) tally.paint({ scripts, },);
 ```
 */
export async function* coverageReadings(
  {
    paths,
    bundleUrlPrefix,
  }: {
    readonly paths: readonly string[];
    readonly bundleUrlPrefix: string;
  },
): AsyncGenerator<readonly BundleScript[]> {
  for (const path of paths) {
    yield readCoverageFile({
      path,
      bundleUrlPrefix,
    },);
  }
}

/**
 Reads every coverage file twice into a tally: boundaries first, then counts.

 @param coverageDirectory - where V8 wrote coverage

 @param bundleUrlPrefix - `file://` URL of the build directory with a trailing slash

 @returns The painted tally

 @throws CoverageFileError where a file does not read as V8 writes one

 @example
 ```ts
 const tally = await tallyCoverage({ coverageDirectory, bundleUrlPrefix, },);
 ```
 */
export async function tallyCoverage(
  {
    coverageDirectory,
    bundleUrlPrefix,
  }: {
    readonly coverageDirectory: string;
    readonly bundleUrlPrefix: string;
  },
): Promise<CoverageTally> {
  /**
   Every coverage file, in one fixed order for both readings.
   */
  const paths = (await readdir(coverageDirectory,))
    .toSorted()
    .map(function inDirectory(name,): string {
      return join(
        coverageDirectory,
        name,
      );
    },);
  stepsLog.info(`${String(paths.length,)} coverage files`,);
  /**
   The tally.
   */
  const tally = createCoverageTally();
  for await (const scripts of coverageReadings({
    paths,
    bundleUrlPrefix,
  },))
    tally.noteBoundaries({ scripts, },);
  stepsLog.info('boundaries noted; counting',);
  for await (const scripts of coverageReadings({
    paths,
    bundleUrlPrefix,
  },))
    tally.paint({ scripts, },);
  return tally;
}

/**
 Reads a bundle's text and map.

 @param distDirectory - build directory

 @param packageDirectory - package directory

 @param bundle - bundle name

 @returns Its lines and the sources its map names, relative to the package

 @throws SourceMapFileError where its map does not read as a version 3 map

 @example
 ```ts
 const { lines, sources, } = await readBundle({ distDirectory, packageDirectory, bundle: 'index.mjs', },);
 ```
 */
export async function readBundle(
  {
    distDirectory,
    packageDirectory,
    bundle,
  }: {
    readonly distDirectory: string;
    readonly packageDirectory: string;
    readonly bundle: string;
  },
): Promise<{
  readonly lines: BundleLines;
  readonly sources: readonly string[];
}> {
  /**
   Its map file.
   */
  const mapPath = join(
    distDirectory,
    `${bundle}.map`,
  );
  /**
   The map.
   */
  const {
    map,
    sources,
  } = readSourceMap({
    path: mapPath,
    text: await readFile(
      mapPath,
      'utf8',
    ),
  },);
  return {
    lines: bundleLinesOf({
      text: await readFile(
        join(
          distDirectory,
          bundle,
        ),
        'utf8',
      ),
      map,
      mapDirectory: distDirectory,
      packageDirectory,
    },),
    sources: sources.map(function fromPackage(source,): string {
      return relative(
        packageDirectory,
        resolve(
          distDirectory,
          source,
        ),
      );
    },),
  };
}

/**
 The sources bundles no test loaded carry that no loaded bundle carries too,
 each with its kind and physical lines, which the spans leave uncounted.

 @param packageDirectory - package directory the sources are named from

 @param carried - sources the unloaded bundles name, repeats allowed

 @param loadedSources - sources the loaded bundles carry

 @param entryFiles - sources the build names as runner entries

 @returns One record per source, sorted by name

 @example
 ```ts
 const unloaded = await unloadedSourcesOf({ packageDirectory, carried, loadedSources, entryFiles, },);
 ```
 */
export async function unloadedSourcesOf(
  {
    packageDirectory,
    carried,
    loadedSources,
    entryFiles,
  }: {
    readonly packageDirectory: string;
    readonly carried: readonly string[];
    readonly loadedSources: ReadonlySet<string>;
    readonly entryFiles: ReadonlySet<string>;
  },
): Promise<readonly UnloadedSource[]> {
  return await Promise.all(
    [...new Set(carried,),]
      .filter(function onlyThere(source,): boolean {
        return !loadedSources.has(source,);
      },)
      .toSorted()
      .map(async function counted(source,): Promise<UnloadedSource> {
        return {
          source,
          kind: sourceKindOf({
            source,
            entryFiles,
          },),
          lines: (await readFile(
            join(
              packageDirectory,
              source,
            ),
            'utf8',
          )).split('\n',)
            .length,
        };
      },),
  );
}

//endregion Coverage census steps
