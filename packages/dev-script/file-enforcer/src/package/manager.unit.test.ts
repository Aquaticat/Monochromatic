import {
  describe,
  expect,
  test,
} from 'bun:test';
import {
  binaryExists,
  detectManager,
  isRoot,
  resetManagerCache,
  resetRootCache,
} from './manager.ts';

//region detectManager

describe('detectManager', () => {
  test('returns a non-null manager on a standard system', async () => {
    resetManagerCache();
    const manager = await detectManager();
    /** Every CI and dev machine has at least one package manager */
    expect(manager,).not.toBeNull();
  });

  test('caches the result across calls', async () => {
    resetManagerCache();
    const first = await detectManager();
    const second = await detectManager();
    expect(first,).toBe(second,);
  });
});

//endregion detectManager

//region binaryExists

describe('binaryExists', () => {
  test('returns true for a binary that exists', async () => {
    /** `ls` exists on every POSIX system */
    const exists = await binaryExists('ls',);
    expect(exists,).toBe(true,);
  });

  test('returns false for a binary that does not exist', async () => {
    const exists = await binaryExists('nonexistent-binary-that-should-not-exist-42',);
    expect(exists,).toBe(false,);
  });
});

//endregion binaryExists

//region isRoot

describe('isRoot', () => {
  test('returns a boolean', () => {
    resetRootCache();
    const result = isRoot();
    expect(typeof result,).toBe('boolean',);
  });

  test('caches the result across calls', () => {
    resetRootCache();
    const first = isRoot();
    const second = isRoot();
    expect(first,).toBe(second,);
  });
});

//endregion isRoot
