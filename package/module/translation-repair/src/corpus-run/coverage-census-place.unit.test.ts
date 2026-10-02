/**
 Tests for the census's placement of a painted tally on source lines
 (ledger T8): a cold block in a mapped bundle placed on its source line, a
 function no process called placed on the line it starts, the sources the
 loaded bundles carry, and the sources only an unloaded bundle carries;
 a bundle with no map read only where code must be placed in it, and
 refused by name there. Each case builds a disposable package with a build
 directory, its maps and a coverage directory. Names are cat-themed
 invention.

 @module
 */

import {
  mkdir,
  readdir,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { pathToFileURL, } from 'node:url';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  bundleMapsOf,
  placeTally,
  tallyCoverage,
} from '../../dist/final/node/index.mjs';
import { scratchDirWith, } from '../scratch-dir.test-fixture.ts';

/**
 A bundle's text: one line, then a second line of 120 characters, which a
 map of `;AAAA` places wholly on its source's first line.
 */
const BUNDLE_TEXT = `x\n${'y'.repeat(120,)}`;

/**
 One function a coverage file lists: its name and its ranges as
 `[start, end, count]`, whole extent first.
 */
type FixtureFunction = {
  readonly name: string;
  readonly ranges: readonly (readonly [number, number, number])[];
};

/**
 One bundle a fixture build holds.
 */
type FixtureBundle = {
  /**
   Its file name.
   */
  readonly bundle: string;

  /**
   The source its map names, absent for a bundle written without a map.
   */
  readonly source?: string;
};

/**
 A disposable package with a build directory holding the bundles given,
 each with a map to its source when it names one, the sources' files, and
 an empty coverage directory.

 @param bundles - bundles the build holds

 @returns The package, its build directory and coverage directory, and the
 build's URL prefix
 */
async function fixturePackage(
  { bundles, }: { readonly bundles: readonly FixtureBundle[]; },
) {
  /**
   Built package: setup's own fields, plus the directory's path and
   disposer, wired by `scratchDirWith`.
   */
  const built = await scratchDirWith({
    prefix: 'translation-repair-place-test-',
    setup: async function seeded({ path, },): Promise<{
      readonly distDirectory: string;
      readonly coverageDirectory: string;
      readonly prefix: string;
    }> {
      /**
       Its build directory.
       */
      const distDirectory = join(
        path,
        'dist',
        'final',
        'node',
      );
      /**
       Where the coverage files go.
       */
      const coverageDirectory = join(
        path,
        'coverage',
      );
      await mkdir(
        distDirectory,
        { recursive: true, },
      );
      await mkdir(
        coverageDirectory,
        { recursive: true, },
      );
      await mkdir(
        join(
          path,
          'src',
        ),
        { recursive: true, },
      );
      await Promise.all(bundles.map(async function writtenBundle({ bundle, source, },): Promise<void> {
        await writeFile(
          join(
            distDirectory,
            bundle,
          ),
          BUNDLE_TEXT,
        );
        if (source === undefined)
          return;
        await Promise.all([
          writeFile(
            join(
              distDirectory,
              `${bundle}.map`,
            ),
            JSON.stringify({
              version: 3,
              sources: [`../../../${source}`,],
              names: [],
              mappings: ';AAAA',
            },),
          ),
          writeFile(
            join(
              path,
              source,
            ),
            'doze\nyawn\nstretch',
          ),
        ],);
      },),);
      return {
        distDirectory,
        coverageDirectory,
        prefix: `${pathToFileURL(distDirectory,).href}/`,
      };
    },
  },);
  return {
    /**
     The package directory alone, the shape every call site already binds
     with `await using`.
     */
    directory: {
      path: built.path,
      [Symbol.asyncDispose]: built[Symbol.asyncDispose],
    },
    distDirectory: built.distDirectory,
    coverageDirectory: built.coverageDirectory,
    prefix: built.prefix,
  };
}

/**
 Writes one process's coverage file.

 @param coverageDirectory - where it goes

 @param prefix - build directory URL with a trailing slash

 @param scripts - each bundle the process loaded, with its functions
 */
async function writeCoverage(
  {
    coverageDirectory,
    prefix,
    scripts,
  }: {
    readonly coverageDirectory: string;
    readonly prefix: string;
    readonly scripts: readonly (readonly [string, readonly FixtureFunction[]])[];
  },
): Promise<void> {
  await writeFile(
    join(
      coverageDirectory,
      'coverage-1.json',
    ),
    JSON.stringify({
      result: scripts.map(([bundle, functions,],) => ({
        url: `${prefix}${bundle}`,
        functions: functions.map(({ name, ranges, },) => ({
          functionName: name,
          ranges: ranges.map(([startOffset, endOffset, count,],) => ({
            startOffset,
            endOffset,
            count,
          })),
        })),
      })),
    },),
  );
}

/**
 A loaded bundle's script whose top level ran and holds nothing else.
 */
const LINKAGE_ONLY: readonly FixtureFunction[] = [{
  name: '',
  ranges: [[0, BUNDLE_TEXT.length, 1,],],
},];

await describe({
  name: placeTally.name,
  children: [
    it({
      name: 'PLACES a cold block and an uncalled function on their source lines, names the loaded bundles\' '
        + 'sources, and counts the sources only an unloaded bundle carries, reading nothing of a loaded '
        + 'bundle with no map and no cold code',
      fn: async () => {
        const {
          directory,
          distDirectory,
          coverageDirectory,
          prefix,
        } = await fixturePackage({
          bundles: [
            {
              bundle: 'nap.mjs',
              source: 'src/nap.ts',
            },
            {
              bundle: 'purr.mjs',
              source: 'src/purr.ts',
            },
            { bundle: 'index.mjs', },
          ],
        },);
        await using _removed = directory;
        await writeCoverage({
          coverageDirectory,
          prefix,
          scripts: [
            ['nap.mjs', [
              {
                name: '',
                ranges: [[0, BUNDLE_TEXT.length, 1,],],
              },
              {
                name: 'nap',
                ranges: [[10, 90, 2,], [40, 60, 0,],],
              },
              {
                name: 'knead',
                ranges: [[95, 110, 0,],],
              },
            ],],
            ['index.mjs', LINKAGE_ONLY,],
          ],
        },);
        const placed = await placeTally({
          packageDirectory: directory.path,
          distDirectory,
          bundleMaps: bundleMapsOf({
            built: await readdir(distDirectory,),
            distDirectory,
          },),
          tally: await tallyCoverage({
            coverageDirectory,
            bundleUrlPrefix: prefix,
          },),
          entryFiles: new Set(),
        },);
        expect(placed.stretches.map(function where({ bundle, start, end, source, startLine, endLine, },) {
          return {
            bundle,
            start,
            end,
            source,
            startLine,
            endLine,
          };
        },),).toEqual([
          {
            bundle: 'nap.mjs',
            start: 40,
            end: 60,
            source: 'src/nap.ts',
            startLine: 1,
            endLine: 1,
          },
          {
            bundle: 'nap.mjs',
            start: 95,
            end: 110,
            source: 'src/nap.ts',
            startLine: 1,
            endLine: 1,
          },
        ],);
        expect(placed.uncalled.map(function named({ name, at, },) {
          return {
            name,
            at,
          };
        },),).toEqual([{
          name: 'knead',
          at: {
            kind: 'mapped',
            source: 'src/nap.ts',
            line: 1,
          },
        },],);
        expect([...placed.loadedSources,],).toEqual(['src/nap.ts',],);
        expect(placed.unloadedBundles,).toEqual(['purr.mjs',],);
        expect(placed.unloadedSources,).toEqual([{
          source: 'src/purr.ts',
          kind: 'library source',
          lines: 3,
        },],);
      },
    },),
    it({
      name: 'REFUSES cold code in a loaded bundle with no map, naming the bundle',
      fn: async () => {
        const {
          directory,
          distDirectory,
          coverageDirectory,
          prefix,
        } = await fixturePackage({
          bundles: [
            {
              bundle: 'nap.mjs',
              source: 'src/nap.ts',
            },
            { bundle: 'index.mjs', },
          ],
        },);
        await using _removed = directory;
        await writeCoverage({
          coverageDirectory,
          prefix,
          scripts: [
            ['nap.mjs', LINKAGE_ONLY,],
            ['index.mjs', [{
              name: '',
              ranges: [[0, BUNDLE_TEXT.length, 1,], [20, 30, 0,],],
            },],],
          ],
        },);
        await expect(placeTally({
          packageDirectory: directory.path,
          distDirectory,
          bundleMaps: bundleMapsOf({
            built: await readdir(distDirectory,),
            distDirectory,
          },),
          tally: await tallyCoverage({
            coverageDirectory,
            bundleUrlPrefix: prefix,
          },),
          entryFiles: new Set(),
        },),).rejects.toThrow('coverage finds code no test ran in index.mjs',);
      },
    },),
    it({
      name: 'REFUSES a bundle no test loaded that has no map, naming the bundle',
      fn: async () => {
        const {
          directory,
          distDirectory,
          coverageDirectory,
          prefix,
        } = await fixturePackage({
          bundles: [
            {
              bundle: 'nap.mjs',
              source: 'src/nap.ts',
            },
            { bundle: 'litter.mjs', },
          ],
        },);
        await using _removed = directory;
        await writeCoverage({
          coverageDirectory,
          prefix,
          scripts: [['nap.mjs', LINKAGE_ONLY,],],
        },);
        await expect(placeTally({
          packageDirectory: directory.path,
          distDirectory,
          bundleMaps: bundleMapsOf({
            built: await readdir(distDirectory,),
            distDirectory,
          },),
          tally: await tallyCoverage({
            coverageDirectory,
            bundleUrlPrefix: prefix,
          },),
          entryFiles: new Set(),
        },),).rejects.toThrow('no test loaded litter.mjs',);
      },
    },),
    it({
      name: 'REFUSES coverage naming a bundle the build does not hold',
      fn: async () => {
        const {
          directory,
          distDirectory,
          coverageDirectory,
          prefix,
        } = await fixturePackage({
          bundles: [{
            bundle: 'nap.mjs',
            source: 'src/nap.ts',
          },],
        },);
        await using _removed = directory;
        await writeCoverage({
          coverageDirectory,
          prefix,
          scripts: [
            ['nap.mjs', LINKAGE_ONLY,],
            ['ghost.mjs', [{
              name: '',
              ranges: [[0, 50, 1,], [20, 30, 0,],],
            },],],
          ],
        },);
        await expect(placeTally({
          packageDirectory: directory.path,
          distDirectory,
          bundleMaps: bundleMapsOf({
            built: await readdir(distDirectory,),
            distDirectory,
          },),
          tally: await tallyCoverage({
            coverageDirectory,
            bundleUrlPrefix: prefix,
          },),
          entryFiles: new Set(),
        },),).rejects.toThrow('coverage names ghost.mjs',);
      },
    },),
  ],
},);
