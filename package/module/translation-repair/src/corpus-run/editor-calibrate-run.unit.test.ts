/**
 Tests for the editor calibration run over scripted clients and scripted
 process reaches, in which no model is called and no environment, corpus or
 clock is read.

 THE ORDER IS UNDER TEST as much as the text: the count is read before the
 overlap, the overlap before the corpus draw, the windows after the header,
 and the client after the windows, so a refusal arrives with exactly the
 output that preceded it.

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
  type BenchSlice,
  type CalibrationGrace,
  type CorpusPin,
  runEditorCalibrate,
  type SyntheticClient,
  RUN_ROSTER,
  StatedRefusalError,
  type WriterGrace,
} from '../../dist/final/node/index.mjs';
import { rejectionOf, } from '../rejecting-call.test-fixture.ts';
import {
  SEAT_BEDROCK_ONLY_TEXT,
  SEAT_HYPER_ONLY,
  SEAT_HYPER_OPENROUTER_UNMEASURED,
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_OPENROUTER_ONLY,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
} from '../roster-seats.test-fixture.ts';
import { lineOf, } from './command-line.test-fixture.ts';
import { divertingConsoleLog, } from './console-log-capture.test-fixture.ts';
import { benchSliceOf, } from './editor-calibrate-rounds.test-fixture.ts';
import { shippingLaneClient, } from './editor-lane-script.test-fixture.ts';
import { scriptedClient, } from './scripted-width-client.test-fixture.ts';

//region Fixtures

/**
 Models the roster seats, which the header counts.
 */
const MODELS = String(RUN_ROSTER.length,);

/**
 The one slice every sample holds.
 */
const SLICE: BenchSlice = benchSliceOf({ entryId: 'mittens', index: 0, },);

/**
 Corpus the scripted draw is asked to read, which names nothing real.
 */
const PIN: CorpusPin = {
  cloneDir: '/no/such/clone',
  commitSha: 'a'.repeat(40,),
};

/**
 Window the calibration adopts when nothing set one.
 */
const DEFAULT_GRACE: CalibrationGrace = {
  effectiveMs: 300_000,
  source: 'calibration-default',
};

/**
 Writer window that follows every other round, which prints no note.
 */
const ROUND_WINDOW_WRITERS: WriterGrace = {
  writerMs: 300_000,
  roundMs: 300_000,
  source: 'round-window',
};

/**
 Note a seat prints when it judged no round.
 */
const NO_ROUNDS_NOTE = '  NO ROUNDS. This seat judged nothing across the sample, so it has no standing. For the editor '
  + 'seat that means no slice carried an ACCEPTED issue: critics can raise claims and the panel can adjudicate '
  + 'them and the lane still report "nothing to edit", which is what one live slice did. For the refiner seat it '
  + 'means the naturalness lane proposed nothing. Draw more slices.';

/**
 Closing paragraph on the slices that reached a rewriter, for a sample of one that reached none.
 */
const REACH_LINE = '  reached a rewriter on 0 of 1 slice; the rest carried no paragraph over the eligibility floor, '
  + 'so no refiner was asked and their silence is not evidence about any model';

/**
 Everything a run reached for, recorded in the order it reached.
 */
type Reaches = {
  /**
   Names of the reaches, in order.
   */
  readonly events: string[];

  /**
   Counts the draw was asked for.
   */
  readonly counts: number[];

  /**
   Fallbacks the overlap dial was read with.
   */
  readonly fallbacks: number[];

  /**
   Pins the draw was asked to read.
   */
  readonly pins: CorpusPin[];
};

/**
 Runs the calibration over scripted reaches, which record what it reached for.

 @param typed - arguments after the command

 @param overlap - slices in flight the scripted dial reads

 @param grace - window the scripted adoption returns

 @param writers - window the scripted writer read returns

 @param newClient - client builder the run is handed

 @param reaches - record of what the run reached for, in order

 @throws whatever the run refuses with

 @example
 ```ts
 await calibrateWith({ typed: [], overlap: 4, grace, writers, newClient, reaches, },);
 ```
 */
async function calibrateWith(
  {
    typed,
    overlap,
    grace,
    writers,
    newClient,
    reaches,
  }: {
    readonly typed: readonly string[];
    readonly overlap: number;
    readonly grace: CalibrationGrace;
    readonly writers: WriterGrace;
    readonly newClient: () => SyntheticClient;
    readonly reaches: Reaches;
  },
): Promise<void> {
  await runEditorCalibrate({
    line: lineOf({
      command: 'editor-calibrate',
      typed,
    },),
    readOverlap: function overlapDial({ fallback, },): number {
      reaches.events.push('overlap',);
      reaches.fallbacks.push(fallback,);
      return overlap;
    },
    drawSample: function drawn({
      count,
      pin,
    },): Promise<readonly BenchSlice[]> {
      reaches.events.push('draw',);
      reaches.counts.push(count,);
      reaches.pins.push(pin,);
      return Promise.resolve([SLICE,],);
    },
    pin: PIN,
    adoptGrace: function adopted(): CalibrationGrace {
      reaches.events.push('grace',);
      return grace;
    },
    readWriterGrace: function writerWindow(): WriterGrace {
      reaches.events.push('writer-grace',);
      return writers;
    },
    newClient: function built(): SyntheticClient {
      reaches.events.push('client',);
      return newClient();
    },
  },);
}

/**
 Builds an empty record of reaches.

 @returns Record with nothing reached yet

 @example
 ```ts
 const reaches = noReaches();
 ```
 */
function noReaches(): Reaches {
  return {
    events: [],
    counts: [],
    fallbacks: [],
    pins: [],
  };
}

//endregion Fixtures

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: runEditorCalibrate.name,
      concurrency: 1,
      children: [
        it({
          name: 'PRINTS the header, the window, one progress line, both empty standings and both closing '
            + 'paragraphs for a slice no critic raised a claim against, reaching for each thing once and in order',
          fn: async (ctx,) => {
            using printed = divertingConsoleLog({ sinon: ctx.sinon, },);
            /**
             What the run reached for.
             */
            const reaches = noReaches();

            await calibrateWith({
              typed: [],
              overlap: 4,
              grace: DEFAULT_GRACE,
              writers: ROUND_WINDOW_WRITERS,
              newClient: function quiet(): SyntheticClient {
                return scriptedClient({ script: { critic_report: { issues: [], }, }, },);
              },
              reaches,
            },);

            expect(printed.lines,).toEqual([
              `editor-calibrate: 1 slice, ${MODELS} models editing and judging each, 4 slices in flight`,
              'straggler window 300000ms (calibration default)',
              '  slice 1 of 1 (mittens chunk 0): 0 editor rounds, 0 refiner rounds (nothing eligible to rewrite), '
              + '0 editors shipping',
              '\nEDITOR standing over 0 judged rounds, from 0 of 1 slice',
              NO_ROUNDS_NOTE,
              '\nREFINER standing over 0 judged rounds, from 0 of 1 slice',
              NO_ROUNDS_NOTE,
              REACH_LINE,
              '\nEDITORS SHIPPED on 0 of 1 slice, 0 of them with no editor round judged at all',
              '  NOTHING SHIPPED. No slice in this sample carried an accepted issue.',
            ],);
            expect(reaches,).toEqual({
              events: ['overlap', 'draw', 'grace', 'writer-grace', 'client',],
              counts: [6,],
              fallbacks: [4,],
              pins: [PIN,],
            },);
          },
        },),

        it({
          name: 'ASKS the draw for the count on the command line, and names the override and the writer window '
            + 'when a launch set them',
          fn: async (ctx,) => {
            using printed = divertingConsoleLog({ sinon: ctx.sinon, },);
            /**
             What the run reached for.
             */
            const reaches = noReaches();

            await calibrateWith({
              typed: ['3',],
              overlap: 1,
              grace: {
                effectiveMs: 1_234,
                source: 'override',
              },
              writers: {
                writerMs: 5_678,
                roundMs: 1_234,
                source: 'writer-dial',
              },
              newClient: function quiet(): SyntheticClient {
                return scriptedClient({ script: { critic_report: { issues: [], }, }, },);
              },
              reaches,
            },);

            expect(reaches.counts,).toEqual([3,],);
            expect(printed.lines.slice(0, 3,),).toEqual([
              `editor-calibrate: 1 slice, ${MODELS} models editing and judging each, 1 slice in flight`,
              'straggler window 1234ms (TRANSLATION_REPAIR_STRAGGLER_GRACE_MS override)',
              'WRITER GRACE OVERRIDDEN by TRANSLATION_REPAIR_WRITER_GRACE_MS: writer rounds (editor, refiner, '
              + 'translate, produceConsolidations) abandon stragglers 5678ms after quorum rather than the 1234ms '
              + 'every other round waits',
            ],);
          },
        },),

        it({
          name: 'PRINTS every editor that wrote the shipped edit, with the unjudged candidate counted as a round, '
            + 'when every stage agrees on one edit',
          fn: async (ctx,) => {
            using printed = divertingConsoleLog({ sinon: ctx.sinon, },);

            await calibrateWith({
              typed: [],
              overlap: 4,
              grace: DEFAULT_GRACE,
              writers: ROUND_WINDOW_WRITERS,
              newClient: shippingLaneClient,
              reaches: noReaches(),
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

            expect(printed.lines.slice(2,).filter(function standingOrShipping(line,): boolean {
              return line.includes('wrote shipping text',) || line.startsWith('\nEDITORS',);
            },),).toEqual([
              '\nEDITORS SHIPPED on 1 of 1 slice, 0 of them with no editor round judged at all',
              ...shippers.map(function credited(modelId,): string {
                return `  ${modelId}: wrote shipping text on 1 of 1 slice`;
              },),
            ],);
            expect(printed.lines[2],).toBe(
              '  slice 1 of 1 (mittens chunk 0): 1 editor round, 0 refiner rounds (nothing eligible to rewrite), '
                + '6 editors shipping',
            );
          },
        },),

        it({
          name: 'REFUSES a count that is no number before the overlap is read, the sample drawn or anything printed',
          fn: async (ctx,) => {
            using printed = divertingConsoleLog({ sinon: ctx.sinon, },);
            /**
             What the run reached for.
             */
            const reaches = noReaches();

            /**
             What the run refused with.
             */
            const refusal = await rejectionOf(async function countOfLetters() {
              await calibrateWith({
                typed: ['four',],
                overlap: 4,
                grace: DEFAULT_GRACE,
                writers: ROUND_WINDOW_WRITERS,
                newClient: shippingLaneClient,
                reaches,
              },);
            },);

            expect(refusal,).toBeInstanceOf(StatedRefusalError,);
            expect(String(refusal,),).toBe(
              'StatedRefusalError: slices must be a whole number written in digits, at most 9007199254740991, '
                + 'and "four" is not one',
            );
            expect(reaches.events,).toEqual([],);
            expect(printed.lines,).toEqual([],);
          },
        },),

        it({
          name: 'REFUSES in the overlap read before the sample is drawn, with nothing printed',
          fn: async (ctx,) => {
            using printed = divertingConsoleLog({ sinon: ctx.sinon, },);
            /**
             What the run reached for.
             */
            const reaches = noReaches();

            /**
             What the run refused with when the overlap dial refuses.
             */
            const refusal = await rejectionOf(async function overlapRefused() {
              await runEditorCalibrate({
                line: lineOf({
                  command: 'editor-calibrate',
                  typed: [],
                },),
                readOverlap: function refusing(): number {
                  reaches.events.push('overlap',);
                  throw new StatedRefusalError({ says: 'the overlap dial is unreadable', },);
                },
                drawSample: function neverDrawn(): Promise<readonly BenchSlice[]> {
                  reaches.events.push('draw',);
                  return Promise.resolve([SLICE,],);
                },
                pin: PIN,
                adoptGrace: function neverAdopted(): CalibrationGrace {
                  reaches.events.push('grace',);
                  return DEFAULT_GRACE;
                },
                readWriterGrace: function neverRead(): WriterGrace {
                  reaches.events.push('writer-grace',);
                  return ROUND_WINDOW_WRITERS;
                },
                newClient: function neverBuilt(): SyntheticClient {
                  reaches.events.push('client',);
                  return shippingLaneClient();
                },
              },);
            },);

            expect(String(refusal,),).toBe('StatedRefusalError: the overlap dial is unreadable',);
            expect(reaches.events,).toEqual(['overlap',],);
            expect(printed.lines,).toEqual([],);
          },
        },),

        it({
          name: 'REFUSES in the window adoption after the header is printed and before the client is built',
          fn: async (ctx,) => {
            using printed = divertingConsoleLog({ sinon: ctx.sinon, },);
            /**
             What the run reached for.
             */
            const reaches = noReaches();

            /**
             What the run refused with when the window is unreadable.
             */
            const refusal = await rejectionOf(async function windowRefused() {
              await runEditorCalibrate({
                line: lineOf({
                  command: 'editor-calibrate',
                  typed: [],
                },),
                readOverlap: function dial(): number {
                  reaches.events.push('overlap',);
                  return 2;
                },
                drawSample: function drawn(): Promise<readonly BenchSlice[]> {
                  reaches.events.push('draw',);
                  return Promise.resolve([SLICE,],);
                },
                pin: PIN,
                adoptGrace: function refusing(): CalibrationGrace {
                  reaches.events.push('grace',);
                  throw new StatedRefusalError({ says: 'the straggler window is unreadable', },);
                },
                readWriterGrace: function neverRead(): WriterGrace {
                  reaches.events.push('writer-grace',);
                  return ROUND_WINDOW_WRITERS;
                },
                newClient: function neverBuilt(): SyntheticClient {
                  reaches.events.push('client',);
                  return shippingLaneClient();
                },
              },);
            },);

            expect(String(refusal,),).toBe('StatedRefusalError: the straggler window is unreadable',);
            expect(reaches.events,).toEqual(['overlap', 'draw', 'grace',],);
            expect(printed.lines,).toEqual([
              `editor-calibrate: 1 slice, ${MODELS} models editing and judging each, 2 slices in flight`,
            ],);
          },
        },),

        it({
          name: 'REFUSES in the client build after the header and the window lines are printed, asking no model',
          fn: async (ctx,) => {
            using printed = divertingConsoleLog({ sinon: ctx.sinon, },);
            /**
             What the run reached for.
             */
            const reaches = noReaches();

            /**
             What the run refused with when no key is set.
             */
            const refusal = await rejectionOf(async function keyMissing() {
              await calibrateWith({
                typed: [],
                overlap: 4,
                grace: DEFAULT_GRACE,
                writers: ROUND_WINDOW_WRITERS,
                newClient: function withoutKey(): SyntheticClient {
                  throw new StatedRefusalError({ says: 'no provider key is set', },);
                },
                reaches,
              },);
            },);

            expect(String(refusal,),).toBe('StatedRefusalError: no provider key is set',);
            expect(reaches.events,).toEqual(['overlap', 'draw', 'grace', 'writer-grace', 'client',],);
            expect(printed.lines,).toEqual([
              `editor-calibrate: 1 slice, ${MODELS} models editing and judging each, 4 slices in flight`,
              'straggler window 300000ms (calibration default)',
            ],);
          },
        },),
      ],
    },),
  ],
},);
