import type { BlockPairingProtocol, } from './block-pairing-protocol.ts';
import type { BlockPairingWire, NumberedBlock, } from './pair-blocks-wire.ts';
import type { PipelineDigest, } from './corpus-run/pipeline-digest.ts';
import type { RoundOutcome, } from './stage-round.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Preparation receipt data
// Namespace and request configuration come from the owning reviewed plan, never from the receipt being read.

/**
 * Expected acquisition namespace and configuration for one explicitly authorized receipt reference.
 * An owning journal must establish the exclusive attempt directory and derive the configuration digest
 * from actual registered caps, request parameters and provider-body plans before using this binding.
 *
 * @example
 * ```ts
 * const binding: PreparationReceiptBinding = { acquisitionPlanDigest, attemptId, receiptId, pipelineDigest, requestConfigurationDigest, modelIds };
 * ```
 */
export type PreparationReceiptBinding = {
  /** Digest of the immutable acquisition plan, not an artifact-selected replacement. */
  readonly acquisitionPlanDigest: string;
  /** Current exclusive acquisition attempt; historical attempts cannot supply this receipt. */
  readonly attemptId: string;
  /** Preregistered receipt or alias target, separate from its current occurrence. */
  readonly receiptId: string;
  /** Executed first-party implementation identity. */
  readonly pipelineDigest: PipelineDigest;
  /** Independently derived configuration and registered provider-body identity. */
  readonly requestConfigurationDigest: string;
  /** Complete ordered configured electorate, never its heard subset. */
  readonly modelIds: readonly RosterModelId[];
};

/**
 * Actual model-neutral question, without full-document coordinates or local interpretation products.
 *
 * @example
 * ```ts
 * const question: PreparationReceiptQuestion = { sourceBlocks, targetBlocks, protocol };
 * ```
 */
export type PreparationReceiptQuestion = {
  /** Exact original numbering and bytes emitted by the question. */
  readonly sourceBlocks: readonly NumberedBlock[];
  /** Exact archive numbering and bytes emitted by the question. */
  readonly targetBlocks: readonly NumberedBlock[];
  /** Shared messages and schema, not a second handwritten protocol. */
  readonly protocol: BlockPairingProtocol;
};

/**
 * Terminal question data retained by the owning journal.
 * Reading this envelope checks its declared bindings; it is not independent proof of provider transmission.
 * Raw provider payloads, request bodies and transport/usage lineage remain owning-journal obligations.
 *
 * @example
 * ```ts
 * const receipt: PreparationReceiptData = { version: 1, state: 'complete', binding, question, outcomes };
 * ```
 */
export type PreparationReceiptData = {
  /** Versioned data shape, separate from historical pairing cache records. */
  readonly version: 1;
  /** Partial checkpoints cannot stand in for a completed question. */
  readonly state: 'complete';
  /** Namespace and configuration asserted by this receipt and checked against the owning plan. */
  readonly binding: PreparationReceiptBinding;
  /** Exact question compared against freshly reconstructed current question bytes. */
  readonly question: PreparationReceiptQuestion;
  /** Final asked-seat outcomes only; aggregate fields are intentionally absent. */
  readonly outcomes: readonly RoundOutcome<BlockPairingWire>[];
};

//endregion Preparation receipt data
