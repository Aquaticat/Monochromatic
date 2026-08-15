/**
 * Tests for the translate lane's document driver.
 *
 * What this covers that the stage tests cannot: that EVERY slice is visited,
 * that the alignment guard protects archive text the source cannot account for,
 * that a cached slice costs no calls, and that the document reassembles from
 * per-slice decisions rather than from one whole-document rewrite.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
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
  type ChatJsonOutcome,
  type ChatJsonRequest,
  prepareDocumentPair,
  type SyntheticClient,
  type SyntheticModelId,
  translateDocument,
  type TranslateModels,
  type TranslateSliceRecord,
} from '../dist/final/node/index.mjs';

/**
 * Logger for the driver under test.
 */
const l = tagged({ tag: 'translate-document-test', },);

/**
 * Original document: two sections, each one paragraph.
 */
const SOURCE_TEXT = `## 第一节

猫猫在窗台上打盹。

## 第二节

窗台上有一只鸟。
`;

/**
 * Translation as it stands, awkward but complete.
 */
const TARGET_TEXT = `## Section one

The cat is doing the sleeping on the windowsill.

## Section two

On the windowsill there is being a bird.
`;

/**
 * Sentence every translator returns for the first section, so the slate
 * collapses to one fresh candidate and the judges have a clear winner.
 */
const FRESH = 'The cat naps on the windowsill.';

/**
 * Renders one slice the way a translator that respected block structure would.
 *
 * A slice carries its heading, so a rendering that dropped it would fail
 * structural validation rather than test the driver.
 *
 * @param content - translator prompt, which carries the slice original
 *
 * @returns Rendering for that slice
 *
 * @example
 * ```ts
 * const rendering = renderingFor({ content, },);
 * ```
 */
function renderingFor({ content, }: { readonly content: string; },): string {
  if (content.includes('第一节',))
    return `## Section one\n\n${FRESH}`;
  if (content.includes('第二节',))
    return '## Section two\n\nA bird sits on the windowsill.';
  return FRESH;
}

/**
 * Models that render each slice.
 */
const TRANSLATORS: readonly SyntheticModelId[] = [
  'hf:moonshotai/Kimi-K3',
  'hf:zai-org/GLM-5.2',
  'hf:zai-org/GLM-4.7-Flash',
];

/**
 * Rosters the driver seats.
 */
const MODELS: TranslateModels = {
  translatorModelIds: TRANSLATORS,
  judgeModelIds: [
    ...TRANSLATORS,
    'hf:Qwen/Qwen3.6-27B',
    'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
    'hf:openai/gpt-oss-120b',
  ],
};

/**
 * Calls the driver made, so a case can prove a resumed slice bought nothing.
 */
type CallLog = {
  translate: number;
  select: number;
};

/**
 * Finds the one-based candidate index whose rendered text carries a needle,
 * reading the judge sheet the way a judge does rather than assuming an order the
 * lane deliberately varies.
 *
 * @param content - judge user message
 *
 * @param needle - text the wanted candidate contains
 *
 * @returns One-based index, or zero when no candidate carries it
 *
 * @example
 * ```ts
 * const best = pickCandidate({ content, needle: FRESH, },);
 * ```
 */
function pickCandidate(
  {
    content,
    needle,
  }: {
    readonly content: string;
    readonly needle: string;
  },
): number {
  /**
   * Sheet split at each candidate heading; the first piece is the evidence.
   */
  const [, ...blocks] = content.split('CANDIDATE ',);
  for (const block of blocks) {
    /**
     * Heading line carrying this candidate's number.
     */
    const [heading = '',] = block.split('\n',);

    /**
     * Number the heading states.
     */
    const index = Math.trunc(Number(heading,),);
    if (Number.isInteger(index,) && block.includes(needle,))
      return index;
  }
  return 0;
}

/**
 * Client serving both stages of the lane from one script.
 *
 * @param calls - shared call log the cases assert on
 *
 * @returns Client honoring the script
 *
 * @example
 * ```ts
 * const client = laneClient({ calls, },);
 * ```
 */
function laneClient(
  { calls, }: { readonly calls: CallLog; },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused by the translate lane',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      /**
       * Schema the caller asked for, which names the stage.
       */
      const schema = request.responseFormat
        ?.json_schema
        .name;
      /**
       * Everything the caller sent, which carries the slice original.
       */
      const content = request.messages
        .map(function toContent(message,) {
          return message.content;
        },)
        .join('\n',);
      if (schema === 'translation_report') {
        calls.translate += 1;

        /**
         * Wire reply carrying the scripted rendering.
         */
        const value: unknown = { translation: renderingFor({ content, },), };
        if (!request.validate(value,))
          throw new Error('scripted translation failed the wire guard',);
        return {
          kind: 'ok',
          value,
          rawText: JSON.stringify(value,),
        };
      }
      calls.select += 1;

      /**
       * Ballot naming the fresh rendering.
       */
      const ballot: unknown = {
        best: pickCandidate({
          content,
          needle: FRESH,
        },),
        reason: 'scripted',
      };
      if (!request.validate(ballot,))
        throw new Error('scripted ballot failed the wire guard',);
      return {
        kind: 'ok',
        value: ballot,
        rawText: JSON.stringify(ballot,),
      };
    },
    quotas: async () => {
      throw new Error('quotas unused by the translate lane',);
    },
  };
}

/**
 * Runs the driver over a document pair.
 *
 * @param sourceText - original document
 *
 * @param targetText - translation as it stands
 *
 * @param resumed - records a previous run settled, keyed as the driver keys
 * them
 *
 * @returns Result, the call log, and everything persisted
 *
 * @example
 * ```ts
 * const { result, calls, } = await runDriver({},);
 * ```
 */
async function runDriver(
  {
    sourceText = SOURCE_TEXT,
    targetText = TARGET_TEXT,
    resumed = new Map<string, TranslateSliceRecord>(),
  }: {
    readonly sourceText?: string;
    readonly targetText?: string;
    readonly resumed?: ReadonlyMap<string, TranslateSliceRecord>;
  },
) {
  /**
   * Calls each stage made.
   */
  const calls: CallLog = {
    translate: 0,
    select: 0,
  };

  /**
   * Records this run settled, by key.
   */
  const persisted = new Map<string, TranslateSliceRecord>();

  /**
   * What the lane decided for the whole document.
   */
  const result = await translateDocument({
    client: laneClient({ calls, },),
    prepared: prepareDocumentPair({
      sourceText,
      targetText,
    },),
    models: MODELS,
    signal: new AbortController().signal,
    perCallTimeoutMs: 1_000,
    sliceCache: {
      resumed,
      persist: async ({
        key,
        serialized,
      },) => {
        persisted.set(
          key,
          JSON.parse(serialized,) as TranslateSliceRecord,
        );
      },
    },
    l,
  },);
  return {
    result,
    calls,
    persisted,
  };
}

await describe({
  name: translateDocument.name,
  children: [
    it({
      name: 'visits EVERY slice, which is the whole reason this lane exists: '
        + 'the repair driver returns early on exactly the slices translation is '
        + 'meant to recover, so a fluent but mediocre translation nobody '
        + 'complains about would never be looked at',
      fn: async () => {
        const { result, } = await runDriver({},);
        expect(result.slices,).toHaveLength(result.sliceCount,);
        expect(result.sliceCount,).toBeGreaterThan(1,);
        for (const record of result.slices)
          expect(record.kind,).toBe('translate-slice',);
      },
    },),

    it({
      name: 'REASSEMBLES the document from per-slice decisions, leaving every '
        + 'byte outside the slices untouched: headings and blank lines belong '
        + 'to the document rather than to any slice',
      fn: async () => {
        const { result, } = await runDriver({},);
        expect(result.translatedText,).toContain('## Section one',);
        expect(result.translatedText,).toContain('## Section two',);
        expect(result.translatedText,).toContain(FRESH,);
        expect(result.changedSliceCount,).toBeGreaterThan(0,);
      },
    },),

    it({
      name: 'records what each slice decided, including the slate and every '
        + 'ballot, so a shipped translation can be traced to the round that '
        + 'chose it rather than to a log line that may not survive the run',
      fn: async () => {
        const { result, } = await runDriver({},);
        for (const record of result.slices) {
          expect(record.stageResult.slate.length,).toBeGreaterThan(0,);
          expect(record.alignment.kind,).toBe('within-limit',);
        }
      },
    },),

    it({
      name: 'PERSISTS every settled slice as it goes, so a run killed at its '
        + 'cap leaves everything it already bought rather than starting over',
      fn: async () => {
        const { result, persisted, } = await runDriver({},);
        expect(persisted.size,).toBe(result.sliceCount,);
      },
    },),

    it({
      name: 'RESUMES a settled slice without spending a call, and refuses a '
        + 'cached record that names another slice: a key derivation and a '
        + 'slicing that disagree would otherwise splice one slice\'s text over '
        + 'another and produce plausible prose',
      fn: async () => {
        const { persisted, } = await runDriver({},);
        const { calls, result, } = await runDriver({ resumed: persisted, },);
        expect(calls.translate,).toBe(0,);
        expect(calls.select,).toBe(0,);
        expect(result.resumedSliceCount,).toBe(result.sliceCount,);

        /**
         * Same records under the same keys, each claiming the wrong slice.
         */
        const misfiled = new Map(
          [...persisted.entries(),].map(function toMisfiled([key, record,],) {
            return [
              key,
              {
                ...record,
                chunkIndex: record.chunkIndex + 1,
              },
            ] as const;
          },),
        );
        await expect(runDriver({ resumed: misfiled, },),)
          .rejects
          .toThrow('the key derivation and the slicing',);
      },
    },),

    it({
      name: 'REFUSES to replace archive text the source cannot account for, '
        + 'and records the refusal as its own disposition. The judges are not '
        + 'wrong here: asked which text better renders a heading, they pick the '
        + 'rendering of the heading, and the passage it would replace is the '
        + 'thing the archive came for',
      fn: async () => {
        const { result, } = await runDriver({
          sourceText: `## 第一节

其一：

## 第二节

窗台上有一只鸟。
`,
          targetText: `## Section one

But we must remember that the cat sleeping on the windowsill has been there `
            + `since the spring, and the household has arranged itself around `
            + `that habit rather than against it, which is the sort of thing `
            + `nobody writes down until it is gone.

## Section two

On the windowsill there is being a bird.
`,
        },);
        expect(result.refusedSliceCount,).toBe(1,);

        /**
         * Slice the guard protected.
         */
        const [refused,] = result.slices
          .filter(function wasRefused(record,): boolean {
            return record.disposition === 'refused-alignment';
          },);
        expect(refused?.changed,).toBe(false,);
        expect(refused?.outputText,).toContain('nobody writes down',);
        // The stage result is kept whole, so "the judges wanted a replacement
        // and the guard refused" stays distinguishable from "the judges kept
        // the incumbent". Both ship the same text and mean opposite things.
        expect(refused?.stageResult.text,).toContain(FRESH,);
        expect(result.findings.some(function isRefusal(finding,): boolean {
          return finding.startsWith('translate-refused-alignment',);
        },),).toBe(true,);
      },
    },),
  ],
},);
