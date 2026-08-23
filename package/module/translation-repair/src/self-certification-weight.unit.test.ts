/**
 * Tests for the self-certification discount: a checker judging text it helped
 * write is heard at {@link SELF_VOTE_WEIGHT} rather than at a whole vote.
 *
 * THE DISCRIMINATING CASE IS `RESOLVES ON ONE INDEPENDENT VOTE`. One author
 * against one independent is 1 against 1 unweighted and 1 against a half
 * weighted, so that case alone flips when the discount is removed. Every other
 * case here fences a property around it, and the case right after it is its
 * positive control: identical ballots with nobody named as an author must NOT
 * resolve, which is what proves the assertion reads the discount rather than
 * the ballots.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type IssueAuthorship,
  type ResolutionBallot,
  type ResolutionVerdict,
  type SyntheticModelId,
  tallyResolutionChecks,
  UNATTRIBUTED_TEXT,
  wroteTextForIssue,
} from '../dist/final/node/index.mjs';

/**
 * Issue the ballots below all speak about.
 */
const WHISKER = 'adjudicated/whisker';

/**
 * Second issue, used where one issue must stay undiscounted while another is
 * discounted.
 */
const PAW = 'adjudicated/paw';

/**
 * Model cast as the one that wrote the text under check.
 */
const AUTHOR: SyntheticModelId = 'hf:zai-org/GLM-5.2';

/**
 * Model that wrote none of it.
 */
const OUTSIDER: SyntheticModelId = 'hf:Qwen/Qwen3.8-27B';

/**
 * Third voice, for cases needing two independents.
 */
const BYSTANDER: SyntheticModelId = 'hf:moonshotai/Kimi-K3';

/**
 * Authorship naming {@link AUTHOR} as the writer of one issue's text only.
 */
const WROTE_WHISKER: IssueAuthorship = {
  perIssue: { [WHISKER]: [AUTHOR,], },
  everyIssue: [],
};

/**
 * Authorship naming {@link AUTHOR} as writer of the whole chunk.
 */
const WROTE_THE_CHUNK: IssueAuthorship = {
  perIssue: {},
  everyIssue: [AUTHOR,],
};

/**
 * One checker id beside the ballot built for it.
 *
 * @example
 * ```ts
 * const entry: CheckerBallot = ['hf:zai-org/GLM-5.2', { verdicts: {}, findings: [], },];
 * ```
 */
type CheckerBallot = readonly [
  string,
  ResolutionBallot,
];

/**
 * Builds ballots from one verdict per checker, so each case reads as the vote
 * it is testing rather than as nested object literals.
 */
function ballotsOf(
  votes: Readonly<Record<string, ResolutionVerdict>>,
): Readonly<Record<string, ResolutionBallot>> {
  return Object.fromEntries(
    Object.entries(votes,)
      .map(function toBallot([modelId, verdict,],): CheckerBallot {
        return [
          modelId,
          {
            verdicts: { [WHISKER]: verdict, },
            findings: [],
          },
        ];
      },),
  );
}

/**
 * Tallies one issue under one authorship, so cases assert on a fate rather than
 * on a record of them.
 */
function fateOf(
  {
    votes,
    authorship,
  }: {
    readonly votes: Readonly<Record<string, ResolutionVerdict>>;
    readonly authorship: IssueAuthorship;
  },
) {
  return tallyResolutionChecks({
    issueIds: [WHISKER,],
    ballots: ballotsOf(votes,),
    authorship,
  },)[WHISKER];
}

await describe({
  name: tallyResolutionChecks.name,
  children: [
    it({
      name: 'RESOLVES on one independent fixed vote against the author saying not-fixed, because a '
        + 'whole vote outweighs the half the author is heard at. THIS IS THE CASE THE DISCOUNT '
        + 'DECIDES: unweighted it is one against one and resolves nothing',
      fn: async function authorLosesToOneIndependent() {
        expect(fateOf({
          votes: {
            [AUTHOR]: 'not-fixed',
            [OUTSIDER]: 'fixed',
          },
          authorship: WROTE_WHISKER,
        },),).toEqual({
          fixed: 1,
          notFixed: 0.5,
          worse: 0,
          resolved: true,
          regressed: false,
        },);
      },
    },),

    it({
      name: 'REFUSES to resolve those same two ballots when nobody is named as an author, which is '
        + 'the positive control for the case above: the assertion has to be reading the discount '
        + 'and not the ballots',
      fn: async function withoutAuthorshipItTies() {
        expect(fateOf({
          votes: {
            [AUTHOR]: 'not-fixed',
            [OUTSIDER]: 'fixed',
          },
          authorship: UNATTRIBUTED_TEXT,
        },),).toEqual({
          fixed: 1,
          notFixed: 1,
          worse: 0,
          resolved: false,
          regressed: false,
        },);
      },
    },),

    it({
      name: 'HALVES AN AUTHOR VOTING FOR ITS OWN WORK TOO, so a self-certified fixed loses to one '
        + 'independent not-fixed. The discount weighs the stake in the text, not the direction the '
        + 'answer points',
      fn: async function discountIsDirectionBlind() {
        expect(fateOf({
          votes: {
            [AUTHOR]: 'fixed',
            [OUTSIDER]: 'not-fixed',
          },
          authorship: WROTE_WHISKER,
        },),).toEqual({
          fixed: 0.5,
          notFixed: 1,
          worse: 0,
          resolved: false,
          regressed: false,
        },);
      },
    },),

    it({
      name: 'STILL RESOLVES on a lone unopposed author, because half a vote outweighs none. Recorded '
        + 'as accepted rather than fixed: a half cannot block an author nobody contradicts, and '
        + 'nothing in the arithmetic picks a number that would',
      fn: async function loneAuthorStillCarries() {
        expect(fateOf({
          votes: { [AUTHOR]: 'fixed', },
          authorship: WROTE_WHISKER,
        },),).toEqual({
          fixed: 0.5,
          notFixed: 0,
          worse: 0,
          resolved: true,
          regressed: false,
        },);
      },
    },),

    it({
      name: 'DISCOUNTS AN ISSUE NEVER NAMED TO THE ROUND when the author wrote the whole chunk, '
        + 'since a chunk-wide rewrite answers for every issue in it whether or not the round was '
        + 'told about them',
      fn: async function chunkScopeReachesEveryIssue() {
        expect(fateOf({
          votes: {
            [AUTHOR]: 'not-fixed',
            [OUTSIDER]: 'fixed',
          },
          authorship: WROTE_THE_CHUNK,
        },),).toEqual({
          fixed: 1,
          notFixed: 0.5,
          worse: 0,
          resolved: true,
          regressed: false,
        },);
      },
    },),

    it({
      name: 'LEAVES A SECOND ISSUE AT WHOLE VOTES when authorship names only the first, so an '
        + 'envelope-scoped discount cannot leak onto issues that envelope never served',
      fn: async function envelopeScopeStaysPut() {
        expect(tallyResolutionChecks({
          issueIds: [
            WHISKER,
            PAW,
          ],
          ballots: {
            [AUTHOR]: {
              verdicts: {
                [WHISKER]: 'not-fixed',
                [PAW]: 'not-fixed',
              },
              findings: [],
            },
            [OUTSIDER]: {
              verdicts: {
                [WHISKER]: 'fixed',
                [PAW]: 'fixed',
              },
              findings: [],
            },
          },
          authorship: WROTE_WHISKER,
        },)[PAW],).toEqual({
          fixed: 1,
          notFixed: 1,
          worse: 0,
          resolved: false,
          regressed: false,
        },);
      },
    },),

    it({
      name: 'WEIGHS THE WORSE VERDICT ON THE SAME TERMS, so a regression called by one author and '
        + 'one independent still outweighs a lone fixed, and worse is summed on its own rather '
        + 'than derived by subtracting the others',
      fn: async function worseIsWeighedNotDerived() {
        expect(fateOf({
          votes: {
            [AUTHOR]: 'worse',
            [BYSTANDER]: 'worse',
            [OUTSIDER]: 'fixed',
          },
          authorship: WROTE_WHISKER,
        },),).toEqual({
          fixed: 1,
          notFixed: 0,
          worse: 1.5,
          resolved: false,
          regressed: true,
        },);
      },
    },),

    it({
      name: 'COUNTS A SILENT CHECKER AS NOTHING, neither for nor against, so an author that cast no '
        + 'verdict adds no weight to either side',
      fn: async function silenceAddsNoWeight() {
        expect(tallyResolutionChecks({
          issueIds: [PAW,],
          ballots: ballotsOf({ [AUTHOR]: 'fixed', },),
          authorship: WROTE_WHISKER,
        },)[PAW],).toEqual({
          fixed: 0,
          notFixed: 0,
          worse: 0,
          resolved: false,
          regressed: false,
        },);
      },
    },),
  ],
},);

await describe({
  name: wroteTextForIssue.name,
  children: [
    it({
      name: 'ACCEPTS a checker named for this very issue, and REFUSES one named for no issue at all',
      fn: async function readsThePerIssueMap() {
        expect(wroteTextForIssue({
          authorship: WROTE_WHISKER,
          issueId: WHISKER,
          modelId: AUTHOR,
        },),).toBe(true,);

        expect(wroteTextForIssue({
          authorship: WROTE_WHISKER,
          issueId: WHISKER,
          modelId: OUTSIDER,
        },),).toBe(false,);
      },
    },),

    it({
      name: 'REFUSES a chunk-wide author on no issue, and ACCEPTS it on one the per-issue map never '
        + 'mentions, which is the whole reason the two fields are kept apart',
      fn: async function readsTheChunkWideList() {
        expect(wroteTextForIssue({
          authorship: WROTE_THE_CHUNK,
          issueId: PAW,
          modelId: AUTHOR,
        },),).toBe(true,);

        expect(wroteTextForIssue({
          authorship: UNATTRIBUTED_TEXT,
          issueId: PAW,
          modelId: AUTHOR,
        },),).toBe(false,);
      },
    },),
  ],
},);
