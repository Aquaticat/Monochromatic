/**
 * Tests for reading a run's own timing lines back, which is what `#215` built
 * so a run could say where its wall-clock went.
 *
 * THE OVERLAP CASE IS THE POINT. Achieved concurrency is an overlap count over
 * call intervals, and before `#215` a completion line said only when a call
 * ended, so no interval existed and the question had no answer. The figures
 * asserted here are hand-computed from the fixture rather than recorded from a
 * run, so a change in the sweep fails the case instead of moving the target.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type CallTiming,
  measureInFlight,
  readCallTiming,
  readRoundTiming,
  readRunTiming,
} from '../../dist/final/node/index.mjs';

//region Fixtures

/**
 * A round line exactly as `runGatherRound` writes it.
 */
const ROUND_LINE = '[info] [2026-08-25T10:00:30.000Z] [translation-repair] [editor] '
  + 'editor round: 6/7 heard, 91402ms total, 61401ms to quorum, 30001ms in grace';

/**
 * A completion line as `reportStreamProgress` writes it since `#215`.
 */
const TIMED_CALL_LINE = '[info] [2026-08-25T10:00:10.000Z] [translation-repair] '
  + '[reportStreamProgress] stream hf:whiskers: completed, elapsed 10000ms, firstByte 40ms, '
  + 'maxGap 4ms, 512 raw chars, 0 unreadable frames, 40 content chars, 7 reasoning chars';

/**
 * A completion line as every log written before `#215` carries it, with no
 * duration anywhere on it.
 */
const UNTIMED_CALL_LINE = '[info] [2026-08-25T10:00:11.000Z] [translation-repair] '
  + '[reportStreamProgress] stream hf:mittens: completed, firstByte 40ms, maxGap 4ms, '
  + '512 raw chars, 0 unreadable frames, 40 content chars, 7 reasoning chars';

/**
 * Base instant the interval fixtures are measured from.
 */
const BASE_MS = Date.parse('2026-08-25T10:00:00.000Z',);

/**
 * Milliseconds in a second, so the interval fixtures read as seconds.
 */
const SECOND = 1_000;

/**
 * Builds one call interval.
 *
 * @param endsAtSeconds - seconds past the base instant the call ended
 *
 * @param ranSeconds - how long the call ran
 *
 * @returns Call the sweep can read
 *
 * @example
 * ```ts
 * const call = callRunning({ endsAtSeconds: 10, ranSeconds: 10, },);
 * ```
 */
function callRunning(
  {
    endsAtSeconds,
    ranSeconds,
  }: {
    readonly endsAtSeconds: number;
    readonly ranSeconds: number;
  },
): CallTiming {
  return {
    label: 'hf:whiskers',
    outcome: 'completed',
    endedAt: BASE_MS + (endsAtSeconds * SECOND),
    elapsedMs: ranSeconds * SECOND,
  };
}

//endregion Fixtures

await describe({
  name: '',
  children: [
    describe({
      name: readRoundTiming.name,
      children: [
        it({
          name: 'reads the stage, the ratio and all three durations off a round line',
          fn: async () => {
            /**
             * What the line said.
             */
            const reading = readRoundTiming({ line: ROUND_LINE, },);
            if (reading.kind !== 'round')
              throw new Error('the fixture round line was not read as a round',);

            expect(reading.round.stage,).toBe('editor',);
            expect(reading.round.heard,).toBe(6,);
            expect(reading.round.asked,).toBe(7,);
            expect(reading.round.totalMs,).toBe(91_402,);
            expect(reading.round.toQuorumMs,).toBe(61_401,);
            expect(reading.round.inGraceMs,).toBe(30_001,);
          },
        },),

        it({
          name: 'REFUSES A TRUNCATED ROUND LINE rather than reading the fields that survived: a '
            + 'log still being written ends mid-line, and a round whose grace field was cut off '
            + 'would report a straggler cost of whatever the parse happened to reach',
          fn: async () => {
            expect(
              readRoundTiming({
                line: '[info] [2026-08-25T10:00:30.000Z] [translation-repair] [editor] '
                  + 'editor round: 6/7 heard, 91402ms total, 61401ms to q',
              },).kind,
            ).toBe('other-line',);
          },
        },),

        it({
          name: 'passes over a line that is not a round at all',
          fn: async () => {
            expect(readRoundTiming({ line: TIMED_CALL_LINE, },).kind,).toBe('other-line',);
          },
        },),

        it({
          name: 'THROWS ON A FIELD THAT LOST ITS UNIT rather than reading it as a zero, since a '
            + 'zero in a timing report is a measurement of nothing happening',
          fn: async () => {
            expect(function readsBroken(): void {
              readRoundTiming({
                line: '[info] [2026-08-25T10:00:30.000Z] [translation-repair] [editor] '
                  + 'editor round: 6/7 heard, ninety total, 61401ms to quorum, 30001ms in grace',
              },);
            },).toThrow(Error,);
          },
        },),
      ],
    },),

    describe({
      name: readCallTiming.name,
      children: [
        it({
          name: 'reads the label, outcome, end instant and duration off a completion line',
          fn: async () => {
            /**
             * What the line said.
             */
            const reading = readCallTiming({ line: TIMED_CALL_LINE, },);
            if (reading.kind !== 'timed')
              throw new Error('the fixture completion line was not read as timed',);

            expect(reading.call.label,).toBe('hf:whiskers',);
            expect(reading.call.outcome,).toBe('completed',);
            expect(reading.call.elapsedMs,).toBe(10_000,);
            expect(reading.call.endedAt,).toBe(Date.parse('2026-08-25T10:00:10.000Z',),);
          },
        },),

        it({
          name: 'SKIPS A COMPLETION LINE THAT PREDATES THE DURATION FIELD, which every log '
            + 'written before `#215` is, so a concurrency is never computed from the half of a '
            + 'mixed archive that happens to be readable',
          fn: async () => {
            expect(readCallTiming({ line: UNTIMED_CALL_LINE, },).kind,).toBe('untimed',);
          },
        },),

        it({
          name: 'passes over a line that is not a completion at all',
          fn: async () => {
            expect(readCallTiming({ line: ROUND_LINE, },).kind,).toBe('other-line',);
          },
        },),
      ],
    },),

    describe({
      name: readRunTiming.name,
      children: [
        it({
          name: 'SEPARATES ROUNDS FROM CALLS AND COUNTS WHAT IT COULD NOT TIME, so a mixed log '
            + 'reports its own blind spot instead of reporting the readable half as the whole',
          fn: async () => {
            /**
             * Every timing line a mixed log holds.
             */
            const reading = readRunTiming({
              lines: [
                ROUND_LINE,
                TIMED_CALL_LINE,
                UNTIMED_CALL_LINE,
                'a line about nothing in particular',
              ],
            },);

            expect(reading.rounds.length,).toBe(1,);
            expect(reading.calls.length,).toBe(1,);
            expect(reading.callsWithoutDuration,).toBe(1,);
          },
        },),
      ],
    },),

    describe({
      name: measureInFlight.name,
      children: [
        it({
          name: 'COUNTS OVERLAP RATHER THAN AVERAGING ANYTHING: three calls at [0,10], [2,8] and '
            + '[15,20] seconds put two in flight at once and leave the run idle between, which no '
            + 'summed duration divided by a span could tell apart from steady single-file work',
          fn: async () => {
            /**
             * Hand-computed fixture: peak 2 during [2,8], idle during [10,15].
             */
            const flight = measureInFlight({
              calls: [
                callRunning({ endsAtSeconds: 10, ranSeconds: 10, },),
                callRunning({ endsAtSeconds: 8, ranSeconds: 6, },),
                callRunning({ endsAtSeconds: 20, ranSeconds: 5, },),
              ],
            },);

            expect(flight.spanMs,).toBe(20 * SECOND,);
            expect(flight.busyMs,).toBe(21 * SECOND,);
            expect(flight.peakInFlight,).toBe(2,);
            // 21 call-seconds across a 20 second span.
            expect(flight.meanInFlight,).toBeCloseTo(1.05, 2,);
          },
        },),

        it({
          name: 'DOES NOT COUNT TWO CALLS THAT MERELY ABUT AS OVERLAPPING, which is the whole '
            + 'difference between a run that fans out and one that works strictly single-file',
          fn: async () => {
            /**
             * Back-to-back calls: one ends exactly where the next begins.
             */
            const flight = measureInFlight({
              calls: [
                callRunning({ endsAtSeconds: 10, ranSeconds: 10, },),
                callRunning({ endsAtSeconds: 20, ranSeconds: 10, },),
              ],
            },);

            expect(flight.peakInFlight,).toBe(1,);
            expect(flight.meanInFlight,).toBeCloseTo(1, 2,);
          },
        },),

        it({
          name: 'REFUSES AN EMPTY CALL LIST rather than reporting a mean of zero in flight, which '
            + 'a log that simply predates the duration field would otherwise produce',
          fn: async () => {
            expect(function measuresNothing(): void {
              measureInFlight({ calls: [], },);
            },).toThrow(Error,);
          },
        },),
      ],
    },),
  ],
},);
