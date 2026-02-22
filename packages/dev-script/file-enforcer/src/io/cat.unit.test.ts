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
import { cat, } from './cat.ts';
import { reads, reset, } from '../tracker.ts';

//region cat(string[]) -- array mode

describe('cat(string[])', () => {
  /** Temporary directory created fresh for each test */
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'file-enforcer-cat-'));
    reset();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true, });
  });

  test('concatenates multiple files with newline separator', async () => {
    expect.assertions(1);
    await writeFile(join(tempDir, 'a.txt'), 'hello');
    await writeFile(join(tempDir, 'b.txt'), 'world');

    /** Concatenated result of two files */
    const result = await cat([join(tempDir, 'a.txt'), join(tempDir, 'b.txt')]);
    expect(result).toBe('hello\nworld');
  });

  test('returns single file content when array has one element', async () => {
    expect.assertions(1);
    await writeFile(join(tempDir, 'only.txt'), 'solo');

    /** Should return the content without any separator artifacts */
    const result = await cat([join(tempDir, 'only.txt')]);
    expect(result).toBe('solo');
  });

  test('auto-expands glob patterns within the array', async () => {
    expect.assertions(1);
    await writeFile(join(tempDir, 'x.ts'), 'one');
    await writeFile(join(tempDir, 'y.ts'), 'two');

    /** Glob in the array should be expanded and all matches concatenated */
    const result = await cat([join(tempDir, '*.ts')]);
    /** Order may vary; check both pieces are present */
    expect(result.split('\n').sort()).toEqual(['one', 'two'].sort());
  });

  test('handles mix of literal paths and globs', async () => {
    expect.assertions(1);
    await writeFile(join(tempDir, 'literal.txt'), 'fixed');
    await writeFile(join(tempDir, 'matched.ts'), 'globbed');

    /** Mixed array with one literal and one glob */
    const result = await cat([
      join(tempDir, 'literal.txt'),
      join(tempDir, '*.ts'),
    ]);
    expect(result).toContain('fixed');
  });

  test('preserves file content exactly (no trimming)', async () => {
    expect.assertions(1);
    /** Content with leading/trailing whitespace and newlines */
    const content = '  spaces  \n\n  tabs\t\n';
    await writeFile(join(tempDir, 'whitespace.txt'), content);

    const result = await cat([join(tempDir, 'whitespace.txt')]);
    expect(result).toBe(content);
  });

  test('handles empty file', async () => {
    expect.assertions(1);
    await writeFile(join(tempDir, 'empty.txt'), '');

    const result = await cat([join(tempDir, 'empty.txt')]);
    expect(result).toBe('');
  });

  test('tracks read paths in the tracker', async () => {
    expect.assertions(1);
    await writeFile(join(tempDir, 'tracked.txt'), 'data');

    await cat([join(tempDir, 'tracked.txt')]);
    /** Tracker should have recorded the absolute read path */
    expect(reads.size).toBeGreaterThan(0);
  });
});

//endregion cat(string[]) -- array mode

//region cat(string) -- glob mode

describe('cat(string)', () => {
  /** Temporary directory created fresh for each test */
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'file-enforcer-cat-glob-'));
    reset();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true, });
  });

  test('returns GlobResult array with path and content per match', async () => {
    expect.assertions(2);
    await writeFile(join(tempDir, 'file1.md'), 'content1');
    await writeFile(join(tempDir, 'file2.md'), 'content2');

    /** Glob mode returns structured results, not a flat string */
    const results = await cat(join(tempDir, '*.md'));
    expect(results.length).toBe(2);
    /** Each result should have both path and content */
    const contents = results.map((result) => result.content).sort();
    expect(contents).toEqual(['content1', 'content2']);
  });

  test('returns empty array when glob matches nothing', async () => {
    expect.assertions(1);
    /** Pattern with no matches */
    const results = await cat(join(tempDir, '*.xyz'));
    expect(results).toEqual([]);
  });

  test('includes the matched file path in each result', async () => {
    expect.assertions(1);
    await writeFile(join(tempDir, 'named.ts'), 'code');

    const results = await cat(join(tempDir, '*.ts'));
    /** Path should end with the filename */
    expect(results[0]?.path).toContain('named.ts');
  });

  test('tracks each matched file in the tracker', async () => {
    expect.assertions(1);
    await writeFile(join(tempDir, 'r1.ts'), 'a');
    await writeFile(join(tempDir, 'r2.ts'), 'b');

    await cat(join(tempDir, '*.ts'));
    /** Both files should be tracked */
    expect(reads.size).toBe(2);
  });

  test('matches files in nested directories', async () => {
    expect.assertions(1);
    /** Nested directory with a matching file */
    const subDir = join(tempDir, 'nested');
    await mkdir(subDir, { recursive: true, });
    await writeFile(join(subDir, 'deep.ts'), 'nested');
    await writeFile(join(tempDir, 'top.ts'), 'top');

    /** Double-star should find both */
    const results = await cat(join(tempDir, '**/*.ts'));
    expect(results.length).toBe(2);
  });
});

//endregion cat(string) -- glob mode
