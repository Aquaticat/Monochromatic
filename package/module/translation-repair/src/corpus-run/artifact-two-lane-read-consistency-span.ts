import { ArtifactParseError, } from '../artifact-guard.ts';
import { slotInSpan, } from '../consistency-count.ts';
import type { ConsistencyRendering, } from '../consistency-count-types.ts';
import { foldedWordsOf, } from '../consistency-fold.ts';
import {
  agreedWordsOf,
  isKeptByMajority,
  usableVoicesOf,
} from '../consistency-majority.ts';
import { planConsistencyEdit, } from '../consistency-splice.ts';
import { consistencyLabels, } from '../consistency-wire.ts';
import type {
  ArtifactConsistencyGroup,
  ArtifactConsistencyOccurrence,
} from './artifact-two-lane-consistency.ts';
import {
  assertCarriesRecount,
  outcomesAfter,
} from './artifact-two-lane-read-consistency-carry-recount.ts';
import {
  asLocatedBySpan,
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
// recorded.

/**
 A group the bench was asked about.
 */
type AskedGroup = ArtifactConsistencyGroup & { readonly verdict: { readonly kind: 'asked'; }; };

/**
 Checks one place's rendering against the words its ballots agreed on.

 @param group - the group, asked of the bench

 @param occurrence - the place

 @param path - where the place sits, for the parse error

 @returns The place's rendering in the counter's form

 @throws {@link ArtifactParseError} when a located rendering is not the agreed
 words or slot, or an unlocated one gives a reason the ballots contradict

 @example
 ```ts
 const rendering = assertSpanRenderingAgrees({ group, occurrence, path, },);
 ```
 */
function assertSpanRenderingAgrees(
  {
    group,
    occurrence,
    path,
  }: {
    readonly group: AskedGroup;
    readonly occurrence: ArtifactConsistencyOccurrence;
    readonly path: string;
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
   The folded words a strict majority quoted for this place.
   */
  const words = agreedWordsOf({
    voices,
    label: occurrence.label,
  },);
  /**
   What the ballots allow the recorded rendering to say.
   */
  const { rendering, } = occurrence;
  if (rendering.kind === 'unlocated') {
    if (reasonContradictedBySpan({
      reason: rendering.reason,
      words,
    },)) {
      throw new ArtifactParseError({
        path: `${path}.rendering.reason`,
        reason: 'a reason the usable ballots do not contradict',
      },);
    }
    return rendering;
  }
  /**
   The folded words, none when the ballots agreed on none.
   */
  const [agreed,] = words;
  if ((agreed === undefined) || (foldedWordsOf({ text: rendering.quote, },) !== agreed)) {
    throw new ArtifactParseError({
      path: `${path}.rendering`,
      reason: 'the words a strict majority of the usable ballots quoted, as the place\'s English holds them',
    },);
  }
  if (locatedContradictedBySpan({ rendering, },)) {
    throw new ArtifactParseError({
      path: `${path}.rendering`,
      reason: 'words that show a reader something and hold their markup in pairs, and a slot that does the same and is not all of them',
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

 @throws {@link ArtifactParseError} when an outcome is not the one the ballots,
 the recorded renderings and the carries give, or the carries are not one per
 receiving place

 @example
 ```ts
 assertSpanOutcomesFollow({ group, renderings, path, },);
 ```
 */
function assertSpanOutcomesFollow(
  {
    group,
    renderings,
    path,
  }: {
    readonly group: AskedGroup;
    readonly renderings: readonly ConsistencyRendering[];
    readonly path: string;
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
    if ((plan.kind === 'unavailable')
      && carry.candidates
      .some(function isSplice(candidate,): boolean {
        return candidate.kind === 'splice';
      },)) {
      throw new ArtifactParseError({
        path: `${path}.carries`,
        reason: `no splice candidate for ${occurrence.label}, whose frame or the chosen frame has no slot to move the words by`,
      },);
    }
    if (!outcomesAfter({ carry, },)
      .includes(occurrence.outcome,)) {
      throw new ArtifactParseError({
        path: `${here}.outcome`,
        reason: `${outcomesAfter({ carry, },)
          .join(', ',)}, for a carry that decided as recorded`,
      },);
    }
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

 @throws {@link ArtifactParseError} when the usable count, a rendering, the
 winner, the run-off, a carry or an outcome is not what the ballots give

 @example
 ```ts
 assertSpanGroupCoherent({ group, path, },);
 ```
 */
export function assertSpanGroupCoherent(
  {
    group,
    path,
  }: {
    readonly group: AskedGroup;
    readonly path: string;
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
  },);
}

//endregion Artifact consistency span coherence
