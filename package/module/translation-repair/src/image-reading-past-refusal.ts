import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import {
  type ImageReading,
  readImageAsset,
} from './image-reading-stage.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';

//region Reading past a refusal
// ASKING THE SAME MODEL AGAIN WHEN IT DECLINES TO READ A PICTURE, because a
// refusal is a property of the ROLL and not of the picture.
//
// MEASURED, on `wangzihao980/Word1.webp`, a picture that plainly carries text:
// the deterministic reader gets 205 characters out of it and the other reader
// gets 389 and 393 on consecutive asks. Asked six times with identical input,
// `hf:moonshotai/Kimi-K3` refused four times and read it twice, at 377 and 403
// characters. Nothing about the picture changed between those asks.
//
// WHY IT MATTERS MORE THAN IT LOOKS. Corroboration needs BOTH readers, and the
// vision sub-roster is exactly two because the provider offers exactly two
// models that read images. So one reader refusing two asks in three does not
// cost a third of the readings: it costs two thirds of them, and the picture
// ends `one-reader-only` with a perfectly good transcription thrown away. That
// is what happened to `Word1.webp` on the run that found this.
//
// WHAT THE LIMIT BUYS, at the measured one-in-three success rate: one ask
// retains 33 of 100 readings, two retain 56, three retain 70, four retain 80.
// The expected cost is far below the limit, because asking stops at the first
// reading: about 2.4 asks per picture at four. This only fires on pictures the
// deterministic gate already found text on, 72 of 191 in this corpus.
//
// SCOPED TO REFUSAL ALONE, deliberately. A model that does not read images, a
// picture too large to send, an empty reply, and a reading that fails the screen
// for some other clause are all properties of the input or the roster: asking
// again spends a call to be told the same thing. Only `reads-as-refusal` has
// been measured to vary between identical asks, so only it is re-asked.

/**
 * Clause the screen reports for a reading that declined to transcribe.
 *
 * NAMED HERE RATHER THAN IMPORTED because it is the one clause this file acts
 * on, and a rename that silently stopped the re-asking would otherwise leave no
 * trace. A mismatch shows up as readings that stop being retried.
 */
const REFUSAL_CLAUSE = 'reads-as-refusal';

/**
 * How many times one model may be asked about one picture.
 *
 * FOUR, from the measured refusal rate of two in three: it retains four
 * readings in five where a single ask retains one in three.
 */
export const REFUSAL_ASK_LIMIT = 4;

/**
 * Whether a reading is a refusal that asking again might get past.
 *
 * @param reading - outcome of one ask
 *
 * @returns True when the model declined to transcribe rather than failing for a
 * reason another ask cannot change
 *
 * @example
 * ```ts
 * if (isRefusal({ reading, },)) { ask again }
 * ```
 */
function isRefusal({ reading, }: { readonly reading: ImageReading; },): boolean {
  if (reading.kind !== 'unavailable')
    return false;
  return reading.reason === REFUSAL_CLAUSE;
}

/**
 * Asks one model to read one picture, past a refusal, up to a bounded limit.
 *
 * @param client - provider client
 *
 * @param modelId - reader asked, the same one every time, since the refusal is
 * this model's roll rather than a fact about the picture
 *
 * @param bytes - picture as it sits in the corpus
 *
 * @param assetName - file name, for the log line and the content part
 *
 * @param signal - abort honoured between asks as well as inside them, so a
 * stopped run does not keep re-asking
 *
 * @param perCallTimeoutMs - ceiling on one exchange, applied per ask rather than
 * across all of them
 *
 * @param l - logger
 *
 * @returns Reading, or the last refusal when every ask was declined
 *
 * @throws {@link DOMException} when `signal` aborts between asks
 *
 * @example
 * ```ts
 * const reading = await readPastRefusal({ client, modelId, bytes, assetName, signal, perCallTimeoutMs, l, },);
 * ```
 */
export async function readPastRefusal(
  {
    client,
    modelId,
    bytes,
    assetName,
    signal,
    perCallTimeoutMs,
    l,
  }: {
    readonly client: SyntheticClient;
    readonly modelId: SyntheticModelId;
    readonly bytes: Uint8Array;
    readonly assetName: string;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  },
): Promise<ImageReading> {
  /**
   * Logger pre-tagged with this function's name.
   */
  const rl = tagged({
    tag: readPastRefusal.name,
    l,
  },);

  /**
   * Outcome of the latest ask, replaced by each re-ask.
   */
  let reading = await readImageAsset({
    client,
    modelId,
    bytes,
    assetName,
    signal,
    perCallTimeoutMs,
    l,
  },);

  for (
    let ask = 2;
    (ask <= REFUSAL_ASK_LIMIT) && isRefusal({ reading, },);
    ask += 1
  ) {
    // Between asks as well as inside them. A stopped run that only checked
    // inside the exchange would spend the whole limit on every remaining
    // picture during teardown.
    signal.throwIfAborted();
    rl.info(
      `${modelId} declined ${assetName}, asking again (${String(ask,)} of ${String(REFUSAL_ASK_LIMIT,)})`,
    );

    // SEQUENTIAL ON PURPOSE. Asking the same model concurrently would queue
    // behind its own per-model limiter and spend every ask even after one
    // succeeds, which is the opposite of what the limit is for.
    /* oxlint-disable-next-line no-await-in-loop -- re-asks are sequential by design, see above */
    reading = await readImageAsset({
      client,
      modelId,
      bytes,
      assetName,
      signal,
      perCallTimeoutMs,
      l,
    },);
  }

  return reading;
}

//endregion Reading past a refusal
