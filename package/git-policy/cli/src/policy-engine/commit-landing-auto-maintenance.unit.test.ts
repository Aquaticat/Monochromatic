/**
 Real object-store growth across many landed commits,
 through the built wrapper on disposable repositories.

 Every landing migrates its objects as one pack,
 so the pack count is the history-proportional term a wrapper commit must keep bounded,
 as native `git commit` bounds it through automatic maintenance.

 @module
 */
import { readdir, } from 'node:fs/promises';
import { join, } from 'node:path';
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
 Pack count above which `git gc --auto` consolidates packs in these fixtures.
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
 Lands {@link COMMIT_COUNT} commits one after another through the wrapper.

 @param repository - fixture repository

 @returns wrapper exit codes in commit order

 @example
 ```ts
 await commitSequentially(repository); // [0, 0, 0, 0, 0, 0]
 ```
 */
async function commitSequentially(repository: LandingRepository,): Promise<readonly number[]> {
  /**
   Exit codes collected in commit order.
   */
  const exitCodes: number[] = [];
  for (const index of Array.from({ length: COMMIT_COUNT, }, function slot(_value, slotIndex,): number {
    return slotIndex;
  },)) {
    /**
     Committed file.
     */
    const name = `f-${String(index,)}.txt`;
    // oxlint-disable-next-line no-await-in-loop -- Each commit must land before the next one so the pack count grows one landing at a time.
    await writeWorktreeFile({ repository, name, content: `${name}\n`, },);
    // oxlint-disable-next-line no-await-in-loop -- Sequential landings are the scenario under test.
    exitCodes.push((await runWrapper({ repository, args: ['commit', '--quiet', '-m', name, name,], },)).exitCode,);
  }
  return exitCodes;
}

await describe({
  name: 'automatic maintenance after landing',
  children: [
    it({
      name: 'sequential landings keep the real pack count bounded by gc.autoPackLimit, as native git commit does',
      fn: async function testPackCountBounded(): Promise<void> {
        await using repository = await createLandingRepository([
          ['gc.autoPackLimit', String(PACK_LIMIT,),],
          ['maintenance.autoDetach', 'false',],
        ],);
        expect(await commitSequentially(repository,),).toEqual(Array.from({ length: COMMIT_COUNT, }, function landed(): number {
          return 0;
        },),);
        // Without maintenance every landing leaves its own pack, so the count equals the number of commits.
        expect(await packCount(repository,),).toBeLessThanOrEqual(PACK_LIMIT + 1,);
        expect(await git({ repository, args: ['rev-list', '--count', 'HEAD',], },),).toBe(String(COMMIT_COUNT + 1,),);
        expect((await gitOutcome({ repository, args: ['fsck', '--strict', '--no-dangling',], },)).exitCode,).toBe(0,);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
  ],
},);
