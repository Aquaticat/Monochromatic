/**
 Tests for the driver's step around the naturalness lane: the refusals it
 passes on and the one it makes itself.

 The step checks every outcome the lane returns against the archive wording
 of its slice, so an outcome naming a slice preparation never made is refused
 there, even with the lane off, where the phase hands its input back
 untouched. A refusal the phase makes under a live signal is a fault, not an
 abort, and keeps its own identity. Fixtures are cat-themed invention.

 @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  CheckerIndependenceError,
  frontMatterRepairOutcome,
  prepareDocumentPair,
  refineSettledSlices,
  type RepairModels,
  type SyntheticClient,
  UnpreparedSliceError,
} from '../dist/final/node/index.mjs';
import { levelCapturingLogger, } from './capturing-logger.test-fixture.ts';
import { slicePairOf, } from './corpus-run/slice-pair-of.test-fixture.ts';
import {
  statusFailureLogText,
  statusFailureOf,
} from './provider-status-failure.test-fixture.ts';
import { rejectionOf, } from './rejecting-call.test-fixture.ts';
import {
  SEAT_HYPER_OPENROUTER_UNMEASURED,
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_HYPER_VISION,
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
} from './roster-seats.test-fixture.ts';
import {
  REPAIRED_TEXT,
  SOURCE_TEXT,
  sunbathingOutcome,
} from './sunbathing-recheck.test-fixture.ts';
import { HANG_STOP_MS, } from './hang-stop.test-fixture.ts';

/**
 Logger for the step under test.
 */
const l = tagged({ tag: 'repair-refine-step-test', },);

/**
 Archive translation of the fixture pair.
 */
const TARGET_TEXT = 'The cat sleeps on the windowsill.';

/**
 Prepared slices of the fixture pair.
 */
const { slices: SLICES, } = prepareDocumentPair({
  sourceText: '猫在窗台上睡觉。',
  targetText: TARGET_TEXT,
},);

/**
 Roster with the naturalness lane off: no rewriter is seated.
 */
const LANE_OFF: RepairModels = {
  criticModelIds: [SEAT_HYPER_OPENROUTER_VISION_EDITOR,],
  panelModelIds: [SEAT_HYPER_OPENROUTER_VISION_EDITOR,],
  editorModelIds: [SEAT_HYPER_OPENROUTER_VISION_EDITOR,],
  judgeModelIds: [SEAT_HYPER_OPENROUTER_VISION_EDITOR,],
  checkerModelIds: [
    SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
    SEAT_SYNTHETIC_VISION_WITHHELD,
    SEAT_SYNTHETIC_TEXT_EVERYWHERE,
  ],
};

/**
 Roster with the naturalness lane on: one rewriter, and checkers apart from it.
 */
const LANE_ON: RepairModels = {
  criticModelIds: [SEAT_HYPER_OPENROUTER_VISION_EDITOR,],
  panelModelIds: [SEAT_HYPER_OPENROUTER_VISION_EDITOR,],
  editorModelIds: [
    SEAT_HYPER_OPENROUTER_VISION_EDITOR,
    SEAT_HYPER_VISION,
  ],
  judgeModelIds: [
    SEAT_HYPER_OPENROUTER_VISION_EDITOR,
    SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
    SEAT_SYNTHETIC_VISION_WITHHELD,
    SEAT_HYPER_OPENROUTER_UNMEASURED,
  ],
  refinerModelIds: [SEAT_HYPER_OPENROUTER_VISION_EDITOR,],
  checkerModelIds: [
    SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
    SEAT_SYNTHETIC_VISION_WITHHELD,
    SEAT_HYPER_OPENROUTER_UNMEASURED,
  ],
};

/**
 Client no case here may call: the lane is off, or refused before it asks.
 */
const SILENT_CLIENT: SyntheticClient = {
  chatText: async () => {
    throw new Error('no call expected',);
  },
  chatJson: async () => {
    throw new Error('no call expected',);
  },
  quotas: async () => {
    throw new Error('no call expected',);
  },
};

await describe({
  name: refineSettledSlices.name,
  concurrency: 1,
  children: [
    it({
      name: 'REFUSES an outcome naming a slice preparation never made, even with the lane off, where '
        + 'the phase returns its input untouched and nothing else would compare it to an archive',
      fn: async () => {
        await expect(refineSettledSlices({
          client: SILENT_CLIENT,
          targetText: TARGET_TEXT,
          slices: SLICES,
          outcomes: [
            frontMatterRepairOutcome({
              sliceIndex: SLICES.length + 5,
              targetText: TARGET_TEXT,
            },),
          ],
          models: LANE_OFF,
          declaredNames: [],
          signal: new AbortController().signal,
          perCallTimeoutMs: HANG_STOP_MS,
          l,
        },),).rejects.toBeInstanceOf(UnpreparedSliceError,);
      },
    },),
    it({
      name: 'PASSES ON the phase\'s own refusal of a rewriter that also checks, by identity, since '
        + 'under a live signal a refusal is a fault to fix and not an abort to retry',
      fn: async () => {
        await expect(refineSettledSlices({
          client: SILENT_CLIENT,
          targetText: TARGET_TEXT,
          slices: SLICES,
          outcomes: [],
          models: {
            ...LANE_OFF,
            refinerModelIds: [SEAT_SYNTHETIC_TEXT_EVERYWHERE,],
          },
          declaredNames: [],
          signal: new AbortController().signal,
          perCallTimeoutMs: HANG_STOP_MS,
          l,
        },),).rejects.toBeInstanceOf(CheckerIndependenceError,);
      },
    },),
    it({
      name: 'WARNS OF A PROVIDER REFUSAL THE CALLER\'S ABORT ENDED by the status and the provider\'s words, the key '
        + 'its refusal echoed masked, and raises the abort\'s own reason',
      fn: async ctx => {
        /**
         Refusal the real client raised over the real transport.
         */
        const failure = await statusFailureOf({
          sinon: ctx.sinon,
          status: 401,
        },);
        /**
         Stop the caller gives while the provider is refusing.
         */
        const stop = new AbortController();
        const lines: string[] = [];
        const refusal = await rejectionOf(async function refineUnderStop() {
          return refineSettledSlices({
            client: {
              chatText: async () => {
                throw new Error('chatText unused by the naturalness lane',);
              },
              chatJson: async () => {
                stop.abort();
                throw failure;
              },
              quotas: async () => {
                throw new Error('quotas unused by the naturalness lane',);
              },
            },
            targetText: REPAIRED_TEXT,
            slices: [
              slicePairOf({
                sliceIndex: 0,
                source: SOURCE_TEXT,
                target: REPAIRED_TEXT,
              },),
            ],
            outcomes: [sunbathingOutcome({ nonTranslationStanding: false, },),],
            models: LANE_ON,
            declaredNames: [],
            signal: stop.signal,
            perCallTimeoutMs: HANG_STOP_MS,
            l: levelCapturingLogger({ lines, },),
          },);
        },);

        expect(refusal,).toBe(stop.signal.reason,);
        expect(lines.filter(function abandoned(line,): boolean {
          return line.includes('abandoned by the caller',);
        },),).toEqual([
          `warn refinement abandoned by the caller's abort (${statusFailureLogText({ status: 401, },)})`,
        ],);
      },
    },),
  ],
},);
