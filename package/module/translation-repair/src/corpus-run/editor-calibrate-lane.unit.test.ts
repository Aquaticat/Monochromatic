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
import { SEATS_THAT_CAN_EDIT, } from '../roster-seats.test-fixture.ts';
import { benchSliceOf, } from './editor-calibrate-rounds.test-fixture.ts';
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
              stageSettings: SCRIPTED_STAGE_SETTINGS,
            },);

            /**
             Seats whose text shipped, in the order the lane seated them.
             */
            const { editorShipped, } = rounds;

            // The lane seats six editors from a bench the prompt rotates (it moved when the house tense rule changed the
            // prompt), so which six of the seats that can hold an editor chair are seated moves with the sheet. Six distinct
            // seats of the roster is what holds.
            expect(new Set(editorShipped,).size,).toBe(6,);
            expect(editorShipped.filter(function isUnseatable(modelId,): boolean {
              return !SEATS_THAT_CAN_EDIT.includes(modelId,);
            },),).toEqual([],);
            expect(rounds,).toEqual({
              editor: [
                {
                  producers: [
                    {
                      kind: 'composite',
                      contributors: editorShipped,
                    },
                  ],
                  ballots: [],
                },
              ],
              refiner: [],
              refineAsked: false,
              editorShipped,
              refinerShipped: [],
              refinerHeard: [],
            },);
          },
        },),
      ],
    },),
  ],
},);
