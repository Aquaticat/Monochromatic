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
        expect(strictRefusalOffset({ text: WHOLE, },),).toEqual({ refused: false, },);
      },
    },),
    it({
      name: 'NAMES THE OFFSET OF THE FIRST REFUSAL, on the line and column the grammar reports',
      fn: async () => {
        /**
         Where the refusal is read.
         */
        const reading = strictRefusalOffset({ text: BROKEN, },);
        expect(reading.refused,).toBe(true,);
        if (!reading.refused)
          throw new Error('refused by the assertion above',);
        expect(reading.offset,).toBeGreaterThanOrEqual(BROKEN.indexOf('A bird',),);
        expect(reading.offset,).toBeLessThanOrEqual(BROKEN.length,);
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
        if ((!bare.refused) || (!withFence.refused))
          throw new Error('both documents carry the break',);
        expect(withFence.offset - bare.offset,).toBe(fenced.length - BROKEN.length,);
      },
    },),
  ],
},);
