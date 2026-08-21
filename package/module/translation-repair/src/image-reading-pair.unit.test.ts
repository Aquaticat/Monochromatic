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
 * A FAILING READER IS CONTAINED, which three of these pin from both sides. A
 * reading is the one output nothing downstream requires, so a reader that
 * throws must cost its own reading and nothing else. An ABORT is not such a
 * failure and must still travel, because a run told to stop must not settle a
 * document on the readings that beat the stop.
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
  type OcrReader,
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
  'hf:Qwen/Qwen3.8-27B',
];

/**
 * Model whose context is the larger of the two, so a picture can be sized to
 * fit it alone.
 */
const LARGER_READER: SyntheticModelId = 'hf:moonshotai/Kimi-K3';

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
 * Deterministic reader that finds text, which is what lets the models be asked.
 *
 * THE REAL ONE SHELLS OUT to `dwebp` and `tesseract`, so every case here supplies
 * a stub instead. That is the point of the seam: a test must not depend on which
 * command-line tools a machine happens to carry.
 */
async function found(): Promise<{
  readonly kind: 'read';
  readonly text: string;
}> {
  return {
    kind: 'read',
    text: '走失猫咪 Mittens',
  };
}

/**
 * Deterministic reader that finds nothing, which is two thirds of the corpus.
 */
async function empty(): Promise<{
  readonly kind: 'no-text';
  readonly characters: number;
}> {
  return {
    kind: 'no-text',
    characters: 3,
  };
}

/**
 * Deterministic reader that could not run, standing in for a machine without
 * the tools installed.
 */
async function missing(): Promise<{
  readonly kind: 'unavailable';
  readonly reason: 'ocr-tool-missing';
}> {
  return {
    kind: 'unavailable',
    reason: 'ocr-tool-missing',
  };
}

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

/**
 * Client that throws for named models and answers the rest from a script.
 *
 * THROWS RATHER THAN RETURNING AN ERROR SHAPE, because that is what the
 * production client does: the runaway guard, the retry ceiling and a transport
 * failure all leave `chatText` by rejecting.
 *
 * @param failing - models whose exchange throws, and the message it throws with
 *
 * @param byModel - reply per model that does not throw
 *
 * @returns Client and models it was asked, in the order asks arrived
 *
 * @example
 * ```ts
 * const { client, } = failingClient({ failing: { [LARGER_READER]: 'runaway', }, byModel: {}, },);
 * ```
 */
function failingClient(
  {
    failing,
    byModel,
  }: {
    readonly failing: Readonly<Record<string, string>>;
    readonly byModel: Readonly<Record<string, string>>;
  },
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

        /**
         * Message this model is scripted to fail with, absent when it succeeds.
         */
        const failure = failing[modelId];
        if (failure !== undefined)
          throw new Error(failure,);
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
            'hf:Qwen/Qwen3.8-27B': AGREEING_READING,
          },
        },);

        /**
         * What the roster made of the picture.
         */
        const paired = await readImagePair({
          client,
          readOcr: found,
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
            'hf:Qwen/Qwen3.8-27B': OTHER_PICTURE,
          },
        },);

        /**
         * What the roster made of two irreconcilable readings.
         */
        const paired = await readImagePair({
          client,
          readOcr: found,
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
        // ONE READER SAYING NOTHING, rather than a picture only one could be
        // sent. That used to be a size case, and size no longer separates the
        // two readers: the per-model ceiling was measuring base64 length
        // against a context and predicting nothing, so both now share one
        // ceiling far above anything in the corpus.
        const { client, } = scriptedClient({
          byModel: { 'hf:moonshotai/Kimi-K3': READING, },
        },);

        /**
         * What the roster made of a picture only one reader answered about.
         */
        const paired = await readImagePair({
          client,
          readOcr: found,
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
          readOcr: found,
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
          readOcr: found,
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

    it({
      name: 'CONTAINS A READER THAT THROWS and keeps the other reader\'s reading, rather than '
        + 'failing the picture. Measured on a real run before this held: one reader looped, the '
        + 'client\'s runaway guard ended the call, the rejection reached the entry driver, and the '
        + 'entry finished with nothing settled, so both lanes were lost to a transcription nobody '
        + 'downstream requires',
      fn: async () => {
        const { client, asked, } = failingClient({
          failing: { 'hf:Qwen/Qwen3.8-27B': 'ended a runaway call, reasoning channel repeated itself', },
          byModel: { 'hf:moonshotai/Kimi-K3': READING, },
        },);

        /**
         * What the roster made of a picture one reader could not finish reading.
         */
        const paired = await readImagePair({
          client,
          readOcr: found,
          readerModelIds: READERS,
          bytes: bytesOf({ length: 64, },),
          assetName: 'noticeboard.webp',
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 30_000,
          l,
        },);

        expect(asked.length,).toBe(2,);
        expect(paired.kind,).toBe('unavailable',);
        if (paired.kind !== 'unavailable')
          throw new Error('unavailable by construction',);

        // The surviving reader is short of corroboration, which is a
        // one-reader shortfall rather than a picture nobody could send.
        expect(paired.reason,).toBe('one-reader-only',);
        expect(paired.perReader
          .some(function named(entry,): boolean {
            return entry.includes('reader-failed',);
          },),).toBe(true,);
      },
    },),

    it({
      name: 'CONTAINS BOTH READERS THROWING and reports a picture nobody could read, rather than '
        + 'propagating either failure. The pipeline reads pictures to gain evidence, so the worst '
        + 'a reading stage may cost is the evidence it failed to gather',
      fn: async () => {
        const { client, } = failingClient({
          failing: {
            'hf:moonshotai/Kimi-K3': 'HTTP 500 after every retry',
            'hf:Qwen/Qwen3.8-27B': 'ended a runaway call',
          },
          byModel: {},
        },);

        /**
         * What the roster made of a picture neither reader could finish.
         */
        const paired = await readImagePair({
          client,
          readOcr: found,
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
          .filter(function named(entry,): boolean {
            return entry.includes('reader-failed',);
          },).length,).toBe(2,);
      },
    },),

    it({
      name: 'FORWARDS AN ABORT rather than absorbing it, even where both readings beat the stop. '
        + 'Absorbed, a run told to halt would return two usable readings, the document would '
        + 'settle on them, and the driver would cache a decision the run was told not to make',
      fn: async () => {
        const { client, } = scriptedClient({
          byModel: {
            'hf:moonshotai/Kimi-K3': READING,
            'hf:Qwen/Qwen3.8-27B': AGREEING_READING,
          },
        },);

        /**
         * Stop that has already arrived, standing in for one that lands while
         * the readings are in flight.
         */
        const stopped = new AbortController();
        stopped.abort();

        /**
         * Name of whatever escaped the call, or what it returned instead.
         * Recorded rather than asserted inline so a verdict slipping past the
         * stop reads as its own value rather than as a missing throw.
         */
        let escaped = 'nothing thrown';
        try {
          /**
           * What the roster made of a picture a stopped run asked about.
           */
          const paired = await readImagePair({
            client,
            readOcr: found,
            readerModelIds: READERS,
            bytes: bytesOf({ length: 64, },),
            assetName: 'noticeboard.webp',
            signal: stopped.signal,
            perCallTimeoutMs: 30_000,
            l,
          },);
          escaped = `returned ${paired.kind}`;
        } catch (error) {
          escaped = Error.isError(error,) ? error.name : String(error,);
        }

        expect(escaped,).toBe('AbortError',);
      },
    },),

    it({
      name: 'ASKS THE DETERMINISTIC READER NOTHING WHEN THE RUN HAS ALREADY STOPPED, which the '
        + 'abort case above cannot show because it throws either way. The gate shells out to a '
        + 'decoder and to tesseract per picture and consults no signal of its own, so a stopped '
        + 'run that reached it would spend that on every remaining asset and then persist verdicts '
        + 'that beat the stop',
      fn: async () => {
        /**
         * Roster that must never be reached, since the gate sits before it.
         */
        const { client, } = scriptedClient({
          byModel: {
            'hf:moonshotai/Kimi-K3': READING,
            'hf:Qwen/Qwen3.8-27B': AGREEING_READING,
          },
        },);

        /**
         * How many times the deterministic reader was asked. Counted rather
         * than asserted inside the stub so a call that does happen reads as a
         * number in the failure rather than as a thrown assertion from a place
         * the test does not name.
         */
        let asked = 0;

        /**
         * Deterministic reader that records being asked, and would otherwise
         * return the verdict two thirds of this corpus reaches.
         */
        async function counting(): Promise<{
          readonly kind: 'no-text';
          readonly characters: number;
        }> {
          asked += 1;
          return {
            kind: 'no-text',
            characters: 0,
          };
        }

        /**
         * Stop that arrived before the picture did.
         */
        const stopped = new AbortController();
        stopped.abort();

        /**
         * Name of whatever escaped, kept so a verdict slipping past the stop
         * reads as its own value.
         */
        let escaped = 'nothing thrown';
        try {
          /**
           * What the roster made of a picture a stopped run asked about.
           */
          const paired = await readImagePair({
            client,
            readOcr: counting,
            readerModelIds: READERS,
            bytes: bytesOf({ length: 64, },),
            assetName: 'noticeboard.webp',
            signal: stopped.signal,
            perCallTimeoutMs: 30_000,
            l,
          },);
          escaped = `returned ${paired.kind}`;
        } catch (error) {
          escaped = Error.isError(error,) ? error.name : String(error,);
        }

        expect(escaped,).toBe('AbortError',);
        expect(asked,).toBe(0,);
      },
    },),

    it({
      name: 'ASKS NO MODEL ABOUT A PICTURE WITH NO TEXT, and reports that as its own verdict rather '
        + 'than as a failure. Measured over the corpus, 119 of 191 pictures carry no text at all, '
        + 'so this is the common case and every model call it would have spent is spent on being '
        + 'told there is nothing there',
      fn: async () => {
        const { client, asked, } = scriptedClient({
          byModel: {
            'hf:moonshotai/Kimi-K3': READING,
            'hf:Qwen/Qwen3.8-27B': AGREEING_READING,
          },
        },);

        /**
         * What the roster made of a picture the deterministic reader found bare.
         */
        const paired = await readImagePair({
          client,
          readOcr: empty,
          readerModelIds: READERS,
          bytes: bytesOf({ length: 64, },),
          assetName: 'noticeboard.webp',
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 30_000,
          l,
        },);

        // The gate, which is the whole point: nothing was asked.
        expect(asked.length,).toBe(0,);
        expect(paired.kind,).toBe('no-text',);
        if (paired.kind !== 'no-text')
          throw new Error('no-text by construction',);
        expect(paired.characters,).toBe(3,);
      },
    },),

    it({
      name: 'ASKS THE MODELS ANYWAY WHEN THE DETERMINISTIC READER CANNOT RUN, since a machine '
        + 'without the tools installed must degrade to the behaviour it had before them rather '
        + 'than report every picture as bare. A missing tool and an empty picture are opposite '
        + 'facts and must not produce the same verdict',
      fn: async () => {
        const { client, asked, } = scriptedClient({
          byModel: {
            'hf:moonshotai/Kimi-K3': READING,
            'hf:Qwen/Qwen3.8-27B': AGREEING_READING,
          },
        },);

        /**
         * What the roster made of a picture nothing could pre-screen.
         */
        const paired = await readImagePair({
          client,
          readOcr: missing,
          readerModelIds: READERS,
          bytes: bytesOf({ length: 64, },),
          assetName: 'noticeboard.webp',
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 30_000,
          l,
        },);

        expect(asked.length,).toBe(2,);
        expect(paired.kind,).toBe('corroborated',);
      },
    },),
  ],
},);
