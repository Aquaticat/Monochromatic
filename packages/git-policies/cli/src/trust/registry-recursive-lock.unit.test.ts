/**
 * Recursive registry lock concurrency regression tests.
 *
 * @module
 */
import {
  mkdtemp,
  rm,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { acquireRecursiveRegistryLock, } from './registry-recursive-lock.ts';

/** Concurrent lock contenders used to expose partial owner-file publication. */
const CONTENDERS = 32;

/** Disposable recursive-lock fixture. */
type LockFixture = Readonly<{
  /** Registry root shared by contenders. */
  registryRoot: string;
  /** Removes disposable registry parent. */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 * Creates disposable registry root for concurrent lock acquisition.
 *
 * @returns disposable registry fixture
 */
async function createLockFixture(): Promise<LockFixture> {
  /** Disposable registry parent. */
  const root = await mkdtemp(join(tmpdir(), 'cli-git-recursive-lock-',),);
  return {
    registryRoot: join(root, 'registry',),
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(root, { recursive: true, force: true, },);
    },
  };
}

await describe({
  name: acquireRecursiveRegistryLock.name,
  children: [
    it({
      name: 'serializes concurrent contenders without exposing partial owner JSON',
      repeats: 2,
      fn: async function testConcurrentOwnerPublication() {
        await using fixture = await createLockFixture();
        await Promise.all(Array.from(
          { length: CONTENDERS, },
          async function acquireAndRelease(): Promise<void> {
            await using lock = await acquireRecursiveRegistryLock({
              registryRoot: fixture.registryRoot,
            },);
            expect(lock,).toBeDefined();
          },
        ),);
      },
    },),
  ],
},);
