/**
 * Tests for the judge-ballot wire guard.
 *
 * `isCandidateBallotWire` is the only check between a malformed judge reply and
 * code that reads `best` as an index. It had no test.
 *
 * One boundary is deliberately absent from the guard and is pinned here so
 * nobody adds it: there is no UPPER bound on `best`. A ballot naming a
 * candidate that does not exist is admitted on purpose, because
 * `selectBestCandidate` counts it as an abstention rather than discarding the
 * whole ballot, and that behavior has its own test. Rejecting the out-of-range
 * ballot here would turn an abstention into a lost voice and change what a
 * quorum means.
 *
 * Fixtures are cat-themed invention.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  CANDIDATE_NONE,
  isCandidateBallotWire,
} from '../dist/final/node/index.mjs';

await describe({
  name: isCandidateBallotWire.name,
  children: [
    it({
      name: 'accepts a ballot naming a candidate by its one-based index',
      fn: async () => {
        expect(
          isCandidateBallotWire({
            best: 1,
            reason: 'reads most naturally',
          },),
        ).toBe(true,);
      },
    },),

    it({
      name: 'accepts the decline value, since refusing every candidate is a '
        + 'substantive verdict rather than a failure to answer',
      fn: async () => {
        expect(
          isCandidateBallotWire({
            best: CANDIDATE_NONE,
            reason: 'none of these fix the dropped clause',
          },),
        ).toBe(true,);
      },
    },),

    it({
      name: 'accepts an out-of-range index ON PURPOSE. The guard has no upper '
        + 'bound because it cannot know the slate size, and selection counts a '
        + 'ballot naming a nonexistent candidate as an ABSTENTION. Refusing it '
        + 'here would turn that abstention into a lost voice, which changes '
        + 'what a quorum means',
      fn: async () => {
        expect(
          isCandidateBallotWire({
            best: 999,
            reason: 'the ninth one, whichever that was',
          },),
        ).toBe(true,);
      },
    },),

    it({
      name: 'accepts an empty reason, so a judge that ranked without '
        + 'explaining still casts a counted vote; the reason is recorded for '
        + 'audit rather than required for validity',
      fn: async () => {
        expect(
          isCandidateBallotWire({
            best: 1,
            reason: '',
          },),
        ).toBe(true,);
      },
    },),

    it({
      name: 'ignores extra keys the model volunteered, since a chatty ballot '
        + 'is still a usable one',
      fn: async () => {
        expect(
          isCandidateBallotWire({
            best: 2,
            reason: 'closer to the original',
            confidence: 0.8,
            runnerUp: 1,
          },),
        ).toBe(true,);
      },
    },),

    it({
      name: 'REFUSES a negative index, which is below the decline value and '
        + 'would index from the end of the slate rather than naming a '
        + 'candidate',
      fn: async () => {
        for (const best of [
          -1,
          -999,
        ])
          expect(
            isCandidateBallotWire({
              best,
              reason: 'the last one',
            },),
          ).toBe(false,);
      },
    },),

    it({
      name: 'refuses a fractional or non-finite index, which passes a bare '
        + 'typeof check while naming no candidate at all',
      fn: async () => {
        for (const best of [
          1.5,
          Number.NaN,
          Number.POSITIVE_INFINITY,
          Number.NEGATIVE_INFINITY,
        ])
          expect(
            isCandidateBallotWire({
              best,
              reason: 'somewhere around there',
            },),
          ).toBe(false,);
      },
    },),

    it({
      name: 'refuses a quoted index, the shape a model produces when it '
        + 'stringifies every field',
      fn: async () => {
        expect(
          isCandidateBallotWire({
            best: '1',
            reason: 'reads most naturally',
          },),
        ).toBe(false,);
      },
    },),

    it({
      name: 'refuses a missing or non-string reason, so a ballot cannot be '
        + 'counted without the audit trail the selection contract promises',
      fn: async () => {
        expect(isCandidateBallotWire({ best: 1, },),).toBe(false,);
        for (const reason of [
          null,
          7,
          [],
          { text: 'reads most naturally', },
        ])
          expect(
            isCandidateBallotWire({
              best: 1,
              reason,
            },),
          ).toBe(false,);
      },
    },),

    it({
      name: 'refuses a non-record entirely, including null, an array, and a '
        + 'bare number: a model that answered with just the index has not sent '
        + 'a ballot',
      fn: async () => {
        for (const value of [
          null,
          undefined,
          1,
          'candidate 1',
          [
            1,
            'reads most naturally',
          ],
        ])
          expect(isCandidateBallotWire(value,),).toBe(false,);
      },
    },),
  ],
},);
