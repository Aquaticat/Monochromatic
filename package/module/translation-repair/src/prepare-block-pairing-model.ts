import type {
  BlockPairingOutcome,
  PairedSectionRecord,
} from './pair-blocks-stage.ts';
import type { BlockPair, } from './pair-blocks-wire.ts';
import type { DefinitionLabelPair, } from './pair-definition-order.ts';

//region One parent pairing's acquisition evidence
// Cache records retain their historical authority; they do not acquire unrecorded seat outcomes on resume.

/**
 * How a questioned parent obtained the relations preparation consumed.
 * A cache record without seat outcomes is not newly corroborated evidence.
 *
 * @example
 * ```ts
 * const evidence: PreparedBlockEvidence = { kind: 'cached', key, record };
 * ```
 */
export type PreparedBlockEvidence =
  | {
    /**
     * Historical record reused without a new call.
     */
    readonly kind: 'cached';
    /**
     * Question identity under the existing pairing-cache version.
     */
    readonly key: string;
    /**
     * Exactly the historical record, without invented ballots.
     */
    readonly record: PairedSectionRecord;
  }
  | {
    /**
     * Existing stage supplied final asked-seat outcomes on this call.
     */
    readonly kind: 'queried';
    /**
     * Question identity under the same pairing-cache version.
     */
    readonly key: string;
    /**
     * Raw final seat outcomes and their existing interpretation.
     */
    readonly outcome: BlockPairingOutcome;
  };

/**
 * Observations shared by paired and deliberately unpaired parent outcomes.
 *
 * @example
 * ```ts
 * const details = { findings: [], definitionPairs: [] }; 
 * ```
 */
type PreparedBlockDetails = {
  /**
   * Original stage, cache and structural-normalization findings in order.
   */
  readonly findings: readonly string[];
  /**
   * Definition label relations kept apart from ordinary body ordering.
   */
  readonly definitionPairs: readonly DefinitionLabelPair[];
};

/**
 * One indexed parent's preparation result without inventing a correspondence on fallback.
 * Only `paired` contributes a map entry to pure document preparation.
 * The other kinds preserve the production distinction between an implicit singleton,
 * an empty side and an unresolved question.
 *
 * @example
 * ```ts
 * if (result.kind === 'paired') blockPairings.set(pairIndex, result.pairs);
 * ```
 */
export type PreparedBlockPairing = PreparedBlockDetails & (
  | {
    /**
     * Relations survived the existing preparation normalization.
     */
    readonly kind: 'paired';
    /**
     * Exact map value supplied to the production slicer, even when empty after definition separation.
     */
    readonly pairs: readonly BlockPair[];
    /**
     * Acquisition state, not a semantic-correctness label.
     */
    readonly evidence: PreparedBlockEvidence;
  }
  | {
    /**
     * A questioned parent contributed no explicit map entry.
     */
    readonly kind: 'fallback';
    /**
     * Question outcome or historical cache record that did not establish a pairing.
     */
    readonly evidence: PreparedBlockEvidence;
  }
  | {
    /**
     * A structural singleton or empty side needed no model question or cache lookup.
     */
    readonly kind: 'implicit' | 'empty';
  }
);

//endregion One parent pairing's acquisition evidence
