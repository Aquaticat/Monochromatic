import type { FrontMatterAuthority, } from './prepared-document-pair.ts';

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
import type { PairedSectionRecord, } from './pair-blocks-stage.ts';
import type { BlockPair, } from './pair-blocks-wire.ts';
import type { DefinitionLabelPair, } from './pair-definition-order.ts';
import type { PairedDocumentRecord, } from './pair-sections-stage.ts';
import { parseDocument, } from './parse-document.ts';
import { prepareBlockPairing, } from './prepare-block-pairing.ts';
import { buySectionPairing, } from './prepare-section-round.ts';
import type { SliceCache, } from './slice-cache.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

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
// the deterministic aligner, and the finding says which sections went that way.
// `prepareBlockPairing` exposes that state so a calibration planner can refuse
// uncorroborated inputs without changing production's fallback policy.

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

  /**
   * Every footnote definition the roster paired with one of the other side's,
   * by label, across the chunks, for the archive relabel.
   */
  readonly footnoteDefinitionPairs: readonly DefinitionLabelPair[];
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
 * @param pairingCache - store the per-section BLOCK rounds republish from
 *
 * @param sectionCache - store the whole-document SECTION round republishes
 * from, kept apart from `pairingCache` because the two answer different
 * questions and a key space holding both would let one kind of record be read
 * as the other
 *
 * @param contextLines - evidence lines bought outside preparation, passed
 * through to the identity context untouched
 *
 * @param frontMatterAuthority - existing caller policy for metadata ownership
 *
 * @param sealArchiveOriginal - existing protection for archive wording declared English-original
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
    pairingCache,
    sectionCache,
    contextLines,
    frontMatterAuthority,
    sealArchiveOriginal,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly modelIds: readonly RosterModelId[];
    readonly sourceText: string;
    readonly targetText: string;
    readonly signal: AbortSignal;
    readonly exchangeTimeoutMs: number;
    readonly l: Logger;
    readonly sliceCharBudget?: number;
    readonly pairingCache?: SliceCache<PairedSectionRecord>;
    readonly sectionCache?: SliceCache<PairedDocumentRecord>;
    readonly contextLines?: readonly string[];
    readonly frontMatterAuthority?: FrontMatterAuthority;
    readonly sealArchiveOriginal?: boolean;
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
   * Source parsed for section alignment and the block questions.
   * Pure preparation parses it again so its output depends only on its explicit inputs.
   */
  const source = parseDocument({ text: sourceText, },);
  /**
   * Whole translation document, parsed beside the source.
   */
  const target = parseDocument({ text: targetText, },);
  /**
   * Section correspondence is bought only where the deterministic aligner refused.
   * Block questions require this alignment to exist before they can be posed.
   */
  const sectionRound = await buySectionPairing({
    client,
    modelIds,
    source,
    target,
    signal,
    exchangeTimeoutMs,
    l: pl,
    ...((sectionCache === undefined) ? {} : { sectionCache, }),
  },);
  /**
   * Correspondences to align on, absent when nobody was asked or nobody agreed.
   */
  const { pairing, } = sectionRound;
  /**
   * Missing correspondence preserves the deterministic aligner rather than supplying an empty pairing.
   */
  const sectionPairing = (pairing.length === 0) ? undefined : pairing;
  /**
   * Aligned sections whose original indexes the block-round findings retain.
   */
  const alignment = alignDocumentSections({
    source,
    target,
    ...((sectionPairing === undefined) ? {} : { sectionPairing, }),
  },);
  /**
   * Explicit block pairings keyed by original alignment index.
   */
  const blockPairings = new Map<number, readonly BlockPair[]>();
  /**
   * Section findings precede the block findings exactly as on the original path.
   */
  const findings: string[] = [...sectionRound.findings,];
  /**
   * Definition labels separated from each parent's ordinary slicer ordering.
   */
  const footnoteDefinitionPairs: DefinitionLabelPair[] = [];
  for (const [pairIndex, pair,] of alignment.pairs
    .entries()) {
    /* oxlint-disable no-await-in-loop -- parent rounds remain sequential rather than multiplying the provider fanout */
    /**
     * The same parent operation a bounded calibration pool consumes independently.
     */
    const round = await prepareBlockPairing({
      client,
      modelIds,
      pair,
      pairIndex,
      targetContainers: target.containers,
      signal,
      exchangeTimeoutMs,
      l: pl,
      ...((pairingCache === undefined) ? {} : { pairingCache, }),
    },);
    /* oxlint-enable no-await-in-loop */
    findings.push(...round.findings,);
    footnoteDefinitionPairs.push(...round.definitionPairs,);
    if (round.kind === 'paired')
      blockPairings.set(
        pairIndex,
        round.pairs,
      );
  }
  /**
   * Preparation built on whatever the roster agreed, preserving every existing caller option.
   */
  const prepared = prepareDocumentPair({
    sourceText,
    targetText,
    ...((sliceCharBudget === undefined) ? {} : { sliceCharBudget, }),
    ...((sectionPairing === undefined) ? {} : { sectionPairing, }),
    ...((contextLines === undefined) ? {} : { contextLines, }),
    ...((frontMatterAuthority === undefined) ? {} : { frontMatterAuthority, }),
    ...((sealArchiveOriginal === undefined) ? {} : { sealArchiveOriginal, }),
    blockPairings,
  },);
  // Pairing findings remain on the artifact's existing alignment channel.
  return {
    prepared: {
      ...prepared,
      alignmentFindings: [
        ...prepared.alignmentFindings,
        ...findings,
      ],
    },
    findings,
    footnoteDefinitionPairs,
  };
}

//endregion Preparation with roster pairing
