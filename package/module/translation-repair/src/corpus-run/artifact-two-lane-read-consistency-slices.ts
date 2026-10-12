import { ArtifactParseError, } from '../artifact-guard.ts';
import type {
  ArtifactConsistencyGroup,
  ArtifactConsistencyOccurrence,
  ArtifactConsistencySlice,
} from './artifact-two-lane-consistency.ts';

//region Artifact consistency slices
// WHAT THE CHANGED SLICES SAY BESIDE THE PLACES THAT WERE REPLACED: one row per
// slice, a row for every slice that holds a replaced place and for no other, and
// one fate for the places of a slice, since the floors answer for a slice once.
// What each group says of itself is the coherence check's question
// (`artifact-two-lane-read-consistency-coherence.ts`).

/**
 Checks that the places of each slice share one fate, since the floors answer
 for a slice once: no slice holds both a replaced place and a place whose
 replacement the floors refused, and a place left out for overlapping another
 replacement has that replacement in its slice.

 @param groups - every recorded group

 @param path - where the slices sit, for the parse error

 @throws {@link ArtifactParseError} when a slice holds both fates, or an overlap
 has no replacement beside it

 @example
 ```ts
 assertSliceFates({ groups, path, },);
 ```
 */
function assertSliceFates(
  {
    groups,
    path,
  }: {
    readonly groups: readonly ArtifactConsistencyGroup[];
    readonly path: string;
  },
): void {
  /**
   Every place of every group.
   */
  const places = groups.flatMap(function placesOf(group,): readonly ArtifactConsistencyOccurrence[] {
    return group.occurrences;
  },);
  /**
   Whether a slice holds a place that ended in an outcome.

   @param sliceIndex - slice asked about

   @param outcome - outcome looked for

   @returns Whether some place of the slice ended in it
   */
  function holds({
    sliceIndex,
    outcome,
  }: {
    readonly sliceIndex: number;
    readonly outcome: string
  },): boolean {
    return places.some(function endedIn(place,): boolean {
      return (place.sliceIndex === sliceIndex) && (place.outcome === outcome);
    },);
  }
  for (const place of places) {
    if ((place.outcome === 'replaced') && holds({
      sliceIndex: place.sliceIndex,
      outcome: 'kept-floor',
    },)) {
      throw new ArtifactParseError({
        path,
        reason: `one fate for slice ${String(place.sliceIndex,)}, which holds a replaced place and a place the floors refused`,
      },);
    }
    if ((place.outcome === 'overlapped') && (!holds({
      sliceIndex: place.sliceIndex,
      outcome: 'replaced',
    },))
      && (!holds({
        sliceIndex: place.sliceIndex,
        outcome: 'kept-floor',
      },))) {
      throw new ArtifactParseError({
        path,
        reason: `a replacement in slice ${String(place.sliceIndex,)} for the overlapped place to overlap`,
      },);
    }
  }
}

/**
 Checks the changed slices against the places that were replaced.

 @param groups - every recorded group

 @param slices - the recorded changed slices

 @param path - where the slices sit, for the parse error

 @throws {@link ArtifactParseError} when a slice is listed twice, a slice has no
 replaced place, or a replaced place has no slice

 @example
 ```ts
 assertSlicesCoherent({ groups, slices, path, },);
 ```
 */
export function assertSlicesCoherent(
  {
    groups,
    slices,
    path,
  }: {
    readonly groups: readonly ArtifactConsistencyGroup[];
    readonly slices: readonly ArtifactConsistencySlice[];
    readonly path: string;
  },
): void {
  /**
   Slices a replaced place sits in.
   */
  const replaced = new Set(groups.flatMap(function replacedIn(group,): readonly number[] {
    return group.occurrences
      .filter(function wasReplaced(occurrence,): boolean {
        return occurrence.outcome === 'replaced';
      },)
      .map(function sliceOf(occurrence,): number {
        return occurrence.sliceIndex;
      },);
  },),);
  /**
   Slices already named.
   */
  const named = new Set<number>();
  for (const row of slices) {
    if (named.has(row.sliceIndex,)) {
      throw new ArtifactParseError({
        path,
        reason: `one row per slice; slice ${String(row.sliceIndex,)} appears more than once`,
      },);
    }
    named.add(row.sliceIndex,);
    if (!replaced.has(row.sliceIndex,)) {
      throw new ArtifactParseError({
        path,
        reason: `a replaced place in slice ${String(row.sliceIndex,)}, which a changed slice needs`,
      },);
    }
  }
  for (const sliceIndex of replaced) {
    if (!named.has(sliceIndex,)) {
      throw new ArtifactParseError({
        path,
        reason: `a changed slice row for slice ${String(sliceIndex,)}, which holds a replaced place`,
      },);
    }
  }
  assertSliceFates({
    groups,
    path,
  },);
}

//endregion Artifact consistency slices
