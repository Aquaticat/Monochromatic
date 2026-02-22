import { join, } from 'node:path';
import {
  mkdtemp,
  rm,
  writeFile,
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
  reset,
  trackDest,
  trackRead,
  trackWriteTime,
  writeTimestamps,
} from '../tracker.ts';
import {
  classifyEvent,
  shouldTrigger,
  watchDirs,
} from './watch-filter.ts';

//region watchDirs

describe('watchDirs', () => {
  afterEach(() => {
    reset();
    writeTimestamps.clear();
  });

  test('includes config file directory', () => {
    expect.assertions(1);
    const dirs = watchDirs('/project/file-enforcer.config.ts');
    expect(dirs.has('/project')).toBe(true);
  });

  test('includes parent directories of all tracked reads', () => {
    expect.assertions(2);
    trackRead('/repo/AGENTS.md');
    trackRead('/repo/packages/config/oxlint.json');

    const dirs = watchDirs('/repo/config.ts');
    expect(dirs.has('/repo')).toBe(true);
    expect(dirs.has('/repo/packages/config')).toBe(true);
  });

  test('includes parent directories of tracked writes for protection', () => {
    expect.assertions(1);
    trackDest('/repo/CLAUDE.md');

    const dirs = watchDirs('/repo/config.ts');
    expect(dirs.has('/repo')).toBe(true);
  });

  test('deduplicates directories when multiple paths share a parent', () => {
    expect.assertions(1);
    trackRead('/repo/a.md');
    trackDest('/repo/b.md');

    const dirs = watchDirs('/repo/config.ts');
    expect(dirs.size).toBe(1);
  });

  test('returns only config dir when no reads or writes are tracked', () => {
    expect.assertions(1);
    const dirs = watchDirs('/project/config.ts');
    expect(dirs.size).toBe(1);
  });
});

//endregion watchDirs

//region classifyEvent

describe('classifyEvent', () => {
  /** Temporary directory for real filesystem operations */
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'file-enforcer-classify-'));
    reset();
    writeTimestamps.clear();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true, });
  });

  test('classifies tracked read file as source', async () => {
    expect.assertions(1);
    trackRead('/repo/AGENTS.md');
    expect(await classifyEvent('AGENTS.md', '/repo', '/repo/config.ts')).toBe('source');
  });

  test('classifies config file itself as source', async () => {
    expect.assertions(1);
    expect(await classifyEvent('config.ts', '/repo', '/repo/config.ts')).toBe('source');
  });

  test('classifies our own write echo as ignore (mtime <= writeTimestamp)', async () => {
    expect.assertions(1);
    /** Write a real file so stat() works */
    const filePath = join(tempDir, 'managed.md');
    await writeFile(filePath, 'enforced content');
    trackDest(filePath);
    trackWriteTime(filePath);

    /** Immediately after our write, mtime should be <= our timestamp */
    expect(await classifyEvent('managed.md', tempDir, '/repo/config.ts')).toBe('ignore');
  });

  test('classifies external edit as protected (mtime > writeTimestamp)', async () => {
    expect.assertions(1);
    /** Write the file and record a timestamp in the past */
    const filePath = join(tempDir, 'protected.md');
    await writeFile(filePath, 'original');
    trackDest(filePath);
    // Record a timestamp well in the past to simulate stale write
    /** Offset to push our recorded time into the past */
    const pastOffset = 2000;
    writeTimestamps.set(filePath, Date.now() - pastOffset);

    /** Now modify the file -- its mtime will be "now", after our recorded timestamp */
    await writeFile(filePath, 'externally modified');

    expect(await classifyEvent('protected.md', tempDir, '/repo/config.ts')).toBe('protected');
  });

  test('classifies as protected when dest has no write timestamp (content-skip case)', async () => {
    expect.assertions(1);
    /** File registered as managed but never actually written (content was unchanged) */
    const filePath = join(tempDir, 'skipcase.md');
    await writeFile(filePath, 'same');
    trackDest(filePath);
    // No trackWriteTime -- simulates content-based skip

    expect(await classifyEvent('skipcase.md', tempDir, '/repo/config.ts')).toBe('protected');
  });

  test('classifies as protected when file was deleted externally', async () => {
    expect.assertions(1);
    /** Register a path that doesn't exist on disk */
    trackDest(join(tempDir, 'deleted.md'));
    trackWriteTime(join(tempDir, 'deleted.md'));

    /** stat() will fail since the file was never created */
    expect(await classifyEvent('deleted.md', tempDir, '/repo/config.ts')).toBe('protected');
  });

  test('classifies unrelated file as ignore', async () => {
    expect.assertions(1);
    trackRead('/repo/AGENTS.md');
    expect(await classifyEvent('README.md', '/repo', '/repo/config.ts')).toBe('ignore');
  });

  test('write classification takes precedence over read for dual-tracked paths', async () => {
    expect.assertions(1);
    /** A file that is both read and written */
    const filePath = join(tempDir, 'dual.md');
    await writeFile(filePath, 'content');
    trackRead(filePath);
    trackDest(filePath);
    trackWriteTime(filePath);

    // Immediately after write, echo detection should classify as ignore
    expect(await classifyEvent('dual.md', tempDir, '/repo/config.ts')).toBe('ignore');
  });
});

//endregion classifyEvent

//region shouldTrigger

describe('shouldTrigger', () => {
  /** Temporary directory for filesystem operations */
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'file-enforcer-trigger-'));
    reset();
    writeTimestamps.clear();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true, });
  });

  test('returns true for source events', async () => {
    expect.assertions(1);
    trackRead('/repo/AGENTS.md');
    expect(await shouldTrigger('AGENTS.md', '/repo', '/repo/config.ts')).toBe(true);
  });

  test('returns true for protected events', async () => {
    expect.assertions(1);
    /** File with a stale write timestamp */
    const filePath = join(tempDir, 'stale.md');
    await writeFile(filePath, 'old');
    trackDest(filePath);
    /** Push timestamp into the past */
    const pastOffset = 2000;
    writeTimestamps.set(filePath, Date.now() - pastOffset);
    await writeFile(filePath, 'modified externally');

    expect(await shouldTrigger('stale.md', tempDir, '/repo/config.ts')).toBe(true);
  });

  test('returns false for ignore events', async () => {
    expect.assertions(1);
    expect(await shouldTrigger('random.txt', '/repo', '/repo/config.ts')).toBe(false);
  });

  test('returns false for our own write echoes', async () => {
    expect.assertions(1);
    /** File just written by us */
    const filePath = join(tempDir, 'echo.md');
    await writeFile(filePath, 'ours');
    trackDest(filePath);
    trackWriteTime(filePath);

    expect(await shouldTrigger('echo.md', tempDir, '/repo/config.ts')).toBe(false);
  });
});

//endregion shouldTrigger
