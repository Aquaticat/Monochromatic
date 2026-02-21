import { join, } from 'node:path';
import {
  mkdtemp,
  rm,
  writeFile,
  mkdir,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import {
  expandGlob,
  mirrorGlobPath,
} from './glob.ts';

//region mirrorGlobPath

describe('mirrorGlobPath', () => {
  test('substitutes a single wildcard', () => {
    expect.assertions(1);
    expect(
      mirrorGlobPath('src/*.ts', 'dist/*.ts', 'src/index.ts'),
    ).toBe('dist/index.ts');
  });

  test('substitutes multiple wildcards positionally', () => {
    expect.assertions(1);
    expect(
      mirrorGlobPath('packages/*/src/*.ts', 'output/*/lib/*.ts', 'packages/foo/src/bar.ts'),
    ).toBe('output/foo/lib/bar.ts');
  });

  test('handles wildcards capturing multi-character segments', () => {
    expect.assertions(1);
    expect(
      mirrorGlobPath('a/*/b', 'x/*/y', 'a/long-segment-name/b'),
    ).toBe('x/long-segment-name/y');
  });

  test('handles pattern with no wildcards (literal copy)', () => {
    expect.assertions(1);
    expect(
      mirrorGlobPath('exact/path.ts', 'other/path.ts', 'exact/path.ts'),
    ).toBe('other/path.ts');
  });

  test('throws when wildcard counts differ between source and dest', () => {
    expect.assertions(1);
    expect(() =>
      mirrorGlobPath('src/*.ts', 'dist/*/*.ts', 'src/a.ts'),
    ).toThrow('Wildcard count mismatch');
  });

  test('throws when source path does not match source pattern prefix', () => {
    expect.assertions(1);
    expect(() =>
      mirrorGlobPath('src/*.ts', 'dist/*.ts', 'lib/index.ts'),
    ).toThrow('does not match pattern');
  });

  test('throws when source path does not match source pattern suffix', () => {
    expect.assertions(1);
    expect(() =>
      mirrorGlobPath('src/*.ts', 'dist/*.ts', 'src/index.js'),
    ).toThrow('does not match pattern');
  });

  test('handles wildcard capturing empty string', () => {
    expect.assertions(1);
    // Wildcard captures empty segment when path has nothing between fixed parts
    expect(
      mirrorGlobPath('src/*-suffix.ts', 'out/*-suffix.ts', 'src/-suffix.ts'),
    ).toBe('out/-suffix.ts');
  });

  test('handles wildcard at the very start of pattern', () => {
    expect.assertions(1);
    expect(
      mirrorGlobPath('*.txt', '*.md', 'readme.txt'),
    ).toBe('readme.md');
  });

  test('handles wildcard at the very end of pattern', () => {
    expect.assertions(1);
    expect(
      mirrorGlobPath('prefix-*', 'output-*', 'prefix-data'),
    ).toBe('output-data');
  });

  test('handles adjacent wildcards in source and dest', () => {
    expect.assertions(1);
    expect(
      mirrorGlobPath('a/*/*.ext', 'b/*/*.ext', 'a/dir/file.ext'),
    ).toBe('b/dir/file.ext');
  });
});

//endregion mirrorGlobPath

//region expandGlob

describe('expandGlob', () => {
  /** Temporary directory created fresh for each test */
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'file-enforcer-glob-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true, });
  });

  test('matches files with a wildcard extension pattern', async () => {
    expect.assertions(1);
    await writeFile(join(tempDir, 'a.ts'), 'a');
    await writeFile(join(tempDir, 'b.ts'), 'b');
    await writeFile(join(tempDir, 'c.js'), 'c');

    /** Matched paths should only include .ts files */
    const matches = await expandGlob(join(tempDir, '*.ts'));
    expect([...matches].sort()).toEqual(
      [join(tempDir, 'a.ts'), join(tempDir, 'b.ts')].sort(),
    );
  });

  test('returns empty array when nothing matches', async () => {
    expect.assertions(1);
    /** Pattern that matches no files in the empty temp dir */
    const matches = await expandGlob(join(tempDir, '*.nonexistent'));
    expect(matches).toEqual([]);
  });

  test('includes dot-files when dot option is enabled', async () => {
    expect.assertions(1);
    await writeFile(join(tempDir, '.hidden'), 'secret');
    await writeFile(join(tempDir, 'visible'), 'public');

    /** Pattern matching everything in the temp dir */
    const matches = await expandGlob(join(tempDir, '*'));
    /** Should include the dot-file */
    const filenames = matches.map((match) => match.split('/').at(-1));
    expect(filenames).toContain('.hidden');
  });

  test('matches files in nested directories with double-star', async () => {
    expect.assertions(1);
    /** Nested directory structure */
    const nested = join(tempDir, 'sub', 'deep');
    await mkdir(nested, { recursive: true, });
    await writeFile(join(nested, 'found.ts'), 'deep');
    await writeFile(join(tempDir, 'top.ts'), 'top');

    /** Double-star should find files at all depths */
    const matches = await expandGlob(join(tempDir, '**/*.ts'));
    expect(matches.length).toBe(2);
  });
});

//endregion expandGlob
