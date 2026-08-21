/**
 * Tests for the lane contest`s cache key.
 *
 * THE KEY HAS NO OTHER WITNESS. Persist and resume both call the same function,
 * so a change to how it is derived produces no failure anywhere: every run
 * simply misses the cache and buys every contested slice again, and the only
 * symptom is quota. The golden hash below is the witness, and it exists to fail
 * when the derivation moves without the version moving with it.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  laneContestRunShape,
  laneContestSliceKey,
} from '../dist/final/node/index.mjs';

/**
 * Roster every case here asks.
 */
const ROSTER = [
  'hf:zai-org/GLM-5.2',
  'hf:Qwen/Qwen3.8-27B',
] as const;

/**
 * Original of the slice every case describes.
 */
const SOURCE_NAP = '猫猫在书店的阁楼里睡觉。';

/**
 * Archive`s own English for it.
 */
const ARCHIVE_NAP = 'The cat sleeps in the bookshop attic.';

/**
 * Wording the repair lane would ship.
 */
const REPAIR_NAP = 'The cat naps in the bookshop attic.';

/**
 * Wording the translate lane would ship.
 */
const TRANSLATE_NAP = 'The cat dozes in the attic of the bookshop.';

/**
 * Every input to the key, in one place, so a case changes exactly one of them.
 *
 * @returns Key inputs for the slice above
 *
 * @example
 * ```ts
 * const key = laneContestSliceKey(catInputs(),);
 * ```
 */
function catInputs(): Parameters<typeof laneContestSliceKey>[0] {
  return {
    runShape: laneContestRunShape({ modelIds: ROSTER, },),
    sourceText: SOURCE_NAP,
    incumbentText: ARCHIVE_NAP,
    incumbentKind: 'present',
    repairText: REPAIR_NAP,
    translateText: TRANSLATE_NAP,
  };
}

await describe({
  name: laneContestSliceKey.name,
  children: [
    it({
      name:
        'DERIVES THE PINNED KEY for a fixed set of inputs, which is the only thing that fails when the '
        + 'derivation moves and the version does not: a moved key costs quota and nothing else, so '
        + 'nothing else would notice',
      fn: async () => {
        /**
         * Key these fixed inputs derive today.
         */
        const key = laneContestSliceKey(catInputs(),);
        expect(key,).toBe('b9ac244d790441e0ae83db76def8d916274bd1981447296e6c3072762176a044',);
      },
    },),
    it({
      name:
        'SEPARATES two contests over identical candidates and different ARCHIVE wording, since the judge '
        + 'is shown the archive rendering as evidence and is therefore not being asked the same question',
      fn: async () => {
        expect(laneContestSliceKey({
          ...catInputs(),
          incumbentText: 'The cat sleeps in the attic.',
        },),).not.toBe(laneContestSliceKey(catInputs(),),);
      },
    },),
    it({
      name:
        'SEPARATES a slice the archive never rendered from one it rendered as nothing, which carry the '
        + 'same empty wording and are opposite facts about the passage',
      fn: async () => {
        expect(laneContestSliceKey({
          ...catInputs(),
          incumbentText: '',
          incumbentKind: 'absent',
        },),).not.toBe(laneContestSliceKey({
          ...catInputs(),
          incumbentText: '',
        },),);
      },
    },),
    it({
      name: 'SEPARATES two rosters asked the same question, since ballots one roster cast are not ballots another cast',
      fn: async () => {
        expect(laneContestSliceKey({
          ...catInputs(),
          runShape: laneContestRunShape({ modelIds: [ROSTER[0],], },),
        },),).not.toBe(laneContestSliceKey(catInputs(),),);
      },
    },),
    it({
      name:
        'SEPARATES a run that declared names from one that declared none, since a judge shown an attested '
        + 'name reads a candidate carrying it differently',
      fn: async () => {
        expect(laneContestSliceKey({
          ...catInputs(),
          runShape: laneContestRunShape({
            modelIds: ROSTER,
            identityContext: 'The narrator is called Whiskers.',
          },),
        },),).not.toBe(laneContestSliceKey(catInputs(),),);
      },
    },),
    it({
      name: 'SEPARATES the two candidates by SIDE, so swapping which lane produced which is a different question',
      fn: async () => {
        expect(laneContestSliceKey({
          ...catInputs(),
          repairText: TRANSLATE_NAP,
          translateText: REPAIR_NAP,
        },),).not.toBe(laneContestSliceKey(catInputs(),),);
      },
    },),
  ],
},);
