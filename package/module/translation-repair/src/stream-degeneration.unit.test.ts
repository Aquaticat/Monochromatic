/**
 * Tests for the degeneration detector.
 *
 * The cases that matter are the two ways this can be wrong in production, and
 * they pull in opposite directions. Missing a cycling model leaves the failure
 * this exists to stop; calling healthy output degenerate aborts good work and
 * costs a voice, which is the exact harm the straggler-grace decision spent a
 * whole document avoiding. So the false-positive cases carry as much weight
 * here as the detection ones, and the JSON case is the realistic one: stages
 * ask for structured replies, so repeated keys are normal output rather than a
 * symptom.
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

import { watchForDegeneration, } from '../dist/final/node/index.mjs';

/**
 * Feeds text to a fresh detector and reads what it says.
 *
 * @param chunks - text pieces, in arrival order
 *
 * @returns Verdict after the last piece
 *
 * @example
 * ```ts
 * const verdict = verdictAfter({ chunks: ['a cat ', 'and a mat',], },);
 * ```
 */
function verdictAfter({ chunks, }: { readonly chunks: readonly string[]; },): ReturnType<
  ReturnType<typeof watchForDegeneration>['verdict']
> {
  /**
   * Detector under test.
   */
  const detector = watchForDegeneration();
  chunks.forEach(function feed(text,): void {
    detector.notifyText({ text, },);
  },);
  return detector.verdict();
}

/**
 * Builds varied prose long enough to pass the minimum sample.
 *
 * @param lines - how many sentences to write
 *
 * @returns Text whose every sentence differs
 *
 * @example
 * ```ts
 * const prose = variedProse({ lines: 400, },);
 * ```
 */
function variedProse({ lines, }: { readonly lines: number; },): string {
  return Array.from(
    { length: lines, },
    function sentence(
      _unused,
      at,
    ): string {
      return `Tabby number ${String(at,)} climbed the ${String(at * 3,)}th shelf `
        + `and knocked down ${String(at % 7,)} jars before napping for ${String(at % 13,)} hours. `;
    },
  ).join('',);
}

await describe({
  name: watchForDegeneration.name,
  children: [
    it({
      name: 'WITHHOLDS a verdict until the sample is large enough, because a short reply that opens '
        + 'with a repeated heading would otherwise be condemned on its first few windows',
      fn: () => {
        /**
         * Far too little text to judge.
         */
        const verdict = verdictAfter({ chunks: ['The cat naps. ',], },);
        expect(verdict.kind,).toBe('undecided',);
      },
    },),

    it({
      name: 'ACCEPTS varied prose, which is the negative control: if this ever reports degenerate '
        + 'the threshold is wrong and every healthy stream is being aborted',
      fn: () => {
        const verdict = verdictAfter({ chunks: [variedProse({ lines: 600, },),], },);
        expect(verdict.kind,).toBe('healthy',);
      },
    },),

    it({
      name: 'REFUSES a stream cycling on one phrase, which is the failure the provider does not '
        + 'end and no token cap is currently set to bound',
      fn: () => {
        const verdict = verdictAfter({
          chunks: ['The cat sat on the mat. '.repeat(4_000,),],
        },);
        expect(verdict.kind,).toBe('degenerate',);
        if (verdict.kind !== 'degenerate')
          throw new Error('degenerate by construction',);
        expect(verdict.distinctRatio,).toBeLessThan(0.1,);
        expect(verdict.charsSeen,).toBeGreaterThan(0,);
      },
    },),

    it({
      name: 'REFUSES a stream that degenerates only AFTER a healthy opening, which is why the '
        + 'sample trails: a cumulative ratio over a long good beginning can never fall far enough '
        + 'to trip, however long the model then cycles',
      fn: () => {
        const verdict = verdictAfter({
          chunks: [
            variedProse({ lines: 3_000, },),
            'A ginger cat batted the same bell over and over. '.repeat(4_000,),
          ],
        },);
        expect(verdict.kind,).toBe('degenerate',);
      },
    },),

    it({
      name: 'ACCEPTS structured output with repeated keys, the realistic false positive: stages ask '
        + 'for JSON replies, so a reply full of identical field names is ordinary output and not a '
        + 'symptom of anything',
      fn: () => {
        /**
         * A structured reply shaped like the ones stages actually request, with
         * every value different and every key the same.
         */
        const structured = `{"findings":[${
          Array.from(
            { length: 700, },
            function finding(
              _unused,
              at,
            ): string {
              return `{"index":${String(at,)},"kind":"whisker-drift","evidence":"the tabby on shelf `
                + `${String(at,)} was described as ${String(at % 5,)} years old","confidence":0.${String(at % 90,)}}`;
            },
          ).join(',',)
        }]}`;

        const verdict = verdictAfter({ chunks: [structured,], },);
        expect(verdict.kind,).toBe('healthy',);
      },
    },),

    it({
      name: 'READS THE SAME VERDICT however the text is split, since chunk boundaries are an '
        + 'accident of the network and a detector that saw them would report differently on '
        + 'identical output',
      fn: () => {
        /**
         * One cycling reply.
         */
        const whole = 'A calico chased its tail in the hallway. '.repeat(3_000,);

        /**
         * The same reply, delivered in small pieces.
         */
        const split = Array.from(
          { length: Math.ceil(whole.length / 17,), },
          function piece(
            _unused,
            at,
          ): string {
            return whole.slice(
              at * 17,
              (at + 1) * 17,
            );
          },
        );

        expect(verdictAfter({ chunks: [whole,], },).kind,).toBe('degenerate',);
        expect(verdictAfter({ chunks: split, },).kind,).toBe('degenerate',);

        /**
         * And the same agreement on healthy text.
         */
        const prose = variedProse({ lines: 600, },);
        const proseSplit = Array.from(
          { length: Math.ceil(prose.length / 23,), },
          function piece(
            _unused,
            at,
          ): string {
            return prose.slice(
              at * 23,
              (at + 1) * 23,
            );
          },
        );
        expect(verdictAfter({ chunks: [prose,], },).kind,).toBe('healthy',);
        expect(verdictAfter({ chunks: proseSplit, },).kind,).toBe('healthy',);
      },
    },),

    it({
      name: 'IGNORES empty arrivals, which a stream produces at its end and which must not count '
        + 'toward the sample',
      fn: () => {
        /**
         * Detector fed nothing but empty strings.
         */
        const detector = watchForDegeneration();
        detector.notifyText({ text: '', },);
        detector.notifyText({ text: '', },);

        /**
         * What it says with no text at all.
         */
        const verdict = detector.verdict();
        expect(verdict.kind,).toBe('undecided',);
        if (verdict.kind !== 'undecided')
          throw new Error('undecided by construction',);
        expect(verdict.windows,).toBe(0,);
      },
    },),

    it({
      name: 'HOLDS MEMORY FLAT across a stream that never ends, which is the whole population this '
        + 'guard exists for: a detector that grew with the stream would fail on exactly the calls '
        + 'it is meant to stop',
      fn: () => {
        /**
         * Detector fed far more text than the trailing sample can hold.
         */
        const detector = watchForDegeneration();
        const prose = variedProse({ lines: 500, },);
        Array.from(
          { length: 40, },
          function round(
            _unused,
            at,
          ): number {
            detector.notifyText({ text: `${prose}${String(at,)}`, },);
            return at;
          },
        );

        /**
         * Sample size after all of it, which must be the cap and not the total.
         */
        const verdict = detector.verdict();
        expect(verdict.kind,).toBe('healthy',);
        if (verdict.kind !== 'healthy')
          throw new Error('healthy by construction',);
        expect(verdict.windows,).toBe(2_048,);
      },
    },),
  ],
},);
