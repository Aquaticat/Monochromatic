import type { PreparationIdentity, } from '../preparation-identity.ts';
import type { RepairTranslationResult, } from '../repair-result.ts';
import type { TranslateDocumentResult, } from '../translate-document-contract.ts';
import type {
  ArtifactComparisonRowV2,
  ArtifactDeliveryRowV2,
} from './artifact-v2-vocabulary.ts';
import type { PipelineDigest, } from './pipeline-digest.ts';

//region Artifact version 2 contract
// What a settled entry records once BOTH lanes run over one preparation.
//
// Version 1 recorded one lane at the top level: a status, a repaired text, a
// set of issues. Appending a second lane beside those would answer the open
// question invisibly, since every existing reader would go on taking the
// top-level fields as "the output" and never learn a second lane existed. So
// there is no top level any more. Both lanes are nested, neither is first, and
// the field that would name a winner says out loud that nobody has picked one.
//
// THE PREPARATION IS RECORDED ONCE, not per lane. Both lanes ran over one
// slicing by construction, and storing it twice would let a later reader meet
// two copies and have to decide which is real.
//
// WHAT THIS IS NOT: a self-contained record of the run. It stores measurements
// of the two documents rather than their canonical manifest, so a reader
// holding only this file can check that the recorded identity is SHAPED like an
// identity and nothing more. Recomputing it needs the corpus at the recorded
// commit. That asymmetry is deliberate and is stated here so nobody later reads
// a syntax check as a verification.

/**
 * Version this contract describes.
 *
 * A LITERAL rather than a reference to the writer's current version, so the
 * type says which generation it is and a later bump cannot quietly re-label it.
 */
export const ARTIFACT_SCHEMA_VERSION_V2 = 2;

/**
 * What the one field this schema does not describe may hold.
 *
 * JSON's `null` is deliberately NOT among these. It is absence spelled as a
 * value, which is the thing this whole generation exists to stop recording, and
 * the writer controls every byte that reaches this field: a configuration with
 * nothing to say about a setting leaves the key out. A reader meeting a null
 * here has met an artifact this schema did not write.
 *
 * @example
 * ```ts
 * const value: ArtifactJsonValue = { retries: 2, };
 * ```
 */
export type ArtifactJsonValue =
  | boolean
  | number
  | string
  | readonly ArtifactJsonValue[]
  | { readonly [key: string]: ArtifactJsonValue; };

/**
 * The slicing both lanes ran over, recorded once.
 *
 * @example
 * ```ts
 * const preparation: SettledPreparationV2 = { identity, sliceCount: 12, ... };
 * ```
 */
export type SettledPreparationV2 = {
  /**
   * Name this slicing gives itself, which every row is joined under.
   */
  readonly identity: PreparationIdentity;

  /**
   * Slices it produced, which every per-slice list here is out of.
   */
  readonly sliceCount: number;

  /**
   * Original document length, in UTF-16 code units, for eyeballing an entry's
   * size. NOT the band input, which is the byte count below.
   */
  readonly sourceChars: number;

  /**
   * Archive translation length, on the same measure.
   */
  readonly targetChars: number;

  /**
   * Original document length in UTF-8 BYTES, which is what band classification
   * takes and what the character counts are routinely mistaken for.
   */
  readonly sourceBytes: number;

  /**
   * Section pairs alignment produced.
   */
  readonly alignmentPairCount: number;

  /**
   * What alignment observed about the two documents' structure.
   *
   * Recorded on the preparation rather than under either lane: both ran over
   * this one alignment, and counting these per lane would count one defect in
   * the archive twice.
   */
  readonly alignmentFindings: readonly string[];
};

/**
 * One lane's raw result beside the ledger derived from it.
 *
 * BOTH, rather than either alone. The ledger is what a reader compares, because
 * it has been checked against that lane's own document; the raw result is the
 * evidence behind it, and a ledger with its evidence discarded cannot answer
 * why a slice went the way it did.
 *
 * @example
 * ```ts
 * const lane: SettledLaneV2<RepairTranslationResult> = { result, delivery, };
 * ```
 */
export type SettledLaneV2<TResult,> = {
  /**
   * Exactly what the lane returned.
   *
   * Typed by the lane's LIVE shape rather than frozen under a version 2 name,
   * unlike the unions a reader dispatches on. These are evidence: they are
   * large, they grow by addition, and a reader takes the fields it knows and
   * leaves the rest. A change that REMOVES or REPURPOSES a field here is a
   * version 3 all the same.
   */
  readonly result: TResult;

  /**
   * One row per prepared slice, saying what this lane's document carries.
   */
  readonly delivery: readonly ArtifactDeliveryRowV2[];
};

/**
 * Everything one settled entry records, once both lanes have run.
 *
 * @example
 * ```ts
 * const artifact: SettledArtifactV2 = buildSettledArtifactV2({ ... },);
 * ```
 */
export type SettledArtifactV2 = {
  /**
   * Which generation this is, stated rather than inferred from which fields
   * happen to be present.
   */
  readonly artifactSchemaVersion: typeof ARTIFACT_SCHEMA_VERSION_V2;

  /**
   * Corpus entry this covers.
   */
  readonly id: string;

  /**
   * Repository head when the pass started, as PROVENANCE: it says where the
   * code came from and never what ran.
   */
  readonly tip: string;

  /**
   * Built output that ran, as IDENTITY: this is the field two artifacts must
   * share before their results may be pooled.
   */
  readonly pipelineDigest: PipelineDigest;

  /**
   * Corpus commit the two texts were read at.
   */
  readonly corpusSha: string;

  /**
   * Model call configuration this run used, whose inside this schema
   * deliberately does not describe.
   */
  readonly callConfig: Readonly<Record<string, ArtifactJsonValue>>;

  /**
   * Wall time the entry took, both lanes included.
   */
  readonly durationMs: number;

  /**
   * When the artifact was written.
   */
  readonly timestamp: string;

  /**
   * Slicing both lanes ran over.
   */
  readonly preparation: SettledPreparationV2;

  /**
   * The two lanes, nested and unordered in meaning: neither is the output.
   */
  readonly lanes: {
    /**
     * Lane that mends the archive's English.
     */
    readonly repair: SettledLaneV2<RepairTranslationResult>;

    /**
     * Lane that renders every slice afresh from the original.
     */
    readonly translate: SettledLaneV2<TranslateDocumentResult>;
  };

  /**
   * The two lanes compared slice by slice, derived rather than supplied.
   *
   * Persisted for the reader's convenience and RECOMPUTED by any reader that
   * cares, which then refuses a disagreement: a stored comparison is a claim
   * about two ledgers that are stored beside it, so nothing has to trust it.
   */
  readonly comparison: readonly ArtifactComparisonRowV2[];

  /**
   * Which lane should ship, which nobody has decided.
   *
   * A STATED PENDING STATE rather than an absent field. Leaving it out would
   * make "no decision yet" and "this artifact predates the question" the same
   * absence, which is the defect class this whole generation exists to end.
   */
  readonly laneSelection: { readonly kind: 'pending-human-decision'; };
};

//endregion Artifact version 2 contract
