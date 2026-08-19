/**
 * Tests for gathering one document's picture readings before its slices run.
 *
 * WHAT THESE PIN is the arithmetic that makes the stage affordable and the
 * store that makes a resume honest.
 *
 * ONCE PER PICTURE, NOT ONCE PER SLICE. A picture named by one slice is shown to
 * that slice and to both its neighbours, so a naive gather would send the same
 * asset three times. Over the pinned corpus that difference is most of the work.
 *
 * AND ONCE PER RUN, NOT ONCE PER ATTEMPT. A reading is not deterministic: ask
 * one model the same question about the same picture twice and the wording
 * differs. Those words are in the translate slice key, because a judge shown
 * different words can reach a different answer. Without the store, a resumed
 * entry would re-read every picture into slightly different words, every key
 * naming a picture would change, and every settled slice on a picture-bearing
 * document would be re-bought. The store is what makes a resumed key equal to
 * the key it resumes.
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
  type ChunkPair,
  type PairedReading,
  readDocumentPictures,
  type SliceCache,
  type SyntheticClient,
  type SyntheticModelId,
} from '../dist/final/node/index.mjs';

/**
 * Logger the gather writes its progress to.
 */
const l = tagged({ tag: 'document-readings-test', },);

/**
 * Vision sub-roster, which is exactly these two models.
 */
const READERS: readonly SyntheticModelId[] = [
  'hf:moonshotai/Kimi-K3',
  'hf:Qwen/Qwen3.6-27B',
];

/**
 * Placeholder the corpus writes for an entry's own directory.
 *
 * WRITTEN AS AN ESCAPED TEMPLATE LITERAL, the same way `photo-reference`'s own
 * fixtures write it: the corpus text carries a literal dollar-brace, which a
 * template literal escapes without an expression and a plain string cannot
 * carry without looking like an accident.
 */
const ENTRY_PLACEHOLDER = `\${path}`;

/**
 * What one reader transcribed from the picture under test.
 */
const READING = '走失猫咪 Mittens，虎斑，2019 年出生，联系 @mittenspaw。';

/**
 * What the other transcribed from it, worded differently where a transcription
 * can differ and identically where it cannot.
 */
const AGREEING_READING = '走失猫咪 Mittens，虎斑，2019 年出生，请联系 @mittenspaw。';

/**
 * Source text naming one picture, in the corpus's only image construct.
 *
 * @param assetName - file name within entry's photos directory
 *
 * @returns Passage showing that picture
 *
 * @example
 * ```ts
 * const text = showing({ assetName: 'noticeboard.webp', },);
 * ```
 */
function showing({ assetName, }: { readonly assetName: string; },): string {
  return `小猫在窗台上睡觉。\n\n<PhotoScroll photos={[ '${ENTRY_PLACEHOLDER}/photos/${assetName}' ]} />\n`;
}

/**
 * One slice pair whose original side carries given text.
 *
 * @param text - original-side text this slice covers
 *
 * @param chunkIndex - position of this slice in its document
 *
 * @returns Pair whose original side carries that text
 *
 * @example
 * ```ts
 * const pair = sliceOf({ text: showing({ assetName: 'a.webp', },), chunkIndex: 0, },);
 * ```
 */
function sliceOf(
  {
    text,
    chunkIndex,
  }: {
    readonly text: string;
    readonly chunkIndex: number;
  },
): ChunkPair {
  return {
    source: {
      chunkIndex,
      nodes: [],
      startOffset: 0,
      endOffset: text.length,
      text,
    },
    target: {
      chunkIndex,
      nodes: [],
      startOffset: 0,
      endOffset: 0,
      text: '',
    },
  };
}

/**
 * Bytes standing in for a picture, whose content no rule here reads.
 *
 * @param seed - byte every position carries, so two calls differ by content
 *
 * @returns Small buffer of that byte
 *
 * @example
 * ```ts
 * const bytes = bytesOf({ seed: 7, },);
 * ```
 */
function bytesOf({ seed, }: { readonly seed: number; },): Uint8Array {
  return new Uint8Array(64,).fill(seed,);
}

/**
 * Client answering each reader with its scripted transcription, recording every
 * model it was asked.
 *
 * @returns Client and models a reading was requested from, in order
 *
 * @example
 * ```ts
 * const { client, asked, } = agreeingClient();
 * ```
 */
function agreeingClient(): {
  readonly client: SyntheticClient;
  readonly asked: SyntheticModelId[];
} {
  /**
   * Models a reading was requested from.
   */
  const asked: SyntheticModelId[] = [];

  /**
   * Transcription each reader returns.
   */
  const scripted: Readonly<Record<string, string>> = {
    'hf:moonshotai/Kimi-K3': READING,
    'hf:Qwen/Qwen3.6-27B': AGREEING_READING,
  };

  return {
    asked,
    client: {
      chatText: async (request,) => {
        /**
         * Model this exchange names.
         */
        const { modelId, } = request;
        asked.push(modelId,);
        return { text: scripted[modelId] ?? '', };
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
 * Store recording what it was asked to persist.
 *
 * @param resumed - readings an earlier run settled, keyed by reading key
 *
 * @returns Cache and what it was told to write
 *
 * @example
 * ```ts
 * const { cache, persisted, } = recordingCache({ resumed: new Map(), },);
 * ```
 */
function recordingCache(
  { resumed, }: { readonly resumed: ReadonlyMap<string, PairedReading>; },
): {
  readonly cache: SliceCache<PairedReading>;
  readonly persisted: string[];
} {
  /**
   * Keys written during this gather.
   */
  const persisted: string[] = [];

  return {
    persisted,
    cache: {
      resumed,
      persist: async ({ key, },) => {
        persisted.push(key,);
      },
    },
  };
}

await describe({
  name: readDocumentPictures.name,
  children: [
    it({
      name: 'READS ONE PICTURE ONCE HOWEVER MANY SLICES NAME IT, which is the arithmetic that '
        + 'makes this affordable: a picture travels to its slice and to both neighbours, so '
        + 'gathering per slice would send the same asset three times',
      fn: async () => {
        const { client, asked, } = agreeingClient();
        const { cache, persisted, } = recordingCache({ resumed: new Map(), },);

        /**
         * Three consecutive slices all showing one picture.
         */
        const slices: readonly ChunkPair[] = [
          0,
          1,
          2,
        ].map(function toSlice(chunkIndex,): ChunkPair {
          return sliceOf({
            text: showing({ assetName: 'noticeboard.webp', },),
            chunkIndex,
          },);
        },);

        /**
         * What the gather produced.
         */
        const readings = await readDocumentPictures({
          client,
          slices,
          assets: new Map([['noticeboard.webp', bytesOf({ seed: 7, },),],],),
          readerModelIds: READERS,
          cache,
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 30_000,
          l,
        },);

        expect(readings.size,).toBe(1,);
        expect(asked.length,).toBe(2,);
        expect(persisted.length,).toBe(1,);
        expect(readings.get('noticeboard.webp',)
          ?.kind,).toBe('corroborated',);
      },
    },),

    it({
      name: 'RESUMES A STORED READING AND SPENDS NO CALL, which is what keeps a resumed slice key '
        + 'equal to the key it resumes. A reading is not deterministic, so re-reading would change '
        + 'the words in the key and re-buy every settled slice on this document',
      fn: async () => {
        const { client, asked, } = agreeingClient();

        /**
         * Reading an earlier run settled for this picture.
         */
        const stored: PairedReading = {
          kind: 'corroborated',
          readings: [{
            modelId: 'hf:moonshotai/Kimi-K3',
            text: READING,
          },],
          overlap: 1,
        };

        /**
         * First gather, whose only purpose is to learn the key this picture is
         * stored under, so the second gather stores it under the same one.
         */
        const learning = recordingCache({ resumed: new Map(), },);
        await readDocumentPictures({
          client,
          slices: [sliceOf({
            text: showing({ assetName: 'noticeboard.webp', },),
            chunkIndex: 0,
          },),],
          assets: new Map([['noticeboard.webp', bytesOf({ seed: 7, },),],],),
          readerModelIds: READERS,
          cache: learning.cache,
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 30_000,
          l,
        },);

        /**
         * Key that gather wrote under.
         */
        const [key,] = learning.persisted;
        if (key === undefined)
          throw new Error('one key by construction',);

        /**
         * Calls spent before the resuming gather, so the assertion below reads
         * the difference rather than a total.
         */
        const spentBefore = asked.length;

        /**
         * Resuming gather, over a store already holding that key.
         */
        const { cache, persisted, } = recordingCache({
          resumed: new Map([[key, stored,],],),
        },);
        const readings = await readDocumentPictures({
          client,
          slices: [sliceOf({
            text: showing({ assetName: 'noticeboard.webp', },),
            chunkIndex: 0,
          },),],
          assets: new Map([['noticeboard.webp', bytesOf({ seed: 7, },),],],),
          readerModelIds: READERS,
          cache,
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 30_000,
          l,
        },);

        expect(asked.length,).toBe(spentBefore,);
        expect(persisted.length,).toBe(0,);
        expect(readings.get('noticeboard.webp',),).toEqual(stored,);
      },
    },),

    it({
      name: 'KEYS BY THE PICTURE RATHER THAN BY ITS NAME, so two assets named alike in different '
        + 'entries never share a reading. The bytes are what was asked about',
      fn: async () => {
        const { client, } = agreeingClient();

        /**
         * Two gathers of one asset name over different bytes.
         */
        const keys = await Promise.all([
          7,
          9,
        ].map(async function keyFor(seed,): Promise<string> {
          const { cache, persisted, } = recordingCache({ resumed: new Map(), },);
          await readDocumentPictures({
            client,
            slices: [sliceOf({
              text: showing({ assetName: 'noticeboard.webp', },),
              chunkIndex: 0,
            },),],
            assets: new Map([['noticeboard.webp', bytesOf({ seed, },),],],),
            readerModelIds: READERS,
            cache,
            signal: AbortSignal.timeout(30_000,),
            perCallTimeoutMs: 30_000,
            l,
          },);
          return persisted[0] ?? '';
        },),);

        expect(keys[0] === keys[1],).toBe(false,);
      },
    },),

    it({
      name: 'SKIPS A PICTURE NOBODY GATHERED BYTES FOR, spending nothing and recording nothing. '
        + 'The slices showing it report it as unread, which is what actually happened, and one '
        + 'unreadable asset must not cost an entry the other fifty slices it has to settle',
      fn: async () => {
        const { client, asked, } = agreeingClient();
        const { cache, persisted, } = recordingCache({ resumed: new Map(), },);

        /**
         * Gather over a slice naming a picture the caller could not read.
         */
        const readings = await readDocumentPictures({
          client,
          slices: [sliceOf({
            text: showing({ assetName: 'missing.webp', },),
            chunkIndex: 0,
          },),],
          assets: new Map(),
          readerModelIds: READERS,
          cache,
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 30_000,
          l,
        },);

        expect(readings.size,).toBe(0,);
        expect(asked.length,).toBe(0,);
        expect(persisted.length,).toBe(0,);
      },
    },),

    it({
      name: 'ASKS NOTHING OF A DOCUMENT THAT SHOWS NO PICTURE, which is 1181 of the pinned '
        + 'corpus\'s 1260 slices and must cost exactly nothing',
      fn: async () => {
        const { client, asked, } = agreeingClient();
        const { cache, } = recordingCache({ resumed: new Map(), },);

        /**
         * Gather over ordinary prose.
         */
        const readings = await readDocumentPictures({
          client,
          slices: [sliceOf({
            text: '小猫在窗台上睡觉。\n',
            chunkIndex: 0,
          },),],
          assets: new Map(),
          readerModelIds: READERS,
          cache,
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 30_000,
          l,
        },);

        expect(readings.size,).toBe(0,);
        expect(asked.length,).toBe(0,);
      },
    },),
  ],
},);
