import type { PreparationIdentity, } from '../preparation-identity.ts';
import type { ArtifactLaneSelectionV2, } from './artifact-v2-contest.ts';
import type { ArtifactJsonValue, } from './artifact-v2-contract.ts';
import type {
  ArtifactComparisonRowV2,
  ArtifactDeliveryRowV2,
  ArtifactSliceOutcomeV2,
} from './artifact-v2-vocabulary.ts';
import type { PipelineDigest, } from './pipeline-digest.ts';

//region Artifact version 2 read contract
// What a reader gets back from a version 2 artifact, and what it requires of
// the two fields the schema leaves open.
//
// NOT `SettledArtifactV2`, which is the WRITER's type. Its two raw lane results
// are typed by the live pipeline shapes, so a reader returning it would promise
// callers that a file written months ago satisfies today's `RepairTranslationResult`.
// It does not, and it never had to: those results are evidence, they grow by
// addition, and version 2 requires only the part of them it checks.
//
// THE EVIDENCE CORE IS THAT PART, and it is why this file exists. Without it
// the meaning of version 2 is whatever the current TypeScript types say, which
// is the same drift the frozen vocabulary and the frozen comparison already
// closed on the other two axes. With it, a version 2 artifact is readable
// forever by a reader that never imports a live pipeline type: the whole raw
// record comes back untouched for whoever wants more, and everything this
// reader CHECKS is named here.
//
// THE TWO LANE STATUSES ARE LITERAL COPIES, not `RepairStatus` or
// `TranslateDocumentResult['status']`. Importing either would let a live union
// gaining a member silently widen what version 2 accepts, which is exactly the
// drift the vocabulary file exists to stop, reintroduced on the read side.

/**
 * How a repair run ended, as version 2 froze it.
 *
 * @example
 * ```ts
 * const status: ArtifactRepairStatusV2 = 'blocked-non-translation';
 * ```
 */
export type ArtifactRepairStatusV2 =
  | 'repaired'
  | 'unchanged'
  | 'blocked-non-translation';

/**
 * Whether a translate run produced a whole translation, as version 2 froze it.
 *
 * @example
 * ```ts
 * const status: ArtifactTranslateStatusV2 = 'unfilled';
 * ```
 */
export type ArtifactTranslateStatusV2 =
  | 'complete'
  | 'unfilled';

/**
 * One slice as a lane's RAW result describes it.
 *
 * The evidence behind one ledger row, parsed out of the open raw record and
 * checked against that row by position. Deliberately the same four fields the
 * ledger repeats, since the check is whether the two agree; everything else the
 * raw row carries stays in the raw record, unread and unrequired.
 *
 * @example
 * ```ts
 * const row: ArtifactEvidenceRowV2 = { chunkIndex: 0, incumbentKind: 'present', ... };
 * ```
 */
export type ArtifactEvidenceRowV2 = {
  /**
   * Global slice index this row is for.
   */
  readonly chunkIndex: number;

  /**
   * Whether the archive holds any wording at this slice.
   */
  readonly incumbentKind: 'present' | 'absent';

  /**
   * Archive's own English for it.
   */
  readonly incumbentText: string;

  /**
   * What the lane did about it.
   */
  readonly outcome: ArtifactSliceOutcomeV2;
};

/**
 * What version 2 requires of the repair lane's raw result.
 *
 * @example
 * ```ts
 * const evidence: ArtifactRepairEvidenceV2 = { status: 'unchanged', sliceCount: 2, ... };
 * ```
 */
export type ArtifactRepairEvidenceV2 = {
  /**
   * How the run ended, which the blocked-compatibility check reads.
   */
  readonly status: ArtifactRepairStatusV2;

  /**
   * Slices the preparation produced, which every index here is out of.
   */
  readonly sliceCount: number;

  /**
   * Slices the returned document carries a repair for.
   */
  readonly shippedChunkIndices: readonly number[];

  /**
   * Slices whose repair the assembly guard took back.
   */
  readonly withdrawnChunkIndices: readonly number[];

  /**
   * What the lane decided for every prepared slice, in document order.
   */
  readonly sliceTexts: readonly ArtifactEvidenceRowV2[];
};

/**
 * What version 2 requires of the translate lane's raw result.
 *
 * Carries two counts the repair result has no equivalent of, and they are here
 * because they are CHECKABLE: each equals the length of a list stored beside
 * it, so a result whose count and list disagree is caught rather than believed.
 *
 * @example
 * ```ts
 * const evidence: ArtifactTranslateEvidenceV2 = { status: 'complete', sliceCount: 2, ... };
 * ```
 */
export type ArtifactTranslateEvidenceV2 = {
  /**
   * Whether the document is a whole translation.
   */
  readonly status: ArtifactTranslateStatusV2;

  /**
   * Slices the preparation produced.
   */
  readonly sliceCount: number;

  /**
   * Slices whose accepted text shipped, which the shipped list also names.
   */
  readonly changedSliceCount: number;

  /**
   * Slices whose replacement was withdrawn, which the withdrawn list also
   * names.
   */
  readonly withdrawnSliceCount: number;

  /**
   * Slices the returned document carries a replacement for.
   */
  readonly shippedChunkIndices: readonly number[];

  /**
   * Slices whose replacement the assembly guard took back.
   */
  readonly withdrawnChunkIndices: readonly number[];

  /**
   * What the lane decided for every prepared slice, in document order.
   */
  readonly sliceTexts: readonly ArtifactEvidenceRowV2[];
};

/**
 * One lane as a reader gets it: the whole raw record, what version 2 requires
 * of it, and the ledger.
 *
 * THE RAW RECORD IS RETURNED rather than discarded once the core is out of it,
 * because a reader that wanted a field this version does not check should get
 * it from the artifact rather than from a later generation of this parser.
 *
 * @example
 * ```ts
 * const lane: ParsedLaneV2<ArtifactRepairEvidenceV2> = { raw, evidence, delivery, };
 * ```
 */
export type ParsedLaneV2<TEvidence,> = {
  /**
   * Exactly what the artifact holds under this lane's `result`, unread beyond
   * the core and never narrowed to a live pipeline type.
   */
  readonly raw: Readonly<Record<string, unknown>>;

  /**
   * The part of that record version 2 requires and checks.
   */
  readonly evidence: TEvidence;

  /**
   * One row per prepared slice, saying what this lane's document carries.
   */
  readonly delivery: readonly ArtifactDeliveryRowV2[];
};

/**
 * Archive English an artifact carries, or a positive statement that it carries
 * none.
 *
 * A TAGGED ABSENCE RATHER THAN AN OPTIONAL STRING, for the reason
 * `sample-manifest.ts` gives for the same shape: a file written before the
 * field existed cannot claim a value, and reading its silence as the empty
 * string would say the entry HAD no English, which is a different and false
 * claim. `unrecorded` says the file predates the field; `stored` says what it
 * held.
 *
 * @example
 * ```ts
 * const archive: ParsedArchiveTextV2 = { kind: 'unrecorded', };
 * ```
 */
export type ParsedArchiveTextV2 = {
  readonly kind: 'stored';

  /**
   * Archive English of the whole entry, verbatim.
   */
  readonly text: string;
} | {
  readonly kind: 'unrecorded';
};

/**
 * The slicing both lanes ran over, as a reader gets it.
 *
 * @example
 * ```ts
 * const preparation: ParsedPreparationV2 = { identity, sliceCount: 12, ... };
 * ```
 */
export type ParsedPreparationV2 = {
  /**
   * Archive English this file carries, or a statement that it carries none.
   */
  readonly archiveText: ParsedArchiveTextV2;

  /**
   * Name this slicing gives itself, checked for SYNTAX and nothing more: the
   * inputs it hashes are not in the file, so a standalone reader cannot
   * recompute it. Verification against a real preparation is a separate entry
   * point that takes one.
   */
  readonly identity: PreparationIdentity;

  /**
   * Slices it produced.
   */
  readonly sliceCount: number;

  /**
   * Original document length in UTF-16 code units.
   */
  readonly sourceChars: number;

  /**
   * Archive translation length, on the same measure.
   */
  readonly targetChars: number;

  /**
   * Original document length in UTF-8 bytes, which is the band input.
   */
  readonly sourceBytes: number;

  /**
   * Section pairs alignment produced.
   */
  readonly alignmentPairCount: number;

  /**
   * What alignment observed about the two documents' structure.
   */
  readonly alignmentFindings: readonly string[];
};

/**
 * One version 2 artifact as a reader gets it.
 *
 * NO SINGULAR STATUS, output, winner, issue list or change set, which version 1
 * had and this generation deliberately does not: both lanes are here, neither
 * is the output, and a reader wanting one answer has to say which lane it means.
 *
 * @example
 * ```ts
 * const artifact: ParsedArtifactV2 = parseSettledArtifactV2({ value, },);
 * ```
 */
export type ParsedArtifactV2 = {
  /**
   * Corpus entry this covers.
   */
  readonly id: string;

  /**
   * Repository head when the pass started, as provenance.
   */
  readonly tip: string;

  /**
   * Built output that ran, as identity.
   */
  readonly pipelineDigest: PipelineDigest;

  /**
   * Corpus commit the two texts were read at.
   */
  readonly corpusSha: string;

  /**
   * Model call configuration, whose inside this schema does not describe.
   */
  readonly callConfig: Readonly<Record<string, ArtifactJsonValue>>;

  /**
   * Wall time the entry took.
   */
  readonly durationMs: number;

  /**
   * When the artifact was written.
   */
  readonly timestamp: string;

  /**
   * Slicing both lanes ran over.
   */
  readonly preparation: ParsedPreparationV2;

  /**
   * The two lanes, neither of them the output.
   */
  readonly lanes: {
    /**
     * Lane that mends the archive's English.
     */
    readonly repair: ParsedLaneV2<ArtifactRepairEvidenceV2>;

    /**
     * Lane that renders every slice afresh from the original.
     */
    readonly translate: ParsedLaneV2<ArtifactTranslateEvidenceV2>;
  };

  /**
   * The two lanes compared, RECOMPUTED from the ledgers by version 2's own
   * rules and returned only once it matched the copy the file carries.
   */
  readonly comparison: readonly ArtifactComparisonRowV2[];

  /**
   * Which lane ships, proven to agree with the ballots recorded beside it and
   * with the comparison this reader recomputed.
   */
  readonly laneSelection: ArtifactLaneSelectionV2;
};

//endregion Artifact version 2 read contract
