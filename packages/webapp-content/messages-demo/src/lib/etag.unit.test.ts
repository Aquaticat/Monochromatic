import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

import {
  etagForChunk,
  etagForFeed,
  matches,
} from './etag.ts';

await describe({
  name: '',
  children: [
    describe({
      name: etagForChunk.name,
      children: [
        it({
          name: 'shape is "r<rev>-<idx>" (quoted, strong)',
          fn: async () => {
            expect(etagForChunk({
              revision: 3,
              chunkIndex: 7,
            },),)
              .toBe('"r3-7"',);
          },
        },),

        it({
          name: 'never has weak prefix',
          fn: async () => {
            const etag = etagForChunk({
              revision: 1,
              chunkIndex: 0,
            },);
            expect(etag.startsWith('W/',),).toBe(false,);
          },
        },),

        it({
          name: 'unique tag per (revision, chunkIndex) pair',
          fn: async () => {
            expect(etagForChunk({
              revision: 1,
              chunkIndex: 2,
            },),)
              .not
              .toBe(etagForChunk({
                revision: 2,
                chunkIndex: 1,
              },),);
          },
        },),
      ],
    },),

    describe({
      name: etagForFeed.name,
      children: [
        it({
          name: 'shape is "f<maxId>-<maxUpdatedAt>"',
          fn: async () => {
            expect(etagForFeed({
              maxId: 1_042,
              maxUpdatedAt: 1_714_080_000_000,
            },),)
              .toBe('"f1042-1714080000000"',);
          },
        },),

        it({
          name: 'empty corpus tag is "f0-0"',
          fn: async () => {
            expect(etagForFeed({
              maxId: 0,
              maxUpdatedAt: 0,
            },),)
              .toBe('"f0-0"',);
          },
        },),
      ],
    },),

    describe({
      name: matches.name,
      children: [
        it({
          name: 'returns true on byte-exact single-tag match',
          fn: async () => {
            const etag = etagForChunk({
              revision: 3,
              chunkIndex: 7,
            },);
            expect(matches(
              etag,
              etag,
            ),)
              .toBe(true,);
          },
        },),

        it({
          name: 'returns false when ifNoneMatch is null',
          fn: async () => {
            expect(matches(
              null,
              '"r3-7"',
            ),)
              .toBe(false,);
          },
        },),

        it({
          name: 'returns false when ifNoneMatch is undefined',
          fn: async () => {
            expect(matches(
              undefined,
              '"r3-7"',
            ),)
              .toBe(false,);
          },
        },),

        it({
          name: 'returns false on differing tag',
          fn: async () => {
            expect(matches(
              '"r2-7"',
              '"r3-7"',
            ),)
              .toBe(false,);
          },
        },),

        it({
          name: 'matches one entry inside a comma-separated list',
          fn: async () => {
            expect(matches(
              '"r1-0", "r2-0", "r3-7"',
              '"r3-7"',
            ),)
              .toBe(true,);
          },
        },),

        it({
          name: 'comma list with no match returns false',
          fn: async () => {
            expect(matches(
              '"r1-0", "r2-0"',
              '"r3-7"',
            ),)
              .toBe(false,);
          },
        },),

        it({
          name: 'weak tag does not byte-match a strong tag',
          fn: async () => {
            expect(matches(
              'W/"r3-7"',
              '"r3-7"',
            ),)
              .toBe(false,);
          },
        },),
      ],
    },),
  ],
},);
