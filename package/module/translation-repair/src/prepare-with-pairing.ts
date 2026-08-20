import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import { alignDocumentSections, } from './chunk-document.ts';
import {
  prepareDocumentPair,
  type PreparedDocumentPair,
} from './document-preparation.ts';
import { pairBlocksWithRoster, } from './pair-blocks-stage.ts';
import type { BlockPair, } from './pair-blocks-wire.ts';
import { parseDocument, } from './parse-document.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';

//region Preparation with roster pairing
// THE ONE PLACE A MODEL TOUCHES PREPARATION, and it is deliberately outside it.
//
// `prepareDocumentPair` stays pure and synchronous: it takes a pairing as DATA.
// That keeps its result a function of its inputs, which is what lets a run cache
// slices by content and what stops a preparation from depending on which models
// answered that day. This function is the async shell that buys the pairing and
// hands it over.
//
// PER SECTION, NOT PER DOCUMENT. The grouper works inside one aligned section
// and indices are section-local, so the roster is asked the question it can
// answer about the text it is shown. Sections also keep each sheet small.
//
// SILENCE FALLS BACK RATHER THAN FAILING. A section the roster cannot pair keeps
// the deterministic aligner, which is worse but not wrong in the way a guessed
// pairing is, and the finding says which sections went that way.

/**
 * A preparation and what the pairing cost to obtain.
 *
 * @example
 * ```ts
 * const { prepared, findings, } = await prepareDocumentPairWithRoster({ ... },);
 * ```
 */
export type PairedPreparation = {
  /**
   * Slicing both lanes run over.
   */
  readonly prepared: PreparedDocumentPair;

  /**
   * What the pairing rounds reported, in scorecard-stable wording.
   */
  readonly findings: readonly string[];
};

/**
 * Prepares a document pair, asking the roster which paragraph renders which.
 *
 * @param client - injected model client
 *
 * @param modelIds - roster to ask
 *
 * @param sourceText - whole original document
 *
 * @param targetText - whole translation document
 *
 * @param signal - caller's steering
 *
 * @param exchangeTimeoutMs - per-call bound
 *
 * @param l - driver logger
 *
 * @param sliceCharBudget - slice sizing, passed through untouched
 *
 * @returns Preparation built on the roster's pairing, and its findings
 *
 * @example
 * ```ts
 * const { prepared, } = await prepareDocumentPairWithRoster({ client, modelIds, sourceText, targetText, signal, exchangeTimeoutMs, l, },);
 * ```
 */
export async function prepareDocumentPairWithRoster(
  {
    client,
    modelIds,
    sourceText,
    targetText,
    signal,
    exchangeTimeoutMs,
    l,
    sliceCharBudget,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly modelIds: readonly SyntheticModelId[];
    readonly sourceText: string;
    readonly targetText: string;
    readonly signal: AbortSignal;
    readonly exchangeTimeoutMs: number;
    readonly l: Logger;
    readonly sliceCharBudget?: number;
  }>,
): Promise<PairedPreparation> {
  /**
   * Logger tagged with this shell.
   */
  const pl = tagged({
    tag: prepareDocumentPairWithRoster.name,
    l,
  },);

  /**
   * Aligned sections, which decide what the roster is asked about.
   *
   * Parsed here and again inside preparation. That is one extra parse of a
   * document already in memory, and it buys a preparation that stays a pure
   * function of its arguments.
   */
  const alignment = alignDocumentSections({
    source: parseDocument({ text: sourceText, },),
    target: parseDocument({ text: targetText, },),
  },);

  /**
   * Pairing per aligned section, keyed by its index.
   */
  const blockPairings = new Map<number, readonly BlockPair[]>();

  /**
   * What the rounds reported.
   */
  const findings: string[] = [];
  for (
    const [pairIndex, pair,] of alignment
      .pairs
      .entries()
  ) {
    /**
     * This section's original blocks.
     */
    const sourceBlocks = pair.source
      .nodes
      .map(function toNumbered(
        node,
        index,
      ) {
        return {
          index,
          text: node.text,
        };
      },);

    /**
     * This section's translation blocks.
     */
    const targetBlocks = pair.target
      .nodes
      .map(function toNumbered(
        node,
        index,
      ) {
        return {
          index,
          text: node.text,
        };
      },);

    // NOTHING TO PAIR is not a question worth buying: one block against one
    // block has exactly one answer, and an empty side has none.
    if ((sourceBlocks.length < 2) && (targetBlocks.length < 2))
      continue;
    if ((sourceBlocks.length === 0) || (targetBlocks.length === 0))
      continue;

    /**
     * What the roster agreed on for this section.
     */
    // eslint-disable-next-line no-await-in-loop -- sections are asked in order so one document's rounds never fan out over the whole provider at once, which is the same reason both lanes run sequentially
    const outcome = await pairBlocksWithRoster({
      client,
      modelIds,
      sourceBlocks,
      targetBlocks,
      signal,
      exchangeTimeoutMs,
      l: pl,
    },);
    findings.push(...outcome.findings,);

    /**
     * Correspondences this section's round agreed on.
     */
    const { pairs, } = outcome;
    if (pairs.length === 0) {
      findings.push(`block-pairing section ${String(pairIndex,)} fell back to scoring`,);
      pl.warn(`section ${String(pairIndex,)}: no agreed pairing, keeping the deterministic aligner`,);
      continue;
    }
    blockPairings.set(
      pairIndex,
      pairs,
    );
  }

  /**
   * Preparation built on whatever the roster agreed.
   */
  const prepared = prepareDocumentPair({
    sourceText,
    targetText,
    ...((sliceCharBudget === undefined) ? {} : { sliceCharBudget, }),
    blockPairings,
  },);

  // PAIRING FINDINGS RIDE THE ALIGNMENT CHANNEL, which already reaches the
  // artifact. A section that fell back to scoring is an alignment fact about
  // that entry, and a reader asking "was this document paired properly" should
  // find the answer in the place they already look rather than a second list.
  return {
    prepared: {
      ...prepared,
      alignmentFindings: [
        ...prepared.alignmentFindings,
        ...findings,
      ],
    },
    findings,
  };
}

//endregion Preparation with roster pairing
