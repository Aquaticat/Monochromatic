/**
 Tests for one slice of the editor calibration run through the whole repair
 lane over scripted clients, in which no model is ever called.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { runEditorLane, } from '../../dist/final/node/index.mjs';
import {
  SEAT_BEDROCK_ONLY_TEXT,
  SEAT_HYPER_ONLY,
  SEAT_HYPER_OPENROUTER_UNMEASURED,
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_OPENROUTER_ONLY,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
} from '../roster-seats.test-fixture.ts';
import { benchSliceOf, } from './editor-calibrate-rounds.test-fixture.ts';
import { shippingLaneClient, } from './editor-lane-script.test-fixture.ts';
import { scriptedClient, } from './scripted-width-client.test-fixture.ts';

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: runEditorLane.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'RETURNS no round, no shipper and no refiner reach when the critics raise no claim',
          fn: async () => {
            /**
             What the lane produced for a slice nobody had a claim against.
             */
            const rounds = await runEditorLane({
              slice: benchSliceOf({ entryId: 'mittens', index: 0, },),
              client: scriptedClient({ script: { critic_report: { issues: [], }, }, },),
            },);

            expect(rounds,).toEqual({
              editor: [],
              refiner: [],
              refineAsked: false,
              editorShipped: [],
              refinerShipped: [],
              refinerHeard: [],
            },);
          },
        },),

        it({
          name: 'CREDITS every editor seat that wrote the shipped edit, as one composite candidate with no ballot, '
            + 'and reaches no rewriter on a one sentence slice',
          fn: async () => {
            /**
             What the lane produced when every stage agreed on one edit.
             */
            const rounds = await runEditorLane({
              slice: benchSliceOf({ entryId: 'mittens', index: 0, },),
              client: shippingLaneClient(),
            },);

            /**
             Seats whose text shipped, in the order the lane seats them.
             */
            const shippers = [
              SEAT_HYPER_OPENROUTER_VISION_EDITOR,
              SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
              SEAT_HYPER_ONLY,
              SEAT_HYPER_OPENROUTER_UNMEASURED,
              SEAT_BEDROCK_ONLY_TEXT,
              SEAT_OPENROUTER_ONLY,
            ];

            expect(rounds,).toEqual({
              editor: [
                {
                  producers: [
                    {
                      kind: 'composite',
                      contributors: shippers,
                    },
                  ],
                  ballots: [],
                },
              ],
              refiner: [],
              refineAsked: false,
              editorShipped: shippers,
              refinerShipped: [],
              refinerHeard: [],
            },);
          },
        },),
      ],
    },),
  ],
},);
