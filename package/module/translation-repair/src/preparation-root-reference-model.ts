import type { FrozenPreparationObligation, FrozenPreparationSelection, } from './preparation-selection-model.ts';
import type { PreparationRootEntry, PreparationRootParent, PreparationRootPopulationParent, PreparationRootRawDocument, } from './preparation-root-population-model.ts';

//region Semantic ownership of frozen supporting evidence

/**
 * Roles follow checked content relationships, not filesystem execution or inferred approval.
 *
 * @example
 * ```ts
 * const role: PreparationRootReferenceRole = 'complete-entry-reading-frame';
 * ```
 */
export type PreparationRootReferenceRole = 'policy-pool' | 'reading-journal' | 'prior-reading-journal'
  | 'complete-entry-reading-frame' | 'reading-note' | 'opaque-selection-support';

/**
 * One byte-bound artifact can support several entry or parent reading relationships.
 *
 * @example
 * ```ts
 * const binding: PreparationRootReferenceBinding = { role: 'reading-note', consumer: parentId };
 * ```
 */
export type PreparationRootReferenceBinding = {
  /** Checked semantic use or explicit absence of interpretive authority. */
  readonly role: PreparationRootReferenceRole;
  /** Entry, parent or selection owning that use. */
  readonly consumer: string;
};

/**
 * Complete reference inventory retains unconsumed provenance as opaque data rather than inventing a role.
 *
 * @example
 * ```ts
 * const reference: PreparationRootReference = { path, hash, bytes, bindings };
 * ```
 */
export type PreparationRootReference = {
  /** Original locator remains data and is never opened by role validation. */
  readonly path: string;
  /** Exact frozen supporting-byte identity. */
  readonly hash: string;
  /** Raw extent measured by the owning byte matcher. */
  readonly bytes: number;
  /** Every interpreted relationship remains explicitly attributed. */
  readonly bindings: readonly PreparationRootReferenceBinding[];
};

/**
 * Current policy exclusions preserve the frozen producer's distinct missing and original-English states.
 *
 * @example
 * ```ts
 * const excluded: PreparationRootExclusion = { entryId, kind: 'missing-corpus-side' };
 * ```
 */
export type PreparationRootExclusion = {
  /** Listed corpus entry whose eligibility is reconstructed. */
  readonly entryId: string;
  /** At least one pinned source path is absent. */
  readonly kind: 'missing-corpus-side';
} | {
  /** Entry declined by an inherited whole-page declaration. */
  readonly entryId: string;
  /** Original-English authority before pass normalization. */
  readonly kind: 'production-whole-page-original';
  /** Exact effective archive before normalization. */
  readonly archiveHash: string;
  /** Declaration identity without placing its prose in this record. */
  readonly noteHash: string;
} | {
  /** Entry declined by the normalized whole-page declaration. */
  readonly entryId: string;
  /** Original-English authority after pass normalization. */
  readonly kind: 'normalized-whole-page-original';
  /** Exact effective archive before normalization. */
  readonly archiveHash: string;
  /** Exact normalized archive identity. */
  readonly targetHash: string;
  /** Declaration identity under the native classification. */
  readonly noteHash: string;
};

/**
 * Semantic root inputs describe current pinned data, never an acquisition phase or reviewed writer unit.
 *
 * @example
 * ```ts
 * const inputs = await buildPreparationRootInputs({ text, expectedDigest, artifacts, pin, l });
 * ```
 */
export type PreparationRootInputs = {
  /** Qualification, phase review and call permission remain subsequent owners. */
  readonly scope: 'unqualified-preparation-root-inputs';
  /** Independently bound frozen selection, not a caller-fabricated typed assertion. */
  readonly selection: FrozenPreparationSelection;
  /** Complete checked artifact inventory in original frozen order. */
  readonly references: readonly PreparationRootReference[];
  /** Raw/effective identities for every successfully read pinned corpus document. */
  readonly rawDocuments: readonly PreparationRootRawDocument[];
  /** Listed entries in native Git order, including exclusions. */
  readonly listedEntryIds: readonly string[];
  /** Current eligible population metadata in native order, without unrelated full-parent prose. */
  readonly population: readonly PreparationRootPopulationParent[];
  /** Existing policy exclusions must match frozen evidence exactly. */
  readonly excluded: readonly PreparationRootExclusion[];
  /** Selected complete entries retain their source and normalization provenance. */
  readonly entries: readonly PreparationRootEntry[];
  /** Exactly the original ordered parent identities, never a replacement draw. */
  readonly parents: readonly PreparationRootParent[];
  /** Source obligations retain open qualifications and cannot silently authorize extra calls. */
  readonly obligations: readonly FrozenPreparationObligation[];
};

//endregion Semantic ownership of frozen supporting evidence
