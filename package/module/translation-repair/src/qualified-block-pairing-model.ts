import type { BlockPairingOutcome, } from './pair-blocks-stage.ts';
import type { BlockPair, } from './pair-blocks-wire.ts';
import type { PreparedBlockPairing, } from './prepare-block-pairing-model.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Current qualification journal values
// Explicit provenance separates model endorsement from deterministic ownership and zero-call dispatch.

/**
 * Why a normalized relation may place archive text in a prepared group.
 * Media ownership establishes placement, not the truth of an image transcript.
 *
 * @example
 * ```ts
 * const relation: QualifiedBlockRelation = { source: 0, target: 1, authority: 'deterministic-media-adjacency', };
 * ```
 */
export type QualifiedBlockRelation = BlockPair & {
  /**
   * Existing independent agreement or separately identified production media claim.
   */
  readonly authority: 'independent-endorsement' | 'deterministic-media-adjacency';
};

/**
 * Provider-free replay result for a current parser-owned parent.
 * Parent/document hashes and acquisition-attempt identity remain obligations of the owning recipe.
 * Neither this result nor a cache key certifies that serialized outcomes came from a provider.
 *
 * @example
 * ```ts
 * const qualified = qualifyPreparedBlockPairing({ pair, prepared, modelIds, targetContainers, l });
 * ```
 */
export type QualifiedBlockPairing =
  | {
    /**
     * Actual production zero-question path, with no invented model votes.
     */
    readonly kind: 'implicit' | 'empty';
    /**
     * Structural dispatch result, not a semantic correspondence claim.
     */
    readonly prepared: Extract<PreparedBlockPairing, { readonly kind: 'implicit' | 'empty'; }>;
  }
  | {
    /**
     * Current outcomes survived replay and the configured usable quorum.
     */
    readonly kind: 'queried';
    /**
     * Verified production map and definition handoff.
     */
    readonly prepared: Extract<PreparedBlockPairing, { readonly kind: 'paired'; }>;
    /**
     * Configured identities whose denominator cannot shrink to heard seats.
     */
    readonly modelIds: readonly RosterModelId[];
    /**
     * Existing preparation quorum, separate from two-identity relation endorsement.
     */
    readonly requiredUsable: number;
    /**
     * Exact final asked-seat outcomes with replayed aggregate fields.
     */
    readonly outcome: BlockPairingOutcome;
    /**
     * Every normalized relation before definition-order separation, with placement authority.
     */
    readonly relations: readonly QualifiedBlockRelation[];
    /**
     * Unpaired original blocks remain source insertions, not discarded tasks.
     */
    readonly sourceInsertions: readonly string[];
    /**
     * Unclaimed archive blocks declined only under existing complete-original coverage policy.
     */
    readonly targetDeclines: readonly string[];
  };

//endregion Current qualification journal values
