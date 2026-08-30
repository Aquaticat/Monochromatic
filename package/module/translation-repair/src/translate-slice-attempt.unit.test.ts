/**
 * Tests for one slice's attempt at translation, as the document driver asks it.
 *
 * The attempt settles a record or propagates operational interruption.
 * An absent passage never becomes a settled empty or unfilled quality result.
 *
 * Fixtures are cat-themed invention.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  attemptTranslateSlice,
  type ChunkPair,
  isInsertionChunk,
  makeInsertionChunk,
  prepareDocumentPair,
  type PreparedDocumentPair,
  type SyntheticClient,
  type TranslateModels,
  TranslationRepairInterruptedError,
} from '../dist/final/node/index.mjs';

/**
 * Logger for the attempts under test.
 */
const l = tagged({ tag: 'translate-slice-attempt-test', },);

/**
 * Original, two sections the archive translates.
 */
const SOURCE_TEXT = `## 第一节

猫猫在窗台上打盹。

## 第二节

窗台上有一只鸟。
`;

/**
 * Archive translating both sections.
 */
const TARGET_TEXT = `## Section one

The cat is doing the sleeping on the windowsill.

## Section two

On the windowsill there is being a bird.
`;

/**
 * Passage the archive never translated, carried by the insertion slice.
 */
const MISSING_SOURCE = '## 第三节\n\n猫猫也喜欢晒太阳。';

/**
 * Roster the attempt seats.
 */
const MODELS: TranslateModels = {
  translatorModelIds: [
    'hf:moonshotai/Kimi-K3',
    'hf:zai-org/GLM-5.3-Flash',
    'minimax-m3',
  ],
  judgeModelIds: [
    'hf:moonshotai/Kimi-K3',
    'hf:zai-org/GLM-5.3-Flash',
    'minimax-m3',
    'hf:Qwen/Qwen3.8-27B',
    'deepseek-v4-pro-0813',
    'hf:openai/gpt-oss-120b',
  ],
};

/**
 * Client nobody is scripted on: every structured reply fails the wire guard,
 * so no translator is heard and no judge has anything to rank.
 *
 * @returns Client answering nothing usable
 *
 * @example
 * ```ts
 * const client = silentClient();
 * ```
 */
function silentClient(): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused by the translate lane',);
    },
    quotas: async () => {
      throw new Error('quotas unused by the translate lane',);
    },
    chatJson: async () => ({
      kind: 'schema-mismatch',
      rawText: '',
      detail: 'nobody is scripted',
    }),
  };
}

/**
 * Prepared pair with one insertion appended, the way the document driver
 * appends a passage the archive never translated.
 *
 * BUILT BY HAND rather than prepared from a mismatched pair, because the
 * deterministic aligner refuses a heading-count mismatch outright and yields no
 * slices at all; the pairing that would place the missing section is LLM
 * assisted and not what this suite is about.
 *
 * @returns Pair carrying two content slices and one insertion
 *
 * @example
 * ```ts
 * const prepared = await pairWithInsertion();
 * ```
 */
async function pairWithInsertion(): Promise<PreparedDocumentPair> {
  /**
   * Pair as the pipeline prepares it.
   */
  const sliced = await prepareDocumentPair({
    sourceText: SOURCE_TEXT,
    targetText: TARGET_TEXT,
  },);
  return {
    ...sliced,
    slices: [
      ...sliced.slices,
      {
        source: {
          sliceIndex: sliced.slices.length,
          nodes: [],
          startOffset: 0,
          endOffset: 0,
          text: MISSING_SOURCE,
        },
        target: makeInsertionChunk({
          sliceIndex: sliced.slices.length,
          offset: TARGET_TEXT.length,
        },),
      },
    ],
  };
}

/**
 * Attempts one slice of the fixture pair with the silent client.
 *
 * @param prepared - pair the slice was cut from
 *
 * @param slice - slice to attempt
 *
 * @returns What the attempt yielded
 *
 * @example
 * ```ts
 * const attempt = await attemptSilently({ prepared, slice, },);
 * ```
 */
async function attemptSilently(
  {
    prepared,
    slice,
  }: {
    readonly prepared: PreparedDocumentPair;
    readonly slice: ChunkPair;
  },
) {
  return attemptTranslateSlice({
    client: silentClient(),
    slice,
    prepared,
    models: MODELS,
    neighbouringIncumbentText: '',
    neighbouringSourceText: '',
    pictureContext: '',
    pictureFindings: [],
    signal: new AbortController().signal,
    perCallTimeoutMs: 1_000,
    l,
  },);
}

await describe({
  name: attemptTranslateSlice.name,
  children: [
    it({
      name: 'PAUSES an insertion when no translator is available rather than settling empty text',
      fn: async () => {
        /**
         * Pair carrying the untranslated passage as an insertion.
         */
        const prepared = await pairWithInsertion();

        /**
         * The insertion slice.
         */
        const insertion = prepared.slices.find(function isInsertion(slice,): boolean {
          return isInsertionChunk(slice.target,);
        },);
        if (insertion === undefined)
          throw new Error('the fixture pair carries no insertion slice',);

        await expect(attemptSilently({
          prepared,
          slice: insertion,
        },),).rejects.toThrow(TranslationRepairInterruptedError,);
      },
    },),

    it({
      name: 'SETTLES a content slice nobody answered on its incumbent, since only an insertion has nothing to '
        + 'fall back on',
      fn: async () => {
        /**
         * Pair carrying two translated sections as content.
         */
        const prepared = await pairWithInsertion();

        /**
         * A content slice.
         */
        const content = prepared.slices.find(function isContent(slice,): boolean {
          return !isInsertionChunk(slice.target,);
        },);
        if (content === undefined)
          throw new Error('the fixture pair carries no content slice',);

        const attempt = await attemptSilently({
          prepared,
          slice: content,
        },);

        expect(attempt.kind,).toBe('settled',);
        if (attempt.kind === 'settled') {
          expect(attempt.record.changed,).toBe(false,);
          expect(attempt.record.outputText,).toBe(content.target.text,);
        }
      },
    },),
  ],
},);
