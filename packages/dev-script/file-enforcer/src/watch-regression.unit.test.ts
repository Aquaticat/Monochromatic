import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import {
  join,
  resolve,
} from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  cat,
  classifyEvent,
  reset,
  resetWriteTimestamps,
  watchDirs,
} from '../dist/final/node/index.mjs';

/**
 * Creates an isolated temp directory for watch regression tests.
 *
 * @returns Temp directory path.
 *
 * @example
 * ```ts
 * const tempDir = await setup();
 * ```
 */
async function setup(): Promise<string> {
  return await mkdtemp(join(
    tmpdir(),
    'file-enforcer-watch-regression-',
  ),);
}

/**
 * Removes an isolated temp directory.
 *
 * @param tempDir - Directory returned by {@link setup}.
 *
 * @example
 * ```ts
 * await teardown(tempDir);
 * ```
 */
async function teardown(tempDir: string,): Promise<void> {
  await rm(
    tempDir,
    {
      recursive: true,
      force: true,
    },
  );
}

await describe({
  name: 'file-enforcer watch regressions',
  concurrency: 1,
  children: [
    it({
      name: 'empty glob dependencies watch future matching files',
      fn: async function emptyGlobWatchesFutureMatches(): Promise<void> {
        const tempDir = await setup();
        await using _cleanup = {
          [Symbol.asyncDispose](): Promise<void> {
            return teardown(tempDir,);
          },
        };
        reset();
        resetWriteTimestamps();
        const sourceDirectory = join(
          tempDir,
          'src',
        );
        const configPath = join(
          tempDir,
          'file-enforcer.config.ts',
        );
        await writeFile(
          configPath,
          '',
        );
        await mkdir(
          sourceDirectory,
          { recursive: true, },
        );
        await cat(join(
          sourceDirectory,
          '*.txt',
        ),);

        /**
         * Directories watched after recording an empty glob expansion.
         */
        const watchedDirectories = watchDirs(configPath,);
        /**
         * Absolute source directory expected to be monitored for future files.
         */
        const resolvedSourceDirectory = resolve(sourceDirectory,);
        expect(watchedDirectories.has(resolvedSourceDirectory,),).toBe(true,);
        await writeFile(
          join(
            sourceDirectory,
            'new.txt',
          ),
          'new content',
        );
        expect(await classifyEvent({
          filename: 'new.txt',
          watchedDir: sourceDirectory,
          configPath,
        },),).toBe('source',);
      },
    },),
  ],
},);
