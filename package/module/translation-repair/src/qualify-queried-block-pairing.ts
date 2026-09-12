import { isDeepStrictEqual, } from 'node:util';
import { type Logger, tagged, } from '@monochromatic-dev/module-logger/ts';
import { blockPairingQuestion, } from './block-pairing-question.ts';
import type { ChunkPair, } from './chunk-document.ts';
import { declinedTargetIdsOfPairing, } from './declined-target-runs.ts';
import { readBlockPairingOutcomes, } from './pair-blocks-read-outcomes.ts';
import { splitDefinitionPairs, } from './pair-definition-order.ts';
import { claimMediaAdjacentTargets, } from './pair-media-adjacency.ts';
import type { PreparedBlockPairing, } from './prepare-block-pairing-model.ts';
import { PreparationQualificationError, } from './preparation-qualification-error.ts';
import type { QualifiedBlockPairing, QualifiedBlockRelation, } from './qualified-block-pairing-model.ts';
import { rosterQuorumSize, } from './roster-quorum-size.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';
import type { ContainerSpan, } from './unwrap-container.ts';

//region Current queried-parent evidence
// Recompute existing production agreement and ownership without buying calls or changing fallback policy.

/**
 * Qualifies a questioned parent using its exact current final seat outcomes.
 * Supplied summaries cannot replace replay, and cache eligibility never establishes qualification.
 *
 * @param pair - current parser-owned complete parent
 *
 * @param prepared - actual production question result, not a claimed frozen-file certificate
 *
 * @param modelIds - configured preparation electorate
 *
 * @param targetContainers - current complete target parser's media ownership spans
 *
 * @param l - caller logger retaining parent identity
 *
 * @returns Owned evidence with existing insertions, declines and relation provenance
 *
 * @throws PreparationQualificationError when current evidence cannot qualify this parent
 *
 * @example
 * ```ts
 * const result = qualifyQueriedBlockPairing({ pair, prepared, modelIds, targetContainers, l });
 * ```
 */
export function qualifyQueriedBlockPairing({ pair, prepared, modelIds, targetContainers, l, }: {
  readonly pair: ChunkPair;
  readonly prepared: Extract<PreparedBlockPairing, { readonly kind: 'paired' | 'fallback'; }>;
  readonly modelIds: readonly RosterModelId[];
  readonly targetContainers: readonly ContainerSpan[];
  readonly l: Logger;
},): Extract<QualifiedBlockPairing, { readonly kind: 'queried'; }> {
  /** Current interpretation logger, separate from model acquisition. */
  const pl = tagged({ tag: qualifyQueriedBlockPairing.name, l, },);
  if (prepared.evidence.kind === 'cached')
    throw new PreparationQualificationError({ kind: 'historical-cache', },);
  /** Exact current block numbering and unchanged question key. */
  const question = blockPairingQuestion({ pair, },);
  if (prepared.evidence.key !== question.key)
    throw new PreparationQualificationError({ kind: 'question', },);
  /** Replayed agreement validates independent identities and every usable wire. */
  const outcome = readBlockPairingOutcomes({
    outcomes: prepared.evidence.outcome.outcomes,
    modelIds,
    sourceCount: question.sourceBlocks.length,
    targetCount: question.targetBlocks.length,
    freeOrder: question.freeOrder,
    l: pl,
  },);
  if (!isDeepStrictEqual(outcome, prepared.evidence.outcome,))
    throw new PreparationQualificationError({ kind: 'result', },);
  /** Configured usable denominator, never the heard subset or cache flag. */
  const requiredUsable = rosterQuorumSize({ rosterSize: modelIds.length, },);
  pl.debug(`qualifying ${String(outcome.usable,)} usable replies against ${String(requiredUsable,)} required`,);
  if (outcome.usable < requiredUsable)
    throw new PreparationQualificationError({ kind: 'usable-quorum', },);
  /** Existing deterministic ownership, explicitly separate from model endorsement. */
  const media = claimMediaAdjacentTargets({
    pairs: outcome.pairs,
    sourceBlocks: pair.source.nodes,
    targetBlocks: pair.target.nodes,
    targetContainers,
  },);
  if (media.pairs.length === 0)
    throw new PreparationQualificationError({ kind: 'fallback', },);
  /** Existing definition-order handoff consumed by production subdivision. */
  const split = splitDefinitionPairs({ pairs: media.pairs, sourceNodes: pair.source.nodes, targetNodes: pair.target.nodes, },);
  if ((prepared.kind !== 'paired')
    || !isDeepStrictEqual(prepared.pairs, split.forSlicing,)
    || !isDeepStrictEqual(prepared.definitionPairs, split.definitionPairs,))
    throw new PreparationQualificationError({ kind: 'result', },);
  /** Original claims before definitions are separated from body placement. */
  const claimedSources = new Set(media.pairs.map(function sourceOf(relation,): number { return relation.source; },),);
  /** Target claims include deterministic media ownership but no scorer guesses. */
  const claimedTargets = new Set(media.pairs.map(function targetOf(relation,): number { return relation.target; },),);
  /** Existing decline policy refuses to discard targets while any original is unplaced. */
  const declined = declinedTargetIdsOfPairing({ pairs: media.pairs, sourceNodes: pair.source.nodes, targetNodes: pair.target.nodes, },);
  if (pair.target.nodes.some(function unaccounted(node, index,): boolean {
    return !claimedTargets.has(index,) && !declined.has(node.id,);
  },))
    throw new PreparationQualificationError({ kind: 'unclaimed-target', },);
  /** Validated integer relation keys distinguish endorsement from later media widening. */
  const endorsed = new Set(outcome.pairs.map(function relationKey(relation,): string {
    return `${String(relation.source,)}/${String(relation.target,)}`;
  },),);
  /** Every included relation identifies its actual placement authority. */
  const relations = media.pairs.map(function authorityOf(relation,): QualifiedBlockRelation {
    return {
      ...relation,
      authority: endorsed.has(`${String(relation.source,)}/${String(relation.target,)}`,)
        ? 'independent-endorsement'
        : 'deterministic-media-adjacency',
    };
  },);
  /** Original blocks not claimed remain writing insertions under existing preparation. */
  const sourceInsertions = pair.source.nodes.filter(function unplaced(_node, index,): boolean {
    return !claimedSources.has(index,);
  },).map(function nodeId(node,): string { return node.id; },);
  pl.info(`qualified ${String(relations.length,)} relations, ${String(sourceInsertions.length,)} source insertions and ${String(declined.size,)} target declines`,);
  // Clone the data at journal ownership so later caller mutation cannot alter retained evidence.
  return structuredClone({
    kind: 'queried',
    prepared,
    modelIds,
    requiredUsable,
    outcome,
    relations,
    sourceInsertions,
    targetDeclines: [...declined,],
  },);
}

//endregion Current queried-parent evidence
