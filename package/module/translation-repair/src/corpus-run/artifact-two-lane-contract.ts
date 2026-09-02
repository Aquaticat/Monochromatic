import type { PreparationIdentity, } from '../preparation-identity.ts';
import type { RepairTranslationResult, } from '../repair-result.ts';
import type { TranslateDocumentResult, } from '../translate-document-contract.ts';
import type { ArtifactConsolidation, } from './artifact-two-lane-consolidate.ts';
import type { ArtifactLaneSelection, } from './artifact-two-lane-contest.ts';
import type {
  ArtifactComparisonRow,
  ArtifactDeliveryRow,
} from './artifact-two-lane-vocabulary.ts';
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
 * Generation this contract describes, and the one the pass writes.
 *
 * A LITERAL rather than a reference to the writer's current version, so the
 * type says which generation it is and a later bump cannot quietly re-label it.
 *
 * WHAT MOVED FROM NINE: the absolute naturalness reviewer is shown, and its
 * findings are located in, EVERY body block of the candidate rather than the
 * refinable paragraphs alone, and the recorded paragraph count and digests
 * are of those blocks. A reader recomputes them, so it must know which set a
 * record was made from (the Toka_ls rerun of 2026-09-02: a blockquote
 * candidate had zero refinable paragraphs, and six of nine reviewers who
 * located findings by stanza were refused as out of range).
 */
export const ARTIFACT_SCHEMA_VERSION_V10 = 10;

/**
 * Generation before reviewers were shown every body block.
 */
export const ARTIFACT_SCHEMA_VERSION_V9 = 9;

/**
 * Generation before two bounded correction transitions became auditable.
 */
export const ARTIFACT_SCHEMA_VERSION_V8 = 8;

/**
 * Generation before exact-text absolute naturalness review became auditable.
 */
export const ARTIFACT_SCHEMA_VERSION_V7 = 7;

/**
 * Generation before source-backed contest eligibility became auditable.
 */
export const ARTIFACT_SCHEMA_VERSION_V6 = 6;

/**
 * Generation before final post-consolidation body polish became auditable.
 */
export const ARTIFACT_SCHEMA_VERSION_V5 = 5;

/**
 * Generation before front matter became explicit slice zero.
 */
export const ARTIFACT_SCHEMA_VERSION_V4 = 4;

/**
 * Generation that renamed the three index and critic keys and left the
 * per-slice index alone. Still read, no longer written.
 *
 * A MIXTURE, and that is the whole reason it needs its own row in the key
 * table: it spells the arrays the way generation 4 does and the index the way
 * generation 2 did.
 */
export const ARTIFACT_SCHEMA_VERSION_V3 = 3;

/**
 * Generation this same shape was first written under, still read and no longer
 * written.
 *
 * THE SHAPE DID NOT MOVE. Versions 2, 3 and 4 record the same two lanes, the
 * same comparison and the same lane selection. They differ in four key
 * spellings, which `artifact-key-vocabulary.ts` holds and a reader selects by
 * the version the file records.
 *
 * The version moved anyway, twice, because a key rename IS a shape change and a
 * version that does not move on one is the failure this field exists to end.
 */
export const ARTIFACT_SCHEMA_VERSION_V2 = 2;

/**
 * Every generation carrying this two-lane shape, oldest first.
 *
 * ONE AUTHORITY FOR THE FAMILY, because two places decide something about it:
 * the reader that accepts a body, and the dispatch that chooses that reader for
 * a file. Those two lists drifting apart is not a refusal but a WRONG ANSWER,
 * and it already happened once: generation 3 was minted, the reader learned it,
 * the dispatch did not, and every generation 3 artifact reaching the dispatch
 * was reported as a generation nothing reads.
 *
 * NAMED ONE BY ONE RATHER THAN AS A RANGE, since a generation belongs here once
 * someone has checked that `artifact-key-vocabulary.ts` spells it, not because
 * its number falls between two others.
 *
 * @example
 * ```ts
 * if (TWO_LANE_GENERATIONS.includes(version,)) { ... }
 * ```
 */
export const TWO_LANE_GENERATIONS: readonly number[] = [
  ARTIFACT_SCHEMA_VERSION_V2,
  ARTIFACT_SCHEMA_VERSION_V3,
  ARTIFACT_SCHEMA_VERSION_V4,
  ARTIFACT_SCHEMA_VERSION_V5,
  ARTIFACT_SCHEMA_VERSION_V6,
  ARTIFACT_SCHEMA_VERSION_V7,
  ARTIFACT_SCHEMA_VERSION_V8,
  ARTIFACT_SCHEMA_VERSION_V9,
  ARTIFACT_SCHEMA_VERSION_V10,
];

/**
 * Generation of parsed two-lane artifact.
 *
 * @example
 * ```ts
 * const generation: TwoLaneArtifactGeneration = 5;
 * ```
 */
export type TwoLaneArtifactGeneration =
  | typeof ARTIFACT_SCHEMA_VERSION_V2
  | typeof ARTIFACT_SCHEMA_VERSION_V3
  | typeof ARTIFACT_SCHEMA_VERSION_V4
  | typeof ARTIFACT_SCHEMA_VERSION_V5
  | typeof ARTIFACT_SCHEMA_VERSION_V6
  | typeof ARTIFACT_SCHEMA_VERSION_V7
  | typeof ARTIFACT_SCHEMA_VERSION_V8
  | typeof ARTIFACT_SCHEMA_VERSION_V9
  | typeof ARTIFACT_SCHEMA_VERSION_V10;

/**
 * Narrows numeric artifact version to known two-lane generation.
 *
 * @param value - parsed schema version
 *
 * @returns Whether this two-lane reader knows generation
 *
 * @example
 * ```ts
 * if (isTwoLaneArtifactGeneration(artifact.artifactSchemaVersion)) read(artifact);
 * ```
 */
export function isTwoLaneArtifactGeneration(
  value: number,
): value is TwoLaneArtifactGeneration {
  return TWO_LANE_GENERATIONS.includes(value,);
}

/**
 * Reports whether generation requires auditable consolidation polish records.
 *
 * @param generation - known two-lane artifact generation
 *
 * @returns Whether every consolidation slice must carry polish field
 *
 * @example
 * ```ts
 * artifactGenerationRequiresPolish({ generation: 7, });
 * ```
 */
export function artifactGenerationRequiresPolish(
  { generation, }: { readonly generation: TwoLaneArtifactGeneration; },
): boolean {
  return (generation === ARTIFACT_SCHEMA_VERSION_V6)
    || (generation === ARTIFACT_SCHEMA_VERSION_V7)
    || (generation === ARTIFACT_SCHEMA_VERSION_V8)
    || (generation === ARTIFACT_SCHEMA_VERSION_V9)
    || (generation === ARTIFACT_SCHEMA_VERSION_V10);
}

/**
 * Reports whether generation binds final wording to absolute naturalness review.
 *
 * @param generation - known two-lane artifact generation
 *
 * @returns Whether consolidation polish must carry absolute review audit
 *
 * @example
 * ```ts
 * artifactGenerationRequiresNaturalnessReview({ generation: 8, });
 * ```
 */
export function artifactGenerationRequiresNaturalnessReview(
  { generation, }: { readonly generation: TwoLaneArtifactGeneration; },
): boolean {
  return (generation === ARTIFACT_SCHEMA_VERSION_V8)
    || (generation === ARTIFACT_SCHEMA_VERSION_V9)
    || (generation === ARTIFACT_SCHEMA_VERSION_V10);
}

/**
 * Reports whether generation binds every correction transition by digest.
 *
 * @param generation - known two-lane artifact generation
 *
 * @returns Whether review audit requires correction chain
 *
 * @example
 * ```ts
 * artifactGenerationRequiresNaturalnessCorrectionChain({ generation: 9, });
 * ```
 */
export function artifactGenerationRequiresNaturalnessCorrectionChain(
  { generation, }: { readonly generation: TwoLaneArtifactGeneration; },
): boolean {
  return (generation === ARTIFACT_SCHEMA_VERSION_V9)
    || (generation === ARTIFACT_SCHEMA_VERSION_V10);
}

/**
 * Reports whether generation showed the absolute reviewer every body block
 * of the candidate, so that recorded paragraph counts and digests are of
 * those blocks rather than of the refinable paragraphs alone.
 *
 * @param generation - known two-lane artifact generation
 *
 * @returns Whether reviewed paragraphs are every body block
 *
 * @example
 * ```ts
 * artifactGenerationReviewsEveryBodyBlock({ generation: 10, });
 * ```
 */
export function artifactGenerationReviewsEveryBodyBlock(
  { generation, }: { readonly generation: TwoLaneArtifactGeneration; },
): boolean {
  return generation === ARTIFACT_SCHEMA_VERSION_V10;
}

/**
 * Generation-specific fields exact reader requires.
 *
 * @param generation - known two-lane artifact generation
 *
 * @returns Polish and absolute-review requirements for generation
 *
 * @example
 * ```ts
 * const requirements = artifactGenerationReadingRequirements({ generation: 8, });
 * ```
 */
export function artifactGenerationReadingRequirements(
  { generation, }: { readonly generation: TwoLaneArtifactGeneration; },
): {
  readonly polishRequired: boolean;
  readonly reviewRequired: boolean;
  readonly correctionChainRequired: boolean;
  readonly everyBodyBlockReviewed: boolean;
} {
  return {
    polishRequired: artifactGenerationRequiresPolish({ generation, }),
    reviewRequired: artifactGenerationRequiresNaturalnessReview({ generation, }),
    correctionChainRequired: artifactGenerationRequiresNaturalnessCorrectionChain({ generation, }),
    everyBodyBlockReviewed: artifactGenerationReviewsEveryBodyBlock({ generation, }),
  };
}

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
 * const preparation: SettledPreparation = { identity, sliceCount: 12, ... };
 * ```
 */
export type SettledPreparation = {
  /**
   * Name this slicing gives itself, which every row is joined under.
   */
  readonly identity: PreparationIdentity;

  /**
   * Archive English of the whole entry, as it stood before either lane ran.
   *
   * STORED BECAUSE IT COSTS ALMOST NOTHING AND BUYS THE FILE ITS OWN MEANING.
   * Measured over the archived artifacts it adds 0.6 and 0.9 percent: an
   * artifact is judge exchanges, findings and ledger rows, not text. The
   * alternative, a hash plus the corpus commit, saves that fraction by charging
   * every future reader a checkout pinned to the right commit, which is the
   * dependency generation identity exists to remove.
   *
   * IT TRAVELS WITH {@link SettledPreparation.identity} OR NOT AT ALL. Stored
   * text nobody can check against the slicing that produced it is a record with
   * no standing, so the hash is what makes the text evidence rather than a copy.
   *
   * Decided in `doc/decision/artifact-stores-the-archive-text.md`.
   */
  readonly archiveText: string;

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

  /**
   * Which original block the roster said each translation block renders, per
   * aligned section.
   *
   * THE MOST CONSEQUENTIAL DECISION IN A RUN, and until this field the only one
   * a settled entry did not keep. It decides which original each slice is
   * judged against, no later stage can repair a wrong one, and the cache that
   * held it is discarded once the entry settles. Recovering it meant racing a
   * live run before it settled.
   *
   * OPTIONAL WITHIN VERSION 2 rather than a version 3, on the precedent
   * {@link SettledPreparation.archiveText} set: a reader that meets it
   * unrecorded understands the artifact completely, so refusing the whole
   * generation over an added field would buy nothing. Recorded in
   * `doc/decision/artifact-stores-the-block-pairing.md`.
   *
   * ABSENT MEANS NOBODY WAS ASKED, which in practice means the artifact was
   * written before this field existed: every production entry runs through the
   * roster shell. Present and EMPTY means the roster was asked and agreed
   * nothing anywhere, which is a different fact. A section missing from a
   * present list had no pairing consumed for it, and which reason applies is
   * legible from {@link SettledPreparation.alignmentFindings} rather than
   * from here: it may have been trivial enough that nobody was asked, it may
   * have fallen back to scoring, or its round may have gone unanswered.
   */
  readonly blockPairing?: readonly ArtifactSectionPairing[];

  /**
   * Which decider chose the aligned sections, and what it chose.
   *
   * THE OTHER HALF OF THE PAIRING RECIPE. `blockPairing` above is keyed by
   * aligned section index, and those indices only mean something under the
   * section alignment that was in force. A reader rebuilding the slicing
   * needs both, and until this field it had one.
   *
   * ALWAYS WRITTEN BY THE BUILDER, unlike `blockPairing`: the deterministic
   * aligner deciding the sections is the ordinary production case, so an
   * absent field could not tell "the aligner decided" from "written before
   * the field existed". Optional here only because every artifact settled
   * before it was added lacks it, which a reader reports as unrecorded.
   */
  readonly sectionPairing?: ArtifactSectionAlignment;
};

/**
 * One committed correspondence between the two sides' sections, as version 2
 * records it.
 *
 * FROZEN UNDER A VERSION 2 NAME rather than reusing the live `SectionPair`,
 * for the reason {@link ArtifactSectionPairing} gives.
 *
 * @example
 * ```ts
 * const pair: ArtifactSectionCorrespondence = { source: 2, target: 3, };
 * ```
 */
export type ArtifactSectionCorrespondence = {
  /**
   * Original-side section index.
   */
  readonly source: number;

  /**
   * Translation-side section index.
   */
  readonly target: number;
};

/**
 * How the aligned sections were decided, as version 2 records it.
 *
 * @example
 * ```ts
 * const alignment: ArtifactSectionAlignment = { kind: 'deterministic', };
 * ```
 */
export type ArtifactSectionAlignment = {
  /**
   * The deterministic aligner chose the sections, by shape or by heading
   * scoring; no pairing was supplied.
   */
  readonly kind: 'deterministic';
} | {
  /**
   * A supplied pairing chose them, which in production is the roster's
   * section round.
   */
  readonly kind: 'supplied';

  /**
   * Correspondences it committed to, in document order.
   */
  readonly pairs: readonly ArtifactSectionCorrespondence[];
};

/**
 * One aligned section's pairing, as version 2 records it.
 *
 * FROZEN UNDER A VERSION 2 NAME rather than reusing the live `BlockPair`, which
 * is the rule everywhere in this schema that is not evidence: a later field on
 * the live type would otherwise silently change what an artifact claiming
 * version 2 means. Drift makes the writer stop compiling, which is the moment
 * the version question should be asked.
 *
 * @example
 * ```ts
 * const pairing: ArtifactSectionPairing = { sectionIndex: 0, pairs: [{ source: 0, target: 0, },], };
 * ```
 */
export type ArtifactSectionPairing = {
  /**
   * Aligned section this answers about, which every index below is local to.
   */
  readonly sectionIndex: number;

  /**
   * Correspondences the roster agreed on, in document order.
   */
  readonly pairs: readonly {
    /**
     * Original-side block index within this section.
     */
    readonly source: number;

    /**
     * Translation-side block index within this section.
     */
    readonly target: number;
  }[];
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
 * const lane: SettledLane<RepairTranslationResult> = { result, delivery, };
 * ```
 */
export type SettledLane<TResult,> = {
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
  readonly delivery: readonly ArtifactDeliveryRow[];
};

/**
 * Everything one settled entry records, once both lanes have run.
 *
 * @example
 * ```ts
 * const artifact: SettledArtifact = buildSettledTwoLaneArtifact({ ... },);
 * ```
 */
export type SettledArtifact = {
  /**
   * Which generation this is, stated rather than inferred from which fields
   * happen to be present.
   */
  readonly artifactSchemaVersion: typeof ARTIFACT_SCHEMA_VERSION_V10;

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
  readonly preparation: SettledPreparation;

  /**
   * The two lanes, nested and unordered in meaning: neither is the output.
   */
  readonly lanes: {
    /**
     * Lane that mends the archive's English.
     */
    readonly repair: SettledLane<RepairTranslationResult>;

    /**
     * Lane that renders every slice afresh from the original.
     */
    readonly translate: SettledLane<TranslateDocumentResult>;
  };

  /**
   * The two lanes compared slice by slice, derived rather than supplied.
   *
   * Persisted for the reader's convenience and RECOMPUTED by any reader that
   * cares, which then refuses a disagreement: a stored comparison is a claim
   * about two ledgers that are stored beside it, so nothing has to trust it.
   */
  readonly comparison: readonly ArtifactComparisonRow[];

  /**
   * Which lane ships, as the roster settled it or as nobody having asked.
   *
   * A STATED PENDING STATE rather than an absent field. Leaving it out would
   * make "no decision yet" and "this artifact predates the question" the same
   * absence, which is the defect class this whole generation exists to end.
   */
  readonly laneSelection: ArtifactLaneSelection;

  /**
   * What the consolidation settled, or a stated absence saying it never ran.
   *
   * SEPARATE FROM `laneSelection` because it answers a later question. The
   * contest picks between the two lanes; this asks whether a rendering neither
   * lane produced is better than the winner, and it runs only where the contest
   * already settled something.
   */
  readonly consolidation: ArtifactConsolidation;
};

//endregion Artifact version 2 contract
