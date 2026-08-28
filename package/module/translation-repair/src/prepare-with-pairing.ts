import { createHash, } from 'node:crypto';

import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import { alignDocumentSections, } from './chunk-document.ts';
import { declinedTargetIdsOfPairing, } from './declined-target-runs.ts';
import {
  prepareDocumentPair,
  type PreparedDocumentPair,
} from './document-preparation.ts';
import {
  pairBlocksWithRoster,
  type PairedSectionRecord,
} from './pair-blocks-stage.ts';
import type {
  BlockPair,
  NumberedBlock,
} from './pair-blocks-wire.ts';
import { claimMediaAdjacentTargets, } from './pair-media-adjacency.ts';
import type {
  PairedDocumentRecord,
} from './pair-sections-stage.ts';
import { parseDocument, } from './parse-document.ts';
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
 * @param pairingCache - store the per-section BLOCK rounds republish from
 *
 * @param sectionCache - store the whole-document SECTION round republishes
 * from, kept apart from `pairingCache` because the two answer different
 * questions and a key space holding both would let one kind of record be read
 * as the other
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
  const source = parseDocument({ text: sourceText, },);

  /**
   * Whole translation document, parsed beside it.
   */
  const target = parseDocument({ text: targetText, },);

  /**
   * Which section renders which, bought ONLY where the deterministic aligner
   * refused, which is two entries in this corpus.
   *
   * FIRST, BEFORE THE BLOCK ROUNDS BELOW. Those are asked one aligned section at
   * a time, so they are questions about an alignment that has to exist before
   * they can be posed. On `XIEPT2` no section aligns, so without this round the
   * roster is never asked anything at all and the page reaches no slice.
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
   * Correspondences to align on, absent when nobody was asked or nobody agreed,
   * which is what keeps the deterministic aligner in place.
   */
  const { pairing, } = sectionRound;

  /**
   * That pairing where there is one, absent where the aligner keeps the floor.
   */
  const sectionPairing = (pairing.length === 0) ? undefined : pairing;

  /**
   * Aligned sections, which decide what the roster is asked about below.
   */
  const alignment = alignDocumentSections({
    source,
    target,
    ...((sectionPairing === undefined) ? {} : { sectionPairing, }),
  },);

  /**
   * Pairing per aligned section, keyed by its index.
   */
  const blockPairings = new Map<number, readonly BlockPair[]>();

  /**
   * What the rounds reported, opened with whatever the section round said.
   */
  const findings: string[] = [...sectionRound.findings,];
  for (
    const [pairIndex, pair,] of alignment
      .pairs
      .entries()
  ) {
    /**
     * Source and target section chunks.
     */
    const {
      source: sourceChunk,
      target: targetChunk,
    } = pair;
    /**
     * Parsed source nodes media attachment and pairing share.
     */
    const { nodes: sourceNodes, } = sourceChunk;
    /**
     * Parsed target nodes under same rule.
     */
    const { nodes: targetNodes, } = targetChunk;

    /**
     * This section's original blocks.
     */
    const sourceBlocks = sourceNodes
      .map(function toNumbered(
        node,
        index,
      ): NumberedBlock {
        return {
          index,
          text: node.text,
        };
      },);

    /**
     * This section's translation blocks.
     */
    const targetBlocks = targetNodes
      .map(function toNumbered(
        node,
        index,
      ): NumberedBlock {
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
     * This section's identity, over the text both sides actually carry.
     *
     * The pairing is a question about THESE blocks, so two entries whose
     * sections happen to match share the answer and a resumed entry buys
     * nothing.
     */
    const key = createHash('sha256',)
      .update(
        [
          ...sourceBlocks.map(function toText(block,): string {
            return block.text;
          },),
          '\u0000',
          ...targetBlocks.map(function toText(block,): string {
            return block.text;
          },),
        ].join('\u0000',),
        'utf8',
      )
      .digest('hex',);

    /**
     * A pairing an earlier run already bought for these blocks.
     */
    const cached = pairingCache?.resumed
      .get(key,);
    if (cached !== undefined) {
      // REPUBLISHED BEFORE ANYTHING IS DECIDED. This run asks nobody about this
      // section, so every finding the first run reported here is reported by
      // nothing at all unless it comes back off disk. Until 2026-08-22 the cache
      // stored a bare list of pairs, and a resumed entry silently lost the
      // per-section counts, the fallback notice, and every voice-level finding.
      /**
       * The two halves of a stored round: what it agreed, and what it reported.
       */
      const {
        pairs: cachedPairs,
        findings: cachedFindings,
      } = cached;
      findings.push(...cachedFindings,);

      /**
       * Structural transcript claims applied on cold and warm paths alike.
       */
      const resumedMediaClaim = claimMediaAdjacentTargets({
        pairs: cachedPairs,
        sourceBlocks: sourceNodes,
        targetBlocks: targetNodes,
        targetContainers: target.containers,
      },);
      /**
       * Cached pairs after current structural normalization.
       */
      const { pairs: resumedPairs, } = resumedMediaClaim;
      /**
       * Structural findings current warm path contributes.
       */
      const resumedMediaFindings = resumedMediaClaim.findings
        .map(function prefixMedia(
          finding,
        ): string {
          return `block-pairing ${finding}`;
        },);
      findings.push(...resumedMediaFindings,);

      // AN EMPTY CACHED PAIRING IS AN ANSWER: the roster was asked about these
      // blocks and agreed on nothing, so the section keeps the scorer without
      // the round being bought again. Warned again rather than only the first
      // time, because falling back to the deterministic aligner is what THIS run
      // is doing, not something that merely happened once.
      if (resumedPairs.length === 0) {
        pl.warn(`section ${String(pairIndex,)}: no agreed pairing, keeping the deterministic aligner`,);
        continue;
      }
      blockPairings.set(
        pairIndex,
        resumedPairs,
      );
      continue;
    }

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

    /**
     * Correspondences this section's round agreed on, beside how many voices
     * stood behind them.
     */
    const {
      pairs: rosterPairs,
      usable,
      heard,
      cacheEligible,
    } = outcome;

    /**
     * Structurally claimed details transcripts adjoining matched media.
     */
    const mediaClaim = claimMediaAdjacentTargets({
      pairs: rosterPairs,
      sourceBlocks: sourceNodes,
      targetBlocks: targetNodes,
      targetContainers: target.containers,
    },);
    /**
     * Pairing consumed and cached after structural normalization.
     */
    const { pairs, } = mediaClaim;

    /**
     * Target blocks normalized pairing still leaves outside source claims.
     */
    const unclaimedTargetIds = declinedTargetIdsOfPairing({
      pairs,
      sourceNodes,
      targetNodes,
    },);
    /**
     * Whether normalized pairing still strands archive blocks.
     */
    const leavesUnclaimedTargets = unclaimedTargetIds.size > 0;

    /**
     * Structural media findings in pairing vocabulary.
     */
    const mediaFindings = mediaClaim.findings
      .map(function prefixMedia(finding,): string {
        return `block-pairing ${finding}`;
      },);
    /**
     * Everything this section reported, gathered before any of it is stored.
     *
     * GATHERED BECAUSE THE CACHE KEEPS IT. Pushing each finding straight into
     * the document's list left nothing naming which findings belonged to this
     * section, so the record written beside the pairs could not carry them and
     * a resume reported a quieter round than the one that was bought.
     */
    const sectionFindings: string[] = [
      ...outcome.findings,
      ...mediaFindings,
    ];

    // HOW MANY VOICES AGREED, recorded rather than only logged. A section two
    // voices paired and one six voices paired are different evidence about the
    // same slicing, and the artifact carried neither until this line. Emitted
    // HERE rather than in the stage because the stage is asked one section at a
    // time and cannot say which, so a run of unattributed counts down a long
    // document names no section at all.
    //
    // A ROUND NOBODY ANSWERED SAYS SO ELSEWHERE. At no usable voice the stage
    // has already filed `no-usable-voice`, and a count of zero out of zero
    // beside it would be a second wording for one fact.
    if (usable > 0)
      sectionFindings.push(
        `block-pairing section ${String(pairIndex,)} paired ${String(rosterPairs.length,)} of ${
          String(sourceBlocks.length,)
        } original and ${String(targetBlocks.length,)} translation blocks, from ${
          String(usable,)
        } usable voices of ${String(heard,)} heard`,
      );

    /**
     * Whether cross-run cache may treat this pairing as terminal.
     */
    const canPersistPairing = cacheEligible ? !leavesUnclaimedTargets : false;
    /**
     * Whether heard round remained unresolved.
     */
    const reportUnresolved = canPersistPairing ? false : usable > 0;
    if (reportUnresolved)
      sectionFindings.push(`block-pairing section ${String(pairIndex,)} unresolved, not cached`,);

    // A ROUND NOBODY ANSWERED IS NOT AN ANSWER, and must not be cached: the
    // roster was unreachable, not undecided, and caching that would make one
    // bad minute permanent for this entry. A round that WAS answered caches
    // even when it agreed on nothing, because that is a stable fact about these
    // blocks and re-buying it on every resume is what the cache exists to stop.
    if (pairs.length === 0)
      sectionFindings.push(`block-pairing section ${String(pairIndex,)} fell back to scoring`,);

    // FED ON EVERY PATH, gated by nothing. Only the persist below asks whether
    // anyone answered: a round nobody answered still reported findings, and
    // hanging the document's list off the same condition would lose them on the
    // cold run that produced them.
    findings.push(...sectionFindings,);

    /**
     * Whether this heard round may persist.
     */
    const shouldPersist = (usable > 0) ? canPersistPairing : false;
    if (shouldPersist)
      // eslint-disable-next-line no-await-in-loop -- writing this section's answer before the next one is asked is the point: a batched write at the end loses everything an abort interrupts
      await pairingCache?.persist({
        key,
        serialized: JSON.stringify({
          pairs,
          findings: sectionFindings,
        },),
      },);
    if (pairs.length === 0) {
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
    ...((sectionPairing === undefined) ? {} : { sectionPairing, }),
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
