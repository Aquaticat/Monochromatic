import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import {
  join,
  resolve,
} from 'node:path';
import {
  reset,
  resetWriteTimestamps,
  writes,
  writeTimestamps,
} from '../tracker.ts';
import { globResults, } from './cat.ts';
import {
  overwrite,
  overwriteEach,
  overwriteIfNotExists,
} from './write.ts';

//region overwrite

describe('overwrite', () => {
  /** Temporary directory created fresh for each test */
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'file-enforcer-write-',),);
    reset();
    resetWriteTimestamps();
  },);

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true, },);
  },);

  test('creates a new file with the given content', async () => {
    const dest = join(tempDir, 'new.txt',);
    await overwrite(dest, 'fresh content',);
    expect(await readFile(dest, 'utf8',),).toBe('fresh content',);
  });

  test('overwrites an existing file when content differs', async () => {
    const dest = join(tempDir, 'existing.txt',);
    await writeFile(dest, 'old',);
    await overwrite(dest, 'new',);
    expect(await readFile(dest, 'utf8',),).toBe('new',);
  });

  test('skips write when content is identical', async () => {
    const dest = join(tempDir, 'same.txt',);
    await writeFile(dest, 'unchanged',);
    await overwrite(dest, 'unchanged',);
    /** No writeTimestamp recorded because the actual write was skipped */
    expect(writeTimestamps.has(resolve(dest,),),).toBe(false,);
  });

  test('still registers dest in writes set even when skipping', async () => {
    const dest = join(tempDir, 'tracked-skip.txt',);
    await writeFile(dest, 'same',);
    await overwrite(dest, 'same',);
    /** Path should be managed regardless of skip */
    expect(writes.has(resolve(dest,),),).toBe(true,);
  });

  test('records writeTimestamp only when content actually changes', async () => {
    const dest = join(tempDir, 'changed.txt',);
    await writeFile(dest, 'old content',);

    await overwrite(dest, 'new content',);
    expect(writeTimestamps.has(resolve(dest,),),).toBe(true,);

    resetWriteTimestamps();
    await overwrite(dest, 'new content',);
    /** Same content now -- should NOT record timestamp */
    expect(writeTimestamps.has(resolve(dest,),),).toBe(false,);
  });

  test('creates parent directories if they do not exist', async () => {
    const dest = join(tempDir, 'a', 'b', 'c', 'deep.txt',);
    await overwrite(dest, 'deep',);
    expect(await readFile(dest, 'utf8',),).toBe('deep',);
  });

  test('handles empty content', async () => {
    const dest = join(tempDir, 'empty.txt',);
    await overwrite(dest, '',);
    expect(await readFile(dest, 'utf8',),).toBe('',);
  });

  test('handles content with special characters', async () => {
    const content = 'line1\nline2\ttab\r\nwindows\n\u{1F600}emoji';
    const dest = join(tempDir, 'special.txt',);
    await overwrite(dest, content,);
    expect(await readFile(dest, 'utf8',),).toBe(content,);
  });
});

//endregion overwrite

//region overwriteIfNotExists

describe('overwriteIfNotExists', () => {
  /** Temporary directory created fresh for each test */
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'file-enforcer-wne-',),);
    reset();
    resetWriteTimestamps();
  },);

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true, },);
  },);

  test('creates file when it does not exist', async () => {
    const dest = join(tempDir, 'new.txt',);
    await overwriteIfNotExists(dest, 'created',);
    expect(await readFile(dest, 'utf8',),).toBe('created',);
  });

  test('skips writing when file already exists', async () => {
    const dest = join(tempDir, 'keep.txt',);
    await writeFile(dest, 'original',);
    await overwriteIfNotExists(dest, 'should-not-appear',);
    expect(await readFile(dest, 'utf8',),).toBe('original',);
  });

  test('still registers dest as managed when skipped', async () => {
    const dest = join(tempDir, 'skipme.txt',);
    await writeFile(dest, 'existing',);
    await overwriteIfNotExists(dest, 'ignored',);
    expect(writes.has(resolve(dest,),),).toBe(true,);
  });

  test('creates parent directories for new files', async () => {
    const dest = join(tempDir, 'sub', 'dir', 'new.txt',);
    await overwriteIfNotExists(dest, 'nested',);
    expect(await readFile(dest, 'utf8',),).toBe('nested',);
  });
});

//endregion overwriteIfNotExists

//region overwriteEach

describe('overwriteEach', () => {
  /** Temporary directory created fresh for each test */
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'file-enforcer-each-',),);
    reset();
    resetWriteTimestamps();
  },);

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true, },);
  },);

  test('writes each file to its mirrored destination', async () => {
    const srcDir = join(tempDir, 'src',);
    await mkdir(srcDir, { recursive: true, },);

    const files = globResults(join(srcDir, '*.ts',), [
      { path: join(srcDir, 'a.ts',), content: 'alpha', },
      { path: join(srcDir, 'b.ts',), content: 'beta', },
    ],);

    await overwriteEach(join(tempDir, 'dest', '*.ts',), files,);

    expect(await readFile(join(tempDir, 'dest', 'a.ts',), 'utf8',),).toBe('alpha',);
    expect(await readFile(join(tempDir, 'dest', 'b.ts',), 'utf8',),).toBe('beta',);
  });

  test('skips files whose destination content is already identical', async () => {
    const srcDir = join(tempDir, 'src',);
    const destDir = join(tempDir, 'dest',);
    await mkdir(srcDir, { recursive: true, },);
    await mkdir(destDir, { recursive: true, },);

    /** Pre-populate destination with identical content */
    await writeFile(join(destDir, 'same.ts',), 'unchanged',);

    const files = globResults(join(srcDir, '*.ts',), [
      { path: join(srcDir, 'same.ts',), content: 'unchanged', },
    ],);

    await overwriteEach(join(destDir, '*.ts',), files,);

    /** No writeTimestamp because content was identical */
    expect(writeTimestamps.size,).toBe(0,);
  });

  test('handles empty file array without error', async () => {
    await overwriteEach(join(tempDir, 'dest', '*.ts',),
      globResults(join(tempDir, 'src', '*.ts',), [],),);
    expect(writes.size,).toBe(0,);
  });

  test('tracks each destination in writes set', async () => {
    const srcDir = join(tempDir, 'src',);
    await mkdir(srcDir, { recursive: true, },);

    const files = globResults(join(srcDir, '*.ts',), [
      { path: join(srcDir, 'x.ts',), content: '1', },
      { path: join(srcDir, 'y.ts',), content: '2', },
    ],);

    await overwriteEach(join(tempDir, 'out', '*.ts',), files,);
    expect(writes.size,).toBe(2,);
  });
});

//endregion overwriteEach
