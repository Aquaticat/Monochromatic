import type {
  ArtifactComparisonRow,
  ArtifactDecisionComparison,
  ArtifactSliceDelivery,
  ArtifactSliceOutcome,
} from './artifact-two-lane-vocabulary.ts';

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
 * const same = outcomesEqual({ left: row.repairOutcome, right: other.repairOutcome, },);
 * ```
 */
export function outcomesEqual(
  {
    left,
    right,
  }: {
    readonly left: ArtifactSliceOutcome;
    readonly right: ArtifactSliceOutcome;
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
 * const same = deliveriesEqual({ left: row.repairDelivery, right: other.repairDelivery, },);
 * ```
 */
export function deliveriesEqual(
  {
    left,
    right,
  }: {
    readonly left: ArtifactSliceDelivery;
    readonly right: ArtifactSliceDelivery;
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
 * const same = decisionsEqual({ left: row.decisionComparison, right: other.decisionComparison, },);
 * ```
 */
export function decisionsEqual(
  {
    left,
    right,
  }: {
    readonly left: ArtifactDecisionComparison;
    readonly right: ArtifactDecisionComparison;
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
 * Names of the comparison-row fields that differ between two rows, in the
 * order the row is written, empty when the rows agree.
 *
 * NAMES, NEVER VALUES: the rows carry the archive text and both lanes' output,
 * and the callers put this into refusal messages that reach stdout (`#237`).
 *
 * @param left - one row
 *
 * @param right - the other row
 *
 * @returns Field names that differ
 *
 * @example
 * ```ts
 * const differing = comparisonRowDifferences({ left: stored, right: derived, },);
 * ```
 */
export function comparisonRowDifferences(
  {
    left,
    right,
  }: {
    readonly left: ArtifactComparisonRow;
    readonly right: ArtifactComparisonRow;
  },
): readonly string[] {
  /**
   * Each field with whether the two rows agree on it.
   */
  const checks: readonly (readonly [string, boolean])[] = [
    ['sliceIndex', left.sliceIndex === right.sliceIndex,],
    ['incumbentKind', left.incumbentKind === right.incumbentKind,],
    ['incumbentText', left.incumbentText === right.incumbentText,],
    ['repairText', left.repairText === right.repairText,],
    ['translateText', left.translateText === right.translateText,],
    ['laneRelation', left.laneRelation === right.laneRelation,],
    ['repairOutcome', outcomesEqual({
      left: left.repairOutcome,
      right: right.repairOutcome,
    },),],
    ['translateOutcome', outcomesEqual({
      left: left.translateOutcome,
      right: right.translateOutcome,
    },),],
    ['decisionComparison', decisionsEqual({
      left: left.decisionComparison,
      right: right.decisionComparison,
    },),],
    ['repairDelivery', deliveriesEqual({
      left: left.repairDelivery,
      right: right.repairDelivery,
    },),],
    ['translateDelivery', deliveriesEqual({
      left: left.translateDelivery,
      right: right.translateDelivery,
    },),],
  ];
  return checks
    .filter(function differs([, same,],): boolean {
      return !same;
    },)
    .map(function toName([name,],): string {
      return name;
    },);
}

/**
 * Whether two comparison rows agree on every field.
 *
 * @param left - one row
 *
 * @param right - the other row
 *
 * @returns Whether no field differs
 *
 * @example
 * ```ts
 * const same = comparisonRowsEqual({ left: stored, right: derived, },);
 * ```
 */
export function comparisonRowsEqual(
  {
    left,
    right,
  }: {
    readonly left: ArtifactComparisonRow;
    readonly right: ArtifactComparisonRow;
  },
): boolean {
  return comparisonRowDifferences({
    left,
    right,
  },).length === 0;
}

//endregion Artifact version 2 row equality
