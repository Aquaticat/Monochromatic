import {
  type AdjudicatedIssue,
  type ChunkRepairOutcome,
  hashContent,
  type IssueCheckerReading,
  type ResolutionVerdict,
  type RosterModelId,
} from '../dist/final/node/index.mjs';
import {
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
} from './roster-seats.test-fixture.ts';

//region Sunbathing recheck
// THE SLICE, ITS OPEN ISSUE AND ITS CHECKER BENCH that the refinement
// recheck's cases share: one repaired paragraph about a cat sunbathing, the
// rewrite a refiner proposes for it, one accepted issue quoting it, and three
// checkers.
//
// TEST SUPPORT, NOT PACKAGE SOURCE. The slice settler's test file and the
// recheck's own both rule on this slice, the first through the whole lane
// and the second through the gate alone, so the two read one fixture rather
// than each keeping a copy of the outcome and the bench.
//
// Fixtures are cat-themed invention. No corpus content appears here.

/**
 Repaired slice text, one long single-line paragraph so the lane finds it
 eligible and would reach a rewriter.
 */
export const REPAIRED_TEXT =
  'The cat is doing the sunbathing on the windowsill in every afternoon, and when the light is moving across the floor she is following it without any hurry at all.';

/**
 Rewrite a scripted refiner proposes for that one paragraph.
 */
export const REWRITTEN_TEXT: string = `${REPAIRED_TEXT} Rewritten for flow.`;

/**
 Original this slice was repaired against.
 */
export const SOURCE_TEXT = '猫猫每天下午都在窗台上晒太阳。';

/**
 Checker bench, in seat order: three seats, the fewest the refine phase lets
 a run configure (`assertCheckerQuorumReachable`), so the checker stage's
 quorum is two and one heard checker is short of it.
 */
export const CHECKERS: readonly RosterModelId[] = [
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
];

/**
 Wording of the repaired text the accepted issue complains about.
 */
const SUNBATHING_QUOTE = 'is doing the sunbathing';

/**
 Accepted issue about the repaired text, with the one member claim the panel
 accepted, quoting the text, so the checker sheet shows a checker what it
 rules on. A case decides whether the accuracy lane's checkers confirmed it
 fixed or left it open.
 */
export const SUNBATHING_ISSUE: AdjudicatedIssue = {
  issueId: 'adjudicated/sunbathing',
  status: 'accepted',
  severity: 'minor',
  claims: [
    {
      claimId: 'issue/sunbathing',
      claim: {
        category: 'fluency/grammar',
        severity: 'minor',
        summary: 'The cat "is doing the sunbathing", which no speaker says.',
        spans: [
          {
            side: 'target',
            nodeId: 'block/1',
            nodeHash: hashContent({ content: REPAIRED_TEXT, },),
            startOffset: REPAIRED_TEXT.indexOf(SUNBATHING_QUOTE,),
            endOffset: REPAIRED_TEXT.indexOf(SUNBATHING_QUOTE,) + SUNBATHING_QUOTE.length,
            quotedText: SUNBATHING_QUOTE,
          },
        ],
      },
    },
  ],
  tallies: {},
};

/**
 Builds the settled accuracy outcome of the slice, standing as a translation
 or not, with no issue on record.

 @param nonTranslationStanding - whether the critics' non-translation ruling
 survived contradiction

 @returns Outcome the naturalness lane would refine

 @example
 ```ts
 const outcome = sunbathingOutcome({ nonTranslationStanding: true, },);
 ```
 */
export function sunbathingOutcome(
  { nonTranslationStanding, }: { readonly nonTranslationStanding: boolean; },
): ChunkRepairOutcome {
  return {
    sliceIndex: 0,
    repairedText: REPAIRED_TEXT,
    changed: false,
    issues: [],
    resolvedIssueIds: [],
    candidateResolvedIssueIds: [],
    checkerReadings: {},
    recheckReadings: {},
    repairRegions: [],
    authorship: {
      perIssue: {},
      everyIssue: [],
    },
    accuracyPatchSelected: false,
    refined: false,
    rounds: [],
    droppedDeclaredNames: [],
    nonTranslationVotes: nonTranslationStanding ? 2 : 0,
    nonTranslationContradicted: false,
    nonTranslationStanding,
    heardCritics: 1,
    heardCriticIds: [],
    claimAttributions: [],
    findings: [],
  };
}

/**
 Verdicts of a round in which every checker of the bench casts the same one.

 @param verdict - what each checker answers on the one issue

 @returns Verdict by checker, for a scripted client

 @example
 ```ts
 const verdicts = everyCheckerSays({ verdict: 'not-fixed', },);
 ```
 */
export function everyCheckerSays(
  { verdict, }: { readonly verdict: ResolutionVerdict; },
): ReadonlyMap<RosterModelId, ResolutionVerdict> {
  return new Map(CHECKERS.map(function toEntry(modelId,): readonly [
    RosterModelId,
    ResolutionVerdict,
  ] {
    return [
      modelId,
      verdict,
    ];
  },),);
}

/**
 A recheck's readings with each issue's ballots in the bench's seat order.

 ORDERED HERE because the gather hears checkers in the order its bench
 rotation takes from the prompt, which says nothing about the round: the
 same ballots in another order are the same reading.

 @param readings - readings a recheck returned or a settled slice carries

 @returns Every issue's reading, ballots sorted by the checker's seat

 @example
 ```ts
 const readings = readingsInSeatOrder({ readings: settled.outcome.recheckReadings, },);
 ```
 */
export function readingsInSeatOrder(
  { readings, }: { readonly readings: Readonly<Record<string, IssueCheckerReading>>; },
): Readonly<Record<string, IssueCheckerReading>> {
  return Object.fromEntries(
    Object
      .entries(readings,)
      .map(function toOrdered([issueId, reading,],): readonly [
        string,
        IssueCheckerReading,
      ] {
        return [
          issueId,
          {
            ...reading,
            ballots: reading.ballots
              .toSorted(function byBenchSeat(
                left,
                right,
              ): number {
                return CHECKERS.indexOf(left.modelId,) - CHECKERS.indexOf(right.modelId,);
              },),
          },
        ];
      },),
  );
}

//endregion Sunbathing recheck
