/**
 * Tests for the shape guards every artifact reader shares.
 *
 * These matter more than their size suggests. They stand at the mouth of the
 * precision measurement: each one is the difference between a malformed
 * artifact aborting loudly and an accepted issue vanishing from the
 * denominator without a trace. So the cases below are mostly about what the
 * guards REFUSE, not what they pass.
 *
 * Fixtures are cat-themed invention mirroring artifact structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  ArtifactParseError,
  requireArray,
  requireBoolean,
  requireCount,
  requireRecord,
  requireString,
} from '../dist/final/node/index.mjs';

/**
 * Path threaded through every case, so a failure names where it happened the
 * way a real parse would.
 */
const PATH = 'Mittens issues[2].issue.status';

await describe({
  name: ArtifactParseError.name,
  children: [
    it({
      name: 'names both the path and the expected shape, since a parse failure '
        + 'deep in an artifact is unactionable without them',
      fn: async () => {
        /**
         * Failure built directly, standing in for one a guard would throw.
         */
        const error = new ArtifactParseError({
          path: PATH,
          reason: 'a string',
        },);

        expect(error.message,).toBe(
          `artifact parse failed at ${PATH}: expected a string.`,
        );
        expect(error.name,).toBe('ArtifactParseError',);
      },
    },),
  ],
},);

await describe({
  name: requireString.name,
  children: [
    it({
      name: 'returns a string unchanged, including the empty one, which is a '
        + 'valid value and not a missing field',
      fn: async () => {
        expect(requireString({
          value: 'accepted',
          path: PATH,
        },),).toBe('accepted',);
        expect(requireString({
          value: '',
          path: PATH,
        },),).toBe('',);
      },
    },),

    it({
      name: 'refuses every non-string, notably a number that would otherwise '
        + 'stringify into a plausible-looking identifier',
      fn: async () => {
        for (const value of [
          7,
          true,
          null,
          undefined,
          {},
          ['accepted',],
        ])
          expect(function readString() {
            requireString({
              value,
              path: PATH,
            },);
          },).toThrow(ArtifactParseError,);
      },
    },),
  ],
},);

await describe({
  name: requireBoolean.name,
  children: [
    it({
      name: 'returns both booleans unchanged, so false is a value rather than '
        + 'an absence',
      fn: async () => {
        expect(requireBoolean({
          value: false,
          path: PATH,
        },),).toBe(false,);
        expect(requireBoolean({
          value: true,
          path: PATH,
        },),).toBe(true,);
      },
    },),

    it({
      name: 'refuses the falsy and truthy look-alikes a JSON writer might emit '
        + 'in a boolean field',
      fn: async () => {
        for (const value of [
          0,
          1,
          'true',
          '',
          null,
          undefined,
        ])
          expect(function readBoolean() {
            requireBoolean({
              value,
              path: PATH,
            },);
          },).toThrow(ArtifactParseError,);
      },
    },),
  ],
},);

await describe({
  name: requireRecord.name,
  children: [
    it({
      name: 'returns an object unchanged, empty included',
      fn: async () => {
        /**
         * Record standing in for one issue of an artifact.
         */
        const issue = { status: 'accepted', };

        expect(requireRecord({
          value: issue,
          path: PATH,
        },),).toBe(issue,);
        expect(requireRecord({
          value: {},
          path: PATH,
        },),).toStrictEqual({},);
      },
    },),

    it({
      name: 'REFUSES an array, which `isJsonRecord` alone would admit: an array '
        + 'reaching a record reader returns an object whose every named field '
        + 'is undefined, so the real shape error would resurface later as a '
        + 'complaint about a missing property',
      fn: async () => {
        expect(function readArrayAsRecord() {
          requireRecord({
            value: [{ status: 'accepted', },],
            path: PATH,
          },);
        },).toThrow(ArtifactParseError,);
        expect(function readEmptyArrayAsRecord() {
          requireRecord({
            value: [],
            path: PATH,
          },);
        },).toThrow(ArtifactParseError,);
      },
    },),

    it({
      name: 'refuses null, which is typeof object and is exactly the value a '
        + 'dropped field arrives as',
      fn: async () => {
        for (const value of [
          null,
          undefined,
          'accepted',
          7,
          false,
        ])
          expect(function readRecord() {
            requireRecord({
              value,
              path: PATH,
            },);
          },).toThrow(ArtifactParseError,);
      },
    },),
  ],
},);

await describe({
  name: requireArray.name,
  children: [
    it({
      name: 'returns an array unchanged, empty included, since no spans is a '
        + 'real answer and not a malformed one',
      fn: async () => {
        /**
         * Array standing in for the spans of a claim.
         */
        const spans = [{ quotedText: '猫猫', },];

        expect(requireArray({
          value: spans,
          path: PATH,
        },),).toBe(spans,);
        expect(requireArray({
          value: [],
          path: PATH,
        },),).toStrictEqual([],);
      },
    },),

    it({
      name: 'refuses an object, so a writer that emitted a keyed map where a '
        + 'list belongs cannot pass silently',
      fn: async () => {
        for (const value of [
          { 0: 'first', },
          'spans',
          null,
          undefined,
          3,
        ])
          expect(function readArray() {
            requireArray({
              value,
              path: PATH,
            },);
          },).toThrow(ArtifactParseError,);
      },
    },),
  ],
},);

await describe({
  name: requireCount.name,
  children: [
    it({
      name: 'returns zero and positive integers, because zero heard probers is '
        + 'a reading rather than a missing one',
      fn: async () => {
        expect(requireCount({
          value: 0,
          path: PATH,
        },),).toBe(0,);
        expect(requireCount({
          value: 6,
          path: PATH,
        },),).toBe(6,);
      },
    },),

    it({
      name: 'separates the two refusals by message: a non-number is reported as '
        + 'expecting a number, while a number of the wrong kind is reported as '
        + 'expecting a non-negative integer, so the diagnostic says which '
        + 'disagreement occurred',
      fn: async () => {
        expect(function readStringAsCount() {
          requireCount({
            value: '6',
            path: PATH,
          },);
        },).toThrow('expected a number',);

        expect(function readFractionAsCount() {
          requireCount({
            value: 2.7,
            path: PATH,
          },);
        },).toThrow('expected a non-negative integer',);
      },
    },),

    it({
      name: 'refuses a fraction, which is the shape that would mean the writer '
        + 'and reader disagree about what the field holds; every count here '
        + 'tallies votes or regions and cannot be partial',
      fn: async () => {
        for (const value of [
          2.7,
          0.5,
          -1,
          -0.5,
          Number.NaN,
          Number.POSITIVE_INFINITY,
        ])
          expect(function readCount() {
            requireCount({
              value,
              path: PATH,
            },);
          },).toThrow(ArtifactParseError,);
      },
    },),

    it({
      name: 'refuses every non-number, including the numeric string a JSON '
        + 'writer produces when a field was quoted by mistake',
      fn: async () => {
        for (const value of [
          '6',
          null,
          undefined,
          true,
          {},
          [6,],
        ])
          expect(function readCount() {
            requireCount({
              value,
              path: PATH,
            },);
          },).toThrow(ArtifactParseError,);
      },
    },),
  ],
},);
