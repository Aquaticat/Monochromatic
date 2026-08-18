import { tagged, } from '@monochromatic-dev/module-logger/ts';

import type { StreamProgress, } from './stream-idle-guard.ts';

//region Stream cut
// WHAT A CALL HAD ALREADY PRODUCED WHEN IT WAS CUT, and the one place that
// reports what a stream did.
//
// TWO LOSSES USED TO HAPPEN AT EVERY ABORT. `drainBody` accumulated its decoded
// chunks and the catch rethrew, dropping every one of them, so a call that had
// already delivered "It's a cat. It did a backflip. It cras" delivered nothing.
// And the progress sample was emitted after the try, so an aborted stream logged
// NO line at all.
//
// THE SECOND ONE INVALIDATED A MEASUREMENT rather than merely hiding one. Every
// latency figure read off a pass log was computed over surviving calls only. A
// 2026-08-17 reading of "1349 streams, mean firstByte 1822ms" excluded every
// abandoned call by construction, which is survivorship bias over exactly the
// population it was quoted to describe.
//
// WHAT THE PARTIAL TEXT SETTLES, immediately and with no further instrument: a
// call that never got a first byte leaves an empty string, and one cut off
// mid-reasoning leaves a truncated thinking block. Those want opposite remedies,
// the first to drop or replace the straggler and the second to allow it longer,
// and until now nothing on disk could tell them apart.

/**
 * Logger root for stream reporting.
 */
const l = tagged({ tag: 'translation-repair', },);

/**
 * Characters of the partial text to show in the log line.
 *
 * ENOUGH TO SEE WHAT KIND OF TEXT IT IS and no more. The opening tells a
 * thinking block from an answer from an empty cut, which is the whole diagnostic
 * question, while a longer excerpt would put licensed corpus material into a run
 * log that gets read, grepped and pasted into documents.
 */
const OPENING_CHARS = 80;

/**
 * How a stream ended.
 */
export type StreamOutcome = 'completed' | 'cut';

/**
 * Raised when a stream was cut off, carrying what it had already delivered.
 *
 * WRAPS RATHER THAN REPLACES. The original failure is the `cause`, so a stall
 * still reads as a stall and steering still reads as steering, and the message
 * repeats the cause's own text so anything printing this error with `String`
 * says what it used to say.
 *
 * @example
 * ```ts
 * throw new StreamCutShortError({
 *   label: 'hf:whiskers',
 *   partialText: 'It is a cat. It did a backflip. It cras',
 *   progress: { firstByteMs: 812, maxGapMs: 43, chars: 9_211, },
 *   cause: new Error('aborted',),
 * },);
 * ```
 */
export class StreamCutShortError extends Error {
  /**
   * Model or endpoint whose stream was cut.
   */
  readonly label: string;

  /**
   * Everything the stream delivered before it stopped, which is empty when it
   * never produced a byte.
   */
  readonly partialText: string;

  /**
   * What the stream did up to the cut.
   */
  readonly progress: StreamProgress;

  /**
   * @param label - model or endpoint
   *
   * @param partialText - text delivered before the cut
   *
   * @param progress - what the stream did
   *
   * @param cause - original failure, kept so its identity survives
   *
   * @example
   * ```ts
   * const error = new StreamCutShortError({ label, partialText, progress, cause, },);
   * ```
   */
  constructor(
    {
      label,
      partialText,
      progress,
      cause,
    }: {
      readonly label: string;
      readonly partialText: string;
      readonly progress: StreamProgress;
      readonly cause: unknown;
    },
  ) {
    super(
      `${label}: stream cut after ${String(partialText.length,)} characters (${String(cause,)})`,
      { cause, },
    );
    this.name = 'StreamCutShortError';
    this.label = label;
    this.partialText = partialText;
    this.progress = progress;
  }
}

/**
 * Reports what one stream did, on the path that finished and the path that did
 * not.
 *
 * ONE FUNCTION FOR BOTH, which is the point: two call sites drifted before, and
 * the one that never logged was the one carrying the calls worth measuring.
 *
 * @param label - model or endpoint
 *
 * @param progress - what the stream did
 *
 * @param unreadableFrames - payload lines the scanner could not read
 *
 * @param outcome - whether the stream finished
 *
 * @param partialText - text delivered, used only for its length and opening
 *
 * @example
 * ```ts
 * reportStreamProgress({ label, progress, unreadableFrames: 0, outcome: 'cut', partialText, },);
 * ```
 */
export function reportStreamProgress(
  {
    label,
    progress,
    unreadableFrames,
    outcome,
    partialText,
  }: {
    readonly label: string;
    readonly progress: StreamProgress;
    readonly unreadableFrames: number;
    readonly outcome: StreamOutcome;
    readonly partialText: string;
  },
): void {
  /**
   * Opening of what arrived, with newlines flattened so one stream is one line.
   */
  const opening = partialText
    .slice(
      0,
      OPENING_CHARS,
    )
    .split('\n',)
    .join(' ',);

  /**
   * Opening excerpt, shown only on a cut, where what arrived is the diagnosis.
   */
  const excerpt = (outcome === 'cut') ? `, opening ${JSON.stringify(opening,)}` : '';

  /**
   * Sample line, assembled before the call so the logger chain stays one step
   * per line.
   */
  const sample = `stream ${label}: ${outcome}, firstByte ${String(progress.firstByteMs,)}ms, `
    + `maxGap ${String(progress.maxGapMs,)}ms, ${String(progress.chars,)} raw chars, `
    + `${String(unreadableFrames,)} unreadable frames, `
    + `${String(partialText.length,)} delivered chars${excerpt}`;

  /**
   * Logger tagged with this report.
   */
  const rl = tagged({
    tag: reportStreamProgress.name,
    l,
  },);
  rl.info(sample,);
}

//endregion Stream cut
