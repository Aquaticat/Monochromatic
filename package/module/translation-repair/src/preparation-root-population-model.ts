import type {
  ArchiveOriginalReading,
  ArchiveOriginalSpan,
} from './archive-original-note.ts';
import type { AlignmentFinding, } from './chunk-document.ts';
import type { ArchiveRetainedLine, } from './corpus-run/archive-stub.ts';
import type { DocumentNode, } from './document-node.ts';
import type { ParseFinding, } from './parse-document.ts';

//region Current corpus identities compared with frozen population evidence

/**
 * Pinned raw bytes and their effective text remain independently identifiable.
 *
 * @example
 * ```ts
 * const raw: PreparationRootRawDocument = { relPath, bytes, rawHash, decodedHash, effectiveHash, foldedCrLf };
 * ```
 */
export type PreparationRootRawDocument = {
  /**
   * Commit-relative locator, never a generated replacement path.
   */
  readonly relPath: string;
  /**
   * Exact committed byte extent.
   */
  readonly bytes: number;
  /**
   * SHA-256 before UTF-8 decoding or line-ending folding.
   */
  readonly rawHash: string;
  /**
   * Hash after native UTF-8 decoding but before CRLF folding.
   */
  readonly decodedHash: string;
  /**
   * Hash under the existing corpus text reader's line-ending semantics.
   */
  readonly effectiveHash: string;
  /**
   * Native count of CRLF sequences folded without changing line numbering.
   */
  readonly foldedCrLf: number;
};

/**
 * Serializable original-English authority observed before and after archive normalization.
 *
 * @example
 * ```ts
 * const policy: PreparationRootOriginalPolicy = { inherited: 'none', normalized: 'none', spans: [] };
 * ```
 */
export type PreparationRootOriginalPolicy = {
  /**
   * Raw archive declaration classification.
   */
  readonly inherited: ArchiveOriginalReading['kind'];
  /**
   * Normalized archive declaration classification.
   */
  readonly normalized: ArchiveOriginalReading['kind'];
  /**
   * Current protected ranges; declarations do not become model votes.
   */
  readonly spans: readonly ArchiveOriginalSpan[];
};

/**
 * Exact selected-entry texts and reconstruction evidence, not qualified writer input.
 *
 * @example
 * ```ts
 * const entry: PreparationRootEntry = { entryId, sourceText, archiveText, targetText, sourceHash, archiveHash, targetHash, originalPolicy, archiveLines, sourceFindings, targetFindings, alignmentFindings };
 * ```
 */
export type PreparationRootEntry = {
  /**
   * Frozen corpus directory component.
   */
  readonly entryId: string;
  /**
   * Effective original under shared corpus reading semantics.
   */
  readonly sourceText: string;
  /**
   * Effective archive before invisible/stub normalization.
   */
  readonly archiveText: string;
  /**
   * Shared normalized incumbent, not repaired prose.
   */
  readonly targetText: string;
  /**
   * Complete original identity.
   */
  readonly sourceHash: string;
  /**
   * Complete archive identity before pass normalization.
   */
  readonly archiveHash: string;
  /**
   * Complete incumbent identity after pass normalization.
   */
  readonly targetHash: string;
  /**
   * Current source-authority classification.
   */
  readonly originalPolicy: PreparationRootOriginalPolicy;
  /**
   * Exact retained normalized lines and pinned-file line numbers.
   */
  readonly archiveLines: readonly ArchiveRetainedLine[];
  /**
   * Parser observations are retained rather than reinterpreted as permission.
   */
  readonly sourceFindings: readonly ParseFinding[];
  /**
   * Incumbent parser observations remain visible to subsequent review.
   */
  readonly targetFindings: readonly ParseFinding[];
  /**
   * Deterministic section observations do not authorize a section-pairing phase.
   */
  readonly alignmentFindings: readonly AlignmentFinding[];
};

/**
 * Frozen producer's node projection, reconstructed from complete current documents.
 *
 * @example
 * ```ts
 * const node: PreparationRootNode = { id, kind, zone, startOffset, endOffset, contentHash };
 * ```
 */
export type PreparationRootNode = Pick<DocumentNode, 'id' | 'kind' | 'zone' | 'startOffset' | 'endOffset' | 'contentHash'>;

/**
 * One complete parent's positional inventory under the historical frozen schema.
 *
 * @example
 * ```ts
 * const side: PreparationRootParentSide = { startOffset, endOffset, hash, nodes };
 * ```
 */
export type PreparationRootParentSide = {
  /**
   * First current document offset owned by the parent.
   */
  readonly startOffset: number;
  /**
   * Exclusive current parent boundary.
   */
  readonly endOffset: number;
  /**
   * Exact parent text hash, not a complete-document identity.
   */
  readonly hash: string;
  /**
   * Ordered native node membership.
   */
  readonly nodes: readonly PreparationRootNode[];
};

/**
 * Original-English protections in the frozen producer's explicit representation.
 *
 * @example
 * ```ts
 * const protection: PreparationRootProtection = { intersections: [], sealedTargetNodeIds: [], straddlingNodeIds: [], allTargetNodesSealed: false };
 * ```
 */
export type PreparationRootProtection = {
  /**
   * Current intersections keep the declaration identity without exporting its text here.
   */
  readonly intersections: readonly {
    readonly startOffset: number;
    readonly endOffset: number;
    readonly noteHash: string
  }[];
  /**
   * Native sealed-node identities.
   */
  readonly sealedTargetNodeIds: readonly string[];
  /**
   * Nodes crossing a protected boundary remain separately observable.
   */
  readonly straddlingNodeIds: readonly string[];
  /**
   * Empty targets are not fabricated all-sealed controls.
   */
  readonly allTargetNodesSealed: boolean;
};

/**
 * Current parent reconstructed in the exact frozen pool representation, without resampling.
 *
 * @example
 * ```ts
 * const parent: PreparationRootParent = { id, entryId, index, pairIndex, sourceSectionIndex, targetSectionIndex, sourceText, incumbentText, source, target, originalProtection };
 * ```
 */
export type PreparationRootParent = {
  /**
   * Canonical entry/source-section/target-section identity.
   */
  readonly id: string;
  /**
   * Corpus entry retaining its contributor and authority context.
   */
  readonly entryId: string;
  /**
   * Historical sampler's source-side index alias.
   */
  readonly index: number;
  /**
   * Position in the current combined aligned-parent list.
   */
  readonly pairIndex: number;
  /**
   * Original-side section identity.
   */
  readonly sourceSectionIndex: number;
  /**
   * Incumbent-side section or insertion-anchor identity.
   */
  readonly targetSectionIndex: number;
  /**
   * Complete parent original, not a selected output fragment.
   */
  readonly sourceText: string;
  /**
   * Complete parent incumbent remains a fallible baseline.
   */
  readonly incumbentText: string;
  /**
   * Current original-side coordinates and node membership.
   */
  readonly source: PreparationRootParentSide;
  /**
   * Current incumbent-side coordinates and node membership.
   */
  readonly target: PreparationRootParentSide;
  /**
   * Original-English ownership remains independent of correspondence.
   */
  readonly originalProtection: PreparationRootProtection;
};

/**
 * Population accounting carries coordinates and protections without unrelated full-parent prose.
 *
 * @example
 * ```ts
 * const population: readonly PreparationRootPopulationParent[] = currentPopulation;
 * ```
 */
export type PreparationRootPopulationParent = Omit<PreparationRootParent, 'index' | 'sourceText' | 'incumbentText'>;

//endregion Current corpus identities compared with frozen population evidence
