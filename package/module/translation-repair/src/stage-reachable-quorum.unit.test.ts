import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  MIN_STAGE_VOICES,
  reachableQuorum,
  rosterQuorumSize,
  shortBenchStageFinding,
} from '../dist/final/node/index.mjs';

await describe({
  name: reachableQuorum.name,
  children: [
    it({
      name: 'KEEPS THE BENCH QUORUM while the reachable seats can still meet it, so a healthy bench and a bench '
        + 'short of a few seats close on the same count',
      fn: async () => {
        expect(reachableQuorum({ benchSize: 11, unreachable: 0, },),).toEqual({
          needed: 6,
          reachable: 11,
          benchQuorum: 6,
          short: false,
        },);
        expect(reachableQuorum({ benchSize: 11, unreachable: 3, },),).toEqual({
          needed: 6,
          reachable: 8,
          benchQuorum: 6,
          short: false,
        },);
      },
    },),

    it({
      name: 'SIZES THE QUORUM ON THE REACHABLE SEATS once they are fewer than the bench quorum, at half of them '
        + 'rounded up and never under the two-voice floor: seven of eleven seats dark leaves four, which close '
        + 'on two',
      fn: async () => {
        expect(reachableQuorum({ benchSize: 11, unreachable: 7, },),).toEqual({
          needed: 2,
          reachable: 4,
          benchQuorum: 6,
          short: true,
        },);
        expect(reachableQuorum({ benchSize: 11, unreachable: 6, },).needed,).toBe(
          rosterQuorumSize({ rosterSize: 5, },),
        );
        expect(reachableQuorum({ benchSize: 6, unreachable: 4, },).needed,).toBe(MIN_STAGE_VOICES,);
      },
    },),

    it({
      name: 'NEVER LETS ONE VOICE, OR NONE, BE A QUORUM: a bench with one reachable seat or none needs the floor '
        + 'it cannot reach, which reads as an outage',
      fn: async () => {
        expect(reachableQuorum({ benchSize: 11, unreachable: 10, },).needed,).toBe(MIN_STAGE_VOICES,);
        expect(reachableQuorum({ benchSize: 3, unreachable: 3, },).needed,).toBe(MIN_STAGE_VOICES,);
        expect(reachableQuorum({ benchSize: 3, unreachable: 3, },).reachable,).toBe(0,);
      },
    },),
  ],
},);

await describe({
  name: shortBenchStageFinding.name,
  children: [
    it({
      name: 'NAMES the stage, the reachable seats against the bench and the quorum applied, in the wording a '
        + 'scorecard can count',
      fn: async () => {
        expect(shortBenchStageFinding({
          stage: 'archive-block-review',
          quorum: reachableQuorum({ benchSize: 11, unreachable: 7, },),
          benchSize: 11,
        },),).toBe('stage-short-bench (archive-block-review reachable 4 of 11, quorum 2)',);
      },
    },),
  ],
},);
