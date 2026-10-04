/**
 Tests for the settlement that refuses edits losing markup no sibling writes.
 Fixtures are cat-themed invention mirroring corpus structure only.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  markupDelta,
  markupSourceKeys,
  settleMarkupMoves,
  type MarkupDelta,
} from '../dist/final/node/index.mjs';

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: settleMarkupMoves.name,
      children: [
        it({
          name: 'KEEPS an edit whose losses a standing sibling writes, since one written atom excuses '
            + 'one loss',
          fn: async () => {
            /**
             One edit losing the tag its sibling writes.
             */
            const deltas: readonly MarkupDelta[] = [
              {
                unexcused: [{ kind: 'tag', value: '<br />', },],
                gained: [],
              },
              {
                unexcused: [],
                gained: [{ kind: 'tag', value: '<br />', },],
              },
            ];
            expect(settleMarkupMoves({ deltas, },),).toEqual([[], []],);
          },
        },),

        it({
          name: 'REFUSES both edits when two lose the same key and none writes it, since nothing says '
            + 'which loss the other answered',
          fn: async () => {
            /**
             Two edits losing the same tag.
             */
            const deltas: readonly MarkupDelta[] = [
              {
                unexcused: [{ kind: 'tag', value: '<br />', },],
                gained: [],
              },
              {
                unexcused: [{ kind: 'tag', value: '<br />', },],
                gained: [],
              },
            ];
            expect(settleMarkupMoves({ deltas, },),).toEqual([['tag'], ['tag']],);
          },
        },),

        it({
          name: 'KEEPS an edit whose loss it writes itself',
          fn: async () => {
            expect(settleMarkupMoves({
              deltas: [{
                unexcused: [{ kind: 'inline-code', value: '`c`', },],
                gained: [{ kind: 'inline-code', value: '`c`', },],
              },],
            },),).toEqual([[]],);
          },
        },),
      ],
    },),

    describe({
      name: markupSourceKeys.name,
      children: [
        it({
          name: 'READS the keys of the atoms a source text carries',
          fn: async () => {
            /**
             Keys of the source's one tag and one code span.
             */
            const keys = [...markupSourceKeys({ sourceText: 'a `c` <br />', },),];
            expect(keys.length,).toBe(2,);
            expect(keys.some(function namesCode(key,) {
              return key.includes('`c`',);
            },),).toBe(true,);
            expect(keys.some(function namesTag(key,) {
              return key.includes('<br />',);
            },),).toBe(true,);
          },
        },),
      ],
    },),

    describe({
      name: markupDelta.name,
      children: [
        it({
          name: 'READS a loss nothing excuses as unexcused and a write nothing consumes as gained',
          fn: async () => {
            expect(markupDelta({
              before: '<br />',
              after: '',
              removableQuotes: [],
              sourceKeys: new Set<string>(),
            },),).toEqual({
              unexcused: [{ kind: 'tag', value: '<br />', },],
              gained: [],
            },);
            expect(markupDelta({
              before: '',
              after: '<br />',
              removableQuotes: [],
              sourceKeys: new Set<string>(),
            },),).toEqual({
              unexcused: [],
              gained: [{ kind: 'tag', value: '<br />', },],
            },);
          },
        },),

        it({
          name: 'PAIRS a loss with the same-kind write that re-marks it, both sides leaving the delta',
          fn: async () => {
            expect(markupDelta({
              before: '<br />',
              after: '<x />',
              removableQuotes: [],
              sourceKeys: new Set<string>(),
            },),).toEqual({
              unexcused: [],
              gained: [],
            },);
          },
        },),

        it({
          name: 'LET GO a loss the envelope\'s removable quote carries, since the claim may take it',
          fn: async () => {
            expect(markupDelta({
              before: '<br />',
              after: '',
              removableQuotes: ['<br />',],
              sourceKeys: new Set<string>(),
            },),).toEqual({
              unexcused: [],
              gained: [],
            },);
          },
        },),

        it({
          name: 'HOLDS a loss the source itself carries as unexcused however the edit writes, since the '
            + 'markup was copied rather than authored',
          fn: async () => {
            expect(markupDelta({
              before: '<br />',
              after: '<x />',
              removableQuotes: [],
              sourceKeys: markupSourceKeys({ sourceText: '<br />', },),
            },),).toEqual({
              unexcused: [{ kind: 'tag', value: '<br />', },],
              gained: [{ kind: 'tag', value: '<x />', },],
            },);
          },
        },),

        it({
          name: 'PAIRS a loss with a write the source carries of another kind, where no same-kind write '
            + 'stands beside it',
          fn: async () => {
            expect(markupDelta({
              before: '`c`',
              after: '<br />',
              removableQuotes: [],
              sourceKeys: markupSourceKeys({ sourceText: '<br />', },),
            },),).toEqual({
              unexcused: [],
              gained: [],
            },);
          },
        },),
      ],
    },),
  ],
},);
