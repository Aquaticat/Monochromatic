import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ChunkPair, } from './chunk-document.ts';
import type { BlockPair, } from './pair-blocks-wire.ts';
import { crossingFinding, splitDefinitionPairs, } from './pair-definition-order.ts';
import type { PreparedBlockEvidence, PreparedBlockPairing, } from './prepare-block-pairing-model.ts';

//region Pairing handoff after acquisition and media normalization
// Both cold and warm paths preserve the same definition-order behavior and fallback semantics.

/**
 * Separates definition relations before handing an explicit pairing to the production slicer.
 * Empty acquired relations retain the scorer fallback rather than becoming an explicit empty map entry.
 *
 * @param pairs - acquired relations after existing media-adjacency normalization
 * @param evidence - actual acquisition path, with no invented cache votes
 * @param findings - observations already reported by acquisition and normalization
 * @param pair - parent nodes whose definition labels are being separated
 * @param pairIndex - original aligned-parent index used in findings
 * @param l - caller logger retaining parent identity
 * @returns Explicit slicer pairing or named unresolved fallback
 * @example
 * ```ts
 * const result = finishPreparedBlockPairing({ pairs, evidence, findings, pair, pairIndex: 2, l });
 * ```
 */
export function finishPreparedBlockPairing(
  {
    pairs,
    evidence,
    findings,
    pair,
    pairIndex,
    l,
  }: {
    readonly pairs: readonly BlockPair[];
    readonly evidence: PreparedBlockEvidence;
    readonly findings: readonly string[];
    readonly pair: ChunkPair;
    readonly pairIndex: number;
    readonly l: Logger;
  },
): PreparedBlockPairing {
  /** Logger distinguishing the final map handoff from acquisition. */
  const pl = tagged({ tag: finishPreparedBlockPairing.name, l, },);
  if (pairs.length === 0) {
    pl.warn(`section ${String(pairIndex,)}: no agreed pairing, keeping the deterministic aligner`,);
    return { kind: 'fallback', evidence, findings, definitionPairs: [], };
  }
  /** Definition labels and ordinary slicer relations under the existing ordering rule. */
  const split = splitDefinitionPairs({
    pairs,
    sourceNodes: pair.source.nodes,
    targetNodes: pair.target.nodes,
  },);
  if (split.crossing)
    pl.warn(crossingFinding({ pairIndex, },),);
  return {
    kind: 'paired',
    pairs: split.forSlicing,
    definitionPairs: split.definitionPairs,
    evidence,
    findings: split.crossing ? [...findings, crossingFinding({ pairIndex, },),] : findings,
  };
}

//endregion Pairing handoff after acquisition and media normalization
