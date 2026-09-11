import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { scanGfmReferenceLiterals, } from '../dist/final/node/index.mjs';

await describe({
  name: scanGfmReferenceLiterals.name,
  children: [
    it({
      name: 'keeps escaped brackets inside labels while excluding escaped marker openings',
      fn: async () => {
        const text = 'Literal \\[^1], active \\\\[^2], escaped-label [^a\\]b].';
        expect(scanGfmReferenceLiterals({ slice: text })).toEqual([
          { identifier: '2', localOffset: text.indexOf('[^2]') },
          { identifier: 'a\\]b', localOffset: text.indexOf('[^a') },
        ]);
      },
    }),
    it({
      name: 'uses GFM whitespace boundaries without rejecting a caret inside a label',
      fn: async () => {
        const text = '[^one two] [^one\rbreak] [^valid^caret]';
        expect(scanGfmReferenceLiterals({ slice: text })).toEqual([
          { identifier: 'valid^caret', localOffset: text.indexOf('[^valid') },
        ]);
      },
    }),
  ],
});
