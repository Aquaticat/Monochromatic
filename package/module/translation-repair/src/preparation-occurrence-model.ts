import type {
  ChunkPair,
  SectionAlignment,
} from './chunk-document.ts';
import type { SectionPair, } from './pair-sections-wire.ts';
import type { RepairDocument, } from './parse-document.ts';
import type { PreparationReceiptBinding, } from './preparation-receipt-model.ts';
import type { PreparedBlockPairing, } from './prepare-block-pairing-model.ts';

//region Current occurrence metadata

/**
 * Independently registered current documents and parent identity.
 * The owner must derive the current target hash through its allowed normalization/relabel lineage,
 * not adopt a hash supplied by the receipt or a replacement document.
 *
 * @example
 * ```ts
 * const expected: PreparationOccurrenceExpectation = { binding, sourceHash, targetHash, pairIndex, sourceIndex, targetIndex };
 * ```
 */
export type PreparationOccurrenceExpectation = {
  /**
   * Explicitly authorized current-attempt receipt or alias reference.
   */
  readonly binding: PreparationReceiptBinding;
  /**
   * Complete pinned source under actual corpus-reader semantics.
   */
  readonly sourceHash: string;
  /**
   * Complete current target after the owner's allowed deterministic transition.
   */
  readonly targetHash: string;
  /**
   * Parent position in the current production alignment.
   */
  readonly pairIndex: number;
  /**
   * Registered source chunk identity, checked independently of the combined parent position.
   */
  readonly sourceIndex: number;
  /**
   * Registered target chunk or insertion-anchor identity.
   */
  readonly targetIndex: number;
  /**
   * Explicit current section correspondence, when the owner registered a non-default alignment.
   */
  readonly sectionPairing?: readonly SectionPair[];
};

/**
 * Freshly reconstructed occurrence, deliberately not a qualification or writer-admission result.
 * Consumers must still apply their registered dependency role or pairing-only qualification,
 * then bind globally reindexed final children, source channels, context and native writer inputs.
 *
 * @example
 * ```ts
 * const occurrence = readPreparationOccurrence({ expected, receipt, sourceText, targetText, l });
 * ```
 */
export type BoundPreparationOccurrence = {
  /**
   * Visible authority boundary, even when reconstructed placement happens to be complete.
   */
  readonly scope: 'receipt-bound-occurrence';
  /**
   * Owned current expectation; no receipt-selected parent or configuration.
   */
  readonly expected: PreparationOccurrenceExpectation;
  /**
   * Current full source parse, including actual node ranges and definition namespace.
   */
  readonly source: RepairDocument;
  /**
   * Current full target parse, including all media containers and definition namespace.
   */
  readonly target: RepairDocument;
  /**
   * Parent selected from current full-document alignment, never from stored offsets.
   */
  readonly pair: ChunkPair;
  /**
   * Current full alignment observations, separate from block-round findings.
   */
  readonly alignmentFindings: SectionAlignment['findings'];
  /**
   * Replayed production handoff before any independent scope qualification.
   */
  readonly prepared: Extract<PreparedBlockPairing, { readonly kind: 'paired' | 'fallback'; }>;
};

//endregion Current occurrence metadata
