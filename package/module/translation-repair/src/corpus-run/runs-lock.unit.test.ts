/**
 * Tests for the one-pass-at-a-time claim on a runs directory.
 *
 * Two passes sharing a directory never collide loudly. They overwrite each
 * other's attempt counts, delete each other's cached slices whenever their
 * pipelines differ, and the later write of any entry replaces the earlier one.
 * Every one of those looks like ordinary output, which is why the refusal has
 * to happen before any of it starts.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  mkdtemp,
  readdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  evictStaleLock,
  lockRunsDir,
  releaseIfOwned,
  RunsDirectoryBusyError,
} from '../../dist/final/node/index.mjs';

/**
 * Makes a throwaway runs directory for one case.
 *
 * @returns Path of the directory
 *
 * @example
 * ```ts
 * const runsDir = await scratch();
 * ```
 */
async function scratch(): Promise<string> {
  return await mkdtemp(join(
    tmpdir(),
    'runs-lock-',
  ),);
}

/**
 * Process id no process can hold.
 *
 * Zero is not a process on Linux: signalling it addresses the caller's own
 * process group, so a lock file naming it is a lock naming nothing, which is
 * what a stale-takeover case needs.
 */
const GONE_PID = 2_147_483_646;

await describe({
  name: lockRunsDir.name,
  children: [
    it({
      name: 'claims a fresh directory and releases on scope exit, which is the '
        + 'ordinary path: a pass that ran and finished must leave nothing '
        + 'behind for the next one to reason about',
      fn: async () => {
        const runsDir = await scratch();

        {
          await using _lock = await lockRunsDir({ runsDir, },);

          expect(await readdir(runsDir,),).toEqual(['pass.lock',],);
        }

        expect(await readdir(runsDir,),).toEqual([],);
      },
    },),

    it({
      name: 'REFUSES a second claim while the first is held, which is the whole '
        + 'guard: the interference between two passes is invisible in the '
        + 'output, so the refusal has to come before either writes anything',
      fn: async () => {
        const runsDir = await scratch();

        await using _lock = await lockRunsDir({ runsDir, },);

        /**
         * What lockRunsDir refused with, read for class as well as wording.
         */
        const refusalOfLockRunsDir = lockRunsDir({ runsDir, },);

        await expect(refusalOfLockRunsDir,).rejects.toBeInstanceOf(RunsDirectoryBusyError,);
        await expect(refusalOfLockRunsDir,).rejects.toThrow('Another pass is running',);
      },
    },),

    it({
      name: 'names the holder it refused for, since an operator meeting this '
        + 'has to decide whether to stop that process or point this run '
        + 'somewhere else, and cannot do either without knowing which it is',
      fn: async () => {
        const runsDir = await scratch();

        await using _lock = await lockRunsDir({ runsDir, },);

        await expect(lockRunsDir({ runsDir, },),)
          .rejects
          .toThrow(String(process.pid,),);
      },
    },),

    it({
      name: 'TAKES OVER a lock whose process is gone. A pass killed at its hard '
        + 'cap leaves one behind, and refusing forever would make every crash '
        + 'need manual cleanup, which is how a guard gets routed around',
      fn: async () => {
        const runsDir = await scratch();

        await writeFile(
          join(
            runsDir,
            'pass.lock',
          ),
          `${JSON.stringify({
            pid: GONE_PID,
            startedAt: '2026-08-14T00:00:00.000Z',
          },)}\n`,
        );

        await using _lock = await lockRunsDir({ runsDir, },);

        expect(await readdir(runsDir,),).toEqual(['pass.lock',],);
      },
    },),

    it({
      name: 'takes over a lock file that says nothing readable, because a lock '
        + 'nobody can respect is not a lock, and honouring it forever would '
        + 'strand the directory on a truncated write',
      fn: async () => {
        const runsDir = await scratch();

        await writeFile(
          join(
            runsDir,
            'pass.lock',
          ),
          '{"pid":',
        );

        await using _lock = await lockRunsDir({ runsDir, },);

        expect(await readdir(runsDir,),).toEqual(['pass.lock',],);
      },
    },),
  ],
},);

await describe({
  name: 'stale-lock takeover under contention',
  children: [
    it({
      name: 'EVICTS a stale lock exactly once when two starters race for it, since the eviction is a '
        + 'rename and a rename is atomic (`#243`)',
      fn: async () => {
        const runsDir = await scratch();
        /**
         * Lock file both starters find stale.
         */
        const path = join(
          runsDir,
          'pass.lock',
        );
        await writeFile(
          path,
          `${JSON.stringify({
            pid: GONE_PID,
            startedAt: '2026-08-14T00:00:00.000Z',
          },)}\n`,
        );
        /**
         * What each concurrent eviction reported.
         */
        const outcomes = await Promise.all([
          evictStaleLock({ path, },),
          evictStaleLock({ path, },),
        ],);
        expect(outcomes.toSorted(),).toEqual(['evicted', 'gone',],);
        expect(await readdir(runsDir,),).toEqual([],);
      },
    },),
    it({
      name: 'KEEPS a lock it does not own on release, so a starter that lost a takeover cannot delete '
        + 'the winner\'s lock on its way out (`#243`)',
      fn: async () => {
        const runsDir = await scratch();
        /**
         * Lock file under test.
         */
        const path = join(
          runsDir,
          'pass.lock',
        );
        /**
         * Acquisition whose release is under test.
         */
        const lock = await lockRunsDir({ runsDir, },);
        // Another holder took the file over underneath this acquisition.
        await writeFile(
          path,
          `${JSON.stringify({
            pid: process.pid,
            startedAt: '2026-08-14T00:00:00.000Z',
            token: 'somebody-else',
          },)}\n`,
        );
        await lock[Symbol.asyncDispose]();
        expect(await readdir(runsDir,),).toEqual(['pass.lock',],);
        expect((await readFile(path, 'utf8',)).includes('somebody-else',),).toBe(true,);
        expect(await releaseIfOwned({
          path,
          holder: {
            pid: process.pid,
            startedAt: '2026-08-14T00:00:00.000Z',
            token: 'somebody-else',
          },
        },),).toBe('released',);
      },
    },),
    it({
      name: 'REFUSES the loser of two concurrent takeovers, and the winner still holds the lock '
        + 'afterwards',
      fn: async () => {
        const runsDir = await scratch();
        await writeFile(
          join(
            runsDir,
            'pass.lock',
          ),
          `${JSON.stringify({
            pid: GONE_PID,
            startedAt: '2026-08-14T00:00:00.000Z',
          },)}\n`,
        );
        /**
         * Both starters, settled.
         */
        const settled = await Promise.allSettled([
          lockRunsDir({ runsDir, },),
          lockRunsDir({ runsDir, },),
        ],);
        /**
         * The one that acquired.
         */
        const winners = settled.filter(function won(outcome,): boolean {
          return outcome.status === 'fulfilled';
        },);
        /**
         * The one that was refused.
         */
        const losers = settled.filter(function lost(outcome,): boolean {
          return outcome.status === 'rejected';
        },);
        expect(winners.length,).toBe(1,);
        expect(losers.length,).toBe(1,);
        expect(
          (losers[0]?.status === 'rejected') ? losers[0].reason : undefined,
        ).toBeInstanceOf(RunsDirectoryBusyError,);
        expect(await readdir(runsDir,),).toEqual(['pass.lock',],);
        if (winners[0]?.status === 'fulfilled')
          await winners[0].value[Symbol.asyncDispose]();
        expect(await readdir(runsDir,),).toEqual([],);
      },
    },),
  ],
},);
