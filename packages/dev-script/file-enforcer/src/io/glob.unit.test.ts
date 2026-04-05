import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import {
  expandGlob,
  mirrorGlobPath,
} from './glob.ts';

/** Creates a fresh temp directory */
async function makeTmpDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'file-enforcer-glob-',),);
}

/** Removes the temp directory */
async function teardown(tempDir: string,): Promise<void> {
  await rm(tempDir, { recursive: true, force: true, },);
}

await describe({
  name: '',
  children: [
    //region mirrorGlobPath

    describe({
      name: mirrorGlobPath.name,
      children: [
        it({
          name: 'substitutes a single wildcard',
          fn: async () => {
            expect(
              mirrorGlobPath('src/*.ts', 'dist/*.ts', 'src/index.ts',),
            )
              .toBe('dist/index.ts',);
          },
        }),
        it({
          name: 'substitutes multiple wildcards positionally',
          fn: async () => {
            expect(
              mirrorGlobPath('packages/*/src/*.ts', 'output/*/lib/*.ts',
                'packages/foo/src/bar.ts',),
            )
              .toBe('output/foo/lib/bar.ts',);
          },
        }),
        it({
          name: 'handles wildcards capturing multi-character segments',
          fn: async () => {
            expect(
              mirrorGlobPath('a/*/b', 'x/*/y', 'a/long-segment-name/b',),
            )
              .toBe('x/long-segment-name/y',);
          },
        }),
        it({
          name: 'handles pattern with no wildcards (literal copy)',
          fn: async () => {
            expect(
              mirrorGlobPath('exact/path.ts', 'other/path.ts', 'exact/path.ts',),
            )
              .toBe('other/path.ts',);
          },
        }),
        it({
          name: 'throws when wildcard counts differ between source and dest',
          fn: async () => {
            expect(() => mirrorGlobPath('src/*.ts', 'dist/*/*.ts', 'src/a.ts',)).toThrow(
              'Wildcard count mismatch',
            );
          },
        }),
        it({
          name: 'throws when source path does not match source pattern prefix',
          fn: async () => {
            expect(() => mirrorGlobPath('src/*.ts', 'dist/*.ts', 'lib/index.ts',)).toThrow(
              'does not match pattern',
            );
          },
        }),
        it({
          name: 'throws when source path does not match source pattern suffix',
          fn: async () => {
            expect(() => mirrorGlobPath('src/*.ts', 'dist/*.ts', 'src/index.js',)).toThrow(
              'does not match pattern',
            );
          },
        }),
        it({
          name: 'handles wildcard capturing empty string',
          fn: async () => {
            // Wildcard captures empty segment when path has nothing between fixed parts
            expect(
              mirrorGlobPath('src/*-suffix.ts', 'out/*-suffix.ts', 'src/-suffix.ts',),
            )
              .toBe('out/-suffix.ts',);
          },
        }),
        it({
          name: 'handles wildcard at the very start of pattern',
          fn: async () => {
            expect(
              mirrorGlobPath('*.txt', '*.md', 'readme.txt',),
            )
              .toBe('readme.md',);
          },
        }),
        it({
          name: 'handles wildcard at the very end of pattern',
          fn: async () => {
            expect(
              mirrorGlobPath('prefix-*', 'output-*', 'prefix-data',),
            )
              .toBe('output-data',);
          },
        }),
        it({
          name: 'handles adjacent wildcards in source and dest',
          fn: async () => {
            expect(
              mirrorGlobPath('a/*/*.ext', 'b/*/*.ext', 'a/dir/file.ext',),
            )
              .toBe('b/dir/file.ext',);
          },
        }),
      ],
    }),

    //endregion mirrorGlobPath

    //region expandGlob

    describe({
      name: expandGlob.name,
      children: [
        it({
          name: 'matches files with a wildcard extension pattern',
          fn: async () => {
            const tempDir = await makeTmpDir();
            await writeFile(join(tempDir, 'a.ts',), 'a',);
            await writeFile(join(tempDir, 'b.ts',), 'b',);
            await writeFile(join(tempDir, 'c.js',), 'c',);

            /** Matched paths should only include .ts files */
            const matches = await expandGlob(join(tempDir, '*.ts',),);
            expect([...matches,].toSorted(),).toEqual(
              [join(tempDir, 'a.ts',), join(tempDir, 'b.ts',),].toSorted(),
            );
            await teardown(tempDir,);
          },
        }),
        it({
          name: 'returns empty array when nothing matches',
          fn: async () => {
            const tempDir = await makeTmpDir();
            /** Pattern that matches no files in the empty temp dir */
            const matches = await expandGlob(join(tempDir, '*.nonexistent',),);
            expect(matches,).toEqual([],);
            await teardown(tempDir,);
          },
        }),
        it({
          name: 'includes dot-files when dot option is enabled',
          fn: async () => {
            const tempDir = await makeTmpDir();
            await writeFile(join(tempDir, '.hidden',), 'secret',);
            await writeFile(join(tempDir, 'visible',), 'public',);

            /** Pattern matching everything in the temp dir */
            const matches = await expandGlob(join(tempDir, '*',),);
            /** Should include the dot-file */
            const filenames = matches.map(match => match.split('/',).at(-1,));
            expect(filenames,).toContain('.hidden',);
            await teardown(tempDir,);
          },
        }),
        it({
          name: 'matches files in nested directories with double-star',
          fn: async () => {
            const tempDir = await makeTmpDir();
            /** Nested directory structure */
            const nested = join(tempDir, 'sub', 'deep',);
            await mkdir(nested, { recursive: true, },);
            await writeFile(join(nested, 'found.ts',), 'deep',);
            await writeFile(join(tempDir, 'top.ts',), 'top',);

            /** Double-star should find files at all depths */
            const matches = await expandGlob(join(tempDir, '**/*.ts',),);
            expect(matches.length,).toBe(2,);
            await teardown(tempDir,);
          },
        }),
      ],
    }),

    //endregion expandGlob
  ],
},);
