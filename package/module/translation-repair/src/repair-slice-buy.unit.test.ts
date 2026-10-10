/**
 Tests for what buying one repair slice does when the caller stops the run
 while the provider is refusing: the abort wins, the line says what the
 provider refused with, and the key its refusal echoed is never in it.

 Fixtures are cat-themed invention.

 @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  buyRepairSlice,
  prepareDocumentPair,
  type RepairModels,
} from '../dist/final/node/index.mjs';
import { levelCapturingLogger, } from './capturing-logger.test-fixture.ts';
import {
  statusFailureLogText,
  statusFailureOf,
} from './provider-status-failure.test-fixture.ts';
import { rejectionOf, } from './rejecting-call.test-fixture.ts';
import {
  SEAT_HYPER_OPENROUTER_UNMEASURED,
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_HYPER_VISION,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
} from './roster-seats.test-fixture.ts';
import { HANG_STOP_MS, } from './hang-stop.test-fixture.ts';

/**
 Roster with the naturalness lane off, checkers apart from the editors.
 */
const MODELS: RepairModels = {
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
  checkerModelIds: [
    SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
    SEAT_SYNTHETIC_VISION_WITHHELD,
    SEAT_HYPER_OPENROUTER_UNMEASURED,
  ],
};

await describe({
  name: buyRepairSlice.name,
  concurrency: 1,
  children: [
    it({
      name: 'WARNS OF A PROVIDER REFUSAL THE CALLER\'S ABORT ENDED by the slice, the status and the provider\'s words, '
        + 'the key its refusal echoed masked, and raises the abort\'s own reason',
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
        /**
         Pair the slice was cut from.
         */
        const prepared = prepareDocumentPair({
          sourceText: '猫在窗台上睡觉。',
          targetText: 'The cat sleeps on the windowsill.',
        },);
        const [slice,] = prepared.slices;
        if (slice === undefined)
          throw new Error('the fixture pair carries no slice',);

        const lines: string[] = [];
        const refusal = await rejectionOf(async function buyUnderStop() {
          return buyRepairSlice({
            client: {
              chatText: async () => {
                throw new Error('chatText unused by the repair lane',);
              },
              chatJson: async () => {
                stop.abort();
                throw failure;
              },
              quotas: async () => {
                throw new Error('quotas unused by the repair lane',);
              },
            },
            prepared,
            models: MODELS,
            slice,
            key: 'purr-key',
            neighbouringIncumbentText: '',
            neighbouringSourceText: '',
            documentSourceText: '',
            signal: stop.signal,
            perCallTimeoutMs: HANG_STOP_MS,
            l: tagged({
              tag: 'repair-slice-buy-test',
              l: levelCapturingLogger({ lines, },),
            },),
          },);
        },);

        expect(refusal,).toBe(stop.signal.reason,);
        expect(lines.filter(function abandoned(line,): boolean {
          return line.includes('abandoned by the caller',);
        },),).toEqual([
          `warn [repair-slice-buy-test] chunk 0: abandoned by the caller's abort (${
            statusFailureLogText({ status: 401, },)
          })`,
        ],);
      },
    },),
  ],
},);
