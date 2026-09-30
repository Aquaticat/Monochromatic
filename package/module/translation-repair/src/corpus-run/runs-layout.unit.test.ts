/**
 Tests for where a pass puts what it leaves behind.

 EVERY PATH SITS UNDER THE ONE RUNS DIRECTORY, named by the constant its
 owning module exports, so the cases compare against those constants rather
 than against spellings of their own: a reader that walks a runs directory
 imports the same names.

 TWO DIRECTORIES ARE PROMISED EVEN WHEN NOTHING SETTLES: the artifacts
 directory and the published tree. The others are made by whatever writes
 into them first, and a case pins that too, so a change to which directories
 exist before the first entry shows up here.

 DISPOSABLE FIXTURES ONLY: every case lays out its own `mkdtemp` directory,
 removed when the case ends.

 @module
 */

import {
  mkdtemp,
  rm,
  stat,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  ARTIFACTS_DIR,
  DECLINED_DIR,
  FIXED_TREE_DIR,
  isMissingPathError,
  prepareRunsLayout,
  PROMPT_PAYLOADS_DIR,
  SLICE_CACHE_DIR,
} from '../../dist/final/node/index.mjs';

//region Runs layout tests

/**
 Makes one throwaway runs directory.

 @returns Runs directory, removed on dispose

 @example
 ```ts
 await using runs = await throwawayRunsDir();
 ```
 */
async function throwawayRunsDir(): Promise<AsyncDisposable & { readonly runsDir: string; }> {
  /**
   Throwaway runs directory, never a real one.
   */
  const runsDir = await mkdtemp(join(
    tmpdir(),
    'runs-layout-',
  ),);
  return {
    runsDir,
    [Symbol.asyncDispose]: async function removeRunsDir() {
      await rm(
        runsDir,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

/**
 Whether a path is a directory on disk now.

 @param path - path to look at

 @returns True for a directory, false for anything else or nothing

 @example
 ```ts
 expect(await isDirectory({ path: layout.artifactsDir, },),).toBe(true,);
 ```
 */
async function isDirectory({ path, }: { readonly path: string; },): Promise<boolean> {
  try {
    return (await stat(path,)).isDirectory();
  } catch (error) {
    if (isMissingPathError({ error, },))
      return false;
    throw error;
  }
}

await describe({
  name: prepareRunsLayout.name,
  children: [
    it({
      name: 'NAMES every path under the runs directory by its owner\'s constant',
      fn: async () => {
        await using runs = await throwawayRunsDir();
        expect(await prepareRunsLayout({ runsDir: runs.runsDir, },),).toEqual({
          artifactsDir: join(
            runs.runsDir,
            ARTIFACTS_DIR,
          ),
          publishDir: join(
            runs.runsDir,
            FIXED_TREE_DIR,
          ),
          declinedDir: join(
            runs.runsDir,
            DECLINED_DIR,
          ),
          sliceCacheDir: join(
            runs.runsDir,
            SLICE_CACHE_DIR,
          ),
          promptPayloadDir: join(
            runs.runsDir,
            PROMPT_PAYLOADS_DIR,
          ),
          attemptsPath: join(
            runs.runsDir,
            'attempts.json',
          ),
        },);
      },
    },),

    it({
      name: 'CREATES the artifacts directory and the published tree, and no other, so a pass that settles '
        + 'nothing still leaves both',
      fn: async () => {
        await using runs = await throwawayRunsDir();
        const layout = await prepareRunsLayout({ runsDir: runs.runsDir, },);
        expect(await isDirectory({ path: layout.artifactsDir, },),).toBe(true,);
        expect(await isDirectory({ path: layout.publishDir, },),).toBe(true,);
        expect(await isDirectory({ path: layout.declinedDir, },),).toBe(false,);
        expect(await isDirectory({ path: layout.sliceCacheDir, },),).toBe(false,);
        expect(await isDirectory({ path: layout.promptPayloadDir, },),).toBe(false,);
      },
    },),

    it({
      name: 'ACCEPTS a runs directory laid out before, since a resumed pass prepares the same layout again',
      fn: async () => {
        await using runs = await throwawayRunsDir();
        const first = await prepareRunsLayout({ runsDir: runs.runsDir, },);
        expect(await prepareRunsLayout({ runsDir: runs.runsDir, },),).toEqual(first,);
      },
    },),
  ],
},);

//endregion Runs layout tests
