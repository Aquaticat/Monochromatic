/**
 Tests for the final polish's configuration.

 WHAT THIS FILE PINS: a roster without refiners, which the repair contract
 names a supported configuration ("Absent means the lane is off",
 `repair-contract.ts`), turns the polish off rather than running it with
 nobody to write; a roster with refiners configures it from the roster and
 the prepared document.

 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  consolidationPolishConfiguration,
  prepareDocumentPair,
  type RepairModels,
} from '../dist/final/node/index.mjs';
import {
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
} from './roster-seats.test-fixture.ts';

/**
 A prepared page pair with no declared names.
 */
const PREPARED = prepareDocumentPair({
  sourceText: '猫在窗边睡着了。\n\n它梦见了鱼。',
  targetText: 'The cat fell asleep by the window.\n\nIt dreamed of fish.',
},);

/**
 A repair roster with every required role and no refiners.
 */
const WITHOUT_REFINERS: RepairModels = {
  criticModelIds: [SEAT_HYPER_OPENROUTER_VISION_EDITOR,],
  panelModelIds: [SEAT_HYPER_OPENROUTER_VISION_EDITOR,],
  editorModelIds: [SEAT_HYPER_OPENROUTER_VISION_EDITOR,],
  judgeModelIds: [SEAT_SYNTHETIC_VISION_NO_OPENROUTER, SEAT_SYNTHETIC_VISION_WITHHELD,],
  checkerModelIds: [SEAT_SYNTHETIC_VISION_WITHHELD,],
};

/**
 The final gate's bench.
 */
const GATE = [SEAT_SYNTHETIC_VISION_NO_OPENROUTER, SEAT_SYNTHETIC_VISION_WITHHELD,] as const;

await describe({
  name: consolidationPolishConfiguration.name,
  children: [
    it({
      name: 'TURNS THE POLISH OFF for a roster without refiners, the configuration the repair contract supports',
      fn: async () => {
        expect(consolidationPolishConfiguration({
          prepared: PREPARED,
          models: WITHOUT_REFINERS,
          gateModelIds: GATE,
        },),).toEqual({ kind: 'disabled', },);
      },
    },),
    it({
      name: 'CONFIGURES THE POLISH from a roster with refiners: its refiners and judges, the gate bench, and '
        + 'the prepared document\'s declared names',
      fn: async () => {
        /**
         The configuration a roster with refiners gives.
         */
        const configured = consolidationPolishConfiguration({
          prepared: PREPARED,
          models: {
            ...WITHOUT_REFINERS,
            refinerModelIds: [SEAT_HYPER_OPENROUTER_VISION_EDITOR,],
          },
          gateModelIds: GATE,
        },);
        if (configured.kind !== 'configured')
          throw new Error(`expected a configured polish, got ${configured.kind}`,);
        expect({
          refinerModelIds: configured.config.refinerModelIds,
          judgeModelIds: configured.config.judgeModelIds,
          gateModelIds: configured.config.gateModelIds,
          declaredNames: configured.config.declaredNames,
        },).toEqual({
          refinerModelIds: [SEAT_HYPER_OPENROUTER_VISION_EDITOR,],
          judgeModelIds: WITHOUT_REFINERS.judgeModelIds,
          gateModelIds: GATE,
          declaredNames: PREPARED.declaredNames,
        },);
      },
    },),
  ],
},);
