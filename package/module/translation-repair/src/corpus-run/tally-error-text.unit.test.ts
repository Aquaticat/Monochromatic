/**
 * Tests for the capped failure text a pass prints.
 *
 * WHAT THESE PIN: a class that may be quoted is quoted up to the cap and no
 * further, and a class that may not be quoted is named, which is the refusal
 * rule `#237` closed on.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  StatedRefusalError,
  TALLY_ERROR_CAP,
  tallyErrorText,
} from '../../dist/final/node/index.mjs';

await describe({
  name: tallyErrorText.name,
  children: [
    it({
      name: 'quotes a stated refusal and caps it at the line budget',
      fn: async () => {
        /**
         * Refusal longer than any line should carry.
         */
        const error = new StatedRefusalError({ says: 'x'.repeat(TALLY_ERROR_CAP * 2,), },);

        expect(tallyErrorText({ error, },),).toHaveLength(TALLY_ERROR_CAP,);
      },
    },),

    it({
      name: 'names a plain error instead of quoting its message',
      fn: async () => {
        /**
         * Error whose message must not reach stdout.
         */
        const error = new Error('the archive said something here',);

        /**
         * What the line would carry.
         */
        const text = tallyErrorText({ error, },);

        expect(text,).not.toContain('archive',);
        expect(text,).toContain('Error',);
      },
    },),
  ],
},);
