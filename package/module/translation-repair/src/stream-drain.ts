import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { IdleGuard, } from './stream-idle-guard.ts';
import {
  StreamDegenerateError,
  watchRunaway,
} from './stream-runaway-watch.ts';
import {
  reportStreamProgress,
  StreamCutShortError,
} from './stream-cut.ts';

//region Stream drain
// Reads a response body chunk by chunk instead of in one `response.text()`
// call, which is what makes silence observable at all: a whole-body read cannot
// tell a stream that is still emitting from one that died, so the only signal
// left was total elapsed time. Parsers above the transport seam are unaffected,
// because the chunks are concatenated and handed back whole.

/**
 * Logger root for the stream drain.
 */
const l = tagged({ tag: 'translation-repair', },);

/**
 * Stops pulling from a stream that will not stop on its own.
 *
 * ITS OWN FUNCTION, and it swallows nothing: a cancel that fails is logged
 * rather than allowed to replace the reason the stream is being abandoned,
 * which is the more useful of the two errors.
 *
 * @param reader - reader to release
 *
 * @param url - stream being abandoned, for the log line
 *
 * @mutates reader - cancels it, so the body cannot be read further
 *
 * @example
 * ```ts
 * await stopReading({ reader, url: response.url, },);
 * ```
 */
async function stopReading(
  {
    reader,
    url,
  }: {
    readonly reader: ForeignBorrowed<ReadableStreamDefaultReader<Uint8Array>>;
    readonly url: string;
  },
): Promise<void> {
  try {
    await reader.cancel();
  }
  catch (error) {
    /**
     * Logger tagged with this drain.
     */
    const cl = tagged({
      tag: drainBody.name,
      l,
    },);
    cl.warn(`could not cancel ${url}: ${String(error,)}`,);
  }
}

/**
 * Drains a response body chunk by chunk, telling the guard about each arrival
 * so silence is measured rather than inferred from total elapsed time. The
 * decoded text is concatenated and handed back whole, so every parser above
 * the transport seam sees exactly what it saw when the body was read with
 * `response.text()`.
 *
 * @param response - response whose body is drained
 *
 * @param guard - silence guard notified per chunk
 *
 * @param callerSignal - caller's own signal, to tell steering from a stall
 *
 * @param label - model this call went to, so a latency figure can be read per
 * model rather than per endpoint. Reasoning from abandon counts instead is what
 * produced the retracted conclusion that one vendor's models were slow
 *
 * @mutates guard - each chunk resets the guard's silence window via
 * guard.notify, and guard.progress reads the totals it accumulated
 *
 * @mutates response - body.getReader locks the body stream to this reader and
 * every read consumes from it, so the response's body is drained and cannot be
 * read again by anyone else
 *
 * @returns Whole decoded body
 *
 * @throws `StreamCutShortError` when the stream was cut off, carrying whatever
 * it had already delivered and wrapping the original failure as its cause
 *
 * @throws `StreamDegenerateError` when the model stopped saying anything new,
 * which no silence window can detect because such a stream is never silent
 *
 * @example
 * ```ts
 * const bodyText = await drainBody({ response, guard, callerSignal, },);
 * ```
 */
export async function drainBody(
  {
    response,
    guard,
    callerSignal,
    label,
  }: {
    readonly response: ForeignBorrowed<Response>;
    readonly guard: ForeignBorrowed<IdleGuard>;
    readonly callerSignal: AbortSignal;
    readonly label: string;
  },
): Promise<string> {
  /**
   * Body stream; absent on a reply the platform gave no body at all, which
   * still has to read as the empty string rather than fail.
   */
  const { body, } = response;
  if (body === null)
    return await response.text();

  /**
   * Reader pulling one chunk at a time.
   */
  const reader = body.getReader();

  /**
   * Incremental decoder, so a multi-byte character split across chunks is
   * still decoded correctly.
   */
  const decoder = new TextDecoder();

  /**
   * Decoded chunks, joined once at the end: repeated string concatenation
   * would rebuild the whole accumulated body on every chunk.
   */
  const parts: string[] = [];

  /**
   * Watches for a model that has stopped saying anything new, on either the
   * answer channel or the thinking one.
   *
   * SEPARATE FROM THE IDLE GUARD because they detect opposite things. The idle
   * guard asks whether bytes are arriving; a degenerating model answers yes
   * forever. Neither can stand in for the other.
   */
  const watch = watchRunaway();

  /**
   * Loop cursor, a named record so the body-root binding stays immutable.
   */
  const cursor = { done: false, };

  try {
    while (!cursor.done) {
      /**
       * Next chunk, or the end-of-stream marker.
       */
      // oxlint-disable-next-line no-await-in-loop -- chunks arrive in order; each read depends on the previous one completing
      const chunk = await reader.read();
      cursor.done = chunk.done;
      if (chunk.value === undefined)
        continue;

      /**
       * This chunk decoded, held so its length feeds the guard.
       */
      const text = decoder.decode(
        chunk.value,
        { stream: true, },
      );
      guard.notify(text.length,);
      parts.push(text,);

      /**
       * Whether this call has stopped producing anything new.
       */
      const runaway = watch.notifyChunk({ chunk: text, },);
      if (runaway.kind === 'runaway') {
        // Released before reporting, so the socket does not stay open feeding a
        // model that will not stop. The provider ends neither, and no token cap
        // bounds it, so this is the only place the call can end.
        // oxlint-disable-next-line no-await-in-loop -- the loop ends on this branch
        await stopReading({
          reader,
          url: response.url,
        },);
        throw new StreamDegenerateError({
          label: response.url,
          channel: runaway.channel,
          distinctRatio: runaway.distinctRatio,
          charsSeen: runaway.charsSeen,
        },);
      }
    }
  }
  catch (error) {
    /**
     * Guard's own signal, whose abort means silence rather than steering.
     */
    const guardSignal = guard.signal;

    /**
     * What the stream had already delivered, which used to be discarded here.
     */
    const partialText = parts.join('',);

    // Reported BEFORE the throw, and on this path as well as the other, because
    // a figure computed only over streams that finished describes only streams
    // that finished.
    reportStreamProgress({
      label,
      progress: guard.progress(),
      unreadableFrames: watch.unreadableFrames(),
      outcome: 'cut',
      partialText,
    },);

    // OUR OWN DELIBERATE TERMINATION PASSES THROUGH UNCHANGED. A runaway is
    // thrown from inside this try, and it already carries the channel, the
    // ratio and the cost. Wrapping it would bury a finished diagnosis inside a
    // description of a cut, and every reader would have to unwrap it to learn
    // what the drain already knew.
    if (error instanceof StreamDegenerateError)
      throw error;

    // A stall aborts the guard's own controller and never the caller's, so this
    // ordering keeps steering identifiable as steering and silence as silence.
    // The chosen failure becomes the cause rather than being replaced.
    throw new StreamCutShortError({
      label,
      partialText,
      progress: guard.progress(),
      cause: (guardSignal.aborted && (!callerSignal.aborted)) ? guardSignal.reason : error,
    },);
  }

  // Flush any bytes the incremental decoder was still holding.
  parts.push(decoder.decode(),);

  /**
   * Whole decoded body.
   */
  const bodyText = parts.join('',);

  reportStreamProgress({
    label,
    progress: guard.progress(),
    unreadableFrames: watch.unreadableFrames(),
    outcome: 'completed',
    partialText: bodyText,
  },);

  return bodyText;
}

//endregion Stream drain
