import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import { encodeImageAsset, } from './image-asset.ts';
import { readingMakesSense, } from './image-reading-sense.ts';
import {
  SYNTHETIC_MODELS,
  type SyntheticModelId,
} from './synthetic-catalog.ts';

//region Image reading stage
// ONE CALL THAT READS A PICTURE, screened before anybody is allowed to use what
// it says.
//
// READING IS ITS OWN STAGE, which is what makes `#111` workable at all. The
// vision sub-roster is exactly two models, selection needs a minimum weight of
// two, and a producer's ballot for its own work counts half, so if those two
// also translated, no disinterested judge would remain on any slice carrying a
// picture. Asking them only to READ turns the picture into text, and the
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
    | 'too-large-for-model'
    | 'too-short'
    | 'reads-as-refusal'
    | 'empty-reply';
};

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
    tag: readImageAsset.name,
    l,
  },);

  /**
   * What the catalog says about this model.
   */
  const model = SYNTHETIC_MODELS[modelId];

  // ASKED OF THE CATALOG RATHER THAN OF THE PROVIDER. A text-only model sent an
  // image part answers about nothing, or errors, and either way the call is
  // spent. The catalog's answer comes from the provider's own
  // `input_modalities`, so this is a lookup rather than a guess.
  if (!model.readsImages) {
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
    contextLength: model.contextLength,
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
