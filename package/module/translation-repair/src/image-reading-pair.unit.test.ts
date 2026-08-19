/**
 * Tests for reading one picture with the whole vision sub-roster and letting
 * the two readers decide whether either reading may be used.
 *
 * WHAT THESE PIN is that corroboration is the gate. A reading that arrives is
 * not a reading that may be used: it has to be matched by a second reader shown
 * the same picture and nothing else, and where no second reading exists the
 * first is refused rather than passed along with a caveat.
 *
 * BOTH READINGS TRAVEL when they agree, which one of these asserts directly.
 * Agreement establishes that two readers describe the same picture, not the
 * same amount of it, so a stage handed only the longer would lose the shorter's
 * vouching and a stage handed only the shorter would lose content.
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
  readImagePair,
  type SyntheticClient,
  type SyntheticModelId,
} from '../dist/final/node/index.mjs';

/**
 * Logger the stage writes its progress to.
 */
const l = tagged({ tag: 'image-reading-pair-test', },);

/**
 * Vision sub-roster, which is exactly these two models.
 */
const READERS: readonly SyntheticModelId[] = [
  'hf:moonshotai/Kimi-K3',
  'hf:Qwen/Qwen3.6-27B',
];

/**
 * Model whose context is the larger of the two, so a picture can be sized to
 * fit it alone.
 */
const LARGER_READER: SyntheticModelId = 'hf:moonshotai/Kimi-K3';

/**
 * Bytes past the smaller reader's half-context allowance of 294912 and within
 * the larger reader's of 589824, so exactly one reader can be sent it.
 */
const ONE_READER_BYTES = 400_000;

/**
 * What one reader transcribed from a picture of a noticeboard.
 */
const READING = '走失猫咪 Mittens，虎斑，2019 年出生，联系 @mittenspaw，请电 555 0134。';

/**
 * What the other reader transcribed from the same picture, worded differently
 * where a transcription can differ and identical where it cannot.
 */
const AGREEING_READING = '走失猫咪 Mittens，虎斑，2019 年出生，联系 @mittenspaw，电话 555 0134。';

/**
 * What a reader transcribed from some other picture entirely.
 */
const OTHER_PICTURE = '兽医诊所营业时间：周一至周五上午九点到下午六点，周六休息。';

/**
 * Bytes standing in for a picture, whose content no rule here reads.
 *
 * @param length - how many bytes picture occupies
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
 * Client answering each model with whatever that model is scripted to say.
 *
 * @param byModel - reply per model; a model absent from this map answers with
 * nothing, which the reading stage reports as an empty reply
 *
 * @returns Client and models it was asked, in the order asks arrived
 *
 * @example
 * ```ts
 * const { client, asked, } = scriptedClient({ byModel: { [LARGER_READER]: READING, }, },);
 * ```
 */
function scriptedClient(
  { byModel, }: { readonly byModel: Readonly<Record<string, string>>; },
): {
  readonly client: SyntheticClient;
  readonly asked: SyntheticModelId[];
} {
  /**
   * Models a reading was requested from.
   */
  const asked: SyntheticModelId[] = [];

  return {
    asked,
    client: {
      chatText: async (request,) => {
        /**
         * Request as this package's own contract describes it.
         */
        const { modelId, } = request as ChatTextRequest;
        asked.push(modelId,);
        return { text: byModel[modelId] ?? '', };
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
  name: readImagePair.name,
  children: [
    it({
      name: 'CORROBORATES TWO READINGS OF ONE PICTURE AND FORWARDS BOTH, labelled by model. '
        + 'Agreement says the two readers describe the same picture, not the same amount of it, so '
        + 'a stage handed only one of them loses either the vouching or the content',
      fn: async () => {
        const { client, asked, } = scriptedClient({
          byModel: {
            'hf:moonshotai/Kimi-K3': READING,
            'hf:Qwen/Qwen3.6-27B': AGREEING_READING,
          },
        },);

        /**
         * What the roster made of the picture.
         */
        const paired = await readImagePair({
          client,
          readerModelIds: READERS,
          bytes: bytesOf({ length: 64, },),
          assetName: 'noticeboard.webp',
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 30_000,
          l,
        },);

        expect(paired.kind,).toBe('corroborated',);
        if (paired.kind !== 'corroborated')
          throw new Error('corroborated by construction',);

        expect(asked.length,).toBe(2,);
        expect(paired.readings
          .length,).toBe(2,);
        expect(paired.readings
          .map(function toModel(reading,): SyntheticModelId {
            return reading.modelId;
          },),).toEqual([...READERS,],);
        expect(paired.readings
          .map(function toText(reading,): string {
            return reading.text;
          },),).toEqual([
          READING,
          AGREEING_READING,
        ],);
        expect(paired.overlap > 0,).toBe(true,);
      },
    },),

    it({
      name: 'REFUSES TWO READINGS THAT DESCRIBE DIFFERENT PICTURES, and records how far apart they '
        + 'were. Used, a reading of the wrong picture would licence replacing a careful '
        + 'transcription with something derived from a misreading, and no judge downstream could '
        + 'tell, because the reading is the only evidence any of them has about the picture',
      fn: async () => {
        const { client, } = scriptedClient({
          byModel: {
            'hf:moonshotai/Kimi-K3': READING,
            'hf:Qwen/Qwen3.6-27B': OTHER_PICTURE,
          },
        },);

        /**
         * What the roster made of two irreconcilable readings.
         */
        const paired = await readImagePair({
          client,
          readerModelIds: READERS,
          bytes: bytesOf({ length: 64, },),
          assetName: 'noticeboard.webp',
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 30_000,
          l,
        },);

        expect(paired.kind,).toBe('unavailable',);
        if (paired.kind !== 'unavailable')
          throw new Error('unavailable by construction',);
        expect(paired.reason,).toBe('readers-disagree',);
        expect(paired.overlap === undefined,).toBe(false,);
      },
    },),

    it({
      name: 'REFUSES A PICTURE ONLY ONE READER CAN BE SENT, which is the cost this design accepts '
        + 'rather than caveats. A caveat travelling downstream is a caveat somebody has to '
        + 'remember, and the passage it would qualify is already protected by the guards that hold '
        + 'every transcript in the corpus today',
      fn: async () => {
        const { client, } = scriptedClient({
          byModel: {
            'hf:moonshotai/Kimi-K3': READING,
            'hf:Qwen/Qwen3.6-27B': AGREEING_READING,
          },
        },);

        /**
         * What the roster made of a picture past the smaller reader's context.
         */
        const paired = await readImagePair({
          client,
          readerModelIds: READERS,
          bytes: bytesOf({ length: ONE_READER_BYTES, },),
          assetName: 'noticeboard.webp',
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 30_000,
          l,
        },);

        expect(paired.kind,).toBe('unavailable',);
        if (paired.kind !== 'unavailable')
          throw new Error('unavailable by construction',);
        expect(paired.reason,).toBe('one-reader-only',);
        expect(paired.overlap,).toBe(undefined,);
      },
    },),

    it({
      name: 'NAMES WHY EACH READER PRODUCED NOTHING, so a finding can tell a picture nobody could '
        + 'send apart from one nobody could read. Both are silence in the artifact otherwise',
      fn: async () => {
        const { client, } = scriptedClient({ byModel: {}, },);

        /**
         * What the roster made of a picture neither reader answered about.
         */
        const paired = await readImagePair({
          client,
          readerModelIds: READERS,
          bytes: bytesOf({ length: 64, },),
          assetName: 'noticeboard.webp',
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 30_000,
          l,
        },);

        expect(paired.kind,).toBe('unavailable',);
        if (paired.kind !== 'unavailable')
          throw new Error('unavailable by construction',);
        expect(paired.reason,).toBe('no-reader-available',);
        expect(paired.perReader
          .length,).toBe(2,);
        expect(paired.perReader
          .every(function names(entry,): boolean {
            return entry.includes('empty-reply',);
          },),).toBe(true,);
      },
    },),

    it({
      name: 'REFUSES A ROSTER OF ONE, since a sole reader has nothing to be corroborated by '
        + 'however well it reads. The vision sub-roster is two models and this is what happens the '
        + 'day it is not',
      fn: async () => {
        const { client, asked, } = scriptedClient({
          byModel: { 'hf:moonshotai/Kimi-K3': READING, },
        },);

        /**
         * What one reader alone produced.
         */
        const paired = await readImagePair({
          client,
          readerModelIds: [LARGER_READER,],
          bytes: bytesOf({ length: 64, },),
          assetName: 'noticeboard.webp',
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 30_000,
          l,
        },);

        expect(asked.length,).toBe(1,);
        expect(paired.kind,).toBe('unavailable',);
        if (paired.kind !== 'unavailable')
          throw new Error('unavailable by construction',);
        expect(paired.reason,).toBe('one-reader-only',);
      },
    },),
  ],
},);
