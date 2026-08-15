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
  RosterConfigurationError,
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
  // A notes section is rendered faithfully, marker and all, which is what makes
  // the footnote case about the REFERENCE that went missing rather than about a
  // pair that vanished together.
  if (content.includes('〔1〕：',))
    return '## Notes\n\n[^1]: The spot it likes best.';
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

  /**
   * Judge calls ATTEMPTED, whether or not one came back. A stage that keeps
   * fanning out after the run was stopped shows up here and nowhere else.
   */
  selectAttempts: number;
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
 * @param controller - abort the script may fire, standing in for the entry
 * deadline the corpus pass imposes
 *
 * @param abortAfterTranslateCalls - translate calls served before the script
 * aborts; absent means it never does
 *
 * @param silentTranslators - whether every translate call fails, standing in for
 * a provider that is down while the signal stays live
 *
 * @returns Client honoring the script
 *
 * @example
 * ```ts
 * const client = laneClient({ calls, controller, },);
 * ```
 */
function laneClient(
  {
    calls,
    controller,
    abortAfterTranslateCalls,
    silentTranslators = false,
  }: {
    readonly calls: CallLog;
    readonly controller: AbortController;
    readonly abortAfterTranslateCalls?: number;
    readonly silentTranslators?: boolean;
  },
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
        if ((abortAfterTranslateCalls !== undefined)
          && (calls.translate >= abortAfterTranslateCalls))
          controller.abort(new Error('entry deadline reached',),);
        // What the real transport does under an aborted signal: the stream is
        // torn down and the failure propagates untouched. The gather machinery
        // turns that into a LOST VOICE rather than a throw, which is exactly
        // the condition these cases exist to pin.
        if (request.signal
          .aborted)
          throw new Error('exchange torn down by abort',);
        if (silentTranslators)
          throw new Error('translator provider is down',);
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
      calls.selectAttempts += 1;
      if (request.signal
        .aborted)
        throw new Error('exchange torn down by abort',);
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
 * @param abortAfterTranslateCalls - translate calls served before the script
 * aborts the run
 *
 * @param silentTranslators - whether every translate call fails while the signal
 * stays live
 *
 * @param persisted - map the run writes settled records into; passed in so a
 * case that expects a REJECTION can still read what reached the cache
 *
 * @param calls - log the run counts into, passed in for the same reason
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
    abortAfterTranslateCalls,
    silentTranslators = false,
    persisted = new Map<string, TranslateSliceRecord>(),
    calls = {
      translate: 0,
      select: 0,
      selectAttempts: 0,
    },
  }: {
    readonly sourceText?: string;
    readonly targetText?: string;
    readonly resumed?: ReadonlyMap<string, TranslateSliceRecord>;
    readonly abortAfterTranslateCalls?: number;
    readonly silentTranslators?: boolean;
    readonly persisted?: Map<string, TranslateSliceRecord>;
    readonly calls?: CallLog;
  },
) {
  /**
   * Run steering, which the script may abort part way through the document.
   */
  const controller = new AbortController();

  /**
   * What the lane decided for the whole document.
   */
  const result = await translateDocument({
    client: laneClient({
      calls,
      controller,
      ...((abortAfterTranslateCalls === undefined)
        ? {}
        : { abortAfterTranslateCalls, }),
      silentTranslators,
    },),
    prepared: prepareDocumentPair({
      sourceText,
      targetText,
    },),
    models: MODELS,
    signal: controller.signal,
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
      name: 'REFUSES a roster with nobody in it BEFORE buying anything, which is the whole point: '
        + 'a stage that can never speak settles exactly like one whose voices all failed, so an '
        + 'unconfigured pass would spend hours writing settled documents nobody translated and '
        + 'every later reader would take them for pages that needed no work',
      fn: async () => {
        /**
         * Client that fails any exchange, so the case proves nothing was bought
         * rather than only that the run refused.
         */
        const client: SyntheticClient = {
          chatText: async () => {
            throw new Error('no exchange may be attempted under an empty roster',);
          },
          chatJson: async () => {
            throw new Error('no exchange may be attempted under an empty roster',);
          },
          quotas: async () => {
            throw new Error('no exchange may be attempted under an empty roster',);
          },
        };

        /**
         * Failure the driver raised.
         */
        let caught: unknown;
        try {
          await translateDocument({
            client,
            prepared: prepareDocumentPair({
              sourceText: SOURCE_TEXT,
              targetText: TARGET_TEXT,
            },),
            models: {
              translatorModelIds: [],
              judgeModelIds: [],
            },
            signal: new AbortController().signal,
            perCallTimeoutMs: 1_000,
            l,
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(RosterConfigurationError,);
        expect(String(caught,),).toContain('translatorModelIds',);
        expect(String(caught,),).toContain('judgeModelIds',);
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
      name: 'RESUMES a settled slice without spending a call, and STAMPS what it resumes with the '
        + 'index it asked under rather than the one the record carries. Since version 2 the key is '
        + 'the texts and the run shape, so a record legitimately answers for any slice with the same '
        + 'texts, and trusting its own index would splice one slice\'s text over another',
      fn: async () => {
        const { persisted, result: firstRun, } = await runDriver({},);
        const { calls, result, } = await runDriver({ resumed: persisted, },);
        expect(calls.translate,).toBe(0,);
        expect(calls.select,).toBe(0,);
        expect(result.resumedSliceCount,).toBe(result.sliceCount,);

        /**
         * Same records under the same keys, each carrying an index that names
         * some other slice.
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

        /**
         * Run resuming every slice from those records.
         */
        const restamped = await runDriver({ resumed: misfiled, },);
        expect(restamped.result
          .translatedText,).toBe(firstRun.translatedText,);
        expect(restamped.result
          .slices
          .map(function toIndex(record,): number {
            return record.chunkIndex;
          },),).toEqual(firstRun.slices
          .map(function toIndex(record,): number {
            return record.chunkIndex;
          },),);
      },
    },),

    it({
      name: 'DISCARDS a cached record that contradicts its own text and buys '
        + 'that slice again, in BOTH directions. A resumed record is trusted on '
        + 'its slice index alone, so a truncated write that still parses, or a '
        + 'slicing that moved while the key did not, otherwise reaches assembly '
        + 'and fails the whole document after every other slice has been paid '
        + 'for. One bad cache file costs one slice instead, and says so in the '
        + 'findings, since a recomputed slice is otherwise indistinguishable '
        + 'from one that was never cached',
      fn: async () => {
        const { persisted, } = await runDriver({},);

        /**
         * Archive wording of each prepared slice, read from the same
         * preparation the driver builds rather than assumed from the fixture.
         */
        const incumbentByIndex = new Map(
          prepareDocumentPair({
            sourceText: SOURCE_TEXT,
            targetText: TARGET_TEXT,
          },)
            .slices
            .map(function toEntry(slice,): readonly [number, string,] {
              return [
                slice.target.chunkIndex,
                slice.target.text,
              ] as const;
            },),
        );

        /**
         * Same records under the same keys, each claiming its change while
         * carrying the wording it claims to have replaced.
         */
        const overClaiming = new Map(
          [...persisted.entries(),].map(function toPoisoned([key, record,],) {
            return [
              key,
              {
                ...record,
                outputText: incumbentByIndex.get(record.chunkIndex,)
                  ?? record.outputText,
              },
            ] as const;
          },),
        );

        /**
         * Records the poisoning actually put in a contradictory state.
         *
         * Not every record reaches one: rewriting the wording of a record that
         * already claimed no change leaves it consistent. Counted rather than
         * assumed, so the case says exactly how many slices should be bought
         * again instead of asserting a number the fixture happens to produce.
         */
        const overClaimingPoisoned = [...overClaiming.values(),]
          .filter(function wasPoisoned(record,): boolean {
            return record.changed
              && (record.outputText === incumbentByIndex.get(record.chunkIndex,));
          },)
          .length;
        expect(overClaimingPoisoned,).toBeGreaterThan(0,);

        /**
         * Run resuming the over-claiming records.
         */
        const overClaimed = await runDriver({ resumed: overClaiming, },);
        expect(overClaimed.result
          .sliceCount - overClaimed.result
          .resumedSliceCount,).toBe(overClaimingPoisoned,);
        expect(overClaimed.calls
          .translate,).toBeGreaterThan(0,);
        expect(overClaimed.result
          .findings
          .filter(function namesDiscard(finding,): boolean {
            return finding.startsWith('translate-discarded-contradictory-slice',);
          },)
          .length,).toBe(overClaimingPoisoned,);

        /**
         * The QUIETER direction: records denying a change they did make. Only
         * `changed` records become replacements, so this one used to have its
         * wording dropped at assembly with nothing said.
         */
        const underClaiming = new Map(
          [...persisted.entries(),].map(function toPoisoned([key, record,],) {
            return [
              key,
              {
                ...record,
                changed: false,
              },
            ] as const;
          },),
        );

        /**
         * Records that direction puts in a contradictory state.
         */
        const underClaimingPoisoned = [...underClaiming.values(),]
          .filter(function wasPoisoned(record,): boolean {
            return record.outputText !== incumbentByIndex.get(record.chunkIndex,);
          },)
          .length;
        expect(underClaimingPoisoned,).toBeGreaterThan(0,);

        const underClaimed = await runDriver({ resumed: underClaiming, },);
        expect(underClaimed.result
          .sliceCount - underClaimed.result
          .resumedSliceCount,).toBe(underClaimingPoisoned,);
        expect(underClaimed.result
          .findings
          .filter(function namesDiscard(finding,): boolean {
            return finding.startsWith('translate-discarded-contradictory-slice',);
          },)
          .length,).toBe(underClaimingPoisoned,);
      },
    },),

    it({
      name: 'THROWS on a caller abort rather than settling the slices it never '
        + 'bought, and caches none of them. An abort reaches every stage as '
        + 'silence rather than as a failure, so an unguarded driver ships the '
        + 'incumbent unjudged for every remaining slice and writes that to the '
        + 'cache, where the next attempt reads it as finished work',
      fn: async () => {
        /**
         * Records that reached the cache before the abort.
         */
        const persisted = new Map<string, TranslateSliceRecord>();
        await expect(runDriver({
          abortAfterTranslateCalls: TRANSLATORS.length,
          persisted,
        },),)
          .rejects
          .toThrow('entry deadline reached',);
        // The first slice was bought and settled; the second was not, and must
        // not be sitting in the cache claiming otherwise.
        expect(persisted.size,).toBe(1,);
      },
    },),

    it({
      name: 'throws on an abort that arrives AFTER a stage reached quorum, '
        + 'which is the window where nothing else notices: the voices that beat '
        + 'the abort are enough to decide, every ask it tore down is discarded '
        + 'by the round rather than raised, and the slice settles on a roster '
        + 'the abort chose',
      fn: async () => {
        /**
         * Records that reached the cache before the abort.
         */
        const persisted = new Map<string, TranslateSliceRecord>();

        /**
         * Voices a three-model roster needs, which the second slice hears
         * before the abort lands on its last translator.
         */
        const quorum = Math.ceil(TRANSLATORS.length / 2,);

        /**
         * Calls the run made, which say where it stopped.
         */
        const calls: CallLog = {
          translate: 0,
          select: 0,
          selectAttempts: 0,
        };
        await expect(runDriver({
          abortAfterTranslateCalls: TRANSLATORS.length + quorum,
          persisted,
          calls,
        },),)
          .rejects
          .toThrow('entry deadline reached',);
        expect(persisted.size,).toBe(1,);
        // The abort landed inside the second slice's translate round, so the
        // only judging this run may have paid for is the first slice's. A round
        // that returned its surviving voices instead of raising the abort would
        // have sent the whole judge roster out on a run already over.
        expect(calls.selectAttempts,).toBe(MODELS.judgeModelIds
          .length,);
      },
    },),

    it({
      name: 'settles a slice NO translator answered, and deliberately does not '
        + 'cache it: the incumbent stands for this run, and the next attempt '
        + 'asks again rather than reading a provider outage as a decision',
      fn: async () => {
        /**
         * Records that reached the cache with every translator down.
         */
        const persisted = new Map<string, TranslateSliceRecord>();
        const { result, } = await runDriver({
          silentTranslators: true,
          persisted,
        },);
        expect(result.sliceCount,).toBeGreaterThan(1,);
        expect(result.changedSliceCount,).toBe(0,);
        expect(persisted.size,).toBe(0,);
        expect(result.findings.some(function isUnheard(finding,): boolean {
          return finding.startsWith('translate-heard-no-translator',);
        },),).toBe(true,);
      },
    },),

    it({
      name: 'WITHDRAWS a replacement that would break a footnote spanning two '
        + 'slices, and counts what SHIPPED rather than what the judges chose. '
        + 'Each slice validated on its own: the sentence reads well, and the '
        + 'marker it lost belongs to a line the judges never saw',
      fn: async () => {
        const { result, } = await runDriver({
          sourceText: `## 第一节

猫猫在窗台上打盹〔1〕。

## 第二节

窗台上有一只鸟。

## 注

〔1〕：那是它最喜欢的位置。
`,
          targetText: `## Section one

The cat is doing the sleeping on the windowsill[^1].

## Section two

On the windowsill there is being a bird.

## Notes

[^1]: That is its favourite spot.
`,
        },);
        // The scripted translators render the first section WITHOUT its marker,
        // so shipping their text would leave the definition orphaned.
        expect(result.withdrawnSliceCount,).toBeGreaterThan(0,);
        expect(result.translatedText,).toContain(
          'The cat is doing the sleeping on the windowsill[^1].',
        );
        expect(result.findings
          .some(function namesWithdrawal(finding,): boolean {
            return finding.startsWith('assembly-footnote-',);
          },),).toBe(true,);
        // The record still says the judges chose a replacement; the document
        // says what it could carry. Both are true and they disagree.
        expect(result.slices
          .some(function chose(record,): boolean {
            return record.changed;
          },),).toBe(true,);
        // And the NAMED sets follow the document rather than the records, which
        // is the whole reason they exist: a reader joining two lanes by slice
        // must not credit this lane with a slice it did not change.
        expect(result.withdrawnChunkIndices
          .length,).toBe(result.withdrawnSliceCount,);
        expect(result.shippedChunkIndices
          .length,).toBe(result.changedSliceCount,);
        for (const chunkIndex of result.withdrawnChunkIndices) {
          expect(result.shippedChunkIndices
            .includes(chunkIndex,),).toBe(false,);
        }
        expect(result.shippedChunkIndices
          .toSorted(function ascending(
            left,
            right,
          ): number {
            return left - right;
          },),).toEqual(result.shippedChunkIndices,);
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
