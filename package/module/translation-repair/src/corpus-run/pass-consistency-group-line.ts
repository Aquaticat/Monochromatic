import type {
  ArtifactConsistencyCarry,
  ArtifactConsistencyGroup,
  ArtifactConsistencyOccurrence,
  ConsistencyOccurrenceOutcome,
} from './artifact-two-lane-consistency.ts';

//region Pass consistency group line
// THE LINE THE PASS LOGS FOR EACH GROUP, with every outcome counted and the reason named where a place was left as it stood
// (n161, R2). The settled TianqiChen66624 run logged `group 1 of 2: refrain verdict=asked placed=4 unplaced=0 replaced=0
// consistent=0 kept-context=0 kept-floor=0 overlapped=0 unlocated=0`: the bench was asked and nothing changed, and the line said
// nothing of why, because `chosen`, `kept-current` and `untouched` had no column and the reasons the record holds were not printed.
// The line now counts all nine outcomes, so the columns add up to the places placed, and ends with `because=` and each distinct
// reason, in the order the places stand, whenever a place ended `kept-current` or the bench was not asked, failed or named no winner.
// Every reason is the code's own decision, read from the record and not decided again here:
//
// - `not-asked:too-few-placed`, `not-asked:no-english`: the bench was not asked (`pass-consistency-unasked.ts`). A group already
//   consistent is not asked either, and its places are counted `consistent`, so it names no reason.
// - `failed:<detail>`: trouble stopped the group before the ballots could be counted; the detail names no corpus text.
// - `no-winner:<reason>`: the bench was asked and no place won (`NoWinnerReason`: `no-quorum`, `no-majority`, `chosen-unlocated`,
//   `run-off-no-quorum`, `run-off-tied`); every place stays as it stood.
// - `carry:<reason>`: a place was to receive the chosen rendering and the carry (`pass-consistency-carry-choose.ts`) left its English
//   as it stood: `no-alternative` (no text but the current one to choose among), `no-quorum`, `no-majority` (the choice among the
//   candidates reached no decision), `failed` (trouble stopped the carry), `chose-current` (the choice kept the English as it stands),
//   `splice-cannot-reach-place` (the choice was the code splice, and this place has no words code can move the chosen words into, as
//   a frame the splice cannot carry), `chose-writer-text` (a writer's text was chosen and no replacement of this place was made),
//   `unrecorded` (the record holds no carry for the place).
// - `kept:<reason>`: the pass left the place as it stood after the splice was chosen and the record's words let code move the chosen
//   words in (`ConsistencyKeptReason`: the `gain-` and `edge-` reasons), which is named ahead of the carry's own decision.

/**
 The outcomes counted in the columns of the line, in the order they are printed: the six the line has always counted, then the three
 it did not.
 */
const COLUMNS: readonly ConsistencyOccurrenceOutcome[] = [
  'replaced',
  'consistent',
  'kept-context',
  'kept-floor',
  'overlapped',
  'unlocated',
  'chosen',
  'kept-current',
  'untouched',
];

/**
 How many places of a group ended in an outcome.

 @param group - the group with its final outcomes

 @param outcome - outcome counted

 @returns Number of places with that outcome

 @example
 ```ts
 const replaced = placesEndingIn({ group, outcome: 'replaced', },);
 ```
 */
function placesEndingIn(
  {
    group,
    outcome,
  }: {
    readonly group: ArtifactConsistencyGroup;
    readonly outcome: ConsistencyOccurrenceOutcome;
  },
): number {
  return group.occurrences
    .filter(function ended(occurrence,): boolean {
      return occurrence.outcome === outcome;
    },)
    .length;
}

/**
 The reason the verdict of a group gives for places left as they stood, none when the verdict gives none.

 @param group - the group with its final outcomes

 @returns The reason as a list of zero or one

 @example
 ```ts
 const [reason,] = verdictReasonOf({ group, },); // 'no-winner:no-quorum'
 ```
 */
function verdictReasonOf({ group, }: { readonly group: ArtifactConsistencyGroup; },): readonly string[] {
  /**
   What was asked of the bench and what it answered.
   */
  const { verdict, } = group;
  if (verdict.kind === 'failed')
    return [`failed:${verdict.detail}`,];
  if (verdict.kind === 'not-asked')
    return (verdict.reason === 'consistent') ? [] : [`not-asked:${verdict.reason}`,];
  /**
   The place every place followed, or why none.
   */
  const { winner, } = verdict;
  return (winner.kind === 'none') ? [`no-winner:${winner.reason}`,] : [];
}

/**
 The reason the carry gives for a place whose English stood: what the carry to the place decided.

 @param carries - the carries of the group, one record for each receiving place

 @param label - label of the place

 @returns The reason

 @example
 ```ts
 const reason = carryReasonOf({ carries, label: 'OCCURRENCE 2', },); // 'carry:no-majority'
 ```
 */
function carryReasonOf(
  {
    carries,
    label,
  }: {
    readonly carries: readonly ArtifactConsistencyCarry[];
    readonly label: string;
  },
): string {
  /**
   The carry to the place, none where the record holds none.
   */
  const [carry,] = carries.filter(function isForPlace(candidate,): boolean {
    return candidate.label === label;
  },);
  if (carry === undefined)
    return 'carry:unrecorded';
  /**
   What the carry decided.
   */
  const { decision, } = carry;
  if (decision.kind === 'failed')
    return 'carry:failed';
  if (decision.kind === 'none')
    return `carry:${decision.reason}`;
  /**
   The kind of text the carry chose.
   */
  const [chosen,] = carry.candidates
    .filter(function isChosen(candidate,): boolean {
      return candidate.label === decision.label;
    },);
  if (chosen?.kind === 'current')
    return 'carry:chose-current';
  return (chosen?.kind === 'splice') ? 'carry:splice-cannot-reach-place' : 'carry:chose-writer-text';
}

/**
 The reason a place that ended `kept-current` was left as it stood: the reason the pass recorded for the place, else what the carry
 to it decided.

 @param group - the group with its final outcomes

 @param occurrence - the place

 @returns The reason

 @example
 ```ts
 const reason = keptReasonOf({ group, occurrence, },); // 'kept:gain-pairs'
 ```
 */
function keptReasonOf(
  {
    group,
    occurrence,
  }: {
    readonly group: ArtifactConsistencyGroup;
    readonly occurrence: ArtifactConsistencyOccurrence;
  },
): string {
  if (occurrence.keptBecause !== undefined)
    return `kept:${occurrence.keptBecause}`;
  return carryReasonOf({
    carries: group.carries ?? [],
    label: occurrence.label,
  },);
}

/**
 The distinct reasons a group's places were left as they stood, in the order the places stand, the verdict's first.

 @param group - the group with its final outcomes

 @returns The reasons

 @example
 ```ts
 const reasons = reasonsOf({ group, },); // ['carry:no-majority']
 ```
 */
function reasonsOf({ group, }: { readonly group: ArtifactConsistencyGroup; },): readonly string[] {
  return [
    ...new Set([
      ...verdictReasonOf({ group, },),
      ...group.occurrences
        .filter(function stood(occurrence,): boolean {
          return occurrence.outcome === 'kept-current';
        },)
        .map(function reasonOf(occurrence,): string {
          return keptReasonOf({
            group,
            occurrence,
          },);
        },),
    ],),
  ];
}

/**
 One line saying how a group came out: its repeat, the verdict, the places placed and not placed, the count of each outcome, and,
 where a place was left as it stood or the bench was not asked, failed or named no winner, the reasons.

 @param group - the group with its final outcomes

 @returns Log line text

 @example
 ```ts
 const line = groupLine({ group, },);
 ```
 */
export function groupLine({ group, }: { readonly group: ArtifactConsistencyGroup; },): string {
  /**
   The parts of the group the line names.
   */
  const {
    repeat,
    verdict,
    occurrences,
    unplaced,
  } = group;
  /**
   The reasons, none for a group whose places a column counts.
   */
  const reasons = reasonsOf({ group, },);
  return [
    repeat.kind,
    `verdict=${verdict.kind}`,
    `placed=${String(occurrences.length,)}`,
    `unplaced=${String(unplaced.length,)}`,
    ...COLUMNS.map(function column(outcome,): string {
      return `${outcome}=${String(placesEndingIn({
        group,
        outcome,
      },),)}`;
    },),
    ...((reasons.length === 0) ? [] : [`because=${reasons.join(',',)}`,]),
  ].join(' ',);
}

//endregion Pass consistency group line
