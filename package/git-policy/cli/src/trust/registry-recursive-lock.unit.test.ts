/**
 Recursive registry lock ownership, liveness, and permission tests.

 @module
 */
import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
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
import { startZombie, } from '../owner-lock/zombie-fixture.unit.test.ts';

const {
  acquireRecursiveRegistryLock,
  resolveProcessBirthIdentity,
} = internalTestExports;

/** Concurrent lock contenders used to expose partial owner-file publication. */
const CONTENDERS = 32;
/** Lock directory name inside the registry root. */
const LOCK_NAME = 'recursive-operation.lock';
/** Budget for an owner nothing proves alive or exited. */
const UNPROVEN_OWNER_TIMEOUT_MS = 1_000;
/** Hold longer than that budget, proving a live owner's wait is not bounded by it. */
const LIVE_OWNER_HOLD_MS = 1_500;
/** Permission bits of a mode. */
const PERMISSION_BITS = 0o777;

/** Disposable recursive-lock fixture. */
type LockFixture = Readonly<{
  /** Registry root shared by contenders. */
  registryRoot: string;
  /** Exact lock directory. */
  lockDirectory: string;
  /** Removes disposable registry parent. */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 Creates disposable registry root for lock acquisition.

 @returns disposable registry fixture
 */
async function createLockFixture(): Promise<LockFixture> {
  /** Disposable registry parent. */
  const root = await mkdtemp(join(tmpdir(), 'cli-git-recursive-lock-',),);
  /** Registry root. */
  const registryRoot = join(root, 'registry',);
  return {
    registryRoot,
    lockDirectory: join(registryRoot, LOCK_NAME,),
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(root, { recursive: true, force: true, },);
    },
  };
}

/**
 Starts and kills a stand-in process, returning its PID and the birth identity it had.

 @returns exited process evidence
 */
async function exitedProcess(): Promise<Readonly<{ pid: number; identity: string; }>> {
  /** Short-lived owner stand-in. */
  const child = spawn(process.execPath, ['--eval', 'setInterval(() => {}, 1000);',], { stdio: 'ignore', },);
  if (child.pid === undefined)
    throw new Error('Owner stand-in did not start.',);
  /** Birth identity while it runs. */
  const identity = await resolveProcessBirthIdentity(child.pid,);
  if ((typeof identity) !== 'string')
    throw new Error('Owner stand-in identity is unavailable.',);
  /** Exit notification. */
  const exited = once(child, 'exit',);
  child.kill('SIGKILL',);
  await exited;
  return { pid: child.pid, identity, };
}

/**
 Publishes a lock directory holding exact owner text, as another process or an earlier build would.

 @param fixture - registry fixture

 @param ownerText - owner record text; omitted for a directory without a record
 */
async function publishLock({
  fixture,
  ownerText,
}: Readonly<{
  fixture: LockFixture;
  ownerText?: string;
}>,): Promise<void> {
  await mkdir(fixture.lockDirectory, { recursive: true, mode: 0o700, },);
  if (ownerText !== undefined)
    await writeFile(join(fixture.lockDirectory, 'owner.json',), ownerText, { mode: 0o600, },);
}

/**
 Reads the published owner record.

 @param fixture - registry fixture

 @returns parsed owner record
 */
async function readOwner(fixture: LockFixture,): Promise<unknown> {
  /** Owner record text. */
  const text = await readFile(join(fixture.lockDirectory, 'owner.json',), 'utf8',);
  return JSON.parse(text,);
}

/**
 Acquires and expects an unproven-owner failure after the budget, leaving the lock untouched.

 @param fixture - registry fixture

 @param evidence - text the diagnostic must contain

 @returns elapsed milliseconds
 */
async function expectUnprovenFailure({
  fixture,
  evidence,
}: Readonly<{
  fixture: LockFixture;
  evidence: string;
}>,): Promise<number> {
  /** Lock content before acquisition. */
  const before = await readdir(fixture.lockDirectory,);
  /** Start time. */
  const startedAt = performance.now();
  /** Captured failure. */
  const failure = await (async function captureFailure(): Promise<Error> {
    try {
      await acquireRecursiveRegistryLock({ registryRoot: fixture.registryRoot, },);
    }
    catch (error: unknown) {
      if (Error.isError(error,))
        return error;
      throw error;
    }
    throw new Error('Acquisition unexpectedly succeeded.',);
  })();
  /** Elapsed time. */
  const elapsed = performance.now() - startedAt;
  expect(failure.name,).toBe('TrustStorageError',);
  expect(failure.message,).toContain(fixture.lockDirectory,);
  expect(failure.message,).toContain(evidence,);
  expect(failure.message,).toContain('left the lock in place',);
  expect(await readdir(fixture.lockDirectory,),).toEqual(before,);
  return elapsed;
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
        expect(await readdir(fixture.registryRoot,),).toEqual([],);
      },
    },),
    it({
      name: 'publishes a private owner record with process-birth identity and removes every entry on release',
      fn: async function testPublication(): Promise<void> {
        await using fixture = await createLockFixture();
        {
          /** Held lock. */
          await using _lock = await acquireRecursiveRegistryLock({ registryRoot: fixture.registryRoot, },);
          expect(await readdir(fixture.registryRoot,),).toEqual([LOCK_NAME,],);
          expect(await readOwner(fixture,),).toMatchObject({
            schemaVersion: 1,
            ownerPid: process.pid,
            ownerBirthIdentity: await resolveProcessBirthIdentity(process.pid,),
          },);
          if (process.platform !== 'win32') {
            expect((await lstat(fixture.lockDirectory,)).mode & PERMISSION_BITS,).toBe(0o700,);
            expect((await lstat(join(fixture.lockDirectory, 'owner.json',),)).mode & PERMISSION_BITS,).toBe(0o600,);
          }
        }
        expect(await readdir(fixture.registryRoot,),).toEqual([],);
      },
    },),
    it({
      name: 'waits past the unproven-owner budget while a live owner holds the lock',
      fn: async function testLiveOwnerWait(): Promise<void> {
        await using fixture = await createLockFixture();
        /** Live owner. */
        const holder = await acquireRecursiveRegistryLock({ registryRoot: fixture.registryRoot, },);
        /** Order of events. */
        const order: string[] = [];
        /** Waiting acquisition. */
        const waiter = (async function acquireAfterHolder(): Promise<void> {
          await using _lock = await acquireRecursiveRegistryLock({ registryRoot: fixture.registryRoot, },);
          order.push('waiter acquired',);
        })();
        await wait(LIVE_OWNER_HOLD_MS,);
        order.push('holder released',);
        await holder[Symbol.asyncDispose]();
        await waiter;
        expect(order,).toEqual(['holder released', 'waiter acquired',],);
      },
    },),
    it({
      name: 'retires a lock whose birth-identity owner exited and acquires it',
      fn: async function testDeadOwner(): Promise<void> {
        await using fixture = await createLockFixture();
        /** Exited owner. */
        const owner = await exitedProcess();
        await publishLock({
          fixture,
          ownerText: `${JSON.stringify({ schemaVersion: 1, token: 'dead', ownerPid: owner.pid, ownerBirthIdentity: owner.identity, },)}\n`,
        },);
        {
          await using _lock = await acquireRecursiveRegistryLock({ registryRoot: fixture.registryRoot, },);
          expect(await readOwner(fixture,),).toMatchObject({ ownerPid: process.pid, },);
        }
        expect(await readdir(fixture.registryRoot,),).toEqual([],);
      },
    },),
    it({
      name: 'retires a lock whose owner exited but was never reaped',
      fn: async function testZombieOwner(): Promise<void> {
        if (process.platform !== 'linux')
          return;
        await using fixture = await createLockFixture();
        await using zombie = await startZombie(resolveProcessBirthIdentity,);
        await publishLock({
          fixture,
          ownerText: `${JSON.stringify({ schemaVersion: 1, token: 'zombie', ownerPid: zombie.pid, ownerBirthIdentity: zombie.identity, },)}\n`,
        },);
        {
          await using _lock = await acquireRecursiveRegistryLock({ registryRoot: fixture.registryRoot, },);
        }
        expect(await readdir(fixture.registryRoot,),).toEqual([],);
      },
    },),
    it({
      name: 'retires an earlier build PID-only lock whose process no longer runs',
      fn: async function testLegacyDeadOwner(): Promise<void> {
        await using fixture = await createLockFixture();
        /** Exited earlier-build owner. */
        const owner = await exitedProcess();
        await publishLock({ fixture, ownerText: `${JSON.stringify({ schemaVersion: 1, ownerPid: owner.pid, },)}\n`, },);
        {
          await using _lock = await acquireRecursiveRegistryLock({ registryRoot: fixture.registryRoot, },);
          expect(await readOwner(fixture,),).toMatchObject({ ownerPid: process.pid, },);
        }
        expect(await readdir(fixture.registryRoot,),).toEqual([],);
      },
    },),
    it({
      name: 'fails after the budget on an earlier build PID-only lock naming a running process',
      fn: async function testLegacyLiveOwner(): Promise<void> {
        await using fixture = await createLockFixture();
        await publishLock({ fixture, ownerText: `${JSON.stringify({ schemaVersion: 1, ownerPid: process.pid, },)}\n`, },);
        /** Time until failure. */
        const elapsed = await expectUnprovenFailure({ fixture, evidence: `names running PID ${String(process.pid,)}`, },);
        expect(elapsed,).toBeGreaterThanOrEqual(UNPROVEN_OWNER_TIMEOUT_MS,);
      },
    },),
    it({
      name: 'fails after the budget on a malformed owner record',
      fn: async function testMalformedOwner(): Promise<void> {
        await using fixture = await createLockFixture();
        await publishLock({ fixture, ownerText: '{"schemaVersion":1,"ownerPid"', },);
        expect(await expectUnprovenFailure({ fixture, evidence: 'owner record is malformed', },),).toBeGreaterThanOrEqual(UNPROVEN_OWNER_TIMEOUT_MS,);
      },
    },),
    it({
      name: 'fails after the budget on a lock directory without an owner record',
      fn: async function testRecordlessLock(): Promise<void> {
        await using fixture = await createLockFixture();
        await publishLock({ fixture, },);
        expect(await expectUnprovenFailure({ fixture, evidence: 'exists without owner.json', },),).toBeGreaterThanOrEqual(UNPROVEN_OWNER_TIMEOUT_MS,);
      },
    },),
  ],
},);
