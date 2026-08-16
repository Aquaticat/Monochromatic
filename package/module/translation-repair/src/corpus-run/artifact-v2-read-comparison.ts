import { ArtifactParseError, } from '../artifact-guard.ts';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { compareLanesV2, } from './artifact-v2-comparison.ts';
import { comparisonRowsEqualV2, } from './artifact-v2-row-equality.ts';
import type {
  ArtifactComparisonRowV2,
  ArtifactDeliveryRowV2,
} from './artifact-v2-vocabulary.ts';

//region Artifact version 2 recorded comparison
// Checking the comparison a version 2 artifact CARRIES against the one its own
// ledgers produce.
//
// The stored comparison is a claim about two ledgers stored beside it, so
// nothing has to trust it: a reader derives its own and refuses a disagreement.
// What makes that worth doing is the derivation being FROZEN. Recomputing with
// the live comparator would agree with itself under any later change to how a
// verdict is decided, while both disagreed with what the artifact meant when it
// was written; `compareLanesV2` is version 2's own rules over version 2's own
// rows, so a reader running it asks what this file meant rather than what the
// pipeline currently thinks.
//
// AND THE DERIVED COPY IS WHAT COMES BACK, not the recorded one. They are equal
// by the time this returns, so which one a caller gets cannot change an answer;
// returning the derived rows means a caller holds the reading this reader can
// account for.

/**
 * Derives the comparison from two ledgers, reporting a refusal as a parse
 * failure.
 *
 * Separate from the caller so the translation happens once and around the one
 * call that can raise the comparison's own error type.
 *
 * @param repair - repair lane's ledger
 *
 * @param translate - translate lane's ledger
 *
 * @param path - dotted path of the recorded comparison
 *
 * @returns Comparison version 2's rules derive
 *
 * @throws {@link ArtifactParseError} when the two ledgers cannot be compared at
 * all, carrying what the comparison said
 *
 * @example
 * ```ts
 * const derived = deriveComparison({ repair, translate, path, },);
 * ```
 */
function deriveComparison(
  {
    repair,
    translate,
    path,
  }: {
    readonly repair: readonly ArtifactDeliveryRowV2[];
    readonly translate: readonly ArtifactDeliveryRowV2[];
    readonly path: string;
  },
): readonly ArtifactComparisonRowV2[] {
  try {
    return compareLanesV2({
      repair,
      translate,
    },);
  } catch (error) {
    // TRANSLATED RATHER THAN RETHROWN, so a reader meets one error type from
    // this layer instead of an error named for the comparison's internals.
    throw new ArtifactParseError({
      path,
      reason: `two ledgers this version can compare: ${caughtValueText(error,)}`,
    },);
  }
}

/**
 * Refuses an artifact whose recorded comparison disagrees with its ledgers.
 *
 * @param recorded - comparison the artifact carries
 *
 * @param repair - repair lane's ledger
 *
 * @param translate - translate lane's ledger
 *
 * @param path - dotted path of the recorded comparison
 *
 * @returns Comparison derived from the two ledgers, proven equal to the
 * recorded one
 *
 * @throws {@link ArtifactParseError} when the two ledgers cannot be compared at
 * all, when the counts differ, or when any row disagrees
 *
 * @example
 * ```ts
 * const comparison = assertRecordedComparisonMatches({ recorded, repair, translate, path, },);
 * ```
 */
export function assertRecordedComparisonMatches(
  {
    recorded,
    repair,
    translate,
    path,
  }: {
    readonly recorded: readonly ArtifactComparisonRowV2[];
    readonly repair: readonly ArtifactDeliveryRowV2[];
    readonly translate: readonly ArtifactDeliveryRowV2[];
    readonly path: string;
  },
): readonly ArtifactComparisonRowV2[] {
  /**
   * What version 2's own rules say about these two ledgers.
   */
  const derived = deriveComparison({
    repair,
    translate,
    path,
  },);
  if (recorded.length !== derived.length) {
    throw new ArtifactParseError({
      path,
      reason: `${
        String(derived.length,)
      } rows, which is how many slices the two ledgers cover, rather than ${String(recorded.length,)}`,
    },);
  }
  for (const [
    position,
    row,
  ] of derived.entries()) {
    /**
     * Row the artifact recorded at the same position.
     */
    const theirs = recorded[position];
    if (theirs === undefined) {
      throw new ArtifactParseError({
        path: `${path}[${String(position,)}]`,
        reason: 'a row wherever the ledgers produce one',
      },);
    }

    // FIELD BY FIELD rather than by serialized bytes, since these rows came off
    // disk in whatever key order the file wrote them and key order is not part
    // of what a row says.
    if (!comparisonRowsEqualV2({
      left: row,
      right: theirs,
    },)) {
      throw new ArtifactParseError({
        path: `${path}[${String(position,)}]`,
        reason: `what this version's rules derive for slice ${
          String(row.chunkIndex,)
        } from the ledgers stored beside it, which is ${JSON.stringify(row,)}`,
      },);
    }
  }
  return derived;
}

//endregion Artifact version 2 recorded comparison
