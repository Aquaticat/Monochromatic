/**
 Tests for the footnote floor on an archive block's revision (class
 eighty-four), read directly rather than through the review stage.

 LEDGER T8, EIGHTEENTH BATCH: a block the archive does not carry verbatim
 passed every revision without reading the page it would leave, a branch
 documented as kept for fixtures a caller composed. Production hands the
 floor an exact slice of the archive (`corpus-run/archive-block-repair.ts`),
 so such a block breaks the caller's contract, and the floor now refuses it
 rather than letting a revision past unread.

 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  caught,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { revisionFootnoteFindings, } from '../dist/final/node/index.mjs';

/**
 Archive page whose second block defines the note its first references.
 */
const ARCHIVE = 'The cat napped by the stove.[^1]\n\n[^1]: The stove in the kitchen.\n';

await describe({
  name: revisionFootnoteFindings.name,
  children: [
    it({
      name: 'REFUSES a block the archive does not carry, which once passed every revision without reading the '
        + 'page it would leave',
      fn: async () => {
        /**
         What the floor threw for a block no page carries.
         */
        const refusal = caught(function readsComposedBlock(): unknown {
          return revisionFootnoteFindings({
            modelId: 'hf:cat/Cat-A',
            blockText: '[^1]: The stove in the hall.',
            replacementText: '',
            targetText: ARCHIVE,
          },);
        },);
        expect(refusal,).toBeInstanceOf(Error,);
        expect({
          name: (refusal as Error).name,
          message: (refusal as Error).message,
        },).toEqual({
          name: 'BlockOutsideArchiveError',
          message: 'the archive block under review is not in the archive it was read from, so the page its '
            + 'revision would leave cannot be built and its footnotes cannot be checked',
        },);
      },
    },),
    it({
      name: 'READS the page a revision of a block the archive carries would leave, finding nothing where the '
        + 'notes still pair',
      fn: async () => {
        expect(revisionFootnoteFindings({
          modelId: 'hf:cat/Cat-A',
          blockText: '[^1]: The stove in the kitchen.',
          replacementText: '[^1]: The kitchen stove.',
          targetText: ARCHIVE,
        },),).toEqual([],);
      },
    },),
  ],
},);
