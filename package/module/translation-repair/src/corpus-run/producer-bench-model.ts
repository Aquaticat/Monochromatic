import type { AlignmentFinding, } from '../chunk-document.ts';

//region Producer benchmark scope
// Writer tasks retain complete deterministic section pairs rather than uncorroborated subdivisions.

/**
 * Exact span in the CRLF-folded pinned file returned by the corpus reader.
 *
 * @example
 * ```ts
 * const span: ProducerBenchSpan = { startOffset: 10, endOffset: 40, hash };
 * ```
 */
export type ProducerBenchSpan = {
  /** First included UTF-16 position in the normalized file. */
  readonly startOffset: number;
  /** Exclusive end in the same normalized file. */
  readonly endOffset: number;
  /** Content identity of exactly this span. */
  readonly hash: string;
};

/**
 * Auditable whole-parent scope, not a declaration that the incumbent is correct.
 *
 * @example
 * ```ts
 * const identity = section.provenance;
 * ```
 */
export type ProducerBenchProvenance = {
  /** No scorer-based fine-grained subdivision supplied this task. */
  readonly kind: 'paired-section';
  /** Source-side section index, not a legacy global slice index. */
  readonly sourceSectionIndex: number;
  /** Corresponding target-side section index. */
  readonly targetSectionIndex: number;
  /** Hash of the complete normalized source file locating the span. */
  readonly sourceFileHash: string;
  /** Hash of the complete normalized incumbent file locating the span. */
  readonly targetFileHash: string;
  /** Complete source parent extent. */
  readonly source: ProducerBenchSpan;
  /** Complete incumbent parent extent. */
  readonly target: ProducerBenchSpan;
  /** Every source block retained in original order. */
  readonly sourceNodeIds: readonly string[];
  /** Every incumbent block retained in original order. */
  readonly targetNodeIds: readonly string[];
};

/**
 * One writer comparison whose paired parent has not been divided into unverified fragments.
 * Incumbents may contain genuine defects; they are competing baselines, not gold references.
 *
 * @example
 * ```ts
 * const result = await runTranslateStage({ sourceText: section.sourceText, incumbentText: section.incumbentText, ... });
 * ```
 */
export type ProducerBenchSection = {
  /** Corpus identity, never inferred from generated prose. */
  readonly entryId: string;
  /** Source section index used to order this benchmark population. */
  readonly index: number;
  /** Complete source parent supplied to writers and judges. */
  readonly sourceText: string;
  /** Complete paired incumbent whose structural floor applies. */
  readonly incumbentText: string;
  /** Source-governed line treatment for the existing translation stage. */
  readonly lineStructured: boolean;
  /** Reproducible pairing and span evidence. */
  readonly provenance: ProducerBenchProvenance;
};

/**
 * Observations retained beside a producer sample rather than hidden by corpus traversal.
 *
 * @example
 * ```ts
 * const observations: ProducerBenchObservation[] = [];
 * ```
 */
export type ProducerBenchObservation = {
  /** Entry whose deterministic pairing or available files need qualification. */
  readonly entryId: string;
  /** Missing files are distinct from unpaired sections. */
  readonly kind: 'missing-corpus-side' | 'section-alignment';
  /** Original aligner observation, absent for a missing file. */
  readonly alignment?: AlignmentFinding;
};

/**
 * Fixed selected tasks and the deterministic population they came from.
 *
 * @example
 * ```ts
 * const { sections, } = await sampleProducerSections({ count: 40 });
 * ```
 */
export type ProducerBenchSample = {
  /** Pinned revision shared by every selected span. */
  readonly corpusSha: string;
  /** Full eligible parent population before deterministic spread sampling. */
  readonly populationCount: number;
  /** Exact requested count in deterministic source-size order. */
  readonly sections: readonly ProducerBenchSection[];
  /** Missing or refused inputs, not a claim of whole-corpus coverage. */
  readonly observations: readonly ProducerBenchObservation[];
};

//endregion Producer benchmark scope
