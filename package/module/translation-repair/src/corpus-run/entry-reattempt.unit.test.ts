/**
 * Tests for whether a capped entry earns another attempt inside one invocation.
 *
 * `#196` measured the largest entries as unable to settle inside the 420-minute
 * hard cap, and the way out it ranked first needs a build that does not move
 * between attempts. One invocation IS such a window, so the pass now re-queues
 * an entry that made progress. What that costs if it is wrong is the whole
 * three-day soft budget spent on one entry, so the stop condition is the part
 * worth testing hardest.
 *
 * THE TWO CASES THAT MATTER ARE BOTH COUNTERINTUITIVE, and both are about a
 * cache count that FELL. A settled entry discards its cache on the way out, so
 * inferring progress from the count alone would read the one outcome the pass
 * exists to reach as the sharpest possible stall. A reset cache, from an entry
 * carrying slices of an older build, reads as negative progress while actually
 * being a fresh generation's first attempt.
 *
 * `countCachedSlices` is tested against a real directory rather than a stub
 * because the thing it has to get right is which files are slices, and the
 * generation markers that must not be counted are real files with a real
 * suffix sitting in the same directory.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  mkdtemp,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  countCachedSlices,
  readAttemptOutcome,
} from '../../dist/final/node/index.mjs';

await describe({
  name: readAttemptOutcome.name,
  children: [
    it({
      name: 'REPORTS settled when an artifact was written, whatever the cache '
        + 'did. A settled entry discards its slice cache on the way out, so '
        + 'this is the case where the count falls furthest and means the most',
      fn: async () => {
        expect(readAttemptOutcome({
          outcome: { kind: 'settled', },
          cachedBefore: 64,
          cachedAfter: 0,
        },),).toEqual({ kind: 'settled', },);
      },
    },),

    it({
      name: 'EARNS another attempt when the entry cached slices it did not '
        + 'have, since the next attempt then starts further along than this '
        + 'one did and the cap is the only thing that stopped it',
      fn: async () => {
        expect(readAttemptOutcome({
          outcome: { kind: 'resumable-failure', },
          cachedBefore: 45,
          cachedAfter: 64,
        },),).toEqual({
          kind: 'earned',
          gained: 19,
        },);
      },
    },),

    it({
      name: 'STOPS WHOLE-ENTRY RETRY when stage-local work remains despite cache growth',
      fn: async () => {
        expect(readAttemptOutcome({
          outcome: { kind: 'stopped', },
          cachedBefore: 0,
          cachedAfter: 13,
        },),).toEqual({ kind: 'stopped', },);
      },
    },),

    it({
      name: 'REFUSES another attempt when the count did not move, which is the '
        + 'stop condition: no progress guarantee holds, so an entry that '
        + 'bought nothing would repeat itself until the soft budget was gone',
      fn: async () => {
        expect(readAttemptOutcome({
          outcome: { kind: 'resumable-failure', },
          cachedBefore: 45,
          cachedAfter: 45,
        },),).toEqual({
          kind: 'stalled',
          cached: 45,
        },);
      },
    },),

    it({
      name: 'EARNS another attempt when the count FELL but slices remain, '
        + 'because a fall means the lane discarded an older build\'s cache and '
        + 'every slice left was bought by this attempt. Reading the plain '
        + 'difference would drop the entry exactly when it started paying for '
        + 'a fresh generation',
      fn: async () => {
        expect(readAttemptOutcome({
          outcome: { kind: 'resumable-failure', },
          cachedBefore: 65,
          cachedAfter: 10,
        },),).toEqual({
          kind: 'earned',
          gained: 10,
        },);
      },
    },),

    it({
      name: 'REFUSES another attempt when a reset left nothing at all, so an '
        + 'entry that cannot cache even one slice under this build stops '
        + 'rather than repeating a failure the cache cannot shorten',
      fn: async () => {
        expect(readAttemptOutcome({
          outcome: { kind: 'resumable-failure', },
          cachedBefore: 65,
          cachedAfter: 0,
        },),).toEqual({
          kind: 'stalled',
          cached: 0,
        },);
      },
    },),

    it({
      name: 'EARNS the first attempt on an entry with no cache at all, which '
        + 'is every large entry the first time it is seen',
      fn: async () => {
        expect(readAttemptOutcome({
          outcome: { kind: 'resumable-failure', },
          cachedBefore: 0,
          cachedAfter: 45,
        },),).toEqual({
          kind: 'earned',
          gained: 45,
        },);
      },
    },),
  ],
},);

await describe({
  name: countCachedSlices.name,
  children: [
    it({
      name: 'COUNTS slices of every lane and no generation marker, so progress '
        + 'in one lane counts while the `.txt` markers beside them do not',
      fn: async () => {
        /**
         * Throwaway cache directory standing in for one entry's.
         */
        const dir = await mkdtemp(join(
          tmpdir(),
          'whiskers-cache-',
        ),);

        await Promise.all([
          'generation.txt',
          'translate-generation.txt',
          'contest-generation.txt',
          '0-1-tabby.json',
          'translate.0-1-tabby.json',
          'contest.0-1-tabby.json',
        ].map(async function writeOne(name,): Promise<void> {
          await writeFile(
            join(
              dir,
              name,
            ),
            '{}\n',
          );
        },),);

        expect(await countCachedSlices({ dir, },),).toBe(3,);
      },
    },),

    it({
      name: 'REPORTS zero for a directory that does not exist, which is every '
        + 'entry before its first slice is bought',
      fn: async () => {
        expect(await countCachedSlices({
          dir: join(
            tmpdir(),
            'whiskers-cache-that-was-never-created',
          ),
        },),).toBe(0,);
      },
    },),
  ],
},);
