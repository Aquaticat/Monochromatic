import { ArtifactParseError, } from '../artifact-guard.ts';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { assertDeliveryCoherent, } from '../delivery-coherence.ts';
import { assertWordingCoherent, } from '../wording-coherence.ts';
import type { ArtifactEvidenceRowV2, } from './artifact-v2-read-contract.ts';
import { outcomesEqualV2, } from './artifact-v2-row-equality.ts';
import type { ArtifactDeliveryRowV2, } from './artifact-v2-vocabulary.ts';

//region Artifact version 2 row relations
// What has to hold between a lane's LEDGER and the raw result recorded beside
// it, row by row.
//
// The two are separate derivations of one run. The ledger is what a reader
// compares, because the writer checked it against that lane's own document;
// the raw result is the evidence behind it. Nothing in the file forces them to
// describe the same run, so a reader that took either on trust could report a
// slice the other contradicts.
//
// BY POSITION, never joined on `chunkIndex`. Both lists are in document order
// by contract, so position is the join, and joining on the index instead would
// accept a result whose rows are in some other order while reporting that
// everything matched.
//
// THE COHERENCE CHECKS ARE HERE TOO, and they are a different question from
// parsing: exact parsing says every word in a row is one this version knows,
// and these say the words in one row can be true together. A row saying its
// document carries a shipped replacement while its lane reports having had
// nothing to do there parses cleanly and cannot have happened.

/**
 * Refuses a lane whose raw evidence and ledger describe different runs.
 *
 * @param evidence - what the lane's raw result says per slice
 *
 * @param ledger - what the lane's delivery ledger says per slice
 *
 * @param path - dotted path of the lane, for error messages
 *
 * @throws {@link ArtifactParseError} when the two lists differ in length, or
 * disagree at any position about which slice it is, what the archive holds, or
 * what the lane decided
 *
 * @example
 * ```ts
 * assertEvidenceMatchesLedger({ evidence, ledger, path: 'lanes.repair', },);
 * ```
 */
export function assertEvidenceMatchesLedger(
  {
    evidence,
    ledger,
    path,
  }: {
    readonly evidence: readonly ArtifactEvidenceRowV2[];
    readonly ledger: readonly ArtifactDeliveryRowV2[];
    readonly path: string;
  },
): void {
  if (evidence.length !== ledger.length) {
    throw new ArtifactParseError({
      path,
      reason: `one row per slice in both, and this lane records ${
        String(evidence.length,)
      } raw slices against ${String(ledger.length,)} ledger rows`,
    },);
  }
  for (const [
    position,
    mine,
  ] of evidence.entries()) {
    /**
     * Ledger row at the same POSITION, which is where a ledger built from this
     * result holds the same slice.
     */
    const theirs = ledger[position];
    if (theirs === undefined) {
      throw new ArtifactParseError({
        path: `${path}.delivery[${String(position,)}]`,
        reason: 'a row wherever the raw result has one',
      },);
    }
    if (mine.chunkIndex !== theirs.chunkIndex) {
      throw new ArtifactParseError({
        path: `${path}.delivery[${String(position,)}].chunkIndex`,
        reason: `slice ${String(mine.chunkIndex,)}, which the raw result names at this position, `
          + `rather than slice ${String(theirs.chunkIndex,)}`,
      },);
    }
    if (mine.incumbentKind !== theirs.incumbentKind) {
      throw new ArtifactParseError({
        path: `${path}.delivery[${String(position,)}].incumbentKind`,
        reason: `${mine.incumbentKind}, as the raw result says of slice ${
          String(mine.chunkIndex,)
        }, rather than ${theirs.incumbentKind}`,
      },);
    }
    if (mine.incumbentText !== theirs.incumbentText) {
      throw new ArtifactParseError({
        path: `${path}.delivery[${String(position,)}].incumbentText`,
        reason: `the archive wording the raw result records for slice ${String(mine.chunkIndex,)}`,
      },);
    }
    if (!outcomesEqualV2({
      left: mine.outcome,
      right: theirs.outcome,
    },)) {
      throw new ArtifactParseError({
        path: `${path}.delivery[${String(position,)}].outcome`,
        reason: `the outcome the raw result records for slice ${String(mine.chunkIndex,)}, which is ${
          mine.outcome
            .kind
        } rather than ${
          theirs.outcome
            .kind
        }`,
      },);
    }
  }
}

/**
 * Refuses a ledger that names one slice twice.
 *
 * NOT COVERED BY ANY OTHER CHECK HERE, which is why it is its own: the evidence
 * is compared to the ledger by position and agrees when both repeat the same
 * index, the two lanes are compared to each other by position and agree for the
 * same reason, and the row count still matches the preparation. A ledger of two
 * rows both naming slice 5 passes every one of those and describes a document
 * with one slice reported twice and another missing.
 *
 * DISTINCT, not ordered or contiguous. The writer stamps indices from the
 * preparation and renumbers them by design, so a reader assuming `0` to
 * `length - 1` would refuse a valid future artifact; what the writer does
 * guarantee is that no two slices share an index.
 *
 * @param ledger - rows to check
 *
 * @param path - dotted path of the lane, for error messages
 *
 * @throws {@link ArtifactParseError} when two rows name one slice, reporting
 * both counts
 *
 * @example
 * ```ts
 * assertSlicesDistinct({ ledger, path: 'lanes.repair', },);
 * ```
 */
export function assertSlicesDistinct(
  {
    ledger,
    path,
  }: {
    readonly ledger: readonly ArtifactDeliveryRowV2[];
    readonly path: string;
  },
): void {
  /**
   * Slices the ledger names, which is smaller than the row count exactly when
   * one is named twice.
   */
  const named = new Set(ledger.map(function toIndex(row,): number {
    return row.chunkIndex;
  },),);
  if (named.size !== ledger.length) {
    throw new ArtifactParseError({
      path: `${path}.delivery`,
      reason: `one row per slice, and these ${
        String(ledger.length,)
      } rows name ${String(named.size,)} distinct slices, so one slice is reported twice and another `
        + 'not at all',
    },);
  }
}

/**
 * Refuses a ledger row whose two axes cannot both be true.
 *
 * DELEGATED to the same assertions the writing pipeline runs, rather than
 * restated here. They encode which pairs of outcome and delivery can occur
 * together, that rule belongs to the shape rather than to either side of it,
 * and a second copy would drift from the first exactly when it mattered.
 *
 * @param ledger - rows to check
 *
 * @param path - dotted path of the lane, for error messages
 *
 * @throws {@link ArtifactParseError} carrying the failing row's position and
 * whatever the coherence rule said, so a reader never meets an error type from
 * the pipeline's internals
 *
 * @example
 * ```ts
 * assertRowsCoherent({ ledger, path: 'lanes.repair', },);
 * ```
 */
export function assertRowsCoherent(
  {
    ledger,
    path,
  }: {
    readonly ledger: readonly ArtifactDeliveryRowV2[];
    readonly path: string;
  },
): void {
  for (const [
    position,
    row,
  ] of ledger.entries()) {
    try {
      // BOTH, because they cover different pairs: one relates what the lane did
      // to what the archive holds, and the other relates what the document
      // carries to both.
      assertWordingCoherent({ wording: row, },);
      assertDeliveryCoherent({ record: row, },);
    } catch (error) {
      throw new ArtifactParseError({
        path: `${path}.delivery[${String(position,)}]`,
        reason: `a row whose outcome and delivery can both be true: ${
          caughtValueText(error,)
        }`,
      },);
    }
  }
}

//endregion Artifact version 2 row relations
