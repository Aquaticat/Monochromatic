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

/**
 * MDX that fails during parsing, representative of a future rule producing
 * invalid MDX during a fixpoint pass.
 */
const INVALID_MDX = '<https://example.com>\n';

/**
 * A file whose only lint finding is an unused reference definition. The raw
 * rule fix would remove every byte, so the CLI boundary must refuse the write.
 */
const UNUSED_REFERENCE_ONLY = '[unused]: https://example.com\n';

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
    it({
      name: 'reports one bad file without aborting sibling fixes',
      fn: async function reportsBadFile() {
        await using dir = await makeTempDir();
        /**
         * Fixable Markdown file that should still be rewritten.
         */
        const goodFile = join(
          dir.path,
          'good.md',
        );
        /**
         * Invalid MDX file that should be reported, not thrown past the run.
         */
        const badFile = join(
          dir.path,
          'bad.mdx',
        );
        await writeFile(
          goodFile,
          PIPE_TABLE,
        );
        await writeFile(
          badFile,
          INVALID_MDX,
        );
        /**
         * Fix result over a mixed-validity directory.
         */
        const result = await run({
          paths: [dir.path,],
          fix: true,
          reporter: 'pretty',
          cwd: dir.path,
        },);
        expect(result.fixedFiles,).toBe(1,);
        expect(result.hadViolations,).toBe(true,);
        expect(result.output.includes('markdown-lint-error',),).toBe(true,);
        /**
         * The sibling file was fixed despite the bad file.
         */
        const fixed = await readFile(
          goodFile,
          'utf8',
        );
        expect(fixed.includes('<table>',),).toBe(true,);
        expect(fixed.length,).toBeGreaterThan(0,);
        expect(await readFile(
          badFile,
          'utf8',
        ),).toBe(INVALID_MDX,);
      },
    },),
    it({
      name: 'refuses to write an empty fix result over a non-empty file',
      fn: async function refusesEmptyRewrite() {
        await using dir = await makeTempDir();
        /**
         * Path of the file whose raw rule fixes would remove all content.
         */
        const file = join(
          dir.path,
          'reference-only.md',
        );
        await writeFile(
          file,
          UNUSED_REFERENCE_ONLY,
        );
        /**
         * Fix result for the risky file.
         */
        const result = await run({
          paths: [file,],
          fix: true,
          reporter: 'pretty',
          cwd: dir.path,
        },);
        expect(result.fixedFiles,).toBe(0,);
        expect(result.hadViolations,).toBe(true,);
        expect(result.output.includes('markdown-lint-safety',),).toBe(true,);
        expect(await readFile(
          file,
          'utf8',
        ),).toBe(UNUSED_REFERENCE_ONLY,);
      },
    },),
  ],
},);
