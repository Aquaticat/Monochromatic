/**
 Starvation reservation: requested after the configured lost races, granted oldest invocation first,
 blocking other landings while held, and released when its holder lands, conflicts, or dies.

 Wrapper tests pin lost races with a held editor and the test-only `race-lost` phase marker;
 reservation-module tests drive `openLandingReservation` on a scratch registry.

 @module
 */
import { randomUUID, } from 'node:crypto';
import {
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
import {
  createLandingRepository,
  finish,
  git,
  type LandingRepository,
  leftovers,
  REAL_GIT,
  runWrapper,
  startWrapper,
  waitForFile,
  writeWorktreeFile,
} from './commit-landing-fixture.unit.test.ts';
import {
  eventTypes,
  findingCodes,
  type HeldCommit,
  holdInEditor,
  numberedLines,
  stageContent,
} from './commit-landing-replay-fixture.unit.test.ts';

const {
  acquireReservedLandingLock,
  createTransactionOwnerRecord,
  encodeTransactionOwner,
  isTransactionId,
  liveRequesters,
  openLandingReservation,
  RESERVATION_LOCK_NAME,
  RESERVATION_REQUEST_FILENAME,
  resolveProcessBirthIdentity,
  tryAcquireOwnerLock,
} = internalTestExports;

/**
 Window in which a commit blocked by the reservation must not land.
 */
const BLOCKED_WINDOW_MS = 1_500;

/**
 A commit paused holding the reservation after its second lost race, with the two commits that beat it.
 */
type ReservedVictim = Readonly<{
  /**
   Victim, paused at `race-lost-2`.
   */
  victim: HeldCommit;
  /**
   Marker directory of the phase files.
   */
  markers: string;
}>;

/**
 Makes a victim commit of `v.txt` lose two races, to commits of `w1.txt` and of `second`,
 so it takes the reservation and pauses at its second `race-lost` marker.

 @param repository - fixture repository

 @param second - wrapper arguments of the second winner

 @returns paused victim

 @example
 ```ts
 const { victim, markers } = await victimHoldingReservation({ repository, second: ['commit', '-m', 'w2', 'w2.txt'] });
 ```
 */
async function victimHoldingReservation({
  repository,
  second,
}: Readonly<{
  repository: LandingRepository;
  second: readonly string[];
}>,): Promise<ReservedVictim> {
  /** Phase marker directory. */
  const markers = join(repository.scratch, 'phases',);
  await mkdir(markers,);
  /** Victim held in its editor until the first winner lands. */
  const victim = await holdInEditor({
    repository,
    name: 'victim',
    args: ['commit', '-e', '-m', 'victim', 'v.txt',],
    env: { CLI_GIT_TEST_ONLY_PHASE_SIGNAL: `race-lost:pause:${markers}`, },
  },);
  expect((await runWrapper({ repository, args: ['commit', '-m', 'w1', 'w1.txt',], },)).exitCode,).toBe(0,);
  await victim.release();
  await waitForFile({ path: join(markers, 'race-lost-1.reached',), },);
  expect((await runWrapper({ repository, args: second, },)).exitCode,).toBe(0,);
  await writeFile(join(markers, 'race-lost-1.release',), '',);
  await waitForFile({ path: join(markers, 'race-lost-2.reached',), },);
  return { victim, markers, };
}

/**
 Reservation threshold the wrapper reservation tests configure,
 above the default of 1 so the victim loses a race without reserving first.
 */
const CONFIGURED_RESERVE_AFTER_LOST_RACES = 2;

/**
 Creates a landing repository whose trusted config sets {@link CONFIGURED_RESERVE_AFTER_LOST_RACES},
 so these tests also prove a configured threshold reaches the landing loop.

 @returns fixture repository

 @example
 ```ts
 await using repository = await createReservingRepository();
 ```
 */
async function createReservingRepository(): Promise<LandingRepository> {
  /** Fixture repository. */
  const repository = await createLandingRepository();
  await writeWorktreeFile({
    repository,
    name: 'cli-git.config.mjs',
    content: `export default { policies: {}, landing: { reserveAfterLostRaces: ${String(CONFIGURED_RESERVE_AFTER_LOST_RACES,)} } };\n`,
  },);
  await git({ repository, args: ['add', 'cli-git.config.mjs',], },);
  await git({ repository, args: ['commit', '--quiet', '-m', 'config',], },);
  expect((await runWrapper({ repository, args: ['cli-git', 'trust', '--yes',], },)).exitCode,).toBe(0,);
  return repository;
}

/**
 Writes the victim, winner, and bystander files.

 @param repository - fixture repository
 */
async function writeRaceFiles(repository: LandingRepository,): Promise<void> {
  for (const name of ['v.txt', 'w1.txt', 'w2.txt', 'w3.txt',]) {
    // oxlint-disable-next-line no-await-in-loop -- Four small ordered writes.
    await writeWorktreeFile({ repository, name, content: `${name}\n`, },);
  }
}

/**
 Reads the reservation lock record, or `absent`.

 @param repository - fixture repository

 @returns parsed record or `absent`
 */
async function reservationRecord(repository: LandingRepository,): Promise<Readonly<Record<string, unknown>> | 'absent'> {
  try {
    return JSON.parse(await readFile(join(repository.gitDir, 'cli-git-transactions', RESERVATION_LOCK_NAME, 'owner.json',), 'utf8',),) as Readonly<Record<string, unknown>>;
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('code' in error) && (error.code === 'ENOENT'))
      return 'absent';
    throw error;
  }
}

/**
 Scratch registry with fake transactions owned by this process.
 */
type ScratchRegistry = AsyncDisposable & Readonly<{
  /**
   Registry root.
   */
  root: string;
  /**
   Creates a published transaction directory with the given invocation start.
   */
  transaction: (createdAt: string) => Promise<Readonly<{ id: string; directory: string; }>>;
}>;

/**
 Creates a scratch registry.

 @returns registry
 */
async function scratchRegistry(): Promise<ScratchRegistry> {
  /** Registry root. */
  const root = await mkdtemp(join(tmpdir(), 'cli-git-reservation-',),);
  return {
    root,
    async transaction(createdAt,) {
      /** Transaction ID. */
      const id = randomUUID();
      /** Transaction directory. */
      const directory = join(root, id,);
      await mkdir(directory,);
      await writeFile(join(directory, 'owner.json',), encodeTransactionOwner(await createTransactionOwnerRecord({ transactionId: id, createdAt, },),),);
      return { id, directory, };
    },
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(root, { recursive: true, force: true, },);
    },
  };
}

/**
 Narrows one owner-lock publication attempt to the held lock.

 @param attempt - attempt result

 @returns held lock

 @throws {@link Error} when another owner holds the lock
 */
function heldLock(attempt: Awaited<ReturnType<typeof tryAcquireOwnerLock>>,): Exclude<typeof attempt, symbol> {
  if ((typeof attempt) === 'symbol')
    throw new Error('A scratch owner lock was already held.',);
  return attempt as Exclude<typeof attempt, symbol>;
}

/**
 Creates a published transaction directory owned by this process in an existing registry.

 @param root - registry root

 @returns transaction ID and directory
 */
async function publishTransaction(root: string,): Promise<Readonly<{ id: string; directory: string; }>> {
  /** Transaction ID. */
  const id = randomUUID();
  /** Transaction directory. */
  const directory = join(root, id,);
  await mkdir(directory,);
  await writeFile(join(directory, 'owner.json',), encodeTransactionOwner(await createTransactionOwnerRecord({ transactionId: id, createdAt: new Date().toISOString(), },),),);
  return { id, directory, };
}

/**
 Reports whether a promise settled within a short window.

 @param promise - promise to watch

 @returns whether it settled
 */
async function settlesSoon(promise: Promise<unknown>,): Promise<boolean> {
  return await Promise.race([promise.then(function settled() {
    return true;
  },), wait(300,).then(function pending() {
    return false;
  },),],);
}

await describe({
  name: 'landing reservation',
  children: [
    it({
      name: 'a commit that lost the configured two races reserves the next slot, a later commit cannot land until it does, and the slot is released',
      fn: async function testReserved(): Promise<void> {
        await using repository = await createReservingRepository();
        await writeRaceFiles(repository,);
        /** Paused victim holding the reservation. */
        const { victim, markers, } = await victimHoldingReservation({ repository, second: ['commit', '-m', 'w2', 'w2.txt',], },);
        // The only transaction in the registry is the victim's, and the reservation names it.
        expect(await reservationRecord(repository,),).toMatchObject({ transactionId: (await readdir(join(repository.gitDir, 'cli-git-transactions',),)).filter(function transaction(name,) {
          return isTransactionId(name,);
        },).join(',',), },);
        /** Head while the victim holds the reservation. */
        const held = await git({ repository, args: ['rev-parse', 'HEAD',], },);
        /** Commit started while the reservation is held. */
        const blocked = startWrapper({ repository, args: ['commit', '-m', 'w3', 'w3.txt',], },);
        /** Its outcome, collected from the start. */
        const blockedOutcome = finish(blocked,);
        await wait(BLOCKED_WINDOW_MS,);
        expect(blocked.exitCode,).toBe(null,);
        expect(await git({ repository, args: ['rev-parse', 'HEAD',], },),).toBe(held,);
        await writeFile(join(markers, 'race-lost-2.release',), '',);
        /** Victim outcome. */
        const outcome = await victim.outcome;
        expect(outcome.exitCode,).toBe(0,);
        expect(eventTypes(outcome,),).toEqual(['landing-race-lost', 'commit-replayed', 'landing-race-lost', 'landing-reserved', 'commit-replayed',],);
        expect((await blockedOutcome).exitCode,).toBe(0,);
        expect(await git({ repository, args: ['log', '--format=%s', '-4',], },),).toBe('w3\nvictim\nw2\nw1',);
        expect(await reservationRecord(repository,),).toBe('absent',);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'without config, the first lost race reserves the next slot and a later commit lands after the holder',
      fn: async function testDefaultReserved(): Promise<void> {
        await using repository = await createLandingRepository();
        await writeRaceFiles(repository,);
        /** Phase marker directory. */
        const markers = join(repository.scratch, 'phases',);
        await mkdir(markers,);
        /** Victim held in its editor until the winner lands. */
        const victim = await holdInEditor({
          repository,
          name: 'victim',
          args: ['commit', '-e', '-m', 'victim', 'v.txt',],
          env: { CLI_GIT_TEST_ONLY_PHASE_SIGNAL: `race-lost:pause:${markers}`, },
        },);
        expect((await runWrapper({ repository, args: ['commit', '-m', 'w1', 'w1.txt',], },)).exitCode,).toBe(0,);
        await victim.release();
        await waitForFile({ path: join(markers, 'race-lost-1.reached',), },);
        /** Head while the victim holds the reservation after one lost race. */
        const held = await git({ repository, args: ['rev-parse', 'HEAD',], },);
        /** Commit started while the reservation is held, with its outcome collected from the start. */
        const blocked = startWrapper({ repository, args: ['commit', '-m', 'w3', 'w3.txt',], },);
        /** Its outcome. */
        const blockedOutcome = finish(blocked,);
        await wait(BLOCKED_WINDOW_MS,);
        expect(blocked.exitCode,).toBe(null,);
        expect(await git({ repository, args: ['rev-parse', 'HEAD',], },),).toBe(held,);
        await writeFile(join(markers, 'race-lost-1.release',), '',);
        /** Victim outcome. */
        const outcome = await victim.outcome;
        expect(outcome.exitCode,).toBe(0,);
        expect(eventTypes(outcome,),).toEqual(['landing-race-lost', 'landing-reserved', 'commit-replayed',],);
        expect((await blockedOutcome).exitCode,).toBe(0,);
        expect(await git({ repository, args: ['log', '--format=%s', '-3',], },),).toBe('w3\nvictim\nw1',);
        expect(await reservationRecord(repository,),).toBe('absent',);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'a reservation holder whose replay conflicts releases the slot',
      fn: async function testConflictReleases(): Promise<void> {
        await using repository = await createReservingRepository();
        await writeRaceFiles(repository,);
        await writeWorktreeFile({ repository, name: 'v.txt', content: numberedLines({},), },);
        await git({ repository, args: ['add', 'v.txt',], },);
        await git({ repository, args: ['commit', '--quiet', '-m', 'lines',], },);
        await writeWorktreeFile({ repository, name: 'v.txt', content: numberedLines({ 1: 'victim', },), },);
        await stageContent({ repository, path: 'v.txt', content: numberedLines({ 1: 'winner', },), },);
        /** Paused victim holding the reservation; the second winner rewrote its line. */
        const { victim, markers, } = await victimHoldingReservation({ repository, second: ['commit', '--no-only', '-m', 'w2',], },);
        await writeFile(join(markers, 'race-lost-2.release',), '',);
        /** Conflicted victim. */
        const outcome = await victim.outcome;
        expect(outcome.exitCode,).toBe(1,);
        expect(eventTypes(outcome,),).toContain('landing-reserved',);
        expect(findingCodes(outcome,),).toEqual(['concurrent-commit/replay-conflict',],);
        expect(await reservationRecord(repository,),).toBe('absent',);
        expect((await runWrapper({ repository, args: ['commit', '-m', 'w3', 'w3.txt',], },)).exitCode,).toBe(0,);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'a killed reservation holder releases the slot to a waiting commit, and recovery leaves nothing behind',
      fn: async function testKilledHolder(): Promise<void> {
        await using repository = await createReservingRepository();
        await writeRaceFiles(repository,);
        /** Paused victim holding the reservation. */
        const { victim, } = await victimHoldingReservation({ repository, second: ['commit', '-m', 'w2', 'w2.txt',], },);
        /** Commit waiting for the reservation. */
        const blocked = finish(startWrapper({ repository, args: ['commit', '-m', 'w3', 'w3.txt',], },),);
        await wait(BLOCKED_WINDOW_MS,);
        process.kill(-(victim.child.pid ?? 0), 'SIGKILL',);
        await victim.outcome;
        expect((await blocked).exitCode,).toBe(0,);
        expect(await git({ repository, args: ['log', '--format=%s', '-1',], },),).toBe('w3',);
        expect((await runWrapper({ repository, args: ['status', '--short',], },)).exitCode,).toBe(0,);
        expect(await reservationRecord(repository,),).toBe('absent',);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'a landing that took the landing lock after a reservation was granted yields the lock until the reservation is released',
      fn: async function testYieldUnderLock(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Transaction registry. */
        const registryRoot = join(repository.gitDir, 'cli-git-transactions',);
        await mkdir(registryRoot, { recursive: true, },);
        /** Landing lock held by a stand-in lander. */
        const lander = heldLock(await tryAcquireOwnerLock({ lockDirectory: join(registryRoot, 'landing.lock',), },),);
        /** Landing waiting for the landing lock, with no reservation in the way yet. */
        const waiting = await publishTransaction(registryRoot,);
        await using view = await openLandingReservation({ registryRoot, transactionDirectory: waiting.directory, transactionId: waiting.id, },);
        /** Its acquisition. */
        const acquisition = acquireReservedLandingLock({ gitPath: REAL_GIT, cwd: repository.path, registryRoot, reservation: view, },);
        expect(await settlesSoon(acquisition,),).toBe(false,);
        /** Reservation granted to another transaction while the landing waits. */
        const reservation = heldLock(await tryAcquireOwnerLock({ lockDirectory: join(registryRoot, RESERVATION_LOCK_NAME,), transactionId: randomUUID(), },),);
        await lander[Symbol.asyncDispose]();
        expect(await settlesSoon(acquisition,),).toBe(false,);
        /** The landing lock is free again: the waiting landing took it, saw the reservation, and yielded it. */
        await heldLock(await tryAcquireOwnerLock({ lockDirectory: join(registryRoot, 'landing.lock',), },),)[Symbol.asyncDispose]();
        await reservation[Symbol.asyncDispose]();
        await using _landingLock = await acquisition;
      },
    },),
    it({
      name: 'a free reservation goes to the oldest live requester first, and the next one after it is released',
      fn: async function testOldestFirst(): Promise<void> {
        await using registry = await scratchRegistry();
        /** Older and younger requesters. */
        const [older, younger,] = [await registry.transaction('2026-09-26T00:00:01.000Z',), await registry.transaction('2026-09-26T00:00:02.000Z',),];
        /** Holder standing in for a third transaction. */
        const blocker = heldLock(await tryAcquireOwnerLock({ lockDirectory: join(registry.root, RESERVATION_LOCK_NAME,), transactionId: randomUUID(), },),);
        await using olderView = await openLandingReservation({ registryRoot: registry.root, transactionDirectory: older.directory, transactionId: older.id, },);
        await using youngerView = await openLandingReservation({ registryRoot: registry.root, transactionDirectory: younger.directory, transactionId: younger.id, },);
        /** Younger requester asks first. */
        const youngerGrant = youngerView.reserve(2,);
        await waitForFile({ path: join(younger.directory, RESERVATION_REQUEST_FILENAME,), },);
        /** Older requester asks second. */
        const olderGrant = olderView.reserve(2,);
        await waitForFile({ path: join(older.directory, RESERVATION_REQUEST_FILENAME,), },);
        expect(await liveRequesters(registry.root,),).toEqual([older.id, younger.id,],);
        expect(await youngerView.heldByAnother(),).toBe(true,);
        await blocker[Symbol.asyncDispose]();
        expect(await olderGrant,).toBe(true,);
        expect(await settlesSoon(youngerGrant,),).toBe(false,);
        expect(await youngerView.heldByAnother(),).toBe(true,);
        expect(await olderView.heldByAnother(),).toBe(false,);
        await olderView[Symbol.asyncDispose]();
        expect(await youngerGrant,).toBe(true,);
        expect(await liveRequesters(registry.root,),).toEqual([younger.id,],);
      },
    },),
    it({
      name: 'a reservation whose holder exited but was never reaped is free, and the next requester retires it',
      fn: async function testZombieHolder(): Promise<void> {
        await using registry = await scratchRegistry();
        await using zombie = await startZombie(resolveProcessBirthIdentity,);
        /** Reservation lock of the zombie. */
        const lockDirectory = join(registry.root, RESERVATION_LOCK_NAME,);
        await mkdir(lockDirectory,);
        await writeFile(join(lockDirectory, 'owner.json',), `${JSON.stringify({ schemaVersion: 1, token: randomUUID(), ownerPid: zombie.pid, ownerBirthIdentity: zombie.identity, transactionId: randomUUID(), },)}\n`,);
        /** Requester. */
        const requester = await registry.transaction('2026-09-26T00:00:01.000Z',);
        await using view = await openLandingReservation({ registryRoot: registry.root, transactionDirectory: requester.directory, transactionId: requester.id, },);
        expect(await view.heldByAnother(),).toBe(false,);
        expect(await view.reserve(2,),).toBe(true,);
        expect(
          JSON.parse(await readFile(join(lockDirectory, 'owner.json',), 'utf8',),),
        ).toMatchObject({ ownerPid: process.pid, transactionId: requester.id, },);
      },
    },),
  ],
},);
