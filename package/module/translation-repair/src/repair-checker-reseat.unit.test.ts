/**
 Guards class one hundred nine (zheermao9, 2026-09-24): the class one hundred
 three re-seat lands at a chunk's start, but with eight chunks in flight the
 chunks already running when Synthetic's weekly allowance ran out kept the
 bench read at their start, so seven of eight checker rounds asked the two
 Synthetic-only seats a minute after the dry-out and heard one voice, short
 of quorum, while five re-seat lines had already named a bench with two
 reachable seats. The checker stage now reads the seating again at the stage
 itself. Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  checkerBenchAtStage,
  CheckerQuorumError,
  standingSeating,
  OPENROUTER_CHECKER_SUBSTITUTE,
  type RepairModels,
  type RepairSliceSeating,
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
} from '../dist/final/node/index.mjs';

/**
 Logger the stage writes to.
 */
const l = tagged({ tag: 'repair-checker-reseat-test', },);

/**
 Roster a chunk was seated with before the provider ran dry.
 */
const SEATED: RepairModels = {
  criticModelIds: [SEAT_HYPER_OPENROUTER_VISION_EDITOR, SEAT_SYNTHETIC_VISION_NO_OPENROUTER,],
  panelModelIds: [SEAT_HYPER_OPENROUTER_VISION_EDITOR, SEAT_SYNTHETIC_VISION_NO_OPENROUTER,],
  editorModelIds: [SEAT_HYPER_OPENROUTER_VISION_EDITOR,],
  judgeModelIds: [SEAT_HYPER_OPENROUTER_VISION_EDITOR, SEAT_SYNTHETIC_VISION_NO_OPENROUTER,],
  checkerModelIds: [
    SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
    SEAT_SYNTHETIC_VISION_WITHHELD,
    SEAT_SYNTHETIC_TEXT_EVERYWHERE,
  ],
};

/**
 Bench the reading seats once the withheld seat's provider is dry.
 */
const FRESH_CHECKERS = [
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
  OPENROUTER_CHECKER_SUBSTITUTE,
];

await describe({
  name: checkerBenchAtStage.name,
  children: [
    it({
      name: 'KEEPS THE CHUNK\'S BENCH where the hook says the given roster still stands',
      fn: async () => {
        expect(await checkerBenchAtStage({
          models: SEATED,
          reseat: standingSeating,
          l,
        },),).toEqual(SEATED.checkerModelIds,);
        expect(await checkerBenchAtStage({
          models: SEATED,
          reseat: async (): Promise<RepairSliceSeating> => ({}),
          l,
        },),).toEqual(SEATED.checkerModelIds,);
      },
    },),
    it({
      name: 'ASKS THE BENCH READ AT THE STAGE where the hook hands a roster whose checkers differ',
      fn: async () => {
        expect(await checkerBenchAtStage({
          models: SEATED,
          reseat: async (): Promise<RepairSliceSeating> => ({
            repairModels: { ...SEATED, checkerModelIds: FRESH_CHECKERS, },
          }),
          l,
        },),).toEqual(FRESH_CHECKERS,);
      },
    },),
    it({
      name: 'REFUSES a re-seated bench below the checker floor rather than running a stage the contract refuses',
      fn: async () => {
        await expect(checkerBenchAtStage({
          models: SEATED,
          reseat: async (): Promise<RepairSliceSeating> => ({
            repairModels: { ...SEATED, checkerModelIds: [SEAT_SYNTHETIC_TEXT_EVERYWHERE,], },
          }),
          l,
        },),).rejects
          .toThrow(CheckerQuorumError,);
      },
    },),
  ],
},);
