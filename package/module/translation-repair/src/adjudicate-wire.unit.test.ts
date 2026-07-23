/**
 * Tests for the panel ballot wire format and its fail-closed resolution.
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  isPanelBallotWire,
  resolvePanelBallot,
} from '../dist/final/neutral/index.mjs';

/**
 * Claim ids in prompt numbering order for resolution tests.
 */
const CLAIM_IDS = [
  'issue/whisker',
  'issue/paw',
  'issue/tail',
] as const;

/**
 * Cluster ids in prompt numbering order for resolution tests.
 */
const CLUSTER_IDS = [
  'cluster/nap',
  'cluster/chase',
] as const;

await describe({
  name: isPanelBallotWire.name,
  children: [
    it({
      name: 'accepts complete and minimal ballots',
      fn: async () => {
        expect(isPanelBallotWire({
          verdicts: [
            {
              claim: 1,
              vote: 'supported',
              severity: 'major',
            },
          ],
          groups: [
            {
              group: 1,
              sameDefect: true,
            },
          ],
        },),).toBe(true,);
        expect(isPanelBallotWire({ verdicts: [], },),).toBe(true,);
      },
    },),

    it({
      name: 'rejects malformed ballots',
      fn: async () => {
        expect(isPanelBallotWire({},),).toBe(false,);
        expect(isPanelBallotWire({ verdicts: [{ claim: 'one', vote: 'supported', },], },),)
          .toBe(false,);
        expect(isPanelBallotWire({ verdicts: [{ claim: 1.5, vote: 'supported', },], },),)
          .toBe(false,);
        expect(isPanelBallotWire({ verdicts: [{ claim: 1, },], },),).toBe(false,);
        expect(isPanelBallotWire({
          verdicts: [],
          groups: [{ group: 1, },],
        },),).toBe(false,);
        expect(isPanelBallotWire('a string',),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: resolvePanelBallot.name,
  children: [
    it({
      name: 'resolves verdicts and group opinions through the index maps',
      fn: async () => {
        /** Complete well-formed ballot. */
        const ballot = resolvePanelBallot({
          wire: {
            verdicts: [
              {
                claim: 1,
                vote: 'supported',
                severity: 'critical',
              },
              {
                claim: 2,
                vote: 'unsupported',
              },
              {
                claim: 3,
                vote: 'abstain',
              },
            ],
            groups: [
              {
                group: 2,
                sameDefect: false,
              },
            ],
          },
          claimIds: CLAIM_IDS,
          clusterIds: CLUSTER_IDS,
        },);
        expect(ballot.verdicts['issue/whisker'],).toEqual({
          vote: 'supported',
          severity: 'critical',
        },);
        expect(ballot.verdicts['issue/paw'],).toEqual({ vote: 'unsupported', },);
        expect(ballot.verdicts['issue/tail'],).toEqual({ vote: 'abstain', },);
        expect(ballot.mergeOpinions['cluster/chase'],).toBe(false,);
        expect(ballot.findings,).toHaveLength(0,);
      },
    },),

    it({
      name: 'records out-of-range references as findings',
      fn: async () => {
        /** Ballot pointing at claims and groups beyond the sheet. */
        const ballot = resolvePanelBallot({
          wire: {
            verdicts: [
              {
                claim: 0,
                vote: 'supported',
              },
              {
                claim: 9,
                vote: 'supported',
              },
            ],
            groups: [
              {
                group: 7,
                sameDefect: true,
              },
            ],
          },
          claimIds: CLAIM_IDS,
          clusterIds: CLUSTER_IDS,
        },);
        expect(Object.keys(ballot.verdicts,),).toHaveLength(0,);
        expect(ballot.findings,).toContain('verdict-index-out-of-range (0)',);
        expect(ballot.findings,).toContain('verdict-index-out-of-range (9)',);
        expect(ballot.findings,).toContain('group-index-out-of-range (7)',);
      },
    },),

    it({
      name: 'keeps the first verdict on duplicates and records the repeat',
      fn: async () => {
        /** Ballot voting claim one twice. */
        const ballot = resolvePanelBallot({
          wire: {
            verdicts: [
              {
                claim: 1,
                vote: 'supported',
              },
              {
                claim: 1,
                vote: 'unsupported',
              },
              {
                claim: 2,
                vote: 'ambiguous',
              },
              {
                claim: 3,
                vote: 'abstain',
              },
            ],
          },
          claimIds: CLAIM_IDS,
          clusterIds: CLUSTER_IDS,
        },);
        expect(ballot.verdicts['issue/whisker']?.vote,).toBe('supported',);
        expect(ballot.findings,).toContain('duplicate-verdict (1)',);
      },
    },),

    it({
      name: 'records unknown votes and keeps votes with dropped bad re-grades',
      fn: async () => {
        /** Ballot with one invented vote state and one invented severity. */
        const ballot = resolvePanelBallot({
          wire: {
            verdicts: [
              {
                claim: 1,
                vote: 'maybe',
              },
              {
                claim: 2,
                vote: 'supported',
                severity: 'catastrophic',
              },
              {
                claim: 3,
                vote: 'source-defect',
              },
            ],
          },
          claimIds: CLAIM_IDS,
          clusterIds: CLUSTER_IDS,
        },);
        expect(ballot.verdicts['issue/whisker'],).toBe(undefined,);
        expect(ballot.findings,).toContain('unknown-vote (maybe)',);
        expect(ballot.verdicts['issue/paw'],).toEqual({ vote: 'supported', },);
        expect(ballot.findings,).toContain('unknown-regrade-severity (catastrophic)',);
        expect(ballot.verdicts['issue/tail']?.vote,).toBe('source-defect',);
      },
    },),

    it({
      name: 'records claims left without any verdict',
      fn: async () => {
        /** Ballot answering only the first claim. */
        const ballot = resolvePanelBallot({
          wire: {
            verdicts: [
              {
                claim: 1,
                vote: 'supported',
              },
            ],
          },
          claimIds: CLAIM_IDS,
          clusterIds: CLUSTER_IDS,
        },);
        expect(ballot.findings,).toContain('missing-verdict (2)',);
        expect(ballot.findings,).toContain('missing-verdict (3)',);
      },
    },),

    it({
      name: 'keeps the first group opinion on duplicates and records the repeat',
      fn: async () => {
        /** Ballot opining the first cluster twice. */
        const ballot = resolvePanelBallot({
          wire: {
            verdicts: [
              {
                claim: 1,
                vote: 'supported',
              },
              {
                claim: 2,
                vote: 'supported',
              },
              {
                claim: 3,
                vote: 'supported',
              },
            ],
            groups: [
              {
                group: 1,
                sameDefect: true,
              },
              {
                group: 1,
                sameDefect: false,
              },
            ],
          },
          claimIds: CLAIM_IDS,
          clusterIds: CLUSTER_IDS,
        },);
        expect(ballot.mergeOpinions['cluster/nap'],).toBe(true,);
        expect(ballot.findings,).toContain('duplicate-group-opinion (1)',);
      },
    },),
  ],
},);
