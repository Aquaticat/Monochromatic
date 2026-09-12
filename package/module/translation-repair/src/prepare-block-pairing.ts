import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { blockPairingQuestion, } from './block-pairing-question.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import type { ChunkPair, } from './chunk-document.ts';
import { declinedTargetIdsOfPairing, } from './declined-target-runs.ts';
import { countPairedBlocks, } from './pair-block-counts.ts';
import {
  pairBlocksWithRoster,
  type PairedSectionRecord,
} from './pair-blocks-stage.ts';
import { claimMediaAdjacentTargets, } from './pair-media-adjacency.ts';
import { finishPreparedBlockPairing, } from './prepare-block-pairing-finish.ts';
import type { PreparedBlockPairing, } from './prepare-block-pairing-model.ts';
import type { SliceCache, } from './slice-cache.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';
import type { ContainerSpan, } from './unwrap-container.ts';

//region One indexed parent through existing block preparation
// Full-document preparation and bounded calibration pools share acquisition, cache and normalization rules.

/**
 * Prepares one already-aligned parent without buying unrelated section or block questions.
 * Singletons and empty sides retain their zero-call paths.
 * Historical cache records remain historical; only a queried result carries final seat outcomes.
 *
 * @param client - existing production model client
 *
 * @param modelIds - configured preparation electorate, unchanged by this operation
 *
 * @param pair - complete aligned source and target parent
 *
 * @param pairIndex - original alignment index used for findings and map identity
 *
 * @param targetContainers - complete target parser containers for media-adjacency ownership
 *
 * @param signal - caller cancellation
 *
 * @param exchangeTimeoutMs - existing per-call ceiling
 *
 * @param l - caller logger preserving entry identity
 *
 * @param pairingCache - existing versioned block cache, absent for an uncached probe
 *
 * @returns Explicit slicer pairing or the existing implicit, empty or fallback state
 *
 * @throws Error when acquisition, cancellation or cache persistence fails unexpectedly
 *
 * @example
 * ```ts
 * const result = await prepareBlockPairing({ client, modelIds, pair, pairIndex: 2, targetContainers, signal, exchangeTimeoutMs, l });
 * ```
 */
export async function prepareBlockPairing(
  {
    client,
    modelIds,
    pair,
    pairIndex,
    targetContainers,
    signal,
    exchangeTimeoutMs,
    l,
    pairingCache,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly modelIds: readonly RosterModelId[];
    readonly pair: ChunkPair;
    readonly pairIndex: number;
    readonly targetContainers: readonly ContainerSpan[];
    readonly signal: AbortSignal;
    readonly exchangeTimeoutMs: number;
    readonly l: Logger;
    readonly pairingCache?: SliceCache<PairedSectionRecord>;
  }>,
): Promise<PreparedBlockPairing> {
  /**
   * Logger naming this parent's shared preparation operation.
   */
  const pl = tagged({
    tag: prepareBlockPairing.name,
    l,
  },);
  /**
   * Parsed source blocks whose local indexes the question uses.
   */
  const sourceNodes = pair.source
    .nodes;
  /**
   * Parsed incumbent blocks under the same local-index convention.
   */
  const targetNodes = pair.target
    .nodes;
  if ((sourceNodes.length === 0) || (targetNodes.length === 0)) {
    pl.debug(`section ${String(pairIndex,)} has an empty side; no pairing question`,);
    return {
      kind: 'empty',
      findings: [],
      definitionPairs: [],
    };
  }
  if ((sourceNodes.length < 2) && (targetNodes.length < 2)) {
    pl.debug(`section ${String(pairIndex,)} is a structural singleton; no pairing question`,);
    return {
      kind: 'implicit',
      findings: [],
      definitionPairs: [],
    };
  }
  /**
   * Shared current numbering, definition exemptions and unchanged cache identity.
   */
  const { sourceBlocks, targetBlocks, freeOrder, key, } = blockPairingQuestion({ pair, },);
  /**
   * Historical round, which carries no invented new electorate evidence.
   */
  const cached = pairingCache?.resumed
    .get(key,);
  if (cached !== undefined) {
    pl.debug(`section ${String(pairIndex,)} resumes block pairing ${key}`,);
    /**
     * Current media ownership applied to the cached relations, as on the cold path.
     */
    const media = claimMediaAdjacentTargets({
      pairs: cached.pairs,
      sourceBlocks: sourceNodes,
      targetBlocks: targetNodes,
      targetContainers,
    },);
    return finishPreparedBlockPairing({
      pairs: media.pairs,
      evidence: {
        kind: 'cached',
        key,
        record: cached,
      },
      findings: [
        ...cached.findings,
        ...media.findings
          .map(function prefix(finding,): string {
        return `block-pairing ${finding}`;
      },),
      ],
      pair,
      pairIndex,
      l: pl,
    },);
  }
  /**
   * Final outcomes and agreement from the unchanged configured pairing stage.
   */
  const outcome = await pairBlocksWithRoster({
    client,
    modelIds,
    sourceBlocks,
    targetBlocks,
    freeOrder,
    signal,
    exchangeTimeoutMs,
    l: pl,
  },);
  /**
   * Media ownership joined to the relations the roster actually supplied.
   */
  const media = claimMediaAdjacentTargets({
    pairs: outcome.pairs,
    sourceBlocks: sourceNodes,
    targetBlocks: targetNodes,
    targetContainers,
  },);
  /**
   * Normalized relations the cache retains before definition-order separation.
   */
  const { pairs, } = media;
  /**
   * Archive blocks still outside a source claim prevent terminal caching.
   */
  const unclaimed = declinedTargetIdsOfPairing({
    pairs,
    sourceNodes,
    targetNodes,
  },);
  /**
   * Findings retain exactly the cold path's stage-then-media order.
   */
  const findings: string[] = [
    ...outcome.findings,
    ...media.findings
      .map(function prefix(finding,): string { return `block-pairing ${finding}`; },),
  ];
  if (outcome.usable > 0) {
    /**
     * Counts describe roster relations, not additional structural media claims.
     */
    const counts = countPairedBlocks({ pairs: outcome.pairs, },);
    findings.push(
      `block-pairing section ${String(pairIndex,)} paired ${String(counts.source,)} of ${
        String(sourceBlocks.length,)
      } original and ${String(counts.target,)} of ${String(targetBlocks.length,)} translation blocks across ${
        String(counts.relations,)
      } relations, from ${String(outcome.usable,)} usable voices of ${String(outcome.heard,)} heard`,
    );
  }
  /**
   * Existing cache gate excludes unresolved agreement and unclaimed archive blocks.
   */
  const canPersistPairing = outcome.cacheEligible ? unclaimed.size === 0 : false;
  if ((!canPersistPairing) && (outcome.usable > 0))
    findings.push(`block-pairing section ${String(pairIndex,)} unresolved, not cached`,);
  if (pairs.length === 0)
    findings.push(`block-pairing section ${String(pairIndex,)} fell back to scoring`,);
  // Persistence precedes definition separation, preserving the historical cache's relabel evidence.
  if ((outcome.usable > 0) && canPersistPairing)
    await pairingCache?.persist({
      key,
      serialized: JSON.stringify({
        pairs,
        findings,
      },),
    },);
  return finishPreparedBlockPairing({
    pairs,
    evidence: {
      kind: 'queried',
      key,
      outcome,
    },
    findings,
    pair,
    pairIndex,
    l: pl,
  },);
}

//endregion One indexed parent through existing block preparation
