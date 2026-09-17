/**
 Tests for which lane texts a consolidation slate offers (class forty,
 2026-09-17).

 WHY THIS FILE EXISTS. The consolidation is the retry of a declined contest,
 and on Mio24 slice 17 the retry never saw the two texts the contest was
 about: the archive's one-line rendering stood, the deterministic rule
 withheld it, and the slate carried only the writers' fresh proposals. The
 lane texts join the slate exactly when the standing is not a text the
 contest endorsed and the rule admits, each only when it passes the rule
 itself and differs from the standing.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { laneTextsForSlate, } from '../dist/final/node/index.mjs';

//region Fixtures

/**
 Original carrying a link the archive's line drops.
 */
const SOURCE_TEXT = '猫在[窗边](https://example.invalid/cat)睡着了。';

/**
 The archive's rendering, which drops the link and so fails the rule.
 */
const INCUMBENT_TEXT = 'The cat slept by the window.';

/**
 What the repair lane would ship, which keeps the link.
 */
const REPAIR_TEXT = 'The cat fell asleep by the [window](https://example.invalid/cat).';

/**
 What the translate lane would ship, which keeps the link too.
 */
const TRANSLATE_TEXT = 'The cat had fallen asleep beside the [window](https://example.invalid/cat).';

/**
 The slice every case reads, which each varies.
 */
const SLICE = {
  sourceText: SOURCE_TEXT,
  incumbentText: INCUMBENT_TEXT,
  repairText: REPAIR_TEXT,
  translateText: TRANSLATE_TEXT,
  standingText: INCUMBENT_TEXT,
  standingMayShip: false,
  standingEligible: false,
};

//endregion Fixtures

await describe({
  name: laneTextsForSlate.name,
  children: [
    it({
      name: 'OFFERS both lane texts when the contest declined both and the archive stands without '
        + 'endorsement, which is the Mio24 slice 17 shape',
      fn: async () => {
        expect(laneTextsForSlate(SLICE,),).toEqual([
          {
            lane: 'repair',
            text: REPAIR_TEXT,
          },
          {
            lane: 'translate',
            text: TRANSLATE_TEXT,
          },
        ],);
      },
    },),

    it({
      name: 'OFFERS both lane texts when the standing is eligible but the contest endorsed neither, '
        + 'since a declined contest is what the consolidation retries',
      fn: async () => {
        expect(laneTextsForSlate({
          ...SLICE,
          sourceText: '猫在窗边睡着了。',
          repairText: 'The cat fell asleep by the window.',
          translateText: 'The cat had fallen asleep beside the window.',
          standingEligible: true,
        },),).toHaveLength(2,);
      },
    },),

    it({
      name: 'OFFERS nothing when the standing is a lane the contest endorsed and the rule admits, '
        + 'because the contest already chose between the lanes',
      fn: async () => {
        expect(laneTextsForSlate({
          ...SLICE,
          standingText: REPAIR_TEXT,
          standingMayShip: true,
          standingEligible: true,
        },),).toEqual([],);
      },
    },),

    it({
      name: 'LEAVES OUT the lane whose text is the standing, so a withheld standing is not offered '
        + 'back under a lane name',
      fn: async () => {
        expect(laneTextsForSlate({
          ...SLICE,
          standingText: TRANSLATE_TEXT,
        },),).toEqual([
          {
            lane: 'repair',
            text: REPAIR_TEXT,
          },
        ],);
      },
    },),

    it({
      name: 'LEAVES OUT a lane text the deterministic publication rule refuses, since the slate '
        + 'floor would refuse it and a judge choosing it would choose nothing',
      fn: async () => {
        expect(laneTextsForSlate({
          ...SLICE,
          translateText: 'The cat had fallen asleep beside the window.',
        },),).toEqual([
          {
            lane: 'repair',
            text: REPAIR_TEXT,
          },
        ],);
      },
    },),

    it({
      name: 'LEAVES OUT a blank lane text, which is a lane that proposed nothing',
      fn: async () => {
        expect(laneTextsForSlate({
          ...SLICE,
          repairText: '',
        },),).toEqual([
          {
            lane: 'translate',
            text: TRANSLATE_TEXT,
          },
        ],);
      },
    },),
  ],
},);
