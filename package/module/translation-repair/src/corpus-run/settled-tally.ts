import type { SettledArtifactV2, } from './artifact-v2-contract.ts';
import type { ArtifactDeliveryRowV2, } from './artifact-v2-vocabulary.ts';
import { wouldShipTextFor, } from './would-ship-text.ts';

//region Settled tally
// The one line a settled entry prints, once BOTH lanes have run.
//
// The version 1 line reported one lane's status as THE status, because there
// was one lane: `status=repaired issues=4 accepted=3`. Keeping that shape and
// appending translate counts beside it would say, in every log a later reader
// greps, that the repair lane is the run's outcome and the other lane is
// commentary. That is the question this generation exists to leave open.
//
// So the top-level `status` is the PASS's own state, settled or ERROR, which is
// what an operator scanning a run actually wants from it, and every lane
// measurement carries its lane in the key. `selection=` says out loud that
// nobody has picked a winner, matching what the artifact records, so a reader
// who greps the logs and a reader who reads the artifacts learn the same thing.
//
// EVERYTHING IS READ OFF THE ARTIFACT, not recomputed beside it. A log line
// that disagrees with the file it describes is worse than no log line, and the
// only way to be sure is to have one source.

/**
 * Counts slices whose delivery carries a change.
 *
 * @param rows - one lane's delivery ledger, as version 2 records it
 *
 * @returns How many slices that lane's document carries a replacement for
 *
 * @example
 * ```ts
 * const changed = changedSlices({ rows: artifact.lanes.repair.delivery, },);
 * ```
 */
function changedSlices(
  { rows, }: { readonly rows: readonly ArtifactDeliveryRowV2[]; },
): number {
  /**
   * Rows whose document carries a replacement.
   */
  const changed = rows.filter(function carriesAChange(row,): boolean {
    return row.delivery
      .kind
      === 'replacement-shipped';
  },);
  return changed.length;
}

/**
 * Renders the TALLY line for one settled entry.
 *
 * @param artifact - what was written for this entry, which supplies every
 * number here rather than being recounted beside it
 *
 * @returns Single line, no trailing newline
 *
 * @example
 * ```ts
 * console.log(settledTallyLine({ artifact, },),);
 * ```
 */
export function settledTallyLine(
  { artifact, }: { readonly artifact: SettledArtifactV2; },
): string {
  /**
   * Both lanes as the artifact nests them.
   */
  const {
    repair,
    translate,
  } = artifact.lanes;

  /**
   * Issues the adjudication accepted, which is a repair-lane measurement and
   * is named as one: the translate lane files no issues at all.
   */
  const accepted = repair.result
    .issues
    .filter(function isAccepted(record,): boolean {
      return record.issue
        .status
        === 'accepted';
    },);

  /**
   * Accepted issues the checkers confirmed fixed.
   */
  const resolved = accepted.filter(function isResolved(record,): boolean {
    return record.resolved;
  },);

  /**
   * Slices where the two documents ended up carrying different words, which is
   * the number worth watching: it is how much of this entry the open question
   * actually covers.
   */
  const differing = artifact.comparison
    .filter(function documentsDiffer(row,): boolean {
      return row.repairText !== row.translateText;
    },);

  /**
   * Slices where a document assembled today would carry wording the archive
   * did not.
   *
   * ADDED BESIDE the two lane counts rather than replacing either, per this
   * task's decision 1. `repairChanged` and `translateChanged` say what each
   * lane PROPOSED, which stays true however the deciders later ruled; this
   * says how much of the entry a reader would actually meet as new. Without
   * it a reader gauging how much an entry changed misses the consolidation
   * entirely, and on an entry nobody has decided reads two sets of proposals
   * as the outcome.
   *
   * ZERO IS THE HONEST ANSWER on an undecided entry, and it is meant to be
   * read beside `selection=pending-human-decision` on the same line: two
   * lanes proposed changes and, as things stand, a document would carry none
   * of them. That is `#175`, stated in the log rather than left to inference.
   */
  const pageChanged = artifact.comparison
    .filter(function pageCarriesAChange(row,): boolean {
      /**
       * What would stand at this slice.
       */
      const reading = wouldShipTextFor({
        artifact,
        row,
      },);

      if (reading.kind === 'nothing-ships')
        return false;
      return reading.text !== row.incumbentText;
    },);

  /**
   * Slices where nothing at all would stand, which is neither a change nor a
   * retention and would be invisible inside either count.
   */
  const pageSilent = artifact.comparison
    .filter(function pageCarriesNothing(row,): boolean {
      /**
       * What would stand at this slice.
       */
      const reading = wouldShipTextFor({
        artifact,
        row,
      },);

      return reading.kind === 'nothing-ships';
    },);

  return [
    `TALLY ${artifact.id}`,
    'status=SETTLED',
    `slices=${String(artifact.preparation
      .sliceCount,)}`,
    `repairStatus=${repair.result
      .status}`,
    `repairIssues=${String(repair.result
      .issues
      .length,)}`,
    `repairAccepted=${String(accepted.length,)}`,
    `repairResolved=${String(resolved.length,)}`,
    `repairFindings=${String(repair.result
      .findings
      .length,)}`,
    `repairChanged=${String(changedSlices({ rows: repair.delivery, },),)}`,
    `translateStatus=${translate.result
      .status}`,
    `translateChanged=${String(changedSlices({ rows: translate.delivery, },),)}`,
    `documentsDiffer=${String(differing.length,)}`,
    `pageChanged=${String(pageChanged.length,)}`,
    `pageSilent=${String(pageSilent.length,)}`,
    `alignmentFindings=${String(artifact.preparation
      .alignmentFindings
      .length,)}`,
    `selection=${artifact.laneSelection
      .kind}`,
    `ms=${String(artifact.durationMs,)}`,
  ].join(' ',);
}

//endregion Settled tally
