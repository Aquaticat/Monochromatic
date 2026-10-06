/**
 Tests for the two closing paragraphs of the editor calibration's report: how
 many slices reached a rewriter, and what shipped with no vote behind it.

 CAPTURING `console.log` IS PROCESS-WIDE, which is why this file runs at
 `concurrency: 1`.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  printEditorCalibrateRefineReach,
  printEditorCalibrateShipped,
} from '../../dist/final/node/index.mjs';
import {
  SEAT_HYPER_TEXT_BEDROCK,
  SEAT_HYPER_VISION,
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
} from '../roster-seats.test-fixture.ts';
import { divertingConsoleLog, } from './console-log-capture.test-fixture.ts';
import { unjudgedRounds, } from './editor-calibrate-rounds.test-fixture.ts';

/**
 Closing sentence of the reach line, which names why the unreached slices say nothing.
 */
const REACH_TAIL = '; the rest carried no paragraph over the eligibility floor, so no refiner was asked '
  + 'and their silence is not evidence about any model';

/**
 Closing sentence the shipped paragraph ends on whenever something shipped.
 */
const NOT_A_PREFERENCE = '  THIS IS NOT A PREFERENCE. A model ships here by writing text that survived, including '
  + 'text every other editor proposed identically, which no judge was ever asked about.';

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: printEditorCalibrateRefineReach.name,
      concurrency: 1,
      children: [
        it({
          name: 'PRINTS how many of the slices reached a rewriter, with the slice noun in the plural',
          fn: async (ctx,) => {
            using printed = divertingConsoleLog({ sinon: ctx.sinon, },);

            printEditorCalibrateRefineReach({
              perSlice: [
                unjudgedRounds({ shippers: [], refineAsked: true, },),
                unjudgedRounds({ shippers: [], refineAsked: false, },),
                unjudgedRounds({ shippers: [], refineAsked: true, },),
              ],
            },);

            expect(printed.lines,).toEqual([`  reached a rewriter on 2 of 3 slices${REACH_TAIL}`,],);
          },
        },),

        it({
          name: 'PRINTS the slice noun in the singular when the run drew one slice, and zero when it reached no rewriter',
          fn: async (ctx,) => {
            using printed = divertingConsoleLog({ sinon: ctx.sinon, },);

            printEditorCalibrateRefineReach({
              perSlice: [unjudgedRounds({ shippers: [], refineAsked: false, },),],
            },);

            expect(printed.lines,).toEqual([`  reached a rewriter on 0 of 1 slice${REACH_TAIL}`,],);
          },
        },),
      ],
    },),

    describe({
      name: printEditorCalibrateShipped.name,
      concurrency: 1,
      children: [
        it({
          name: 'PRINTS that nothing shipped, and stops, when no slice carried an editor credited with a repair',
          fn: async (ctx,) => {
            using printed = divertingConsoleLog({ sinon: ctx.sinon, },);

            printEditorCalibrateShipped({
              perSlice: [
                unjudgedRounds({ shippers: [], refineAsked: true, },),
                unjudgedRounds({ shippers: [], refineAsked: false, },),
              ],
            },);

            expect(printed.lines,).toEqual([
              '\nEDITORS SHIPPED on 0 of 2 slices, 0 of them with no editor round judged at all',
              '  NOTHING SHIPPED. No slice in this sample carried an accepted issue.',
            ],);
          },
        },),

        it({
          name: 'PRINTS each model with the slices it wrote shipping text on, most slices first, then the preference caveat',
          fn: async (ctx,) => {
            using printed = divertingConsoleLog({ sinon: ctx.sinon, },);

            printEditorCalibrateShipped({
              perSlice: [
                unjudgedRounds({ shippers: [SEAT_HYPER_VISION,], refineAsked: false, },),
                unjudgedRounds({
                  shippers: [SEAT_HYPER_VISION, SEAT_HYPER_TEXT_BEDROCK,],
                  refineAsked: false,
                },),
                unjudgedRounds({ shippers: [], refineAsked: false, },),
                unjudgedRounds({ shippers: [SEAT_SYNTHETIC_TEXT_EVERYWHERE,], refineAsked: false, },),
              ],
            },);

            expect(printed.lines,).toEqual([
              '\nEDITORS SHIPPED on 3 of 4 slices, 3 of them with no editor round judged at all',
              `  ${SEAT_HYPER_VISION}: wrote shipping text on 2 of 3 slices`,
              `  ${SEAT_HYPER_TEXT_BEDROCK}: wrote shipping text on 1 of 3 slices`,
              `  ${SEAT_SYNTHETIC_TEXT_EVERYWHERE}: wrote shipping text on 1 of 3 slices`,
              NOT_A_PREFERENCE,
            ],);
          },
        },),

        it({
          name: 'COUNTS only the slices that shipped with no editor round judged, and prints the slice noun in the singular',
          fn: async (ctx,) => {
            using printed = divertingConsoleLog({ sinon: ctx.sinon, },);

            printEditorCalibrateShipped({
              perSlice: [
                {
                  ...unjudgedRounds({ shippers: [SEAT_HYPER_VISION,], refineAsked: false, },),
                  editor: [
                    {
                      producers: [],
                      ballots: [],
                    },
                  ],
                },
              ],
            },);

            expect(printed.lines,).toEqual([
              '\nEDITORS SHIPPED on 1 of 1 slice, 0 of them with no editor round judged at all',
              `  ${SEAT_HYPER_VISION}: wrote shipping text on 1 of 1 slice`,
              NOT_A_PREFERENCE,
            ],);
          },
        },),
      ],
    },),
  ],
},);
