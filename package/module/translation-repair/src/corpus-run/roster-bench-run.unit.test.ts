/**
 Tests for the roster bench run over scripted slices, clients, report writer
 and clock, in which no model is called and no corpus clone is read.

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
  runRosterBench,
  StatedRefusalError,
} from '../../dist/final/node/index.mjs';
import { successiveClients, } from '../introduced-defect-scripted-client.test-fixture.ts';
import { rejectionOf, } from '../rejecting-call.test-fixture.ts';
import {
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_HYPER_VISION,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
} from '../roster-seats.test-fixture.ts';
import { lineOf, } from './command-line.test-fixture.ts';
import { divertingConsoleLog, } from './console-log-capture.test-fixture.ts';
import {
  SCRIPTED_HEAD,
  scriptedDrawing,
} from './scripted-bench-seams.test-fixture.ts';
import { translateLaneClient, } from './translate-lane-script.test-fixture.ts';

/**
 Models the widths are cut from, which also judge.
 */
const ROSTER = [
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_HYPER_VISION,
] as const;

/**
 Archive wording every slice already carries.
 */
const INCUMBENT_TEXT = 'The cat is doing the sleeping on the windowsill, with tail hanging by the radiator.';

/**
 What each of the roster's models writes, the last one copying the archive.
 */
const RENDERINGS = {
  [SEAT_HYPER_OPENROUTER_VISION_EDITOR]: 'The cat dozes on the windowsill, tail draped beside the radiator.',
  [SEAT_SYNTHETIC_VISION_NO_OPENROUTER]: 'A cat naps on the sill, its tail hanging near the heater.',
  [SEAT_HYPER_VISION]: INCUMBENT_TEXT,
} as const;

/**
 What the report writer is handed, as the run types it.
 */
type ReportInput = Parameters<Parameters<typeof runRosterBench>[0]['writeReport']>[0];

/**
 What the report writer was handed at one call, with the rows counted at that
 moment since the run keeps filling the one list it passes.
 */
type Written = Omit<ReportInput, 'rows'> & {
  /**
   Rows the report held when it was written.
   */
  readonly rows: number;
};

/**
 Everything a run is handed that a case scripts: clients that answer, a report
 writer and a clock that each keep a record.

 @param rows - how many rows the run will make, one client each

 @param needle - text the judges back

 @returns The seams, the clients' builder and the writer's record

 @example
 ```ts
 const scripted = scriptedRun({ rows: 3, needle: 'dozes', },);
 ```
 */
function scriptedRun(
  {
    rows,
    needle,
  }: {
    readonly rows: number;
    readonly needle: string;
  },
): {
  readonly seams: {
    readonly roster: typeof ROSTER;
    readonly newClient: () => ReturnType<typeof translateLaneClient>;
    readonly writeReport: (input: ReportInput,) => Promise<void>;
    readonly clock: { readonly now: () => number; };
  };
  readonly built: () => number;
  readonly written: Written[];
} {
  const { newClient, built, } = successiveClients({
    clients: Array.from(
      { length: rows, },
      function answering(): ReturnType<typeof translateLaneClient> {
        return translateLaneClient({
          renderings: RENDERINGS,
          needle,
        },);
      },
    ),
  },);

  /**
   What the writer was handed, one entry a call.
   */
  const written: Written[] = [];

  /**
   Reading the clock is at.
   */
  const reading = { at: 0, };
  return {
    seams: {
      roster: ROSTER,
      newClient,
      writeReport: function keepReport(input,): Promise<void> {
        written.push({
          rows: input.rows.length,
          headSha: input.headSha,
          widths: input.widths,
          repeated: input.repeated,
          roster: input.roster,
        },);
        return Promise.resolve();
      },
      clock: {
        now: function advance(): number {
          reading.at += 250;
          return reading.at;
        },
      },
    },
    built,
    written,
  };
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: runRosterBench.name,
      concurrency: 1,
      children: [
        it({
          name: 'RUNS every width on every slice, the repeated width twice, one client a row, and writes the report '
            + 'after each row',
          fn: async (ctx,) => {
            using printed = divertingConsoleLog({ sinon: ctx.sinon, },);
            const { asked, seams: drawing, } = scriptedDrawing({ slices: 2, },);
            const {
              seams,
              built,
              written,
            } = scriptedRun({
              rows: 6,
              needle: 'dozes',
            },);

            await runRosterBench({
              line: lineOf({
                command: 'roster-bench',
                typed: ['2',],
              },),
              ...drawing,
              ...seams,
            },);

            expect(asked,).toEqual({
              draws: [{ count: 2, },],
              heads: 1,
            },);
            expect(built(),).toBe(6,);
            expect(written,).toEqual([
              1,
              2,
              3,
              4,
              5,
              6,
            ].map(function afterRow(rows,): Written {
              return {
                rows,
                headSha: SCRIPTED_HEAD,
                widths: [
                  2,
                  3,
                ],
                repeated: 3,
                roster: ROSTER,
              };
            },),);
            expect(printed.lines,).toEqual([
              'BENCH 2 slices, widths 2, 3, width 3 run twice, roster of 3',
              'BENCH mittens#0 w2p1: judged, replaced, weight 2.5, 5 calls, 250ms',
              'BENCH mittens#0 w3p1: judged, replaced, weight 2.5, 6 calls, 250ms',
              'BENCH mittens#0 w3p2: judged, replaced, weight 2.5, 6 calls, 250ms',
              'BENCH mittens#1 w2p1: judged, replaced, weight 2.5, 5 calls, 250ms',
              'BENCH mittens#1 w3p1: judged, replaced, weight 2.5, 6 calls, 250ms',
              'BENCH mittens#1 w3p2: judged, replaced, weight 2.5, 6 calls, 250ms',
              'BENCH width 2 pass 1: 2 slices (2 with an incumbent), declined 0, kept 0, self-votes 2, '
              + 'self-preference 0.00 (own 0.50 of 4, others 0.50 of 8, same candidates), calls 10, '
              + 'tokens 0 (in 0, out 0), 250ms per slice',
              'BENCH width 3 pass 1: 2 slices (2 with an incumbent), declined 0, kept 0, self-votes 2, '
              + 'self-preference 0.00 (own 0.33 of 6, others 0.33 of 12, same candidates), calls 12, '
              + 'tokens 0 (in 0, out 0), 250ms per slice',
              'BENCH width 3 pass 2: 2 slices (2 with an incumbent), declined 0, kept 0, self-votes 2, '
              + 'self-preference 0.00 (own 0.33 of 6, others 0.33 of 12, same candidates), calls 12, '
              + 'tokens 0 (in 0, out 0), 250ms per slice',
            ],);
          },
        },),

        it({
          name: 'SAYS one slice in the singular, DRAWS ten when no count is named, and says KEPT where the '
            + 'archive wording won',
          fn: async (ctx,) => {
            using printed = divertingConsoleLog({ sinon: ctx.sinon, },);
            const { asked, seams: drawing, } = scriptedDrawing({ slices: 1, },);
            const { seams, } = scriptedRun({
              rows: 3,
              needle: 'sleeping',
            },);

            await runRosterBench({
              line: lineOf({
                command: 'roster-bench',
                typed: [],
              },),
              ...drawing,
              ...seams,
            },);

            expect(asked.draws,).toEqual([{ count: 10, },],);
            expect(printed.lines,).toEqual([
              'BENCH 1 slice, widths 2, 3, width 3 run twice, roster of 3',
              'BENCH mittens#0 w2p1: judged, kept, weight 3, 5 calls, 250ms',
              'BENCH mittens#0 w3p1: judged, kept, weight 2.5, 6 calls, 250ms',
              'BENCH mittens#0 w3p2: judged, kept, weight 2.5, 6 calls, 250ms',
              'BENCH width 2 pass 1: 1 slice (1 with an incumbent), declined 0, kept 1, self-votes 0, '
              + 'self-preference 0.00 (own 0.00 of 2, others 0.00 of 4, same candidates), calls 5, '
              + 'tokens 0 (in 0, out 0), 250ms per slice',
              'BENCH width 3 pass 1: 1 slice (1 with an incumbent), declined 0, kept 1, self-votes 1, '
              + 'self-preference 0.00 (own 0.33 of 3, others 0.33 of 6, same candidates), calls 6, '
              + 'tokens 0 (in 0, out 0), 250ms per slice',
              'BENCH width 3 pass 2: 1 slice (1 with an incumbent), declined 0, kept 1, self-votes 1, '
              + 'self-preference 0.00 (own 0.33 of 3, others 0.33 of 6, same candidates), calls 6, '
              + 'tokens 0 (in 0, out 0), 250ms per slice',
            ],);
          },
        },),

        it({
          name: 'REFUSES a count below one as stated, before the corpus is drawn or any client is built',
          fn: async () => {
            const { asked, seams: drawing, } = scriptedDrawing({ slices: 1, },);
            const {
              seams,
              built,
            } = scriptedRun({
              rows: 0,
              needle: 'dozes',
            },);

            const refusal = await rejectionOf(async function runZero(): Promise<void> {
              await runRosterBench({
                line: lineOf({
                  command: 'roster-bench',
                  typed: ['0',],
                },),
                ...drawing,
                ...seams,
              },);
            },);

            expect(refusal,).toBeInstanceOf(StatedRefusalError,);
            expect(String(refusal,),).toBe('StatedRefusalError: slices must be at least 1, and 0 is not',);
            expect(asked,).toEqual({
              draws: [],
              heads: 0,
            },);
            expect(built(),).toBe(0,);
          },
        },),

        it({
          name: 'REFUSES a roster too narrow to vary as stated, before the corpus is drawn or any client is built',
          fn: async () => {
            const { asked, seams: drawing, } = scriptedDrawing({ slices: 1, },);
            const {
              seams,
              built,
            } = scriptedRun({
              rows: 0,
              needle: 'dozes',
            },);

            const refusal = await rejectionOf(async function runLoneModel(): Promise<void> {
              await runRosterBench({
                line: lineOf({
                  command: 'roster-bench',
                  typed: [],
                },),
                ...drawing,
                ...seams,
                roster: [SEAT_HYPER_VISION,],
              },);
            },);

            expect(refusal,).toBeInstanceOf(StatedRefusalError,);
            expect(String(refusal,),).toBe(
              'StatedRefusalError: a roster of 1 cannot be benched: nothing to vary',
            );
            expect(asked,).toEqual({
              draws: [],
              heads: 0,
            },);
            expect(built(),).toBe(0,);
          },
        },),
      ],
    },),
  ],
},);
