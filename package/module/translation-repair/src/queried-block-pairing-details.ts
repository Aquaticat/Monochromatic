import type { ChunkPair, } from './chunk-document.ts';
import { declinedTargetIdsOfPairing, } from './declined-target-runs.ts';
import { countPairedBlocks, } from './pair-block-counts.ts';
import type { BlockPairingOutcome, } from './pair-blocks-stage.ts';
import type { BlockPair, } from './pair-blocks-wire.ts';
import { claimMediaAdjacentTargets, } from './pair-media-adjacency.ts';
import type { ContainerSpan, } from './unwrap-container.ts';

//region Queried preparation before persistence
// Live acquisition and qualification share all findings without moving definition separation ahead of persistence.

/**
 * Existing queried-parent normalization and persistence eligibility.
 *
 * @example
 * ```ts
 * const details = queriedBlockPairingDetails({ outcome, pair, pairIndex, targetContainers });
 * ```
 */
export type QueriedBlockPairingDetails = {
  /** Normalized relations before definition-order separation. */
  readonly pairs: readonly BlockPair[];
  /** Exact stage, media, coverage and fallback findings in production order. */
  readonly findings: readonly string[];
  /** Existing cache gate, not semantic qualification. */
  readonly canPersistPairing: boolean;
};

/**
 * Derives the current queried handoff without persisting or changing its ordering.
 *
 * @param outcome - current pairing stage result
 *
 * @param pair - current complete parent
 *
 * @param pairIndex - original alignment position used in findings
 *
 * @param targetContainers - complete target parser's media ownership spans
 *
 * @returns Production normalization and unchanged cache gate
 *
 * @throws Error when existing structural media validation fails
 *
 * @example
 * ```ts
 * const { pairs, findings, canPersistPairing, } = queriedBlockPairingDetails({ outcome, pair, pairIndex, targetContainers });
 * ```
 */
export function queriedBlockPairingDetails({ outcome, pair, pairIndex, targetContainers, }: {
  readonly outcome: BlockPairingOutcome;
  readonly pair: ChunkPair;
  readonly pairIndex: number;
  readonly targetContainers: readonly ContainerSpan[];
},): QueriedBlockPairingDetails {
  /** Source blocks retain their current local indexes. */
  const sourceNodes = pair.source.nodes;
  /** Target blocks retain the same current-question convention. */
  const targetNodes = pair.target.nodes;
  /** Media ownership joined to the relations the roster actually supplied. */
  const media = claimMediaAdjacentTargets({ pairs: outcome.pairs, sourceBlocks: sourceNodes, targetBlocks: targetNodes, targetContainers, },);
  /** Normalized relations the cache retains before definition-order separation. */
  const { pairs, } = media;
  /** Archive blocks still outside a source claim prevent terminal caching. */
  const unclaimed = declinedTargetIdsOfPairing({ pairs, sourceNodes, targetNodes, },);
  /** Findings retain exactly the cold path's stage-then-media order. */
  const findings: string[] = [
    ...outcome.findings,
    ...media.findings.map(function prefix(finding,): string { return `block-pairing ${finding}`; },),
  ];
  if (outcome.usable > 0) {
    /** Counts describe roster relations, not additional structural media claims. */
    const counts = countPairedBlocks({ pairs: outcome.pairs, },);
    findings.push(
      `block-pairing section ${String(pairIndex,)} paired ${String(counts.source,)} of ${String(sourceNodes.length,)} original and ${String(counts.target,)} of ${String(targetNodes.length,)} translation blocks across ${String(counts.relations,)} relations, from ${String(outcome.usable,)} usable voices of ${String(outcome.heard,)} heard`,
    );
  }
  /** Existing cache gate excludes unresolved agreement and unclaimed archive blocks. */
  const canPersistPairing = outcome.cacheEligible ? unclaimed.size === 0 : false;
  if ((!canPersistPairing) && (outcome.usable > 0))
    findings.push(`block-pairing section ${String(pairIndex,)} unresolved, not cached`,);
  if (pairs.length === 0)
    findings.push(`block-pairing section ${String(pairIndex,)} fell back to scoring`,);
  return { pairs, findings, canPersistPairing, };
}

//endregion Queried preparation before persistence
