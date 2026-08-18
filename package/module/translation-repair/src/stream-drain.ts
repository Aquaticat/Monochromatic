import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { IdleGuard, } from './stream-idle-guard.ts';
import {
  StreamDegenerateError,
  watchRunaway,
} from './stream-runaway-watch.ts';

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
 * Gap worth naming in the run log. Below it the stream is behaving and logging
 * every exchange would bury the run output; at or above it the sample is what
 * `STREAM_IDLE_MS` has to be tuned against.
 */
const NOTABLE_GAP_MS = 0;

/**
 * Time to first byte worth naming in the run log.
 *
 * Zero, meaning every exchange is sampled, because any positive threshold
 * censors the very distribution the sample exists to describe. A 60 s value
 * here produced a log in which every entry was slower than 60 s, which was then
 * briefly mistaken for the healthy range; a 30 s value would have made the same
 * mistake available at 30 s. The open question these samples must answer is
 * whether the 240 s per-call deadline truncates real work, and that question is
 * about the shape of the whole distribution, most of all its tail, so nothing
 * may be filtered out ahead of seeing it.
 *
 * The cost is one log line per model call. That is the price of an honest
 * denominator.
 */
const NOTABLE_FIRST_BYTE_MS = 0;

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
 * @mutates guard - each chunk resets the guard's silence window via
 * guard.notify, and guard.progress reads the totals it accumulated
 *
 * @mutates response - body.getReader locks the body stream to this reader and
 * every read consumes from it, so the response's body is drained and cannot be
 * read again by anyone else
 *
 * @returns Whole decoded body
 *
 * @throws `StreamStalledError` when the guard tripped on silence
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
  }: {
    readonly response: ForeignBorrowed<Response>;
    readonly guard: ForeignBorrowed<IdleGuard>;
    readonly callerSignal: AbortSignal;
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

    // A stall aborts the guard's own controller and never the caller's, so
    // this ordering reports steering as steering and silence as silence.
    if (guardSignal.aborted && (!callerSignal.aborted))
      throw guardSignal.reason;
    throw error;
  }

  // Flush any bytes the incremental decoder was still holding.
  parts.push(decoder.decode(),);

  /**
   * What the stream did, sampled so the idle windows can be tuned against
   * observed behavior instead of the guess they were first set to.
   */
  const progress = guard.progress();
  if ((progress.maxGapMs >= NOTABLE_GAP_MS)
    || (progress.firstByteMs >= NOTABLE_FIRST_BYTE_MS)) {
    /**
     * Sample line, assembled before the call so the logger chain stays one
     * step per line.
     */
    const sample = `stream ${response.url}: firstByte `
      + `${String(progress.firstByteMs,)}ms, `
      + `maxGap ${String(progress.maxGapMs,)}ms, `
      + `${String(progress.chars,)} chars`
      + `, ${String(watch.unreadableFrames(),)} unreadable frames`;

    /**
     * Logger tagged with this drain.
     */
    const dl = tagged({
      tag: drainBody.name,
      l,
    },);
    dl.info(sample,);
  }

  return parts.join('',);
}

//endregion Stream drain
