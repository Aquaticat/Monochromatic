import type {
  ArtifactComparisonRowV2,
  ArtifactDecisionComparisonV2,
  ArtifactSliceDeliveryV2,
  ArtifactSliceOutcomeV2,
} from './artifact-v2-vocabulary.ts';

//region Artifact version 2 row equality
// Whether two version 2 comparison rows say the same thing, compared FIELD BY
// FIELD.
//
// Not `JSON.stringify` on both sides, which is what this replaced. Serialized
// equality makes KEY ORDER matter, and key order is not part of what a row
// means: two rows built by different code, or one built in memory against one
// parsed from a file, can carry identical values in a different order and are
// the same row. The stringify version passed only because both sides happened
// to come from literals written in one order, which is luck rather than a
// checked property, and the version 2 reader will compare rows read off disk
// where the order is whatever the file has.
//
// Shared by the writer, which refuses a disagreement between version 2's rules
// and the pipeline's, and by the reader, which refuses a recorded comparison
// that disagrees with the one it derives. One definition, so the two cannot
// disagree about what agreement means.

/**
 * Whether two lane outcomes say the same thing.
 *
 * @param left - one outcome
 *
 * @param right - the other
 *
 * @returns Whether they name the same member carrying the same wording
 *
 * @example
 * ```ts
 * const same = outcomesEqualV2({ left: row.repairOutcome, right: other.repairOutcome, },);
 * ```
 */
export function outcomesEqualV2(
  {
    left,
    right,
  }: {
    readonly left: ArtifactSliceOutcomeV2;
    readonly right: ArtifactSliceOutcomeV2;
  },
): boolean {
  if (left.kind !== right.kind)
    return false;

  // The only member carrying anything beyond its name, so every other pair is
  // equal once the names match.
  if ((left.kind === 'decided') && (right.kind === 'decided'))
    return left.acceptedText === right.acceptedText;
  return true;
}

/**
 * Whether two deliveries say the same thing.
 *
 * @param left - one delivery
 *
 * @param right - the other
 *
 * @returns Whether they name the same member for the same reason
 *
 * @example
 * ```ts
 * const same = deliveriesEqualV2({ left: row.repairDelivery, right: other.repairDelivery, },);
 * ```
 */
export function deliveriesEqualV2(
  {
    left,
    right,
  }: {
    readonly left: ArtifactSliceDeliveryV2;
    readonly right: ArtifactSliceDeliveryV2;
  },
): boolean {
  if (left.kind !== right.kind)
    return false;
  if ((left.kind === 'replacement-withdrawn') && (right.kind === 'replacement-withdrawn'))
    return left.reason === right.reason;
  return true;
}

/**
 * Whether two decision comparisons say the same thing.
 *
 * `undecidedLanes` is compared IN ORDER, because the order is part of what the
 * field says: it is stated as lane order, so a reversed pair is a different
 * claim about which lane came first rather than the same set spelled twice.
 *
 * @param left - one reading
 *
 * @param right - the other
 *
 * @returns Whether they name the same member with the same contents
 *
 * @example
 * ```ts
 * const same = decisionsEqualV2({ left: row.decisionComparison, right: other.decisionComparison, },);
 * ```
 */
export function decisionsEqualV2(
  {
    left,
    right,
  }: {
    readonly left: ArtifactDecisionComparisonV2;
    readonly right: ArtifactDecisionComparisonV2;
  },
): boolean {
  if (left.kind !== right.kind)
    return false;
  if ((left.kind === 'comparable') && (right.kind === 'comparable'))
    return left.verdict === right.verdict;
  if ((left.kind === 'not-comparable') && (right.kind === 'not-comparable')) {
    /**
     * Lanes the left reading names, in the order it names them.
     */
    const mine = left.undecidedLanes;

    /**
     * Same from the right reading.
     */
    const theirs = right.undecidedLanes;
    if (mine.length !== theirs.length)
      return false;
    return mine.every(function sameLane(
      lane,
      position,
    ): boolean {
      return lane === theirs[position];
    },);
  }
  return true;
}

/**
 * Whether two comparison rows say the same thing.
 *
 * @param left - one row
 *
 * @param right - the other
 *
 * @returns Whether every field version 2 owns agrees
 *
 * @example
 * ```ts
 * const same = comparisonRowsEqualV2({ left: frozen, right: recorded, },);
 * ```
 */
export function comparisonRowsEqualV2(
  {
    left,
    right,
  }: {
    readonly left: ArtifactComparisonRowV2;
    readonly right: ArtifactComparisonRowV2;
  },
): boolean {
  return (left.chunkIndex === right.chunkIndex)
    && (left.incumbentKind === right.incumbentKind)
    && (left.incumbentText === right.incumbentText)
    && (left.repairText === right.repairText)
    && (left.translateText === right.translateText)
    && (left.verdict === right.verdict)
    && outcomesEqualV2({
      left: left.repairOutcome,
      right: right.repairOutcome,
    },)
    && outcomesEqualV2({
      left: left.translateOutcome,
      right: right.translateOutcome,
    },)
    && decisionsEqualV2({
      left: left.decisionComparison,
      right: right.decisionComparison,
    },)
    && deliveriesEqualV2({
      left: left.repairDelivery,
      right: right.repairDelivery,
    },)
    && deliveriesEqualV2({
      left: left.translateDelivery,
      right: right.translateDelivery,
    },);
}

//endregion Artifact version 2 row equality
