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
import {
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
} from './roster-seats.test-fixture.ts';

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
          perCallTimeoutMs: 30_000,
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
          perCallTimeoutMs: 30_000,
          l,
        },),).rejects.toBeInstanceOf(CheckerIndependenceError,);
      },
    },),
  ],
},);
