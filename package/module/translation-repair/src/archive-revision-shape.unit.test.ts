/**
 Tests for the shape floor on an archive block's revision (class
 seventy-seven), read directly rather than through the review stage.

 LEDGER T8, EIGHTEENTH BATCH: no case gave the floor an archive block the
 slice grammar refuses, nor a revision it refuses. Writing them found the
 refusals saying "the block is paragraph", a list of shapes where a count
 belongs; they now count each side's blocks as the translate lanes' block
 floor does ("1 block (paragraph)").

 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { revisionShapeFindings, } from '../dist/final/node/index.mjs';

/**
 A box component opened and never closed, which the slice grammar refuses.
 */
const UNCLOSED = '<CatBox an unclosed box\n\nThe cat naps.';

/**
 Archive block of one paragraph.
 */
const PARAGRAPH = 'The cat naps by the stove.';

/**
 Reviewer named in every refusal.
 */
const REVIEWER = 'hf:cat/Cat-A';

await describe({
  name: revisionShapeFindings.name,
  children: [
    it({
      name: 'PASSES any revision of an archive block the slice grammar cannot read, which has no shape to hold one to',
      fn: async () => {
        expect(revisionShapeFindings({
          modelId: REVIEWER,
          blockText: UNCLOSED,
          replacementText: PARAGRAPH,
        },),).toEqual([],);
      },
    },),
    it({
      name: 'WITHHOLDS a revision the slice grammar cannot read, carrying the parser\'s account and counting the '
        + 'block\'s blocks',
      fn: async () => {
        expect(revisionShapeFindings({
          modelId: REVIEWER,
          blockText: PARAGRAPH,
          replacementText: UNCLOSED,
        },),).toEqual([
          `archive-revision-refused (${REVIEWER}): the revision does not parse (MdxParseError: MDX body refused to `
            + 'parse at 3:13 (micromark-extension-mdx-jsx/unexpected-character); corpus documents compile as MDX '
            + 'upstream, so failure signals corruption or an unsupported construct.); the block is 1 block '
            + '(paragraph)',
        ],);
      },
    },),
    it({
      name: 'WITHHOLDS a revision of another shape, counting each side\'s blocks, and passes a removal and a '
        + 'revision of the same shape',
      fn: async () => {
        expect(revisionShapeFindings({
          modelId: REVIEWER,
          blockText: PARAGRAPH,
          replacementText: 'The cat naps.\n\nShe dreams of fish.',
        },),).toEqual([
          `archive-revision-refused (${REVIEWER}): the block is 1 block (paragraph) and the revision is 2 blocks `
            + '(paragraph, paragraph); a revision keeps the block\'s own shape',
        ],);
        expect([
          revisionShapeFindings({
            modelId: REVIEWER,
            blockText: PARAGRAPH,
            replacementText: '',
          },),
          revisionShapeFindings({
            modelId: REVIEWER,
            blockText: PARAGRAPH,
            replacementText: 'The cat dozes by the stove.',
          },),
        ],).toEqual([
          [],
          [],
        ],);
      },
    },),
  ],
},);
