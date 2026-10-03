/**
 Real object-store growth across many landed commits,
 through the built wrapper on disposable repositories.

 Every landing migrates its objects as one pack,
 so the pack count is the history-proportional term a wrapper commit must keep bounded,
 as native `git commit` bounds it through automatic maintenance.

 @module
 */
import {
  access,
  readdir,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { wait, } from '@monochromatic-dev/module-async-time/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  createLandingRepository,
  git,
  gitOutcome,
  type LandingRepository,
  leftovers,
  runWrapper,
  writeWorktreeFile,
} from './commit-landing-fixture.unit.test.ts';

/**
 Pack count above which `git gc --auto` consolidates packs in these fixtures;
 Git 2.54 and later default to geometric repacking, which consolidates equal-sized packs sooner.
 */
const PACK_LIMIT = 2;

/**
 Sequential commits, enough to exceed {@link PACK_LIMIT} twice over.
 */
const COMMIT_COUNT = 3 * PACK_LIMIT;

/**
 Counts the packs in the real object store.

 @param repository - fixture repository

 @returns number of `.pack` files

 @example
 ```ts
 await packCount(repository); // 1
 ```
 */
async function packCount(repository: LandingRepository,): Promise<number> {
  return (await readdir(join(
    repository.gitDir,
    'objects',
    'pack',
  ),))
    .filter(function isPack(name,): boolean {
      return name.endsWith('.pack',);
    },)
    .length;
}

/**
 Every slot index of {@link COMMIT_COUNT} commits.

 @returns indexes in commit order

 @example
 ```ts
 commitSlots(); // [0, 1, 2, 3, 4, 5]
 ```
 */
function commitSlots(): readonly number[] {
  return Array.from({ length: COMMIT_COUNT, }, function slot(_value, slotIndex,): number {
    return slotIndex;
  },);
}

/**
 Lands {@link COMMIT_COUNT} commits one after another through the wrapper.

 @param repository - fixture repository

 @param globalArgs - Git global options placed before `commit`

 @returns wrapper exit codes in commit order

 @example
 ```ts
 await commitSequentially({ repository }); // [0, 0, 0, 0, 0, 0]
 ```
 */
async function commitSequentially({
  repository,
  globalArgs = [],
}: Readonly<{
  repository: LandingRepository;
  globalArgs?: readonly string[];
}>,): Promise<readonly number[]> {
  /**
   Exit codes collected in commit order.
   */
  const exitCodes: number[] = [];
  for (const index of commitSlots()) {
    /**
     Committed file.
     */
    const name = `f-${String(index,)}.txt`;
    // oxlint-disable-next-line no-await-in-loop -- Each commit must land before the next one so the pack count grows one landing at a time.
    await writeWorktreeFile({ repository, name, content: `${name}\n`, },);
    // oxlint-disable-next-line no-await-in-loop -- Sequential landings are the scenario under test.
    exitCodes.push((await runWrapper({ repository, args: [...globalArgs, 'commit', '--quiet', '-m', name, name,], },)).exitCode,);
  }
  return exitCodes;
}

/**
 Exit codes of {@link COMMIT_COUNT} successful commits.

 @returns zero per commit

 @example
 ```ts
 allLanded(); // [0, 0, 0, 0, 0, 0]
 ```
 */
function allLanded(): readonly number[] {
  return commitSlots().map(function landed(): number {
    return 0;
  },);
}

/**
 Reports whether a path is absent.

 @param path - probed path

 @returns whether it does not exist

 @example
 ```ts
 await absent('/repo/.git/gc.pid'); // true
 ```
 */
async function absent(path: string,): Promise<boolean> {
  try {
    await access(path,);
    return false;
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('code' in error) && (error.code === 'ENOENT'))
      return true;
    throw error;
  }
}

/**
 Waits until background maintenance has consolidated packs and released its locks,
 so fixture removal never races a detached `gc`.

 @param repository - fixture repository

 @param timeoutMs - failure deadline

 @returns final pack count

 @throws {@link Error} when the deadline passes first

 @example
 ```ts
 await settledPackCount({ repository }); // 1
 ```
 */
async function settledPackCount({
  repository,
  timeoutMs = 20_000,
}: Readonly<{
  repository: LandingRepository;
  timeoutMs?: number;
}>,): Promise<number> {
  /**
   Deadline.
   */
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    // oxlint-disable-next-line no-await-in-loop -- Polling observes the background process in order.
    const [count, lockFree, gcFree,] = await Promise.all([
      packCount(repository,),
      absent(join(repository.gitDir, 'objects', 'maintenance.lock',),),
      absent(join(repository.gitDir, 'gc.pid',),),
    ],);
    if ((count <= (PACK_LIMIT + 1)) && lockFree && gcFree)
      return count;
    if (Date.now() > deadline)
      throw new Error(`background maintenance did not settle: ${String(count,)} packs, maintenance lock ${lockFree ? 'free' : 'held'}, gc ${gcFree ? 'idle' : 'running'}`,);
    // oxlint-disable-next-line no-await-in-loop -- Polling delay.
    await wait(50,);
  }
}

await describe({
  name: 'automatic maintenance after landing',
  children: [
    it({
      name: 'sequential landings keep the real pack count bounded by automatic maintenance, as native git commit does',
      fn: async function testPackCountBounded(): Promise<void> {
        await using repository = await createLandingRepository([
          ['gc.autoPackLimit', String(PACK_LIMIT,),],
          ['maintenance.autoDetach', 'false',],
        ],);
        expect(await commitSequentially({ repository, },),).toEqual(allLanded(),);
        // Without maintenance every landing leaves its own pack, so the count equals the number of commits.
        expect(await packCount(repository,),).toBeLessThanOrEqual(PACK_LIMIT + 1,);
        expect(await git({ repository, args: ['rev-list', '--count', 'HEAD',], },),).toBe(String(COMMIT_COUNT + 1,),);
        expect((await gitOutcome({ repository, args: ['fsck', '--strict', '--no-dangling',], },)).exitCode,).toBe(0,);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'default detached maintenance consolidates packs in the background without failing any landing',
      fn: async function testDetachedMaintenance(): Promise<void> {
        await using repository = await createLandingRepository([['gc.autoPackLimit', String(PACK_LIMIT,),],],);
        expect(await commitSequentially({ repository, },),).toEqual(allLanded(),);
        expect(await settledPackCount({ repository, },),).toBeLessThanOrEqual(PACK_LIMIT + 1,);
        expect((await gitOutcome({ repository, args: ['fsck', '--strict', '--no-dangling',], },)).exitCode,).toBe(0,);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'a caller -c maintenance.auto=false reaches maintenance, so every landing keeps its pack',
      fn: async function testCallerDisables(): Promise<void> {
        await using repository = await createLandingRepository([
          ['gc.autoPackLimit', String(PACK_LIMIT,),],
          ['maintenance.autoDetach', 'false',],
        ],);
        expect(await commitSequentially({ repository, globalArgs: ['-c', 'maintenance.auto=false',], },),).toEqual(allLanded(),);
        expect(await packCount(repository,),).toBe(COMMIT_COUNT,);
      },
    },),
    it({
      name: 'gc.auto=0 without maintenance.auto disables maintenance, as native git commit decides',
      fn: async function testGcAutoDisables(): Promise<void> {
        await using repository = await createLandingRepository([
          ['gc.autoPackLimit', String(PACK_LIMIT,),],
          ['gc.auto', '0',],
          ['maintenance.autoDetach', 'false',],
        ],);
        expect(await commitSequentially({ repository, },),).toEqual(allLanded(),);
        expect(await packCount(repository,),).toBe(COMMIT_COUNT,);
      },
    },),
    it({
      name: 'concurrent landings all land while another landing runs foreground gc',
      fn: async function testConcurrentWithGc(): Promise<void> {
        await using repository = await createLandingRepository([
          ['gc.autoPackLimit', '1',],
          ['maintenance.autoDetach', 'false',],
        ],);
        /** Agent names. */
        const names = commitSlots().map(function agentName(index,): string {
          return `agent-${String(index,)}`;
        },);
        await Promise.all(names.map(async function writeAgentFile(name,): Promise<void> {
          await writeWorktreeFile({ repository, name: `${name}.txt`, content: `${name} bytes\n`, },);
        },),);
        /** Outcomes of every agent. */
        const outcomes = await Promise.all(names.map(async function commitAgent(name,) {
          return await runWrapper({ repository, args: ['commit', '--quiet', '-m', name, `${name}.txt`,], },);
        },),);
        expect(outcomes.map(function exitOf(outcome,): number {
          return outcome.exitCode;
        },),).toEqual(allLanded(),);
        expect((await git({ repository, args: ['log', '--format=%s',], },)).split('\n',)
          .toSorted(),).toEqual([...names, 'baseline',].toSorted(),);
        expect(await git({ repository, args: ['status', '--porcelain',], },),).toBe('',);
        expect((await gitOutcome({ repository, args: ['fsck', '--strict', '--no-dangling',], },)).exitCode,).toBe(0,);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
  ],
},);
