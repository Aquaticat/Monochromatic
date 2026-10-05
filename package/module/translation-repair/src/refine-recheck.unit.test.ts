/**
 Tests the refinement recheck, the checker round a refined slice passes
 before its rewrite may ship (ledger L11), by the verdict it returns for each
 kind of round: none to buy, one short of the checker stage's quorum, one
 that passes, and one that rolls the slice back.

 A ROUND SHORT OF ITS QUORUM IS THE CASE THIS FILE EXISTS FOR. With no ballot
 cast, no tally says worse, so such a round returned the findings of a round
 every checker answered and the rewrite shipped as rechecked.

 Each case asserts the whole verdict: whether the rewrite is retained, every
 finding, and every issue's reading. The cases for what the slice settler
 then does with a verdict are in `refine-slice-settle.unit.test.ts`.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  retainsResolvedIssues,
  type AdjudicatedIssue,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type IssueCheckerReading,
  type ResolutionVerdict,
  type RosterModelId,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';
import {
  type AskedSheet,
  askedSheetOf,
  stagesAsked,
} from './asked-sheets.test-fixture.ts';
import {
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
} from './roster-seats.test-fixture.ts';
import {
  CHECKERS,
  everyCheckerSays,
  readingsInSeatOrder,
  REWRITTEN_TEXT,
  SOURCE_TEXT,
  SUNBATHING_ISSUE,
  sunbathingOutcome,
} from './sunbathing-recheck.test-fixture.ts';

/**
 Logger for the recheck under test.
 */
const l = tagged({ tag: 'refine-recheck-test', },);

/**
 Message the scripted bench throws with for an exchange the recheck never
 sends.
 */
const NOT_A_CHECKER_EXCHANGE = 'the recheck asked for something other than a checker report';

/**
 The three lost voices and the unmet quorum the checker stage reports for a
 round nobody answered, in the bench's seat order.
 */
const NOBODY_HEARD_FINDINGS: readonly string[] = [
  `stage-voice-lost (checker ${SEAT_SYNTHETIC_VISION_NO_OPENROUTER})`,
  `stage-voice-lost (checker ${SEAT_SYNTHETIC_VISION_WITHHELD})`,
  `stage-voice-lost (checker ${SEAT_SYNTHETIC_TEXT_EVERYWHERE})`,
  'stage-quorum-unmet (checker 0/3)',
];

/**
 The lost voice and the short roster the checker stage reports for a round
 that met its quorum on the first two seats and never heard the third.
 */
const THIRD_SEAT_LOST_FINDINGS: readonly string[] = [
  `stage-voice-lost (checker ${SEAT_SYNTHETIC_TEXT_EVERYWHERE})`,
  'stage-roster-incomplete (checker 2/3)',
];

/**
 Client standing in for the checker bench, which is all the recheck asks.

 Each checker answers with its scripted verdict on the one issue. One given
 no verdict sends an empty report, which the checker stage's guard refuses
 (ledger L8), so the stage never hears it and the client hands the refusal
 back as a schema mismatch, as a provider's would.

 @param verdicts - verdict each checker casts on the one issue, by model id

 @param asked - sink receiving every exchange the recheck sent

 @returns Client usable by the recheck

 @example
 ```ts
 const client = checkerBench({ verdicts: everyCheckerSays({ verdict: 'fixed', },), asked: [], },);
 ```
 */
function checkerBench(
  {
    verdicts,
    asked,
  }: {
    readonly verdicts: ReadonlyMap<RosterModelId, ResolutionVerdict>;
    readonly asked: AskedSheet[];
  },
): SyntheticClient {
  return {
    chatText(): never {
      throw new Error(NOT_A_CHECKER_EXCHANGE,);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      asked.push(askedSheetOf({ request, },),);
      /**
       Verdict this checker casts, absent for one never heard.
       */
      const verdict = verdicts.get(request.modelId,);
      /**
       Report the checker sends: its one check, or none.
       */
      const report: unknown = {
        checks: (verdict === undefined)
          ? []
          : [{
            issue: 1,
            verdict,
          },],
      };
      if (request.validate(report,))
        return {
          kind: 'ok',
          value: report,
          rawText: JSON.stringify(report,),
        };
      return {
        kind: 'schema-mismatch',
        rawText: JSON.stringify(report,),
        detail: 'the guard refused a report with no usable check',
      };
    },
    quotas(): never {
      throw new Error(NOT_A_CHECKER_EXCHANGE,);
    },
  };
}

/**
 Ballots a reading holds when each scripted checker's verdict was heard:
 one per verdict, in the order given, none of the checkers having written
 the text.

 @param verdicts - verdict by checker, in seat order

 @returns Ballots as the checker stage records them

 @example
 ```ts
 const ballots = ballotsCast({ verdicts: everyCheckerSays({ verdict: 'fixed', },), },);
 ```
 */
function ballotsCast(
  { verdicts, }: { readonly verdicts: ReadonlyMap<RosterModelId, ResolutionVerdict>; },
): IssueCheckerReading['ballots'] {
  return [...verdicts,].map(function toBallot([modelId, verdict,],) {
    return {
      modelId,
      verdict,
      wroteTheText: false,
    };
  },);
}

/**
 Runs the recheck over the sunbathing slice's rewrite.

 @param issues - issues the accuracy lane settled for the slice

 @param resolvedIssueIds - issues among them its checkers had confirmed fixed

 @param verdicts - verdict each checker casts this round; a checker it
 leaves out is never heard

 @param asked - sink receiving every exchange the recheck sent

 @returns The recheck's verdict, each reading's ballots in seat order

 @example
 ```ts
 const verdict = await recheck({ issues: [SUNBATHING_ISSUE,], },);
 ```
 */
async function recheck(
  {
    issues,
    resolvedIssueIds = [],
    verdicts = new Map<RosterModelId, ResolutionVerdict>(),
    asked = [],
  }: {
    readonly issues: readonly AdjudicatedIssue[];
    readonly resolvedIssueIds?: readonly string[];
    readonly verdicts?: ReadonlyMap<RosterModelId, ResolutionVerdict>;
    readonly asked?: AskedSheet[];
  },
): Promise<Awaited<ReturnType<typeof retainsResolvedIssues>>> {
  /**
   Verdict as the recheck returned it.
   */
  const verdict = await retainsResolvedIssues({
    client: checkerBench({
      verdicts,
      asked,
    },),
    checkerModelIds: CHECKERS,
    outcome: {
      ...sunbathingOutcome({ nonTranslationStanding: false, },),
      issues,
      resolvedIssueIds,
    },
    refineContributors: [SEAT_HYPER_OPENROUTER_VISION_EDITOR,],
    sourceText: SOURCE_TEXT,
    refinedText: REWRITTEN_TEXT,
    signal: AbortSignal.timeout(30_000,),
    perCallTimeoutMs: 1_000,
    l,
  },);
  return {
    ...verdict,
    readings: readingsInSeatOrder({ readings: verdict.readings, },),
  };
}

await describe({
  name: retainsResolvedIssues.name,
  children: [
    it({
      name: 'BUYS NO ROUND for a slice whose one issue the panel rejected: the rewrite is retained with no '
        + 'finding and no reading, and no checker is asked',
      fn: async () => {
        /**
         Exchanges the recheck sent.
         */
        const asked: AskedSheet[] = [];
        expect(
          await recheck({
            issues: [{
              ...SUNBATHING_ISSUE,
              status: 'rejected',
            },],
            verdicts: everyCheckerSays({ verdict: 'worse', },),
            asked,
          },),
        ).toEqual({
          retained: true,
          findings: [],
          readings: {},
        },);
        expect(stagesAsked({ asked, },),).toEqual([],);
      },
    },),

    it({
      name: 'REFUSES a round that heard none of the three checkers: the rewrite is not retained, under the '
        + 'checker stage\'s three lost voices, its unmet quorum and refine-recheck-unheard at 0 of 3, with '
        + 'no ballot in the open issue\'s reading',
      fn: async () => {
        expect(await recheck({ issues: [SUNBATHING_ISSUE,], },),).toEqual({
          retained: false,
          findings: [
            ...NOBODY_HEARD_FINDINGS,
            'refine-recheck-unheard (0 of 3 checkers heard)',
          ],
          readings: {
            [SUNBATHING_ISSUE.issueId]: {
              ballots: [],
              configuredCheckers: 3,
              tally: {
                fixed: 0,
                notFixed: 0,
                worse: 0,
                resolved: false,
                regressed: false,
              },
            },
          },
        },);
      },
    },),

    it({
      name: 'REFUSES a round that heard one checker of three, short of the stage\'s quorum of two, though '
        + 'the one ballot cast says not-fixed: refine-recheck-unheard at 1 of 3, with that ballot in the '
        + 'reading',
      fn: async () => {
        /**
         Round in which the first seat alone answers.
         */
        const verdicts = new Map<RosterModelId, ResolutionVerdict>([
          [
            SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
            'not-fixed',
          ],
        ],);
        expect(
          await recheck({
            issues: [SUNBATHING_ISSUE,],
            verdicts,
          },),
        ).toEqual({
          retained: false,
          findings: [
            `stage-voice-lost (checker ${SEAT_SYNTHETIC_VISION_WITHHELD})`,
            `stage-voice-lost (checker ${SEAT_SYNTHETIC_TEXT_EVERYWHERE})`,
            'stage-quorum-unmet (checker 1/3)',
            'refine-recheck-unheard (1 of 3 checkers heard)',
          ],
          readings: {
            [SUNBATHING_ISSUE.issueId]: {
              ballots: ballotsCast({ verdicts, },),
              configuredCheckers: 3,
              tally: {
                fixed: 0,
                notFixed: 1,
                worse: 0,
                resolved: false,
                regressed: false,
              },
            },
          },
        },);
      },
    },),

    it({
      name: 'NAMES a round short of quorum unheard, not its issue worsened, where the one ballot cast says '
        + 'worse: the findings name no issue, and the worse ballot stays in the reading',
      fn: async () => {
        /**
         Round in which the second seat alone answers, and answers worse.
         */
        const verdicts = new Map<RosterModelId, ResolutionVerdict>([
          [
            SEAT_SYNTHETIC_VISION_WITHHELD,
            'worse',
          ],
        ],);
        expect(
          await recheck({
            issues: [SUNBATHING_ISSUE,],
            verdicts,
          },),
        ).toEqual({
          retained: false,
          findings: [
            `stage-voice-lost (checker ${SEAT_SYNTHETIC_VISION_NO_OPENROUTER})`,
            `stage-voice-lost (checker ${SEAT_SYNTHETIC_TEXT_EVERYWHERE})`,
            'stage-quorum-unmet (checker 1/3)',
            'refine-recheck-unheard (1 of 3 checkers heard)',
          ],
          readings: {
            [SUNBATHING_ISSUE.issueId]: {
              ballots: ballotsCast({ verdicts, },),
              configuredCheckers: 3,
              tally: {
                fixed: 0,
                notFixed: 0,
                worse: 1,
                resolved: false,
                regressed: true,
              },
            },
          },
        },);
      },
    },),

    it({
      name: 'NAMES a round nobody answered unheard, not its issue regressed, for an issue the checkers had '
        + 'confirmed fixed: no ballot says the rewrite broke it',
      fn: async () => {
        expect(
          await recheck({
            issues: [SUNBATHING_ISSUE,],
            resolvedIssueIds: [SUNBATHING_ISSUE.issueId,],
          },),
        ).toEqual({
          retained: false,
          findings: [
            ...NOBODY_HEARD_FINDINGS,
            'refine-recheck-unheard (0 of 3 checkers heard)',
          ],
          readings: {
            [SUNBATHING_ISSUE.issueId]: {
              ballots: [],
              configuredCheckers: 3,
              tally: {
                fixed: 0,
                notFixed: 0,
                worse: 0,
                resolved: false,
                regressed: false,
              },
            },
          },
        },);
      },
    },),

    it({
      name: 'PASSES a round every checker answered not-fixed on an open issue: the rewrite is retained '
        + 'under refine-recheck-passed (1 issue) and no other finding',
      fn: async () => {
        /**
         Round in which every checker finds the open issue as it stood.
         */
        const verdicts = everyCheckerSays({ verdict: 'not-fixed', },);
        expect(
          await recheck({
            issues: [SUNBATHING_ISSUE,],
            verdicts,
          },),
        ).toEqual({
          retained: true,
          findings: ['refine-recheck-passed (1 issue)',],
          readings: {
            [SUNBATHING_ISSUE.issueId]: {
              ballots: ballotsCast({ verdicts, },),
              configuredCheckers: 3,
              tally: {
                fixed: 0,
                notFixed: 3,
                worse: 0,
                resolved: false,
                regressed: false,
              },
            },
          },
        },);
      },
    },),

    it({
      name: 'PASSES a round every checker confirmed a confirmed issue fixed again',
      fn: async () => {
        /**
         Round in which every checker calls the confirmed issue fixed.
         */
        const verdicts = everyCheckerSays({ verdict: 'fixed', },);
        expect(
          await recheck({
            issues: [SUNBATHING_ISSUE,],
            resolvedIssueIds: [SUNBATHING_ISSUE.issueId,],
            verdicts,
          },),
        ).toEqual({
          retained: true,
          findings: ['refine-recheck-passed (1 issue)',],
          readings: {
            [SUNBATHING_ISSUE.issueId]: {
              ballots: ballotsCast({ verdicts, },),
              configuredCheckers: 3,
              tally: {
                fixed: 3,
                notFixed: 0,
                worse: 0,
                resolved: true,
                regressed: false,
              },
            },
          },
        },);
      },
    },),

    it({
      name: 'ROLLS BACK on one worse ballot of three on an open issue, naming the issue, though the other '
        + 'two say not-fixed',
      fn: async () => {
        /**
         Round with one worse ballot, from the second seat.
         */
        const verdicts = new Map<RosterModelId, ResolutionVerdict>([
          [
            SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
            'not-fixed',
          ],
          [
            SEAT_SYNTHETIC_VISION_WITHHELD,
            'worse',
          ],
          [
            SEAT_SYNTHETIC_TEXT_EVERYWHERE,
            'not-fixed',
          ],
        ],);
        expect(
          await recheck({
            issues: [SUNBATHING_ISSUE,],
            verdicts,
          },),
        ).toEqual({
          retained: false,
          findings: [`refine-rolled-back (${SUNBATHING_ISSUE.issueId})`,],
          readings: {
            [SUNBATHING_ISSUE.issueId]: {
              ballots: ballotsCast({ verdicts, },),
              configuredCheckers: 3,
              tally: {
                fixed: 0,
                notFixed: 2,
                worse: 1,
                resolved: false,
                regressed: false,
              },
            },
          },
        },);
      },
    },),

    it({
      name: 'ROLLS BACK when a round every checker answered does not confirm a confirmed issue again, '
        + 'naming the issue',
      fn: async () => {
        /**
         Round in which every checker finds the confirmed issue present again.
         */
        const verdicts = everyCheckerSays({ verdict: 'not-fixed', },);
        expect(
          await recheck({
            issues: [SUNBATHING_ISSUE,],
            resolvedIssueIds: [SUNBATHING_ISSUE.issueId,],
            verdicts,
          },),
        ).toEqual({
          retained: false,
          findings: [`refine-rolled-back (${SUNBATHING_ISSUE.issueId})`,],
          readings: {
            [SUNBATHING_ISSUE.issueId]: {
              ballots: ballotsCast({ verdicts, },),
              configuredCheckers: 3,
              tally: {
                fixed: 0,
                notFixed: 3,
                worse: 0,
                resolved: false,
                regressed: false,
              },
            },
          },
        },);
      },
    },),

    it({
      name: 'CARRIES the checker stage\'s own findings into a pass: two checkers of three answering '
        + 'not-fixed meet the quorum, and the lost checker and the short roster are named beside '
        + 'refine-recheck-passed',
      fn: async () => {
        /**
         Round the first two seats answer and the third never does.
         */
        const verdicts = new Map<RosterModelId, ResolutionVerdict>([
          [
            SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
            'not-fixed',
          ],
          [
            SEAT_SYNTHETIC_VISION_WITHHELD,
            'not-fixed',
          ],
        ],);
        expect(
          await recheck({
            issues: [SUNBATHING_ISSUE,],
            verdicts,
          },),
        ).toEqual({
          retained: true,
          findings: [
            ...THIRD_SEAT_LOST_FINDINGS,
            'refine-recheck-passed (1 issue)',
          ],
          readings: {
            [SUNBATHING_ISSUE.issueId]: {
              ballots: ballotsCast({ verdicts, },),
              configuredCheckers: 3,
              tally: {
                fixed: 0,
                notFixed: 2,
                worse: 0,
                resolved: false,
                regressed: false,
              },
            },
          },
        },);
      },
    },),

    it({
      name: 'CARRIES the checker stage\'s own findings into a rollback: one worse ballot of the two heard '
        + 'rolls back, and the lost checker and the short roster are named beside the issue',
      fn: async () => {
        /**
         Round the first seat calls worse, the second not-fixed, and the
         third never answers.
         */
        const verdicts = new Map<RosterModelId, ResolutionVerdict>([
          [
            SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
            'worse',
          ],
          [
            SEAT_SYNTHETIC_VISION_WITHHELD,
            'not-fixed',
          ],
        ],);
        expect(
          await recheck({
            issues: [SUNBATHING_ISSUE,],
            verdicts,
          },),
        ).toEqual({
          retained: false,
          findings: [
            ...THIRD_SEAT_LOST_FINDINGS,
            `refine-rolled-back (${SUNBATHING_ISSUE.issueId})`,
          ],
          readings: {
            [SUNBATHING_ISSUE.issueId]: {
              ballots: ballotsCast({ verdicts, },),
              configuredCheckers: 3,
              tally: {
                fixed: 0,
                notFixed: 1,
                worse: 1,
                resolved: false,
                regressed: false,
              },
            },
          },
        },);
      },
    },),
  ],
},);
