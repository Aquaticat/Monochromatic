import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { run, } from './run.ts';

/**
 * A throwaway directory that removes itself on disposal, so the CLI's real
 * filesystem operations run against a disposable fixture, never shared state.
 */
type TempDir = {
  /**
   * Absolute path to the directory.
   */
  readonly path: string;
  /**
   * Remove the directory and its contents.
   */
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

/**
 * Create a throwaway directory under the OS temp dir.
 *
 * @returns a disposable temp directory
 */
async function makeTempDir(): Promise<TempDir> {
  /**
   * Freshly created temp directory path.
   */
  const path = await mkdtemp(join(
    tmpdir(),
    'mdlint-test-',
  ),);
  return {
    path,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(
        path,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

/**
 * A pipe table, which `no-pipe-tables` flags and fixes.
 */
const PIPE_TABLE = [
  '# Title',
  '',
  '| A | B |',
  '| - | - |',
  '| 1 | 2 |',
  '',
].join('\n',);

await describe({
  name: 'run (CLI boundary)',
  children: [
    it({
      name: 'lints a directory and reports violations',
      fn: async function lintsDirectory() {
        await using dir = await makeTempDir();
        await writeFile(
          join(
            dir.path,
            'a.md',
          ),
          PIPE_TABLE,
        );
        /**
         * Lint result over the directory.
         */
        const result = await run({
          paths: [dir.path,],
          fix: false,
          reporter: 'json',
          cwd: dir.path,
        },);
        expect(result.hadViolations,).toBe(true,);
        expect(result.output.includes('no-pipe-tables',),).toBe(true,);
        expect(result.output.includes('a.md',),).toBe(true,);
      },
    },),
    it({
      name: 'skips gitignored files',
      fn: async function skipsGitignored() {
        await using dir = await makeTempDir();
        await writeFile(
          join(
            dir.path,
            '.gitignore',
          ),
          'ignored.md\n',
        );
        await writeFile(
          join(
            dir.path,
            'ignored.md',
          ),
          PIPE_TABLE,
        );
        /**
         * Lint result; the only file is gitignored.
         */
        const result = await run({
          paths: [dir.path,],
          fix: false,
          reporter: 'json',
          cwd: dir.path,
        },);
        expect(result.hadViolations,).toBe(false,);
      },
    },),
    it({
      name: 'fix rewrites the file and leaves it clean',
      fn: async function fixRewrites() {
        await using dir = await makeTempDir();
        /**
         * Path of the file under fix.
         */
        const file = join(
          dir.path,
          'a.md',
        );
        await writeFile(
          file,
          PIPE_TABLE,
        );
        /**
         * Fix result over the directory.
         */
        const result = await run({
          paths: [dir.path,],
          fix: true,
          reporter: 'pretty',
          cwd: dir.path,
        },);
        expect(result.fixedFiles,).toBe(1,);
        expect(result.hadViolations,).toBe(false,);
        /**
         * File contents after the fix.
         */
        const fixed = await readFile(
          file,
          'utf8',
        );
        expect(fixed.includes('<table>',),).toBe(true,);
        expect(fixed.includes('| A | B |',),).toBe(false,);
      },
    },),
  ],
},);
