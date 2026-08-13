import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  alignDocumentSections,
  type ChunkPair,
} from '../chunk-document.ts';
import { readCorpusFile, } from '../corpus-source.ts';
import { parseDocument, } from '../parse-document.ts';
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
   * Sheet the translators read.
   */
  const plan = buildTranslateMessages({
    sourceText: sourceSection,
    existingText: targetSection,
  },);

  /**
   * Translator voices over this section.
   */
  const gather = await gatherStageVoices({
    client: createRunClient(),
    modelIds: RUN_MODELS.editorModelIds,
    messages: plan.messages,
    signal: AbortSignal.timeout(RUN_PER_CALL_TIMEOUT_MS * 2,),
    exchangeTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    responseFormat: TRANSLATE_RESPONSE_FORMAT,
    validate: isTranslateReportWire,
    stage: 'translate-probe',
    l,
  },);

  /**
   * Voices heard, against the roster asked.
   */
  const {
    voices,
    findings,
  } = gather;

  /**
   * How many spoke.
   */
  const heard = voices.length;

  /**
   * Roster the stage asked.
   */
  const { editorModelIds, } = RUN_MODELS;

  /**
   * Roster size for the same line.
   */
  const asked = editorModelIds.length;
  console.log(`TRANSLATE ${String(heard,)}/${String(asked,)} voices heard`,);
  for (const voice of voices) {
    /**
     * Rendered English from this voice.
     */
    const { translation, } = voice.value;

    /**
     * Blocks the rendered English parses to, which is the number worth
     * comparing against the source side.
     */
    const { nodes: renderedNodes, } = parseDocument({ text: translation, },);
    console.log(
      `\n===== ${voice.modelId}: ${String(translation.length,)} chars, ${
        String(renderedNodes.length,)
      } blocks =====`,
    );
    console.log(translation,);
  }
  for (const finding of findings)
    console.log(`TRANSLATE finding: ${finding}`,);
}

await main();

//endregion Translate probe
