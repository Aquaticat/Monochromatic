/**
 * Tests for the one check a slice record can be held to on its own.
 *
 * Both lanes store a decided text beside a boolean saying whether it differs
 * from the archive's, and nothing but this compares them. From a CACHE a
 * contradiction is not a model failure: it is a file, and files get truncated,
 * hand-edited, and written under a slicing that has since moved. From a STAGE
 * it is a derivation reading something other than the text, and the two want
 * opposite answers: discard the file, refuse the stage.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  assertSettledRecordAgrees,
  resumedSliceDiscardFinding,
  SliceRecordContradictionError,
  sliceRecordAgrees,
} from '../dist/final/node/index.mjs';

/**
 * Archive wording every case compares against.
 */
const ARCHIVE = 'The cat is doing the sleeping on the windowsill.';

/**
 * Wording a lane might decide instead.
 */
const DECIDED = 'The cat naps on the windowsill.';

await describe({
  name: sliceRecordAgrees.name,
  children: [
    it({
      name: 'accepts both agreeing records: one that claims a change and carries different '
        + 'wording, and one that claims none and carries the archive`s',
      fn: async () => {
        expect(sliceRecordAgrees({
          changed: true,
          decidedText: DECIDED,
          incumbentText: ARCHIVE,
        },),).toBe(true,);
        expect(sliceRecordAgrees({
          changed: false,
          decidedText: ARCHIVE,
          incumbentText: ARCHIVE,
        },),).toBe(true,);
      },
    },),
    it({
      name: 'REFUSES a record claiming a change it did not make, which is the direction that '
        + 'reaches the shipped set: the count settles into the artifact and is wrong wherever '
        + 'it is read afterwards',
      fn: async () => {
        expect(sliceRecordAgrees({
          changed: true,
          decidedText: ARCHIVE,
          incumbentText: ARCHIVE,
        },),).toBe(false,);
      },
    },),
    it({
      name: 'REFUSES a record denying a change it DID make, which is the quieter of the two: '
        + 'only changed records become replacements, so this one`s wording is dropped at '
        + 'assembly with nothing said about it',
      fn: async () => {
        expect(sliceRecordAgrees({
          changed: false,
          decidedText: DECIDED,
          incumbentText: ARCHIVE,
        },),).toBe(false,);
      },
    },),
    it({
      name: 'reads an EMPTY decided text as a change when the archive was not empty, since a '
        + 'lane deleting a passage decided something rather than nothing',
      fn: async () => {
        expect(sliceRecordAgrees({
          changed: true,
          decidedText: '',
          incumbentText: ARCHIVE,
        },),).toBe(true,);
        expect(sliceRecordAgrees({
          changed: false,
          decidedText: '',
          incumbentText: '',
        },),).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: resumedSliceDiscardFinding.name,
  children: [
    it({
      name: 'names the lane, the slice, and WHICH WAY the record contradicted itself, since a '
        + 'record that over-claims and one that under-claims fail for different reasons and a '
        + 'reader counting recomputed slices needs to tell them apart',
      fn: async () => {
        /**
         * Finding for a record that claimed a change it did not make.
         */
        const overClaimed = resumedSliceDiscardFinding({
          lane: 'translate',
          chunkIndex: 4,
          changed: true,
        },);
        expect(overClaimed.startsWith('translate-discarded-contradictory-slice',),).toBe(true,);
        expect(overClaimed,).toContain('chunk 4',);
        expect(overClaimed,).toContain('archive wording',);

        /**
         * Finding for the other direction, on the other lane.
         */
        const underClaimed = resumedSliceDiscardFinding({
          lane: 'repair',
          chunkIndex: 0,
          changed: false,
        },);
        expect(underClaimed.startsWith('repair-discarded-contradictory-slice',),).toBe(true,);
        expect(underClaimed,).toContain('wording of a change',);
      },
    },),
  ],
},);

await describe({
  name: assertSettledRecordAgrees.name,
  children: [
    it({
      name: 'lets an agreeing record through, which is every record either lane settles today',
      fn: async () => {
        expect(function acceptAgreeing() {
          assertSettledRecordAgrees({
            lane: 'repair',
            chunkIndex: 0,
            changed: true,
            decidedText: DECIDED,
            incumbentText: ARCHIVE,
          },);
        },).not
          .toThrow();
      },
    },),
    it({
      name: 'REFUSES rather than discards, because a fresh record is what this run just decided: '
        + 'asking again would put the same question to the same code, and persisting it would '
        + 'write the contradiction into the cache for every later run to discard',
      fn: async () => {
        /**
         * Failure raised for a record claiming a change it did not make.
         */
        let overClaimed: unknown;
        try {
          assertSettledRecordAgrees({
            lane: 'repair',
            chunkIndex: 4,
            changed: true,
            decidedText: ARCHIVE,
            incumbentText: ARCHIVE,
          },);
        }
        catch (error) {
          overClaimed = error;
        }
        expect(overClaimed,).toBeInstanceOf(SliceRecordContradictionError,);
        expect(String(overClaimed,),).toContain('repair slice 4',);
        expect(String(overClaimed,),).toContain('archive wording',);

        /**
         * Failure raised for the quieter direction, on the other lane.
         */
        let underClaimed: unknown;
        try {
          assertSettledRecordAgrees({
            lane: 'translate',
            chunkIndex: 2,
            changed: false,
            decidedText: DECIDED,
            incumbentText: ARCHIVE,
          },);
        }
        catch (error) {
          underClaimed = error;
        }
        expect(underClaimed,).toBeInstanceOf(SliceRecordContradictionError,);
        expect(String(underClaimed,),).toContain('translate slice 2',);
        expect(String(underClaimed,),).toContain('wording of a change',);
      },
    },),
  ],
},);
