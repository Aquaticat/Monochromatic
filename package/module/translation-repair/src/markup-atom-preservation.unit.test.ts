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
  settleMarkupMoves,
  type MarkupDelta,
} from '../dist/final/node/index.mjs';

await describe({
  name: settleMarkupMoves.name,
  children: [
    it({
      name: 'KEEPS an edit whose losses a standing sibling writes, since one written atom excuses one '
        + 'loss',
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
      name: 'REFUSES both edits when two lose the same key and none writes it, since nothing says which '
        + 'loss the other answered',
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
      name: 'KEEPS an edit that loses nothing and one whose loss it writes itself', fn: async () => {
        expect(settleMarkupMoves({
          deltas: [{
            unexcused: [{ kind: 'inline-code', value: '`c`', },],
            gained: [{ kind: 'inline-code', value: '`c`', },],
          },],
        },),).toEqual([[]],);
      },
    },),
  ],
},);
