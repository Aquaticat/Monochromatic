import { ArtifactParseError, } from '@monochromatic-dev/translation-repair-artifact-pool/ts';
import type { ConsistencyRendering, } from '@monochromatic-dev/translation-repair-consistency/ts';
import {
  agreedWordsOf,
  consistencyLabels,
  containedQuoteWordsOf,
  foldedWordsOf,
  isKeptByMajority,
  planConsistencyEdit,
  slotInSpan,
  usableVoicesOf,
} from '@monochromatic-dev/translation-repair-consistency/ts';
import { rendersAsNothing, } from '@monochromatic-dev/translation-repair-typography/ts';
import {
  artifactGenerationCarriesPartialUnits,
  artifactGenerationRecordsMarks,
  type TwoLaneArtifactGeneration,
} from './artifact-two-lane-contract.ts';
import type {
  ArtifactConsistencyGroup,
  ArtifactConsistencyOccurrence,
} from './artifact-two-lane-consistency.ts';
import { assertCarriesRecount, } from './artifact-two-lane-read-consistency-carry-recount.ts';
import {
  assertCarriedOutcomes,
  type CarriedPlace,
} from './artifact-two-lane-read-consistency-span-shared.ts';
import {
  asLocatedBySpan,
  edgeMarksContradictedBySpan,
  locatedContradictedBySpan,
  reasonContradictedBySpan,
} from './artifact-two-lane-read-consistency-span-located.ts';
import {
  expectedWinnerOf,
  sameWinner,
} from './artifact-two-lane-read-consistency-span-winner.ts';
import {
  assertSeatsHeardOnce,
  winningPositionOf,
} from './artifact-two-lane-read-consistency-tally.ts';

//region Artifact consistency span coherence
// WHAT A RECORDED GROUP OF THE SIXTEENTH SHAPE SAYS ABOUT ITSELF, recounted. The
// ballots are in the file, so the usable count, the words a strict majority
// quoted for each place, the slot inside them, the places a majority kept, the
// tie for first and the run-off that settled it, the winner, each receiving
// place's carry and what became of each place are all recomputed here, and a
// file that disagrees with its own ballots is refused. What the recount cannot
// reach is the English of a slice, which the file does not hold for slices the
// pass left alone, so "the words stand exactly once there" is the pass's check
// alone, and the text of the current English candidate of a carry is taken as
// recorded. A splice is recounted with the marks beside and inside the words
// compared from generation seventeen, which recorded them
// (`consistency-splice.ts`), and by the words alone before, as those sections
// were written.
//
// A UNIT CARRIED IN PART IS READ FROM THE RECORD ALONE, from generation seventeen.
// The places of one block share one bench record, so the carries recorded under
// them are the same candidates, ballots and decision, and a splice among the
// candidates was built from the places of the block code could move the chosen words
// into. A place whose recomputed plan is `unavailable` then ends `kept-current` when
// the splice was chosen, a place whose plan is `replace` ends in one of the
// outcomes a replacement can end in, and a splice candidate under a place whose
// plan is `unavailable` is accepted only when another place of the group, recorded
// under the same record, has a `replace` plan (`artifact-two-lane-read-consistency-span-shared.ts`).
// Sixteen and fifteen keep the rule they were written under: such a place withholds
// the splice, so no carry of theirs holds a splice candidate under it.
//
// A SPLICE THAT BRINGS AN APOSTROPHE TO AN EDGE IS ALLOWED TO HAVE BEEN LEFT OUT.
// Whether a proven apostrophe carried to an edge where the receiving words held none
// is still an apostrophe on the page the pass makes depends on the quotation characters
// of the English and on the other replacements, which the record does not hold. So a
// place whose plan is `replace` and whose words would gain such an apostrophe
// (`bringsEdgeApostrophe`) may end `kept-current` after the splice was chosen, as well
// as in the outcomes a replacement ends in. The reader checks that the outcome is one
// the carry allows; it cannot check that the apostrophe was in fact not proven there.

/**
 A group the bench was asked about.
 */
type AskedGroup = ArtifactConsistencyGroup & { readonly verdict: { readonly kind: 'asked'; }; };

/**
 Checks one place's rendering against the words its ballots agreed on.

 @param group - the group, asked of the bench

 @param occurrence - the place

 @param path - where the place sits, for the parse error

 @param generation - generation the section was written under, which says whether the edges of a located place's words may hold a proven apostrophe and are checked for one

 @returns The place's rendering in the counter's form

 @throws {@link ArtifactParseError} when a located rendering is not the agreed
 words or slot, holds at an edge a single mark the pass could not have put
 there, or an unlocated one gives a reason the ballots contradict

 @example
 ```ts
 const rendering = assertSpanRenderingAgrees({ group, occurrence, path, generation: 17, },);
 ```
 */
function assertSpanRenderingAgrees(
  {
    group,
    occurrence,
    path,
    generation,
  }: {
    readonly group: AskedGroup;
    readonly occurrence: ArtifactConsistencyOccurrence;
    readonly path: string;
    readonly generation: TwoLaneArtifactGeneration;
  },
): ConsistencyRendering {
  /**
   The usable ballots of the group.
   */
  const voices = usableVoicesOf({
    voices: group.verdict
      .ballots,
    labels: consistencyLabels({ count: group.occurrences
      .length, },),
  },);
  /**
   The spans a strict majority of the quotes naming this place contain, in the fold, longest first. THE RECOUNT CANNOT SAY WHICH OF
   THEM STANDS EXACTLY ONCE in the English (the file does not hold the English of a slice the pass left alone), so a located
   rendering is held to be one of them and an unlocated one is held to a reason one of them allows.
   */
  const candidates = containedQuoteWordsOf({
    voices,
    label: occurrence.label,
  },);
  /**
   The candidates that show a reader something, which the pass searches the English for.
   */
  const readable = candidates.filter(function showsSomething(words,): boolean {
    return !rendersAsNothing({ text: words, },);
  },);
  /**
   What the ballots allow the recorded rendering to say.
   */
  const { rendering, } = occurrence;
  if (rendering.kind === 'unlocated') {
    // A FILE OF THE SEVENTEENTH GENERATION WRITTEN BEFORE THE SPANS WERE LOCATED BY CONTAINMENT (the run of TianqiChen66625 and
    // those before it) recorded `no-agreement` where a strict majority of the usable ballots had quoted no one text, so the
    // recorded reason is refused only when NEITHER reading allows it: the words a strict majority of the ballots quoted, as the
    // pass located them before, and the spans a strict majority of the quotes contain, as it does now. The earlier agreed
    // words are always among the candidates, so the two readings differ only for a place the earlier one left unlocated.
    if (reasonContradictedBySpan({
      reason: rendering.reason,
      // No agreement is contradicted by any candidate; the other reasons are read against the first candidate that shows
      // something, or against the first candidate when none does.
      words: ((rendering.reason === 'no-agreement') || (readable.length === 0)) ? candidates : readable.slice(
        0,
        1,
      ),
    },) && reasonContradictedBySpan({
      reason: rendering.reason,
      words: agreedWordsOf({
        voices,
        label: occurrence.label,
      },),
    },)) {
      throw new ArtifactParseError({
        path: `${path}.rendering.reason`,
        reason: 'a reason the usable ballots do not contradict',
      },);
    }
    return rendering;
  }
  /**
   The folded words of the recorded rendering, which are one of the spans the ballots allow.
   */
  const agreed = foldedWordsOf({ text: rendering.quote, },);
  if (!readable.includes(agreed,)) {
    throw new ArtifactParseError({
      path: `${path}.rendering`,
      reason: 'words that a strict majority of the quotes naming the place contain, as the place\'s English holds them',
    },);
  }
  if (locatedContradictedBySpan({ rendering, },)) {
    throw new ArtifactParseError({
      path: `${path}.rendering`,
      reason: 'words that show a reader something and hold their markup in pairs, and a slot that does the same and is not all of them',
    },);
  }
  if (artifactGenerationRecordsMarks({ generation, },) && edgeMarksContradictedBySpan({ rendering, },)) {
    throw new ArtifactParseError({
      path: `${path}.rendering`,
      reason: 'words that hold at most one apostrophe at an edge, directly beside a letter or a digit and never the opening '
        + 'curly single mark, since the pass puts only a proven apostrophe there',
    },);
  }
  /**
   The slot the ballots pin down inside the recorded words, none for a run or when they pin none.
   */
  const [expected,] = (group.repeat
    .kind
    === 'refrain')
    ? slotInSpan({
      voices,
      label: occurrence.label,
      words: agreed,
      span: rendering.quote,
    },)
    : [];
  if (rendering.slot !== expected?.slot) {
    throw new ArtifactParseError({
      path: `${path}.rendering`,
      reason: 'the slot a strict majority of the usable ballots gave inside those words, and none where they gave none',
    },);
  }
  return asLocatedBySpan({
    rendering,
    path: `${path}.rendering`,
  },);
}

/**
 Checks what became of each place of a group the bench decided, and the carries
 recorded beside them.

 @param group - the group, asked of the bench, with a winner

 @param renderings - each place's rendering in the counter's form

 @param path - where the group sits, for the parse error

 @param marks - whether a splice is recounted with the marks beside and inside
 the words compared, as a section that recorded them was written

 @param partialUnits - whether the section records a unit carried in part, so a
 place code cannot move the chosen words into may sit under a splice built for
 another place of its record and keeps its words when the splice is chosen

 @throws {@link ArtifactParseError} when an outcome is not the one the ballots,
 the recorded renderings and the carries give, or the carries are not one per
 receiving place

 @example
 ```ts
 assertSpanOutcomesFollow({ group, renderings, path, marks: 'compared', partialUnits: true, },);
 ```
 */
function assertSpanOutcomesFollow(
  {
    group,
    renderings,
    path,
    marks,
    partialUnits,
  }: {
    readonly group: AskedGroup;
    readonly renderings: readonly ConsistencyRendering[];
    readonly path: string;
    readonly marks: 'compared' | 'unrecorded';
    readonly partialUnits: boolean;
  },
): void {
  /**
   The usable ballots of the group.
   */
  const voices = usableVoicesOf({
    voices: group.verdict
      .ballots,
    labels: consistencyLabels({ count: group.occurrences
      .length, },),
  },);
  /**
   Position of the chosen place, none when no place won.
   */
  const chosenAt = winningPositionOf({ group, },);
  /**
   Rendering of the chosen place.
   */
  const chosen = renderings[chosenAt];
  /**
   Labels of the places the chosen rendering is carried to, which the carries must name in order.
   */
  const receivers: string[] = [];
  /**
   The places the chosen words are carried to, with what each is checked against once all are known.
   */
  const carriedTo: CarriedPlace[] = [];
  group.occurrences
    .forEach(function checkOne(
    occurrence,
    at,
  ): void {
    /**
     Where the place sits, for the parse error.
     */
    const here = `${path}.occurrences[${String(at,)}]`;
    /**
     Rendering of this place in the counter's form.
     */
    const rendering = renderings[at];
    /**
     Fails the place's outcome unless it is the one named.
     */
    function requireOutcome({ expected, }: { readonly expected: string; },): void {
      if (occurrence.outcome !== expected) {
        throw new ArtifactParseError({
          path: `${here}.outcome`,
          reason: `${expected}, as the ballots and the renderings give for this place`,
        },);
      }
    }
    if (chosenAt === (-1)) {
      requireOutcome({ expected: 'untouched', },);
      return;
    }
    if (at === chosenAt) {
      requireOutcome({ expected: 'chosen', },);
      return;
    }
    if (rendering?.kind !== 'located') {
      requireOutcome({ expected: 'unlocated', },);
      return;
    }
    if (isKeptByMajority({
      voices,
      label: occurrence.label,
    },)) {
      requireOutcome({ expected: 'kept-context', },);
      return;
    }
    if (chosen?.kind !== 'located') {
      throw new ArtifactParseError({
        path: `${path}.verdict.winner`,
        reason: 'a place whose rendering is located, since a winner is named only where its own rendering is located',
      },);
    }
    /**
     What moving the chosen words over this place by code amounts to.
     */
    const plan = planConsistencyEdit({
      chosen,
      target: rendering,
      framed: group.repeat
        .kind
        === 'refrain',
      marks,
    },);
    if (plan.kind === 'same') {
      requireOutcome({ expected: 'consistent', },);
      return;
    }
    receivers.push(occurrence.label,);
    /**
     The carry recorded for this place.
     */
    const carry = (group.carries ?? []).find(function carriesIt(entry,): boolean {
      return entry.label === occurrence.label;
    },);
    if (carry === undefined) {
      throw new ArtifactParseError({
        path: `${path}.carries`,
        reason: `a carry for ${occurrence.label}, which the chosen words are carried to`,
      },);
    }
    carriedTo.push({
      occurrence,
      here,
      plan: plan.kind,
      carry,
    },);
  },);
  assertCarriedOutcomes({
    carriedTo,
    path,
    marks,
    partialUnits,
  },);
  if ((group.carries ?? []).map(function labelOf({ label, },): string {
    return label;
  },)
    .join('\n',)
    !== receivers.join('\n',)) {
    throw new ArtifactParseError({
      path: `${path}.carries`,
      reason: 'one carry for each place the chosen words are carried to, in the order of the places',
    },);
  }
}

/**
 Checks a group of the sixteenth shape, asked of the bench, against its own
 ballots.

 @param group - the group, asked of the bench

 @param path - where the group sits, for the parse error

 @param generation - generation the section was written under, which says
 whether the marks beside each located place's words were recorded and a splice
 is recounted with them compared (seventeen) or by the words alone (sixteen)

 @throws {@link ArtifactParseError} when the usable count, a rendering, the
 winner, the run-off, a carry or an outcome is not what the ballots give

 @example
 ```ts
 assertSpanGroupCoherent({ group, path, generation: 17, },);
 ```
 */
export function assertSpanGroupCoherent(
  {
    group,
    path,
    generation,
  }: {
    readonly group: AskedGroup;
    readonly path: string;
    readonly generation: TwoLaneArtifactGeneration;
  },
): void {
  /**
   The usable ballots of the group.
   */
  const voices = usableVoicesOf({
    voices: group.verdict
      .ballots,
    labels: consistencyLabels({ count: group.occurrences
      .length, },),
  },);
  assertSeatsHeardOnce({
    seats: group.verdict
      .ballots
      .map(function seatOf({ seat, },): string {
        return seat;
      },),
    path: `${path}.verdict.ballots`,
  },);
  if (voices.length
    !== group.verdict
    .usable) {
    throw new ArtifactParseError({
      path: `${path}.verdict.usable`,
      reason: 'the number of ballots that can be counted against the places',
    },);
  }
  /**
   Each place's rendering in the counter's form, checked against the ballots.
   */
  const renderings = group.occurrences
    .map(function agrees(
    occurrence,
    at,
  ): ConsistencyRendering {
    return assertSpanRenderingAgrees({
      group,
      occurrence,
      path: `${path}.occurrences[${String(at,)}]`,
      generation,
    },);
  },);
  if (!sameWinner({
    left: expectedWinnerOf({
      group,
      renderings,
      path,
    },),
    right: group.verdict
      .winner,
  },)) {
    throw new ArtifactParseError({
      path: `${path}.verdict.winner`,
      reason: 'the winner a strict majority of the usable ballots, reaching the quorum, give, after the run-off when they tied',
    },);
  }
  assertCarriesRecount({
    carries: group.carries ?? [],
    path: `${path}.carries`,
  },);
  assertSpanOutcomesFollow({
    group,
    renderings,
    path,
    marks: artifactGenerationRecordsMarks({ generation, },) ? 'compared' : 'unrecorded',
    partialUnits: artifactGenerationCarriesPartialUnits({ generation, },),
  },);
}

//endregion Artifact consistency span coherence
