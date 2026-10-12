import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';

import type { ConsistencyRendering, } from '../consistency-count-types.ts';
import {
  applyConsistencyEdits,
  type ConsistencyEdit,
} from '../consistency-splice.ts';
import { consistencyLabel, } from '../consistency-wire.ts';
import type { DeclaredNamePair, } from '../linked-title-declared-name.ts';
import type {
  ArtifactConsistencyGroup,
  ArtifactConsistencyOccurrence,
  ArtifactConsistencyRendering,
  ArtifactConsistencySlice,
  ConsistencyOccurrenceOutcome,
} from './artifact-two-lane-consistency.ts';
import {
  type ConsistencyFloorVerdict,
  consistencyFloorVerdict,
} from './pass-consistency-floors.ts';
import type { ConsistencySliceFacts, } from './pass-consistency-slices.ts';
import type { SettledGroup, } from './pass-consistency-settle.ts';
import { ConsistencyInvariantError, } from '../consistency-invariant-error.ts';

//region Pass consistency apply
// WHERE THE GROUPS' REPLACEMENTS MEET EACH OTHER AND THE FLOORS. Every group
// was judged over the English as it stood when the pass began, so two groups
// can address one slice, and a replacement of one can overlap a replacement of
// another. Replacements are applied slice by slice, the earlier group winning
// wherever two overlap (the later is recorded `overlapped`), and the slice
// with its replacements made is put through every floor as one text: a slice
// the floors refuse keeps the wording it had, and every replacement made in it
// is recorded `kept-floor` (the owner's ruling of 2026-10-11). A replacement
// already left out for overlapping an earlier one stays `overlapped`, whether
// the floors then pass or refuse its slice.

/**
 What the pass came to once the replacements were applied.

 @example
 ```ts
 const applied: AppliedConsistency = { groups: [], slices: [], findings: [], };
 ```
 */
export type AppliedConsistency = {
  /**
   Every group, with its final outcomes.
   */
  readonly groups: readonly ArtifactConsistencyGroup[];

  /**
   Slices whose text changed.
   */
  readonly slices: readonly ArtifactConsistencySlice[];

  /**
   What the pass reports beside its groups.
   */
  readonly findings: readonly string[];
};

/**
 The name a replacement is reported under, in the words an operator reads the
 pass's log in: the group counted from one and the receiving place's label.

 @param group - position of the group on the page, from zero

 @param place - position of the receiving place in the group, from zero

 @returns Name unique across the page's replacements

 @example
 ```ts
 const id = editId({ group: 0, place: 1, },); // 'group 1 OCCURRENCE 2'
 ```
 */
function editId(
  {
    group,
    place,
  }: {
    readonly group: number;
    readonly place: number;
  },
): string {
  return `group ${String(group + 1,)} ${consistencyLabel({ position: place, },)}`;
}

/**
 A rendering as the artifact records it.

 @param rendering - the counter's rendering

 @returns The recorded rendering

 @example
 ```ts
 const recorded = recordedRendering({ rendering, },);
 ```
 */
function recordedRendering(
  { rendering, }: { readonly rendering: ConsistencyRendering; },
): ArtifactConsistencyRendering {
  if (rendering.kind === 'unlocated') {
    return {
      kind: 'unlocated',
      reason: rendering.reason,
    };
  }
  return {
    kind: 'located',
    quote: rendering.quote,
    ...((rendering.slot === undefined) ? {} : { slot: rendering.slot, }),
  };
}

/**
 Runs the floors on a changed slice.

 @param facts - the slice

 @param currentText - the wording the slice carries now

 @param candidateText - the slice with the replacements made

 @param declared - name pairs the front matter declares

 @param declaredNames - declared name forms

 @returns What the floors found

 @example
 ```ts
 const verdict = floorsOn({ facts, currentText, candidateText, declared, declaredNames, },);
 ```
 */
function floorsOn(
  {
    facts,
    currentText,
    candidateText,
    declared,
    declaredNames,
  }: {
    readonly facts: ConsistencySliceFacts;
    readonly currentText: string;
    readonly candidateText: string;
    readonly declared: readonly DeclaredNamePair[];
    readonly declaredNames: readonly string[];
  },
): ConsistencyFloorVerdict {
  return consistencyFloorVerdict({
    sliceIndex: facts.sliceIndex,
    sourceText: facts.sourceText,
    currentText,
    candidateText,
    lineStructured: facts.lineStructured,
    declared,
    declaredNames,
    disputedWordings: facts.disputedWordings,
  },);
}

/**
 Applies every group's replacements slice by slice and puts each changed slice
 through the floors.

 @param settled - the groups in page order, with their pending replacements

 @param slices - what the pass knows of each slice

 @param declared - name pairs the front matter declares

 @param declaredNames - declared name forms

 @param l - logger the pass writes to

 @returns The groups with final outcomes, the changed slices and the findings

 @example
 ```ts
 const applied = applyConsistency({ settled, slices, declared, declaredNames, l, },);
 ```
 */
export function applyConsistency(
  {
    settled,
    slices,
    declared,
    declaredNames,
    l,
  }: {
    readonly settled: readonly SettledGroup[];
    readonly slices: readonly ConsistencySliceFacts[];
    readonly declared: readonly DeclaredNamePair[];
    readonly declaredNames: readonly string[];
    readonly l: Logger;
  },
): AppliedConsistency {
  /**
   Logger pre-tagged with this function's name.
   */
  const al = tagged({
    tag: applyConsistency.name,
    l,
  },);
  /**
   Final outcome of every replacement, by name.
   */
  const outcomes = new Map<string, ConsistencyOccurrenceOutcome>();
  /**
   Slices changed.
   */
  const changed: ArtifactConsistencySlice[] = [];
  /**
   What the pass reports beside its groups.
   */
  const findings: string[] = [];
  for (const facts of slices) {
    /**
     This slice's replacements, earlier groups first.
     */
    const edits = settled.flatMap(function editsIn(
      group,
      groupPosition,
    ): readonly ConsistencyEdit[] {
      return group.edits
        .filter(function inThisSlice(edit,): boolean {
          return edit.sliceIndex === facts.sliceIndex;
        },)
        .map(function named(edit,): ConsistencyEdit {
          return {
            id: editId({
              group: groupPosition,
              place: edit.placePosition,
            },),
            start: edit.start,
            end: edit.end,
            text: edit.text,
          };
        },);
    },);
    if ((edits.length === 0) || (facts.current
      .kind
      !== 'present'))
      continue;
    /**
     The wording the slice carries now.
     */
    const currentText = facts.current
      .text;
    /**
     The slice with every replacement that does not overlap an earlier one made.
     */
    const made = applyConsistencyEdits({
      english: currentText,
      edits,
    },);
    for (const id of made.overlapped)
      outcomes.set(
        id,
        'overlapped',
      );
    /**
     What the floors make of the slice as it would ship.
     */
    const verdict = floorsOn({
      facts,
      currentText,
      candidateText: made.text,
      declared,
      declaredNames,
    },);
    if (verdict.kind === 'passes') {
      for (const id of made.applied)
        outcomes.set(
          id,
          'replaced',
        );
      changed.push({
        sliceIndex: facts.sliceIndex,
        text: made.text,
      },);
      continue;
    }
    for (const id of made.applied)
      outcomes.set(
        id,
        'kept-floor',
      );
    al.warn(
      `slice ${String(facts.sliceIndex,)}: the floors refused the consistency replacement, so the slice keeps its wording: ${
        verdict.findings
          .join(' | ',)
      }`,
    );
    findings.push(
      `slice ${String(facts.sliceIndex,)}: the floors refused the consistency replacement: ${
        verdict.findings
          .join(' | ',)
      }`,
    );
  }
  return {
    groups: settled.map(function finalGroup(
      group,
      groupPosition,
    ): ArtifactConsistencyGroup {
      return {
        repeat: group.repeat,
        occurrences: group.places
          .map(function finalPlace(
            place,
            position,
          ): ArtifactConsistencyOccurrence {
            /**
             Rendering of this place.
             */
            const rendering = group.renderings[position];
            /**
             Outcome of this place before the replacements met each other and the floors.
             */
            const provisional = group.outcomes[position];
            if ((rendering === undefined) || (provisional === undefined)) {
              throw new ConsistencyInvariantError({ invariant:
                `${consistencyLabel({ position, },)} of group ${String(groupPosition + 1,)} has no rendering `
                  + 'or outcome, and both are made for every place', },);
            }
            /**
             What the replacements and the floors made of this place's replacement, if it had one.
             */
            const decided = outcomes.get(editId({
              group: groupPosition,
              place: position,
            },),);
            if ((provisional === 'replaced') && (decided === undefined)) {
              throw new ConsistencyInvariantError({ invariant:
                `${consistencyLabel({ position, },)} of group ${String(groupPosition + 1,)} was to be replaced `
                  + 'and no replacement was applied, left out or refused, and every pending replacement is one of the three', },);
            }
            return {
              label: consistencyLabel({ position, },),
              sliceIndex: place.slice
                .sliceIndex,
              startOffset: place.startOffset,
              endOffset: place.endOffset,
              line: place.line,
              ...((place.slotStartOffset === undefined) ? {} : { slotStartOffset: place.slotStartOffset, }),
              ...((place.slotEndOffset === undefined) ? {} : { slotEndOffset: place.slotEndOffset, }),
              rendering: recordedRendering({ rendering, },),
              outcome: decided ?? provisional,
            };
          },),
        unplaced: group.unplaced,
        verdict: group.verdict,
      };
    },),
    slices: changed,
    findings,
  };
}

//endregion Pass consistency apply
