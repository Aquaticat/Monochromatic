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
  isCandidateBallotAsSent,
  isCandidateBallotWire,
  readCandidateBallotWire,
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
      name: 'refuses a quoted index at the STRICT shape. The as-sent guard is '
        + 'where a canonical quoted index is admitted and read, so nothing '
        + 'downstream of this guard ever compares a string with an index',
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

await describe({
  name: isCandidateBallotAsSent.name,
  children: [
    it({
      name: 'admits everything the strict guard admits',
      fn: async () => {
        for (const best of [
          CANDIDATE_NONE,
          1,
          999,
        ])
          expect(
            isCandidateBallotAsSent({
              best,
              reason: 'a fine cat',
            },),
          ).toBe(true,);
      },
    },),

    it({
      name: 'admits a quoted canonical index, the shape deepseek-v4-flash-0731 '
        + 'sends about one select round in ten, a quoted decline included',
      fn: async () => {
        for (const best of [
          '0',
          '1',
          '8',
          '12',
        ])
          expect(
            isCandidateBallotAsSent({
              best,
              reason: 'the cat in the window',
            },),
          ).toBe(true,);
      },
    },),

    it({
      name: 'REFUSES every quoted shape that is not the canonical decimal text '
        + 'of a non-negative integer: signs, leading zeros, fractions, exponents, '
        + 'whitespace, hex, fullwidth digits, words and the empty string, each of '
        + 'which Number() or a looser scan would read as some index',
      fn: async () => {
        for (const best of [
          '-1',
          '+1',
          '08',
          '00',
          '1.0',
          '1e0',
          ' 1',
          '1 ',
          '1\n',
          '0x1',
          '１',
          '',
          'one',
        ])
          expect(
            isCandidateBallotAsSent({
              best,
              reason: 'somewhere around there',
            },),
          ).toBe(false,);
      },
    },),

    it({
      name: 'still refuses a missing or non-string reason and a non-record, '
        + 'since widening the index shape widens nothing else',
      fn: async () => {
        expect(isCandidateBallotAsSent({ best: '1', },),).toBe(false,);
        expect(
          isCandidateBallotAsSent({
            best: '1',
            reason: 7,
          },),
        ).toBe(false,);
        expect(isCandidateBallotAsSent(null,),).toBe(false,);
        expect(isCandidateBallotAsSent('1',),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: readCandidateBallotWire.name,
  children: [
    it({
      name: 'reads a quoted index as the number it spells, a quoted decline as '
        + 'the decline value, and leaves a numeric index alone, so selection '
        + 'compares numbers with numbers',
      fn: async () => {
        expect(
          readCandidateBallotWire({
            sent: {
              best: '8',
              reason: 'the eighth cat',
            },
          },),
        ).toStrictEqual({
          best: 8,
          reason: 'the eighth cat',
        },);
        expect(
          readCandidateBallotWire({
            sent: {
              best: '0',
              reason: 'no cat here',
            },
          },),
        ).toStrictEqual({
          best: CANDIDATE_NONE,
          reason: 'no cat here',
        },);
        expect(
          readCandidateBallotWire({
            sent: {
              best: 3,
              reason: 'the third cat',
            },
          },),
        ).toStrictEqual({
          best: 3,
          reason: 'the third cat',
        },);
      },
    },),
  ],
},);
