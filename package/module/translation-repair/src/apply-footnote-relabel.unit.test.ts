/**
 Tests for the simultaneous syntax-positioned footnote relabel rewrite.
 Fixtures are cat-themed invention mirroring corpus structure only.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { applyFootnoteRelabel, } from '../dist/final/node/index.mjs';

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: applyFootnoteRelabel.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'returns text unchanged when a self-rename finds no footnote markers in it at all',
          fn: async () => {
            const text = 'Cats nap all afternoon, holding no footnote markers at all.';
            expect(applyFootnoteRelabel({
              text,
              map: [{ from: 'whisker', to: 'whisker', },],
            },),).toBe(text,);
          },
        },),
      ],
    },),
  ],
},);
