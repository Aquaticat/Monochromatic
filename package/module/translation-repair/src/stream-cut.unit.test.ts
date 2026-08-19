/**
 * Tests for the stream progress report, the one place that says how a call
 * ended.
 *
 * TESTED THROUGH ITS RETURN VALUE rather than by capturing a logger's side
 * effect: `reportStreamProgress` hands back the exact line it logs, so an
 * assertion here reads as a statement about the LINE rather than about
 * whatever the logging subsystem happened to do with it.
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

import { reportStreamProgress, } from '../dist/final/node/index.mjs';

/**
 * Progress a call made before it stopped, plain numbers standing in for what
 * the idle guard would have measured.
 */
const SOME_PROGRESS = {
  firstByteMs: 40,
  maxGapMs: 4,
  chars: 512,
};

await describe({
  name: reportStreamProgress.name,
  children: [
    it({
      name: 'NAMES A TERMINATION THIS SYSTEM CHOSE AS ITS OWN OUTCOME, distinct from a stall or '
        + 'steering: a stall is worth retrying and a model that has begun repeating itself will '
        + 'repeat itself again, so a reader counting `cut` lines to measure stalls must not count '
        + 'a deliberate ending among them',
      fn: async () => {
        /**
         * The line a genuine cut logs.
         */
        const cutLine = reportStreamProgress({
          label: 'hf:whiskers',
          progress: SOME_PROGRESS,
          unreadableFrames: 0,
          outcome: 'cut',
          partialText: 'It is a cat. It did a backflip. It cras',
        },);

        /**
         * The line this guard's own termination logs, everything else equal.
         */
        const degenerateLine = reportStreamProgress({
          label: 'hf:whiskers',
          progress: SOME_PROGRESS,
          unreadableFrames: 0,
          outcome: 'degenerate',
          partialText: 'The cat sat on the mat. '.repeat(20,),
        },);

        expect(cutLine.includes('hf:whiskers: cut,',),).toBe(true,);
        expect(degenerateLine.includes('hf:whiskers: degenerate,',),).toBe(true,);

        // Neither word appears on the other line: they are different
        // outcomes, not one outcome spelled two ways.
        expect(cutLine.includes('degenerate',),).toBe(false,);
        expect(degenerateLine.includes(': cut,',),).toBe(false,);
      },
    },),

    it({
      name: 'SHOWS THE OPENING EXCERPT ON A DEGENERATE ENDING, not only on a cut, because seeing '
        + 'what the model was saying when it started repeating is exactly as diagnostic as seeing '
        + 'what it was saying when the connection dropped',
      fn: async () => {
        /**
         * Line for a call this guard ended.
         */
        const line = reportStreamProgress({
          label: 'hf:whiskers',
          progress: SOME_PROGRESS,
          unreadableFrames: 0,
          outcome: 'degenerate',
          partialText: 'The cat sat on the mat. '.repeat(20,),
        },);

        expect(line.includes('opening',),).toBe(true,);
      },
    },),

    it({
      name: 'OMITS THE OPENING EXCERPT ON A CLEAN FINISH, since what a healthy reply said is not a '
        + 'diagnostic question and every finished call would otherwise carry one',
      fn: async () => {
        /**
         * Line for a call that simply finished.
         */
        const line = reportStreamProgress({
          label: 'hf:mittens',
          progress: SOME_PROGRESS,
          unreadableFrames: 0,
          outcome: 'completed',
          partialText: 'A tabby naps in the window.',
        },);

        expect(line.includes('opening',),).toBe(false,);
      },
    },),
  ],
},);
