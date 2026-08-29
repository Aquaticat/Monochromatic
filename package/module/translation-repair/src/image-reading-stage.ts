import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import { encodeImageAsset, } from './image-asset.ts';
import { readingMakesSense, } from './image-reading-sense.ts';
import { readsImages, } from './roster-reach.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Image reading stage
// ONE CALL THAT READS A PICTURE, screened before anybody is allowed to use what
// it says.
//
// READING IS ITS OWN STAGE, which is what makes `#111` workable at all. The
// cross-provider vision sub-roster is four models, selection needs a minimum weight of
// two, and a producer's ballot for its own work counts half. Combining image
// transcription with translation would entangle reading provenance with candidate
// authorship and its weights. Asking them only to READ turns the picture into text, and the
// ordinary six-model roster then translates and judges from that text with its
// weights and its disinterest untouched.
//
// THE READING IS EVIDENCE, NOT AN ANSWER. It goes beside the source and the
// archive as something a later stage may consult. Nothing here decides what
// ships.
//
// SCREENED BEFORE IT LEAVES. `readingMakesSense` implements the rule written in
// `doc/planning/when-an-image-reading-makes-no-sense.md`, and a reading that
// fails it is reported as unavailable rather than returned with a caveat: a
// caveat downstream is a caveat somebody has to remember.

/**
 * What the reader is asked to do.
 *
 * EXPORTED SO THE CACHE KEY CAN FOLD IT IN. A stored reading was produced by
 * ASKING something, and an edit to this sentence changes what was asked. A key
 * that ignored it would serve a reading of the old question as an answer to the
 * new one.
 *
 * TRANSCRIBE RATHER THAN DESCRIBE, and in the picture's own language. A
 * description ("a screenshot of a profile card") shares no anchors with a
 * transcript and would be refused by the screen anyway, having cost a call. The
 * house policy is deliberately absent: those rules govern how this corpus is
 * WRITTEN, and reading what a picture already says is not writing.
 */
export const READING_INSTRUCTION: string = 'Transcribe every word visible in this image, in the language it is '
  + 'written in, preserving line breaks and the order things appear. Include names, handles, dates, '
  + 'numbers and addresses exactly as written. Do not translate, summarise, describe the image, or '
  + 'add any commentary. If you cannot read the image, say so plainly and say nothing else.';

/**
 * Most bytes a picture may occupy in a reading request.
 *
 * WHAT THE GATEWAY WILL CARRY, not what the model will read. The model is the
 * authority on the second and says so plainly when asked: every asset in the
 * pinned corpus is accepted at its natural size, including the largest at
 * 1344454 bytes, and `gqt/photo1.webp` at 1274028 was read for 2631
 * characters. The derivation this replaced allowed 294912 for the same model,
 * so it refused 45 of 191 pictures that nobody upstream had any trouble with.
 *
 * THE GATEWAY IS THE AUTHORITY ON THE FIRST, and unlike the model it does not
 * answer plainly. A body over its cap comes back as `400` naming a parse
 * failure at a byte offset, which describes our JSON rather than its size, so
 * a request refused for being too big reads as a request that was malformed.
 * `doc/troubleshooting/synthetic-request-body-size-cap.md` is the measurement.
 *
 * SEVEN MEBIBYTES, which is more than five times the corpus's largest asset.
 * The overhead around the picture is a constant 501 bytes and base64 costs a
 * third on top, so this ceiling maps onto a body of 9787235 bytes, leaving
 * 698525 under the only size measured to pass. The eight mebibytes here until
 * 2026-08-22 mapped onto 11185335, which is 699575 ABOVE it: the number
 * guarding the request permitted requests the gateway rejects.
 *
 * NOT THE EXACT FIT OF 7863927. Only the passing size is exact, the failing
 * one is reported as approximate, and the boundary between them has never been
 * bisected, so a ceiling with one byte of headroom would rest on an assumption.
 * Seven mebibytes also absorbs growth in the instruction text, which is part of
 * that constant.
 */
const READING_MAX_BYTES = 7_340_032;

/**
 * What one reading attempt produced.
 *
 * @example
 * ```ts
 * const reading: ImageReading = { kind: 'read', text: 'Name: Mittens', };
 * ```
 */
export type ImageReading = {
  readonly kind: 'read';

  /**
   * What the model transcribed, having passed the screen.
   */
  readonly text: string;
} | {
  readonly kind: 'unavailable';

  /**
   * Why no reading is available, so a finding names the reason and a later
   * reader can tell a picture nobody could send from one nobody could read.
   */
  readonly reason:
    | 'model-does-not-read-images'
    | 'unknown-media-type'
    | 'too-large-for-transport'
    | 'too-short'
    | 'reads-as-refusal'
    | 'empty-reply'
    | 'reader-failed';
};

/**
 * Reasons that describe the provider's evening rather than the picture.
 *
 * A reader that threw, answered nothing, answered too little or refused may
 * read the same picture tomorrow; a model that does not read images, a media
 * type nobody names, and a file too large to send will not change. The split
 * decides what a pair verdict built on the reason is allowed to remember.
 */
const TRANSIENT_READING_REASONS: ReadonlySet<string> = new Set([
  'too-short',
  'reads-as-refusal',
  'empty-reply',
  'reader-failed',
],);

/**
 * Whether a reader's reason for producing nothing may not hold tomorrow.
 *
 * @param reason - why the reader produced nothing
 *
 * @returns Whether the reason describes the call rather than the picture
 *
 * @example
 * ```ts
 * const transient = isTransientReadingReason({ reason: 'reader-failed', },);
 * ```
 */
export function isTransientReadingReason(
  { reason, }: { readonly reason: Extract<ImageReading, { readonly kind: 'unavailable'; }>['reason']; },
): boolean {
  return TRANSIENT_READING_REASONS.has(reason,);
}

/**
 * Reads one picture with one model, screening what comes back.
 *
 * @param client - transport to the provider
 *
 * @param modelId - model doing the reading, which must read images
 *
 * @param bytes - picture as read from disk
 *
 * @param assetName - its file name, which carries the media type
 *
 * @param signal - abort honoured for the whole exchange
 *
 * @param perCallTimeoutMs - deadline bounding the exchange
 *
 * @param l - lane logger
 *
 * @returns Reading that passed the screen, or why none is available
 *
 * @throws {@link import('./synthetic-client.ts').SyntheticHttpError} on a
 * non-success status, which is a transport failure rather than an unreadable
 * picture and is not this function's to interpret
 *
 * @example
 * ```ts
 * const reading = await readImageAsset({ client, modelId, bytes, assetName, signal, perCallTimeoutMs, l, },);
 * ```
 */
export async function readImageAsset(
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
    readonly modelId: RosterModelId;
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
    tag: readImageAsset.name,
    l,
  },);

  // ASKED OF BOTH CATALOGS RATHER THAN OF THE PROVIDER. A text-only model sent
  // an image part answers about nothing, or errors, and either way the call is
  // spent. Each catalog's answer comes from that provider's own reported
  // modalities, so this is a lookup rather than a guess.
  //
  // BOTH, because one provider can add or remove image support independently.
  // Asking only one catalog could refuse a reading another serving path can buy.
  if (!readsImages({ modelId, },)) {
    rl.warn(`${modelId} does not read images, so ${assetName} was not sent`,);
    return {
      kind: 'unavailable',
      reason: 'model-does-not-read-images',
    };
  }

  /**
   * Picture as a content part carries it, or why it cannot be sent.
   */
  const encoded = encodeImageAsset({
    bytes,
    assetName,
    maxBytes: READING_MAX_BYTES,
  },);
  if (encoded.kind === 'refused') {
    rl.warn(`${assetName} cannot be sent to ${modelId}: ${encoded.reason}`,);
    return {
      kind: 'unavailable',
      reason: encoded.reason,
    };
  }

  /**
   * Reply from the reader.
   */
  const reply = await client.chatText({
    modelId,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: READING_INSTRUCTION,
        },
        {
          type: 'image_url',
          image_url: { url: encoded.dataUri, },
        },
      ],
    },],
    signal,
    exchangeTimeoutMs: perCallTimeoutMs,
  },);

  if (reply.text === '') {
    rl.warn(`${modelId} returned nothing for ${assetName}`,);
    return {
      kind: 'unavailable',
      reason: 'empty-reply',
    };
  }

  /**
   * Whether the reading may be used at all.
   */
  const verdict = readingMakesSense({ reading: reply.text, },);
  if (verdict.kind === 'refused') {
    rl.warn(
      `${modelId} read ${assetName} but the reading was refused: ${verdict.clause}`,
    );
    return {
      kind: 'unavailable',
      reason: verdict.clause,
    };
  }

  /**
   * How much was transcribed, for a line a reader can compare across pictures.
   */
  const { length, } = reply.text;
  rl.info(`${modelId} read ${assetName}: ${String(length,)} characters`,);
  return {
    kind: 'read',
    text: reply.text,
  };
}

//endregion Image reading stage
