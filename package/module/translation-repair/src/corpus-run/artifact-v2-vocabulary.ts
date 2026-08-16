//region Artifact version 2 vocabulary
// The small unions a version 2 reader DISPATCHES on, frozen under names this
// version owns.
//
// Every one of these has a live twin in the pipeline, and the twins are the
// right thing for the pipeline to keep changing: this session alone added a
// fifth lane outcome and split one delivery word into two axes. Importing the
// live union into the persisted shape would make each of those changes expand
// what version 2 MEANS, silently, for artifacts already on disk. A reader
// written against version 2 would then meet a member its dispatch has never
// heard of while the version number still says 2.
//
// So these are copies, and the duplication is the point rather than a cost to
// be removed later. The rule they encode: the live unions may grow whenever the
// pipeline needs them to, and the day one of them grows in a way this file does
// not describe, the artifact becomes version 3.
//
// THE COMPILER ENFORCES THAT, which is why the copies are worth having rather
// than merely well intentioned. It takes two mechanisms, and knowing which does
// what matters, because assuming one covers both is how a schema drifts:
//
//  -   MEMBER GROWTH is caught by `artifact-v2-project.ts`, which ends each
//      projection on a `never` binding. A live union that gains a member leaves
//      that member unhandled, the binding stops being `never`, and the file
//      stops compiling. Plain assignment catches this too; the projection makes
//      it deliberate rather than incidental.
//  -   FIELD GROWTH is NOT caught, by either mechanism, and saying otherwise is
//      how a schema drifts. Excess property checking applies to object
//      LITERALS, so a live record that gains a field assigns into these types
//      cleanly; the projection does not fail on it either, it simply leaves the
//      new field out. What the projection buys is that the new field cannot
//      reach the written bytes, so version 2 artifacts keep meaning what this
//      file says and the version 2 parser keeps accepting them.
//
// So a live union that grows meets the version question as a build error, and a
// live record that grows keeps writing valid version 2 until somebody decides
// the new field belongs on disk. An exact-shape type test would turn the second
// into a build error too; it is not here, and that is the gap to close if a
// silently omitted field ever turns out to have mattered.
//
// DELIBERATELY NOT the whole artifact. The two raw lane results are recorded as
// EVIDENCE and typed by their live shapes, because they are large, they grow
// additively, and nothing dispatches on their shape: a reader takes what it
// recognizes and ignores the rest. What is frozen here is exactly the part a
// reader has to understand completely to read a row at all.

/**
 * What a lane did about one slice, as version 2 records it.
 *
 * @example
 * ```ts
 * const outcome: ArtifactSliceOutcomeV2 = { kind: 'decided', acceptedText: 'The cat naps.', };
 * ```
 */
export type ArtifactSliceOutcomeV2 = {
  /**
   * Lane produced a wording, whether or not the document carries it.
   */
  readonly kind: 'decided';

  /**
   * Wording it decided on.
   */
  readonly acceptedText: string;
} | {
  /**
   * Lane never reached this slice.
   */
  readonly kind: 'not-evaluated';
} | {
  /**
   * Lane reached it, produced nothing, and the archive had nothing either.
   */
  readonly kind: 'unfilled';
} | {
  /**
   * Lane reached it, produced nothing, and the archive's wording therefore
   * stands by default rather than by anyone's choice.
   */
  readonly kind: 'incumbent-fallback';
} | {
  /**
   * Lane reached it and the work it does has no input there at all.
   */
  readonly kind: 'not-applicable';
};

/**
 * What one lane's document carries at one slice, as version 2 records it.
 *
 * @example
 * ```ts
 * const delivery: ArtifactSliceDeliveryV2 = { kind: 'replacement-shipped', };
 * ```
 */
export type ArtifactSliceDeliveryV2 = {
  /**
   * Document carries the lane's decision, which differs from the archive.
   */
  readonly kind: 'replacement-shipped';
} | {
  /**
   * Lane decided a replacement and the document does not carry it.
   */
  readonly kind: 'replacement-withdrawn';

  /**
   * Which mechanism took it back: the per-slice assembly guard, or the
   * whole-document refusal that never assembled at all.
   */
  readonly reason: 'assembly-integrity' | 'blocked-non-translation';
} | {
  /**
   * Document carries the archive's own wording.
   */
  readonly kind: 'incumbent-retained';
} | {
  /**
   * Passage is missing, and the archive never had it either.
   */
  readonly kind: 'gap-remains';
};

/**
 * One row of one lane's delivery ledger, as version 2 records it.
 *
 * @example
 * ```ts
 * const row: ArtifactDeliveryRowV2 = { chunkIndex: 0, sourceText: '猫', ... };
 * ```
 */
export type ArtifactDeliveryRowV2 = {
  /**
   * Global slice index, which every join uses.
   */
  readonly chunkIndex: number;

  /**
   * Original this slice was translated from.
   */
  readonly sourceText: string;

  /**
   * Whether the archive holds any wording at this slice at all.
   */
  readonly incumbentKind: 'present' | 'absent';

  /**
   * Archive's own English for it.
   */
  readonly incumbentText: string;

  /**
   * What the lane did.
   */
  readonly outcome: ArtifactSliceOutcomeV2;

  /**
   * Wording the lane's document carries here.
   */
  readonly shippedText: string;

  /**
   * How it came to carry that.
   */
  readonly delivery: ArtifactSliceDeliveryV2;
};

/**
 * How the two lanes' own decisions relate at one slice, as version 2 records
 * it.
 *
 * @example
 * ```ts
 * const decisions: ArtifactDecisionComparisonV2 = { kind: 'comparable', verdict: 'same', };
 * ```
 */
export type ArtifactDecisionComparisonV2 = {
  /**
   * Both lanes decided a wording.
   */
  readonly kind: 'comparable';

  /**
   * Whether those wordings match, character for character.
   */
  readonly verdict: 'same' | 'different';
} | {
  /**
   * At least one lane decided nothing here.
   */
  readonly kind: 'not-comparable';

  /**
   * Which lanes those were, in lane order.
   */
  readonly undecidedLanes: readonly ('repair' | 'translate')[];
};

/**
 * How the two documents relate at one slice, as version 2 records it.
 *
 * @example
 * ```ts
 * const verdict: ArtifactLaneVerdictV2 = 'both-differ';
 * ```
 */
export type ArtifactLaneVerdictV2 =
  | 'archive-stands'
  | 'repair-only'
  | 'translate-only'
  | 'both-agree'
  | 'both-differ'
  | 'gap-remains';

/**
 * One slice as both lanes left it, as version 2 records it.
 *
 * @example
 * ```ts
 * const row: ArtifactComparisonRowV2 = { chunkIndex: 0, verdict: 'both-differ', ... };
 * ```
 */
export type ArtifactComparisonRowV2 = {
  /**
   * Slice both lanes name it by.
   */
  readonly chunkIndex: number;

  /**
   * Whether the archive holds any wording here.
   */
  readonly incumbentKind: 'present' | 'absent';

  /**
   * Archive's own English for it.
   */
  readonly incumbentText: string;

  /**
   * Wording the repair document carries.
   */
  readonly repairText: string;

  /**
   * Wording the translate document carries.
   */
  readonly translateText: string;

  /**
   * How the two documents relate here.
   */
  readonly verdict: ArtifactLaneVerdictV2;

  /**
   * What the repair lane did.
   */
  readonly repairOutcome: ArtifactSliceOutcomeV2;

  /**
   * What the translate lane did.
   */
  readonly translateOutcome: ArtifactSliceOutcomeV2;

  /**
   * Whether their decisions were comparable, and how they came out.
   */
  readonly decisionComparison: ArtifactDecisionComparisonV2;

  /**
   * How the repair document came to carry what it carries.
   */
  readonly repairDelivery: ArtifactSliceDeliveryV2;

  /**
   * How the translate document did.
   */
  readonly translateDelivery: ArtifactSliceDeliveryV2;
};

//endregion Artifact version 2 vocabulary
