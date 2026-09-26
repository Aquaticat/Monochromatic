/**
 Owner locks: publication, contention with a live owner, retirement of a dead owner's lock, and ownership checks.

 @module
 */
import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import {
  access,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import { wait, } from '@monochromatic-dev/module-async-time/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { internalTestExports, } from '../../dist/final/node/index.mjs';

const {
  acquireOwnerLock,
  OwnerLockError,
  parseOwnerLockRecord,
  resolveProcessBirthIdentity,
} = internalTestExports;

/**
 Scratch registry directory.

 @returns directory and disposer
 */
async function scratch(): Promise<AsyncDisposable & Readonly<{ path: string; }>> {
  /**
   Directory.
   */
  const path = await mkdtemp(join(tmpdir(), 'cli-git-owner-lock-',),);
  return {
    path,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(path, { recursive: true, force: true, },);
    },
  };
}

/**
 Reports path presence.

 @param path - path

 @returns existence
 */
async function exists(path: string,): Promise<boolean> {
  try {
    await access(path,);
    return true;
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('code' in error) && (error.code === 'ENOENT'))
      return false;
    throw error;
  }
}

/**
 Writes a published lock owned by a process that has exited.

 @param lockDirectory - lock directory
 */
async function writeDeadLock(lockDirectory: string,): Promise<void> {
  /**
   Short-lived owner stand-in.
   */
  const child = spawn(process.execPath, ['--eval', 'setInterval(() => {}, 1000);',], { stdio: 'ignore', },);
  if (child.pid === undefined)
    throw new Error('Owner stand-in did not start.',);
  /**
   Birth identity while it runs.
   */
  const identity = await resolveProcessBirthIdentity(child.pid,);
  if ((typeof identity) === 'symbol')
    throw new Error('Owner stand-in identity is unavailable.',);
  /**
   Exit notification.
   */
  const exited = once(child, 'exit',);
  child.kill('SIGKILL',);
  await exited;
  await mkdir(lockDirectory,);
  await writeFile(join(lockDirectory, 'owner.json',), `${JSON.stringify({ schemaVersion: 1, token: 'dead', ownerPid: child.pid, ownerBirthIdentity: identity, },)}\n`,);
}

await describe({
  name: acquireOwnerLock.name,
  children: [
    it({
      name: 'publishes a lock naming this process and removes it on release without leaving candidates',
      fn: async function testAcquireRelease(): Promise<void> {
        await using directory = await scratch();
        /** Lock path. */
        const lockDirectory = join(directory.path, 'landing.lock',);
        {
          /** Held lock. */
          await using lock = await acquireOwnerLock({ lockDirectory, },);
          expect(await readdir(directory.path,),).toEqual(['landing.lock',],);
          expect(lock.lockDirectory,).toBe(lockDirectory,);
        }
        expect(await readdir(directory.path,),).toEqual([],);
      },
    },),
    it({
      name: 'waits while a live owner holds the lock, notifies once, and acquires after release',
      fn: async function testContention(): Promise<void> {
        await using directory = await scratch();
        /** Lock path. */
        const lockDirectory = join(directory.path, 'hook.lock',);
        /** First owner. */
        const first = await acquireOwnerLock({ lockDirectory, },);
        /** Wait notifications. */
        const waits: string[] = [];
        /** Order of events. */
        const order: string[] = [];
        /** Second acquisition, pending while the first is held. */
        const second = (async function acquireSecond(): Promise<void> {
          await using _second = await acquireOwnerLock({
            lockDirectory,
            pollDelayMs: 5,
            onWait: function recordWait(): void {
              waits.push('wait',);
            },
          },);
          order.push('second acquired',);
        })();
        await wait(100,);
        order.push('first released',);
        await first[Symbol.asyncDispose]();
        await second;
        expect(order,).toEqual(['first released', 'second acquired',],);
        expect(waits,).toEqual(['wait',],);
        expect(await exists(lockDirectory,),).toBe(false,);
      },
    },),
    it({
      name: 'keeps mutual exclusion and leaves nothing behind while many acquirers contend',
      fn: async function testStress(): Promise<void> {
        await using directory = await scratch();
        /** Lock path. */
        const lockDirectory = join(directory.path, 'landing.lock',);
        /** Holders inside the critical section, and the most ever seen at once. */
        const inside = { now: 0, most: 0, entries: 0, };
        await Promise.all(Array.from({ length: 8, }, async function contender(): Promise<void> {
          for (const _round of Array.from({ length: 40, },)) {
            // oxlint-disable-next-line no-await-in-loop -- Each round contends again after its own release.
            await using _lock = await acquireOwnerLock({ lockDirectory, pollDelayMs: 1, },);
            inside.now += 1;
            inside.entries += 1;
            inside.most = Math.max(inside.most, inside.now,);
            // oxlint-disable-next-line no-await-in-loop -- Holding the lock across a turn lets others contend.
            await wait(1,);
            inside.now -= 1;
          }
        },),);
        expect(inside,).toEqual({ now: 0, most: 1, entries: 8 * 40, },);
        expect(await readdir(directory.path,),).toEqual([],);
      },
    },),
    it({
      name: 'retires a lock whose owner is dead and acquires it',
      fn: async function testDeadOwner(): Promise<void> {
        await using directory = await scratch();
        /** Lock path. */
        const lockDirectory = join(directory.path, 'landing.lock',);
        await writeDeadLock(lockDirectory,);
        {
          /** Acquired lock. */
          await using lock = await acquireOwnerLock({ lockDirectory, pollDelayMs: 5, },);
          expect(lock.token,).not.toBe('dead',);
        }
        expect(await readdir(directory.path,),).toEqual([],);
      },
    },),
    it({
      name: 'release fails when another owner replaced the lock while it was held',
      fn: async function testReplaced(): Promise<void> {
        await using directory = await scratch();
        /** Lock path. */
        const lockDirectory = join(directory.path, 'landing.lock',);
        /** Held lock. */
        const lock = await acquireOwnerLock({ lockDirectory, },);
        await writeFile(join(lockDirectory, 'owner.json',), `${JSON.stringify({ schemaVersion: 1, token: 'other', ownerPid: 1, ownerBirthIdentity: 'x', },)}\n`,);
        /** Release failure. */
        const failure = await (async function release(): Promise<unknown> {
          try {
            await lock[Symbol.asyncDispose]();
          }
          catch (error: unknown) {
            return error;
          }
          return undefined;
        })();
        expect(failure instanceof OwnerLockError,).toBe(true,);
        expect(await exists(lockDirectory,),).toBe(true,);
      },
    },),
    it({
      name: `${parseOwnerLockRecord.name} rejects malformed records`,
      fn: async function testParse(): Promise<void> {
        /** Malformed records. */
        const malformed = [
          '{}',
          '{"schemaVersion":2,"token":"t","ownerPid":1,"ownerBirthIdentity":"x"}',
          '{"schemaVersion":1,"token":"","ownerPid":1,"ownerBirthIdentity":"x"}',
          '{"schemaVersion":1,"token":"t","ownerPid":0,"ownerBirthIdentity":"x"}',
          '{"schemaVersion":1,"token":"t","ownerPid":1.5,"ownerBirthIdentity":"x"}',
          '{"schemaVersion":1,"token":"t","ownerPid":1,"ownerBirthIdentity":""}',
        ];
        expect(malformed.map(function rejects(text,): boolean {
          try {
            parseOwnerLockRecord(text,);
            return false;
          }
          catch (error: unknown) {
            return error instanceof OwnerLockError;
          }
        },),).toEqual(malformed.map(function expected(): boolean {
          return true;
        },),);
        expect(parseOwnerLockRecord('{"schemaVersion":1,"token":"t","ownerPid":7,"ownerBirthIdentity":"linux:1"}',),)
          .toEqual({ schemaVersion: 1, token: 't', ownerPid: 7, ownerBirthIdentity: 'linux:1', },);
      },
    },),
  ],
},);
