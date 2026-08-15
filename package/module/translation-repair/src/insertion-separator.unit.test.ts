/**
 * Tests for the whitespace assembly owns around an insertion.
 *
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  composeInsertion,
  documentLineEnding,
  fragmentBody,
  makeInsertionChunk,
  spliceSlices,
} from '../dist/final/node/index.mjs';

await describe({
  name: fragmentBody.name,
  children: [
    it({
      name: 'strips the blank lines around a fragment and keeps its INDENTATION, because a rendering '
        + 'that begins with spaces is inside a list or a quote and cutting them moves it out of the '
        + 'structure it belongs to',
      fn: async () => {
        expect(fragmentBody({ fragment: '\n\n  The cat naps.\n\n', },),).toBe('  The cat naps.',);
        expect(fragmentBody({ fragment: 'The cat naps.', },),).toBe('The cat naps.',);
        expect(fragmentBody({ fragment: '   \n\nThe cat naps.', },),).toBe('The cat naps.',);
        expect(fragmentBody({ fragment: '\n\n\n', },),).toBe('',);
        // TRAILING SPACES GO, including the two that make a Markdown hard
        // break. Safe only because composition joins fragments with a blank
        // line, where a hard break breaks nothing; a join that ever put two
        // fragments on consecutive lines would make this case wrong.
        expect(fragmentBody({ fragment: 'The cat naps.  \n', },),).toBe('The cat naps.',);
        // Inside the fragment the same two spaces survive, since only the ends
        // are touched.
        expect(fragmentBody({ fragment: 'The cat naps.  \nShe purrs.\n', },),)
          .toBe('The cat naps.  \nShe purrs.',);
      },
    },),
    it({
      name: 'keeps the blank line INSIDE a fragment, since a rendering of two paragraphs is two blocks '
        + 'and joining them would make one',
      fn: async () => {
        expect(fragmentBody({ fragment: '\nThe cat naps.\n\nShe purrs.\n', },),)
          .toBe('The cat naps.\n\nShe purrs.',);
      },
    },),
  ],
},);

await describe({
  name: documentLineEnding.name,
  children: [
    it({
      name: 'reads the ending the DOCUMENT uses rather than the platform`s, so a translation written on '
        + 'Windows does not come back with two conventions in it and a diff naming lines nobody touched',
      fn: async () => {
        expect(documentLineEnding({ targetText: 'The cat sleeps.\r\n\r\nShe purrs.\r\n', },),).toBe('\r\n',);
        expect(documentLineEnding({ targetText: 'The cat sleeps.\n', },),).toBe('\n',);
        expect(documentLineEnding({ targetText: '', },),).toBe('\n',);
      },
    },),
  ],
},);

await describe({
  name: composeInsertion.name,
  children: [
    it({
      name: 'ADDS the separator an insertion needs and no more: a boundary that already carries a blank '
        + 'line keeps exactly that, and one that carries none is topped up. Existing whitespace is the '
        + 'archive`s, and this only ever adds',
      fn: async () => {
        expect(composeInsertion({
          fragments: ['The cat naps.',],
          before: 'The cat sleeps.\n\n',
          after: 'She purrs.\n',
          eol: '\n',
        },),).toBe('The cat naps.\n\n',);
        expect(composeInsertion({
          fragments: ['The cat naps.',],
          before: 'The cat sleeps.',
          after: 'She purrs.',
          eol: '\n',
        },),).toBe('\n\nThe cat naps.\n\n',);
      },
    },),
    it({
      name: 'writes ONE blank line between fragments sharing a boundary, not one per fragment. Several '
        + 'slices of an untranslated section land here, and each carrying its own separators would put '
        + 'two blank lines between every pair',
      fn: async () => {
        expect(composeInsertion({
          fragments: [
            '\nThe cat naps.\n\n',
            '\n\nShe purrs.\n',
          ],
          before: 'The cat sleeps.\n\n',
          after: 'She wakes.\n',
          eol: '\n',
        },),).toBe('The cat naps.\n\nShe purrs.\n\n',);
      },
    },),
    it({
      name: 'terminates the FILE rather than separating two blocks when the boundary is the end of the '
        + 'document, since there is nothing after it to be separated from and a text file ends with one '
        + 'line ending',
      fn: async () => {
        expect(composeInsertion({
          fragments: ['She sleeps again.',],
          before: 'The cat sleeps.\n',
          after: '',
          eol: '\n',
        },),).toBe('\nShe sleeps again.\n',);
      },
    },),
    it({
      name: 'writes the document`s own line ending, so an insertion into a Windows translation carries '
        + 'the convention the rest of the file uses',
      fn: async () => {
        expect(composeInsertion({
          fragments: ['The cat naps.',],
          before: 'The cat sleeps.',
          after: 'She purrs.',
          eol: '\r\n',
        },),).toBe('\r\n\r\nThe cat naps.\r\n\r\n',);
      },
    },),
    it({
      name: 'writes NOTHING for fragments that say nothing, which keeps an empty group from opening a '
        + 'blank line at a boundary nobody wrote to',
      fn: async () => {
        expect(composeInsertion({
          fragments: [
            '',
            '\n\n',
          ],
          before: 'The cat sleeps.',
          after: 'She purrs.',
          eol: '\n',
        },),).toBe('',);
      },
    },),
  ],
},);

await describe({
  name: `${spliceSlices.name} separators`,
  children: [
    it({
      name: 'writes an insertion BEFORE a heading without running into it, which is the defect this '
        + 'exists for: a rendering written verbatim at that boundary produces a line that still parses '
        + 'as Markdown and says something else',
      fn: async () => {
        /** Archive whose second section is where the insertion goes. */
        const targetText = `## Intro

The cat sleeps.

## Habits

She purrs.
`;

        /** Boundary just before the second heading. */
        const offset = targetText.indexOf('## Habits',);
        expect(spliceSlices({
          targetText,
          slices: [
            {
              source: {
                chunkIndex: 0,
                nodes: [],
                startOffset: 0,
                endOffset: 0,
                text: '## 白天\n\n猫猫晒太阳。',
              },
              target: makeInsertionChunk({
                chunkIndex: 0,
                offset,
              },),
            },
          ],
          replacements: [
            {
              chunkIndex: 0,
              replacementText: '## Daytime\n\nThe cat suns herself.',
            },
          ],
        },),).toBe(`## Intro

The cat sleeps.

## Daytime

The cat suns herself.

## Habits

She purrs.
`,);
      },
    },),
    it({
      name: 'separates an anchor from the span it sits at the END of, even though that span is itself '
        + 'replaced: composition reads the document as it stands when the anchor is written, and the '
        + 'replacement lands afterwards',
      fn: async () => {
        /** Archive whose first paragraph is rewritten and followed by an insertion. */
        const targetText = `## Intro

The cat sleeps.

## Habits

She purrs.
`;

        /** Where the paragraph being replaced begins. */
        const startOffset = targetText.indexOf('The cat sleeps.',);

        /** Where it ends, which is also the boundary the anchor names. */
        const endOffset = startOffset + 'The cat sleeps.'.length;
        expect(spliceSlices({
          targetText,
          slices: [
            {
              source: {
                chunkIndex: 0,
                nodes: [],
                startOffset: 0,
                endOffset: 0,
                text: '猫猫睡着了。',
              },
              target: {
                chunkIndex: 0,
                nodes: [],
                startOffset,
                endOffset,
                text: 'The cat sleeps.',
              },
            },
            {
              source: {
                chunkIndex: 1,
                nodes: [],
                startOffset: 0,
                endOffset: 0,
                text: '她伸了个懒腰。',
              },
              target: makeInsertionChunk({
                chunkIndex: 1,
                offset: endOffset,
              },),
            },
          ],
          replacements: [
            {
              chunkIndex: 0,
              replacementText: 'The cat dozes.',
            },
            {
              chunkIndex: 1,
              replacementText: 'She stretches.',
            },
          ],
        },),).toBe(`## Intro

The cat dozes.

She stretches.

## Habits

She purrs.
`,);
      },
    },),
  ],
},);
