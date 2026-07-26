import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { IdleGuard, } from './stream-idle-guard.ts';

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
const NOTABLE_GAP_MS = 20_000;

/**
 * Time to first byte worth naming in the run log, for the same reason.
 */
const NOTABLE_FIRST_BYTE_MS = 60_000;

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
      + `${String(progress.chars,)} chars`;

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
