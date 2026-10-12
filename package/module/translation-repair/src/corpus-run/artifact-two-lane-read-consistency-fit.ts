import { ArtifactParseError, } from '../artifact-guard.ts';
import { consistencyLabel, } from '../consistency-wire.ts';
import type { ArtifactConsistencyGroup, } from './artifact-two-lane-consistency.ts';

//region Artifact consistency fit
// WHAT A RECORDED GROUP'S PLACES SAY BESIDE THE KIND OF REPEAT AND THE SLICES
// THE COMPARISON NAMES: labels in order, slices that exist, slot offsets on a
// frame's places alone, and "not asked" meaning every place says so. What the
// ballots say is the coherence check's question
// (`artifact-two-lane-read-consistency-coherence.ts`).

/**
 Checks the places of a group the bench was not asked about.

 @param group - the group read

 @param path - where it sits, for the parse error

 @throws {@link ArtifactParseError} when a place says more than "not asked"

 @example
 ```ts
 assertNotAskedFits({ group, path, },);
 ```
 */
function assertNotAskedFits(
  {
    group,
    path,
  }: {
    readonly group: ArtifactConsistencyGroup;
    readonly path: string;
  },
): void {
  if (group.verdict
    .kind
    === 'asked')
    return;
  /**
   Outcome every place of such a group carries: all consistent when the page
   already read alike, untouched otherwise.
   */
  const outcome = ((group.verdict
    .kind
    === 'not-asked') && (group.verdict
      .reason
      === 'consistent'))
    ? 'consistent'
    : 'untouched';
  group.occurrences
    .forEach(function fits(
    occurrence,
    at,
  ): void {
    if ((occurrence.outcome !== outcome)
      || (occurrence.rendering
        .kind
        !== 'unlocated')
      || (occurrence.rendering
        .reason
        !== 'not-asked')) {
      throw new ArtifactParseError({
        path: `${path}.occurrences[${String(at,)}]`,
        reason: `a place with outcome ${outcome} and no rendering looked for, since the bench was not asked`,
      },);
    }
  },);
  if ((group.verdict
    .kind
    === 'not-asked') && (group.verdict
      .reason
      === 'too-few-placed')
    && (group.occurrences
      .length
      >= 2)) {
    throw new ArtifactParseError({
      path: `${path}.occurrences`,
      reason: 'fewer than two places, since the group was skipped for too few',
    },);
  }
}

/**
 Checks the places of a group against the kind of repeat and the slices the
 comparison names, and what each outcome claims of the verdict.

 @param group - the group read

 @param path - where it sits, for the parse error

 @param sliceIndexes - slices the artifact's comparison names

 @throws {@link ArtifactParseError} when a label, a slice, a slot, an outcome or
 the number of places does not fit

 @example
 ```ts
 assertGroupFits({ group, path, sliceIndexes, },);
 ```
 */
export function assertGroupFits(
  {
    group,
    path,
    sliceIndexes,
  }: {
    readonly group: ArtifactConsistencyGroup;
    readonly path: string;
    readonly sliceIndexes: ReadonlySet<number>;
  },
): void {
  group.occurrences
    .forEach(function fits(
    occurrence,
    at,
  ): void {
    /**
     Where the place sits, for the parse error.
     */
    const here = `${path}.occurrences[${String(at,)}]`;
    /**
     The label this position carries.
     */
    const expected = consistencyLabel({ position: at, },);
    if (occurrence.label !== expected) {
      throw new ArtifactParseError({
        path: `${here}.label`,
        reason: `the label ${expected}, since the places are labelled in order`,
      },);
    }
    if (!sliceIndexes.has(occurrence.sliceIndex,)) {
      throw new ArtifactParseError({
        path: `${here}.sliceIndex`,
        reason: 'a slice the comparison names',
      },);
    }
    /**
     Whether this group has a slot.
     */
    const framed = group.repeat
      .kind
      === 'refrain';
    // EACH OFFSET IS HELD TO THE KIND OF REPEAT ON ITS OWN: a place of a run
    // that carries one slot offset alone says something no run has.
    if ((framed !== (occurrence.slotStartOffset !== undefined))
      || (framed !== (occurrence.slotEndOffset !== undefined))) {
      throw new ArtifactParseError({
        path: here,
        reason: 'slot offsets on a place of a frame, and on no other',
      },);
    }
    if ((occurrence.rendering
      .kind
      === 'located') && (framed !== (occurrence.rendering
        .slot
        !== undefined))) {
      throw new ArtifactParseError({
        path: `${here}.rendering`,
        reason: 'a slot in the rendering of a place of a frame, and in no other',
      },);
    }
  },);
  assertNotAskedFits({
    group,
    path,
  },);
  // A GROUP OF FEWER THAN TWO PLACES IS SKIPPED FOR TOO FEW, whatever else the
  // bench would say: the pass asks a group, or finds its places already alike
  // or without English, only with two places or more. A group whose handling
  // failed is the one verdict a reader has always read with any number.
  if ((group.occurrences
    .length
    < 2)
    && (group.verdict
      .kind
      !== 'failed')
    && (!((group.verdict
      .kind
      === 'not-asked') && (group.verdict
        .reason
        === 'too-few-placed')))) {
    throw new ArtifactParseError({
      path: `${path}.occurrences`,
      reason: 'at least two places, since a group with fewer is skipped for too few',
    },);
  }
}

//endregion Artifact consistency fit
