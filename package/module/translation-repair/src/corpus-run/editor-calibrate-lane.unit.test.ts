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
import { PINNED_EDITOR_BENCH_START, } from './editor-bench-start.test-fixture.ts';
import { shippingLaneClient, } from './editor-lane-script.test-fixture.ts';
import { scriptedClient, } from './scripted-width-client.test-fixture.ts';
import { SCRIPTED_STAGE_SETTINGS, } from '../stage-settings.test-fixture.ts';

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
              stageSettings: SCRIPTED_STAGE_SETTINGS,
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
              stageSettings: { ...SCRIPTED_STAGE_SETTINGS, editorBenchStart: PINNED_EDITOR_BENCH_START, },
            },);

            // THE SIX SEATS THAT SHIP ARE PINNED AGAIN (n166, Z3). The lane seats six editors from a bench the prompt rotates, so
            // which six of the seven seats that can hold an editor chair are seated moved whenever a sheet's wording did (n161: the
            // house tense rule), and the test had stopped naming them. The rotation's start is injected through the stage settings
            // instead, so no sheet text moves the seats and a lane that seated a worse subset of the seven fails.
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
