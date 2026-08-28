import type { ArtifactContestVerdict, } from './artifact-two-lane-contest.ts';
import {
  type WouldShipSource,
  wouldShipTextPerSlice,
} from './would-ship-text.ts';

//region Final selection completeness
// An archive can stand after contest only when contest endorsed it. A declined,
// unjudged or under-attended archive is provenance, not final semantic approval.

/**
 * Failure raised when final assembly would revive archive without endorsement.
 *
 * @example
 * ```ts
 * throw new UnsettledFinalSelectionError({ entryId: 'Cat', sliceIndices: [2,], });
 * ```
 */
export class UnsettledFinalSelectionError extends Error {
  /**
   * Declares message safe to forward because it names only entry and slice indices.
   */
  readonly messageNamesOnly: true = true;

  /**
   * Entry refused.
   */
  readonly entryId: string;

  /**
   * Slices whose archive lacks final endorsement.
   */
  readonly sliceIndices: readonly number[];

  /**
   * @param entryId - entry refused
   *
   * @param sliceIndices - slices without endorsed final wording
   */
  public constructor(
    {
      entryId,
      sliceIndices,
    }: {
      readonly entryId: string;
      readonly sliceIndices: readonly number[];
    },
  ) {
    super(`entry ${entryId} would revive unendorsed archive wording at slices ${sliceIndices.join(', ',)}`,);
    this.name = 'UnsettledFinalSelectionError';
    this.entryId = entryId;
    this.sliceIndices = sliceIndices;
  }
}

/**
 * Reports whether contest explicitly endorsed archive fallback.
 *
 * @param verdict - contest result for slice
 *
 * @returns Whether archive won explicit semantic endorsement
 *
 * @example
 * ```ts
 * const endorsed = archiveWasEndorsed({ verdict: { kind: 'settled-neither', archive: 'endorsed', }, });
 * ```
 */
function archiveWasEndorsed(
  { verdict, }: { readonly verdict: ArtifactContestVerdict; },
): boolean {
  return (verdict.kind === 'settled-neither') && (verdict.archive === 'endorsed');
}

/**
 * Refuses artifact whose final selection revives archive without contest endorsement.
 *
 * @param entryId - corpus entry being settled
 *
 * @param artifact - comparison and deciding stages used by final assembly
 *
 * @throws {@link UnsettledFinalSelectionError} when archive would stand after no endorsement
 *
 * @example
 * ```ts
 * assertFinalSelectionSettled({ entryId: 'Cat', artifact, });
 * ```
 */
export function assertFinalSelectionSettled(
  {
    entryId,
    artifact,
  }: {
    readonly entryId: string;
    readonly artifact: WouldShipSource;
  },
): void {
  /**
   * Final reading by slice index.
   */
  const readings = new Map(wouldShipTextPerSlice({ artifact, },)
    .map(function nameReading(slice,) {
      return [
        slice.sliceIndex,
        slice.reading,
      ] as const;
    },),);

  /**
   * Lane-selection stage this artifact carries.
   */
  const { laneSelection, } = artifact;

  /**
   * Contest records, absent when contest has not run.
   */
  const contests = (laneSelection.kind === 'contested')
    ? laneSelection.slices
    : [];

  /**
   * Consolidation and optional polish records final reading derives from.
   */
  const { consolidation, } = artifact;

  /**
   * Slices where archive would stand despite no contest endorsement.
   */
  const unresolved = contests.flatMap(function unresolvedArchive(contest,): readonly number[] {
    /**
     * Final wording source after consolidation.
     */
    const reading = readings.get(contest.sliceIndex,);
    if (reading?.kind !== 'wording')
      return [];
    if (reading.decidedBy === 'polish') {
      /**
       * Initial consolidation result polish rewrote, when stage recorded one.
       */
      const consolidated = (consolidation.kind === 'settled')
        ? consolidation.slices
          .find(function namesSlice(slice,): boolean {
            return slice.sliceIndex === contest.sliceIndex;
          },)
        : undefined;
      if (consolidated?.terminal === 'consolidated')
        return [];
      /**
       * Contest verdict deciding whether baseline had prior endorsement.
       */
      const { verdict, } = contest;
      if (verdict.kind === 'lane-won')
        return [];
      if (archiveWasEndorsed({ verdict, },))
        return [];
      return [contest.sliceIndex,];
    }
    if (reading.decidedBy !== 'archive')
      return [];
    if (archiveWasEndorsed({ verdict: contest.verdict, },))
      return [];
    return [contest.sliceIndex,];
  },);

  if (unresolved.length === 0)
    return;
  throw new UnsettledFinalSelectionError({
    entryId,
    sliceIndices: unresolved,
  },);
}

//endregion Final selection completeness
