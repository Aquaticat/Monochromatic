import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  alignDocumentSections,
  type ChunkPair,
} from '../chunk-document.ts';
import { readCorpusFile, } from '../corpus-source.ts';
import { parseDocument, } from '../parse-document.ts';
import {
  SLICE_CHAR_BUDGET,
  subdivideChunkPair,
} from '../slice-pair.ts';
import { gatherStageVoices, } from '../stage-quorum.ts';
import {
  buildTranslateMessages,
  isTranslateReportWire,
  TRANSLATE_RESPONSE_FORMAT,
} from '../translate-wire.ts';
import {
  createRunClient,
  RUN_CORPUS_PIN,
  RUN_MODELS,
  RUN_PER_CALL_TIMEOUT_MS,
} from './run-config.ts';

//region Translate probe
// PROTOTYPE for `#70`. Asks whether a translate stage can do what the repair
// loop demonstrably cannot: render a section the corpus never translated.
//
// The case is real and is the worst one measured. In `XingZ60` an aligned
// section holds 76 source blocks against 5 target blocks. The current pipeline
// treats that as a translation with defects in it, so the critics file omission
// after omission and the editor writes English one accepted issue at a time.
//
// Reports characters in and out, block counts, and how far the voices agree,
// then prints the rendered text so it can be read against the original. It
// writes nothing and changes no pipeline behaviour.

/**
 * Entry carrying the worst measured coverage gap.
 */
const PROBE_ENTRY = 'XingZ60';

/**
 * Ratio below which a section counts as barely translated for this probe.
 *
 * Only picks which section to demonstrate on. Nothing downstream reads it, and
 * choosing a threshold for production is exactly the question `#69` asked and
 * the user rejected, so it is deliberately local to this file.
 */
const SPARSE_RATIO = 0.25;

/**
 * Decimal places a coverage ratio prints with.
 */
const RATIO_DIGITS = 3;

/**
 * Slices translated in one probe run.
 *
 * The first attempt asked for a whole 4641-character section in one call and
 * lost two voices of three: one timed out at six minutes, one returned
 * schema-invalid output. Editors in this pipeline work on regions of median 75
 * characters and at most 562, so that call was eight times larger than anything
 * the stage has ever been asked for. A translate stage would run at SLICE
 * granularity like every other stage, and this now does.
 */
const PROBE_SLICES = 3;

/**
 * Share of a pair's source blocks the translation covers.
 *
 * @param pair - aligned section pair
 *
 * @returns Target blocks divided by source blocks
 *
 * @example
 * ```ts
 * const ratio = coverageOf({ pair, },);
 * ```
 */
function coverageOf({ pair, }: { readonly pair: ChunkPair; },): number {
  /**
   * Blocks on each side.
   */
  const sourceBlocks = pair.source
    .nodes
    .length;

  /**
   * Target blocks, which may be far fewer.
   */
  const targetBlocks = pair.target
    .nodes
    .length;

  return targetBlocks / Math.max(
    sourceBlocks,
    1,
  );
}

/**
 * Runs one translator ensemble over the sparsest aligned section.
 *
 * @example
 * ```ts
 * await main();
 * ```
 */
async function main(): Promise<void> {
  /**
   * Logger tagged for this probe.
   */
  const l = tagged({ tag: 'translate-probe', },);

  /**
   * Original document at the pinned commit.
   */
  const sourceText = await readCorpusFile({
    pin: RUN_CORPUS_PIN,
    relPath: `people/${PROBE_ENTRY}/page.md`,
  },);

  /**
   * Translation at the same commit.
   */
  const targetText = await readCorpusFile({
    pin: RUN_CORPUS_PIN,
    relPath: `people/${PROBE_ENTRY}/page.en.md`,
  },);

  /**
   * Aligned section pairs.
   */
  const alignment = alignDocumentSections({
    source: parseDocument({ text: sourceText, },),
    target: parseDocument({ text: targetText, },),
  },);

  /**
   * Sparsest section by block ratio, which is the one worth demonstrating on.
   */
  const sparsest = alignment.pairs
    .filter(function hasSource(pair,) {
      /**
       * Source blocks this pair carries.
       */
      const { nodes, } = pair.source;

      return nodes.length > 0;
    },)
    .toSorted(function byRatio(
      left,
      right,
    ) {
      return coverageOf({ pair: left, },) - coverageOf({ pair: right, },);
    },)
    .at(0,);
  if (sparsest === undefined) {
    console.log('TRANSLATE no aligned section carries source blocks',);
    return;
  }

  /**
   * Coverage of the section being demonstrated on.
   */
  const ratio = coverageOf({ pair: sparsest, },);

  /**
   * Sizes of the section, pulled out so the log line carries no chains.
   */
  const {
    nodes: sourceNodes,
    text: sourceSection,
  } = sparsest.source;

  /**
   * Same for the translation side.
   */
  const {
    nodes: targetNodes,
    text: targetSection,
  } = sparsest.target;

  /**
   * Block and character counts for the line below.
   */
  const sourceBlocks = sourceNodes.length;

  /**
   * Characters of original in this section.
   */
  const sourceChars = sourceSection.length;

  /**
   * Blocks the translation carries.
   */
  const targetBlocks = targetNodes.length;

  /**
   * Characters of translation in this section.
   */
  const targetChars = targetSection.length;
  console.log(
    `TRANSLATE ${PROBE_ENTRY}: source ${
      String(sourceBlocks,)
    } blocks / ${String(sourceChars,)} chars, target ${
      String(targetBlocks,)
    } blocks / ${String(targetChars,)} chars, coverage ${
      ratio.toFixed(RATIO_DIGITS,)
    }${ratio < SPARSE_RATIO ? ' (barely translated)' : ''}`,
  );

  /**
   * Roster the stage asks.
   */
  const { editorModelIds, } = RUN_MODELS;

  /**
   * Paragraph-bound slices of this section, exactly as the pipeline cuts them.
   */
  const slices = subdivideChunkPair({
    pair: sparsest,
    sourceText,
    targetText,
    baseIndex: 0,
    budget: SLICE_CHAR_BUDGET,
  },);
  console.log(
    `TRANSLATE section subdivides into ${String(slices.length,)} slices; probing the first ${String(PROBE_SLICES,)}`,
  );

  /* oxlint-disable no-await-in-loop -- sequential by design so this never competes with a running corpus pass for per-model stream slots */
  for (const slice of slices.slice(
    0,
    PROBE_SLICES,
  )) {
    /**
     * Texts of this slice.
     */
    const { text: sliceSource, } = slice.source;

    /**
     * Translation side, empty where the section was never translated.
     */
    const { text: sliceTarget, } = slice.target;
    console.log(
      `\n--- slice: ${String(sliceSource.length,)} source chars, ${
        String(sliceTarget.length,)
      } target chars ---`,
    );
    console.log(`SOURCE: ${sliceSource}`,);

    /**
     * Sheet the translators read for this slice.
     */
    const plan = buildTranslateMessages({
      sourceText: sliceSource,
      existingText: sliceTarget,
    },);

    try {
      /**
       * Translator voices over this slice.
       */
      const gather = await gatherStageVoices({
        client: createRunClient(),
        modelIds: editorModelIds,
        messages: plan.messages,
        signal: AbortSignal.timeout(RUN_PER_CALL_TIMEOUT_MS,),
        exchangeTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
        responseFormat: TRANSLATE_RESPONSE_FORMAT,
        validate: isTranslateReportWire,
        stage: 'translate-probe',
        l,
      },);

      /**
       * Voices heard for this slice.
       */
      const {
        voices,
        findings,
      } = gather;
      console.log(
        `HEARD ${String(voices.length,)}/${String(editorModelIds.length,)}`,
      );
      for (const voice of voices) {
        /**
         * Rendered English from this voice.
         */
        const { translation, } = voice.value;
        console.log(`  ${voice.modelId}: ${translation}`,);
      }
      for (const finding of findings)
        console.log(`  finding: ${finding}`,);
    }
    catch (error) {
      // Reported rather than fatal. The first run died on an uncaught timeout
      // and lost every slice after it, which turns one slow call into no
      // measurement at all.
      console.log(`  SLICE FAILED: ${String(error,)}`,);
    }
  }
  /* oxlint-enable no-await-in-loop */
}

await main();

//endregion Translate probe
