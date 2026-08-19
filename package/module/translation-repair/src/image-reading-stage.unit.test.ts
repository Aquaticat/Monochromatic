/**
 * Tests for reading one picture with one model, and screening what comes back.
 *
 * WHAT THESE PIN is that every way a reading can fail to arrive is a NAMED
 * outcome rather than a thrown error or a caveat attached to usable text.
 * Whether a reading is of the RIGHT picture is settled one level up, in
 * `image-reading-pair.ts`, against a second reader rather than against the
 * archive. The
 * stage sits between two things nobody controls, a picture on disk and a model's
 * willingness to read it, and a caller that has to distinguish "nobody could
 * send this" from "nobody could read it" cannot do so from an empty string.
 *
 * THE CAPTURED REQUEST IS THE POINT of the first case. `#107`'s judging window
 * existed for weeks while production never passed it, and nothing failed,
 * because no test asserted on what the call actually carried. A picture that
 * never reaches the wire looks exactly like one the model ignored, so the parts
 * array is asserted rather than assumed.
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
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  type ChatTextRequest,
  readImageAsset,
  type SyntheticClient,
  type SyntheticModelId,
} from '../dist/final/node/index.mjs';

/**
 * Logger the stage writes its progress to.
 */
const l = tagged({ tag: 'image-reading-stage-test', },);

/**
 * Model that reads images, per the provider's own `input_modalities`.
 */
const READER: SyntheticModelId = 'hf:moonshotai/Kimi-K3';

/**
 * Model that does not, so the catalog refuses before a call is spent.
 */
const TEXT_ONLY: SyntheticModelId = 'hf:openai/gpt-oss-120b';

/**
 * Bytes larger than the reading model's half-context allowance, which is
 * 786432 base64 characters and therefore 589824 bytes.
 */
const OVERSIZED_BYTES = 600_000;

/**
 * Transcription a reader returns for the picture under test.
 */
const A_READING = '虎斑猫 Mittens，2019 年领养，联系方式 @mittenspaw。';

/**
 * Bytes standing in for a picture, whose content no rule here reads.
 *
 * @param length - how many bytes the picture occupies
 *
 * @returns Buffer of that size
 *
 * @example
 * ```ts
 * const bytes = bytesOf({ length: 64, },);
 * ```
 */
function bytesOf({ length, }: { readonly length: number; },): Uint8Array {
  return new Uint8Array(length,).fill(7,);
}

/**
 * Client answering every reading with one fixed reply, recording what it was
 * asked.
 *
 * @param text - reply the model returns
 *
 * @returns Client and the requests it received
 *
 * @example
 * ```ts
 * const { client, requests, } = replyingClient({ text: A_READING, },);
 * ```
 */
function replyingClient({ text, }: { readonly text: string; },): {
  readonly client: SyntheticClient;
  readonly requests: ChatTextRequest[];
} {
  /**
   * Requests the stage sent, for the assertion that a picture reached the wire.
   */
  const requests: ChatTextRequest[] = [];

  return {
    requests,
    client: {
      chatText: async (request,) => {
        requests.push(request as ChatTextRequest,);
        return { text, };
      },
      chatJson: async () => {
        throw new Error('chatJson unused by the reading stage',);
      },
      quotas: async () => {
        throw new Error('quotas unused by the reading stage',);
      },
    },
  };
}

await describe({
  name: readImageAsset.name,
  children: [
    it({
      name: 'SENDS THE PICTURE AS A CONTENT PART BESIDE THE INSTRUCTION, and returns what came '
        + 'back. A reading the wire never carried is indistinguishable from one the model ignored, '
        + 'so this asserts the parts array rather than only the returned text',
      fn: async () => {
        const { client, requests, } = replyingClient({ text: A_READING, },);

        /**
         * One reading of a picture the archive already transcribes.
         */
        const reading = await readImageAsset({
          client,
          modelId: READER,
          bytes: bytesOf({ length: 64, },),
          assetName: 'mittens.webp',
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 30_000,
          l,
        },);

        expect(reading.kind,).toBe('read',);
        if (reading.kind !== 'read')
          throw new Error('read by construction',);
        expect(reading.text,).toBe(A_READING,);

        expect(requests.length,).toBe(1,);

        /**
         * Sole message the reader was sent.
         */
        const message = requests[0]
          ?.messages[0];
        if (message === undefined)
          throw new Error('one message by construction',);

        /**
         * Its parts, which must be an array rather than a bare string.
         */
        const { content, } = message;
        if ((typeof content) === 'string')
          throw new Error('a picture cannot travel as a string',);

        expect(content.length,).toBe(2,);
        expect(content[0]
          ?.type,).toBe('text',);
        expect(content[1]
          ?.type,).toBe('image_url',);

        /**
         * Picture part, whose data URI declares the media type it was encoded
         * under.
         */
        const [
          ,
          picture,
        ] = content;
        if (picture?.type !== 'image_url')
          throw new Error('image part by construction',);
        expect(picture.image_url
          .url
          .startsWith('data:image/webp;base64,',),).toBe(true,);
      },
    },),

    it({
      name: 'REFUSES A MODEL THE CATALOG SAYS DOES NOT READ IMAGES, without spending a call. A '
        + 'text-only model sent a picture answers about nothing or errors, and either way the quota '
        + 'is gone',
      fn: async () => {
        const { client, requests, } = replyingClient({ text: A_READING, },);

        /**
         * Attempt against a model whose `input_modalities` carry no image.
         */
        const reading = await readImageAsset({
          client,
          modelId: TEXT_ONLY,
          bytes: bytesOf({ length: 64, },),
          assetName: 'mittens.webp',
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 30_000,
          l,
        },);

        expect(reading.kind,).toBe('unavailable',);
        if (reading.kind !== 'unavailable')
          throw new Error('unavailable by construction',);
        expect(reading.reason,).toBe('model-does-not-read-images',);
        expect(requests.length,).toBe(0,);
      },
    },),

    it({
      name: 'REFUSES AN EXTENSION THE CORPUS DOES NOT USE, rather than guessing a media type. A '
        + 'picture sent under the wrong one asks a model to decode something it was not given',
      fn: async () => {
        const { client, requests, } = replyingClient({ text: A_READING, },);

        /**
         * Attempt against a file whose name declares nothing sendable.
         */
        const reading = await readImageAsset({
          client,
          modelId: READER,
          bytes: bytesOf({ length: 64, },),
          assetName: 'mittens.heic',
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 30_000,
          l,
        },);

        expect(reading.kind,).toBe('unavailable',);
        if (reading.kind !== 'unavailable')
          throw new Error('unavailable by construction',);
        expect(reading.reason,).toBe('unknown-media-type',);
        expect(requests.length,).toBe(0,);
      },
    },),

    it({
      name: 'REFUSES A PICTURE TOO LARGE FOR THE MODEL rather than downscaling it. A shrunk '
        + 'photograph of handwriting is the exact input that produces a confident wrong reading',
      fn: async () => {
        const { client, requests, } = replyingClient({ text: A_READING, },);

        /**
         * Attempt with a picture past the half-context allowance.
         */
        const reading = await readImageAsset({
          client,
          modelId: READER,
          bytes: bytesOf({ length: OVERSIZED_BYTES, },),
          assetName: 'mittens.webp',
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 30_000,
          l,
        },);

        expect(reading.kind,).toBe('unavailable',);
        if (reading.kind !== 'unavailable')
          throw new Error('unavailable by construction',);
        expect(reading.reason,).toBe('too-large-for-model',);
        expect(requests.length,).toBe(0,);
      },
    },),

    it({
      name: 'NAMES AN EMPTY REPLY SEPARATELY FROM A SHORT ONE. Nothing at all means the exchange '
        + 'produced no content, which is a transport outcome; a few characters means the model '
        + 'answered and said too little, which is a reading outcome',
      fn: async () => {
        const { client, } = replyingClient({ text: '', },);

        /**
         * Attempt whose reply carries no content at all.
         */
        const reading = await readImageAsset({
          client,
          modelId: READER,
          bytes: bytesOf({ length: 64, },),
          assetName: 'mittens.webp',
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 30_000,
          l,
        },);

        expect(reading.kind,).toBe('unavailable',);
        if (reading.kind !== 'unavailable')
          throw new Error('unavailable by construction',);
        expect(reading.reason,).toBe('empty-reply',);
      },
    },),

    it({
      name: 'REFUSES A READING TOO SHORT TO BE A TRANSCRIPTION, which is what a picture carrying no '
        + 'words produces and what a truncated exchange leaves behind',
      fn: async () => {
        const { client, } = replyingClient({ text: '喵。', },);

        /**
         * Attempt whose reply is content but not a transcription.
         */
        const reading = await readImageAsset({
          client,
          modelId: READER,
          bytes: bytesOf({ length: 64, },),
          assetName: 'mittens.webp',
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 30_000,
          l,
        },);

        expect(reading.kind,).toBe('unavailable',);
        if (reading.kind !== 'unavailable')
          throw new Error('unavailable by construction',);
        expect(reading.reason,).toBe('too-short',);
      },
    },),

    it({
      name: 'REFUSES A REPLY THAT ANNOUNCES ITSELF AS A REFUSAL, which would otherwise reach a '
        + 'translator as a source passage saying the model could not read the picture',
      fn: async () => {
        const { client, } = replyingClient({
          text: 'I cannot read the text in this image, as it is too blurry to make out.',
        },);

        /**
         * Attempt whose reply is an apology of transcription length.
         */
        const reading = await readImageAsset({
          client,
          modelId: READER,
          bytes: bytesOf({ length: 64, },),
          assetName: 'mittens.webp',
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 30_000,
          l,
        },);

        expect(reading.kind,).toBe('unavailable',);
        if (reading.kind !== 'unavailable')
          throw new Error('unavailable by construction',);
        expect(reading.reason,).toBe('reads-as-refusal',);
      },
    },),

    it({
      name: 'ACCEPTS A JPEG AS READILY AS A WEBP, since four of the corpus assets are jpg and a '
        + 'reader that only understood one extension would report those four as unsendable',
      fn: async () => {
        const { client, requests, } = replyingClient({ text: A_READING, },);

        /**
         * Attempt against the other extension the corpus uses.
         */
        const reading = await readImageAsset({
          client,
          modelId: READER,
          bytes: bytesOf({ length: 64, },),
          assetName: 'mittens.jpg',
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 30_000,
          l,
        },);

        expect(reading.kind,).toBe('read',);

        /**
         * Picture part of the sole message, whose media type follows the name.
         */
        const content = requests[0]
          ?.messages[0]
          ?.content;
        if (((typeof content) === 'string') || (content === undefined))
          throw new Error('a picture cannot travel as a string',);

        /**
         * That part, narrowed to the picture it is.
         */
        const [
          ,
          picture,
        ] = content;
        if (picture?.type !== 'image_url')
          throw new Error('image part by construction',);
        expect(picture.image_url
          .url
          .startsWith('data:image/jpeg;base64,',),).toBe(true,);
      },
    },),
  ],
},);
