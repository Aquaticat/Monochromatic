/**
 Tests the reader that says where the strict grammar first refused a
 document, which the assembly guard blames a structural break by (class
 fifty-eight). Cat-themed invention throughout.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { strictRefusalOffset, } from '../dist/final/node/index.mjs';

/**
 Document the strict grammar accepts.
 */
const WHOLE = '## The cat\n\nThe cat naps on the windowsill[^1].\n\n[^1]: Its favourite spot.\n';

/**
 Document with an expression that never closes, on its second paragraph.
 */
const BROKEN = '## The cat\n\nThe cat naps on the windowsill.\n\nA bird sits there too. {\'unclosed\n';

await describe({
  name: strictRefusalOffset.name,
  children: [
    it({
      name: 'ANSWERS NOTHING for a document the strict grammar accepts',
      fn: async () => {
        expect(strictRefusalOffset({ text: WHOLE, },),).toBeUndefined();
      },
    },),
    it({
      name: 'NAMES THE OFFSET OF THE FIRST REFUSAL, on the line and column the grammar reports',
      fn: async () => {
        /**
         Where the refusal is read.
         */
        const offset = strictRefusalOffset({ text: BROKEN, },);
        expect(offset,).toBeDefined();
        if (offset === undefined)
          throw new Error('defined by the assertion above',);
        expect(offset,).toBeGreaterThanOrEqual(BROKEN.indexOf('A bird',),);
        expect(offset,).toBeLessThanOrEqual(BROKEN.length,);
      },
    },),
    it({
      name: 'COUNTS THE FRONT MATTER into the offset, so the number indexes the whole text',
      fn: async () => {
        /**
         Same break behind a front matter block.
         */
        const fenced = `---\nname: cat\n---\n\n${BROKEN}`;
        /**
         Offsets with and without the fence.
         */
        const bare = strictRefusalOffset({ text: BROKEN, },);
        const withFence = strictRefusalOffset({ text: fenced, },);
        if ((bare === undefined) || (withFence === undefined))
          throw new Error('both documents carry the break',);
        expect(withFence - bare,).toBe(fenced.length - BROKEN.length,);
      },
    },),
  ],
},);
