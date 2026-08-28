/**
 * Tests for refusing archive blocks no source passage claims.
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
  assertArchiveReviewed,
  UnreviewedArchiveError,
} from '../../dist/final/node/index.mjs';

await describe({
  name: assertArchiveReviewed.name,
  children: [
    it({
      name: 'ACCEPTS preparation where every archive block belongs to source claim',
      fn: async () => {
        expect(assertArchiveReviewed({ entryId: 'Cat', blocks: [], },),).toBeUndefined();
      },
    },),
    it({
      name: 'REFUSES unclaimed archive blocks before they bypass every quality stage',
      fn: async () => {
        let thrown: unknown;
        try {
          assertArchiveReviewed({
            entryId: 'Cat',
            blocks: [{
              pairIndex: 1,
              blockId: 'block/3',
              startOffset: 10,
              endOffset: 30,
            },],
          },);
        }
        catch (error) {
          thrown = error;
        }

        expect(thrown,).toBeInstanceOf(UnreviewedArchiveError,);
        expect((thrown as UnreviewedArchiveError).entryId,).toBe('Cat');
        expect((thrown as UnreviewedArchiveError).blocks,).toHaveLength(1);
        expect((thrown as Error).message,).toContain('1/block/3');
      },
    },),
  ],
},);
