/**
 Tests for where a span of an English stands among its blocks, decided without a
 model: the body block a writer is given, and the kind of block (a table, a code
 block, a setext heading) no paragraph rewrite can carry words into.

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  blockHolding,
  blockStandingOf,
} from '../dist/final/node/index.mjs';

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: blockHolding.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'NAMES THE BODY BLOCK THAT HOLDS A SPAN WHOLE, with its offsets and its text',
          fn: async () => {
            const english = 'The cat naps.\n\nThe fish swims in the bowl.';
            expect([
              blockHolding({ english, start: 4, end: 7, },),
              blockHolding({ english, start: 19, end: 30, },),
              blockHolding({ english, start: 0, end: 13, },),
            ],).toEqual([
              [{ start: 0, end: 13, text: 'The cat naps.', },],
              [{ start: 15, end: 42, text: 'The fish swims in the bowl.', },],
              [{ start: 0, end: 13, text: 'The cat naps.', },],
            ],);
          },
        },),
        it({
          name: 'NAMES THE INNERMOST PARAGRAPH, not the container, for a span inside a list item, a block quote or a nested '
            + 'quote and list, with offsets in the English whole',
          fn: async () => {
            const list = '- The cat naps in the sun.\n- The fish swims.\n';
            const afterIntro = 'Intro here.\n\n- The cat naps in the sun.\n- The fish swims.\n';
            const nested = '> - The cat naps in the sun.\n';
            const quote = '> The cat naps in the sun.\n> It is warm.\n';
            const secondInItem = '- The cat naps.\n\n  The fish swims in the bowl.\n';
            expect([
              blockHolding({ english: list, start: list.indexOf('cat naps',), end: list.indexOf('cat naps',) + 8, },),
              blockHolding({
                english: afterIntro,
                start: afterIntro.indexOf('cat naps',),
                end: afterIntro.indexOf('cat naps',) + 8,
              },),
              blockHolding({ english: nested, start: nested.indexOf('cat naps',), end: nested.indexOf('cat naps',) + 8, },),
              blockHolding({ english: quote, start: quote.indexOf('cat naps',), end: quote.indexOf('cat naps',) + 8, },),
              blockHolding({
                english: secondInItem,
                start: secondInItem.indexOf('fish swims',),
                end: secondInItem.indexOf('fish swims',) + 10,
              },),
            ],).toEqual([
              [{ start: 2, end: 26, text: 'The cat naps in the sun.', },],
              [{ start: 15, end: 39, text: 'The cat naps in the sun.', },],
              [{ start: 4, end: 28, text: 'The cat naps in the sun.', },],
              [{ start: 2, end: 40, text: 'The cat naps in the sun.\n> It is warm.', },],
              [{ start: 19, end: 46, text: 'The fish swims in the bowl.', },],
            ],);
          },
        },),
        it({
          name: 'NAMES THE PARAGRAPH ALONE, WITHOUT THE CLOSING TAG, for a span in the content of a details container, whatever '
            + 'stands before it',
          fn: async () => {
            const details = '<details>\n<summary>Cats</summary>\n\nThe cat naps in the sun.\n\n</details>\n';
            const afterIntro = `Intro here.\n\n${details}`;
            expect([
              blockHolding({ english: details, start: 40, end: 48, },),
              blockHolding({ english: afterIntro, start: 53, end: 61, },),
            ],).toEqual([
              [{ start: 35, end: 59, text: 'The cat naps in the sun.', },],
              [{ start: 48, end: 72, text: 'The cat naps in the sun.', },],
            ],);
          },
        },),
        it({
          name: 'KEEPS THE OFFSETS OF AN ENGLISH THAT STARTS WITH A BYTE ORDER MARK, A FRONT MATTER OR WINDOWS LINE ENDS, naming '
            + 'the same innermost paragraph',
          fn: async () => {
            const bom = `${String.fromCodePoint(0xFE_FF,)}- The cat naps in the sun.\n`;
            const front = '---\ntitle: Mittens\n---\n\n- The cat naps in the sun.\n';
            const windows = '- The cat naps in the sun.\r\n- The fish swims.\r\n';
            expect([
              blockHolding({ english: bom, start: 8, end: 16, },),
              blockHolding({ english: front, start: 29, end: 37, },),
              blockHolding({ english: windows, start: 6, end: 14, },),
            ],).toEqual([
              [{ start: 3, end: 27, text: 'The cat naps in the sun.', },],
              [{ start: 26, end: 50, text: 'The cat naps in the sun.', },],
              [{ start: 2, end: 26, text: 'The cat naps in the sun.', },],
            ],);
          },
        },),
        it({
          name: 'NAMES THE HEADING LINE FOR A SPAN IN AN ATX HEADING, closing marks included, and the paragraph after a table',
          fn: async () => {
            const heading = '## The cat naps\n\nThe fish swims.\n';
            const closed = '## The cat naps ##\n\nThe fish swims.\n';
            const afterTable = '| a | b |\n| - | - |\n| cat | fish |\n\nThe fish swims.\n';
            expect([
              blockHolding({ english: heading, start: 7, end: 15, },),
              blockHolding({ english: closed, start: 7, end: 15, },),
              blockHolding({ english: afterTable, start: afterTable.indexOf('The fish',), end: afterTable.indexOf('The fish',) + 8, },),
            ],).toEqual([
              [{ start: 0, end: 15, text: '## The cat naps', },],
              [{ start: 0, end: 18, text: '## The cat naps ##', },],
              [{ start: 36, end: 51, text: 'The fish swims.', },],
            ],);
          },
        },),
        it({
          name: 'NAMES NO BLOCK FOR A SPAN IN A TABLE, A CODE BLOCK OR A SETEXT HEADING, wherever it stands, since no paragraph '
            + 'a writer could rewrite holds it',
          fn: async () => {
            /**
             The block of the first stand of a needle in an English.
             */
            function blockOfNeedle({ english, needle, }: { readonly english: string; readonly needle: string; },): unknown {
              return blockHolding({
                english,
                start: english.indexOf(needle,),
                end: english.indexOf(needle,) + needle.length,
              },);
            }
            expect([
              blockOfNeedle({ english: '| a | b |\n| - | - |\n| cat naps | x |\n', needle: 'cat naps', },),
              blockOfNeedle({ english: 'a | b\n--|--\ncat naps | x\n', needle: 'cat naps', },),
              blockOfNeedle({ english: '```\nthe cat naps\n```\n', needle: 'cat naps', },),
              blockOfNeedle({ english: '~~~\nthe cat naps\n~~~\n\nAfter.', needle: 'cat naps', },),
              blockOfNeedle({ english: 'The cat naps\n============\n\nAfter.', needle: 'cat naps', },),
              blockOfNeedle({ english: 'The cat\nnaps here\n--------\n\nAfter.', needle: 'naps', },),
              blockOfNeedle({
                english: '- item\n\n  | a | b |\n  | - | - |\n  | cat naps | x |\n\n- Next.\n',
                needle: 'cat naps',
              },),
              blockOfNeedle({ english: '> | a | b |\n> | - | - |\n> | cat naps | x |\n\nAfter.', needle: 'cat naps', },),
              blockOfNeedle({ english: '> ```\n> the cat naps\n> ```\n\nAfter.', needle: 'cat naps', },),
              blockOfNeedle({ english: '- item\n\n  ```\n  the cat naps\n  ```\n\n- Next.\n', needle: 'cat naps', },),
              blockOfNeedle({ english: '> The cat naps\n> =============\n\nAfter.', needle: 'cat naps', },),
            ],).toEqual([[], [], [], [], [], [], [], [], [], [], [],],);
          },
        },),
        it({
          name: 'NAMES NO BLOCK FOR A SPAN IN A FOOTNOTE DEFINITION, and the whole list for a span across two list items, '
            + 'since no paragraph holds it',
          fn: async () => {
            const footnote = 'The cat naps.[^1]\n\n[^1]: The note says the cat naps.\n';
            const items = '- The cat naps\n- in the sun.\n';
            expect([
              blockHolding({ english: footnote, start: 25, end: 35, },),
              blockHolding({ english: items, start: 11, end: 20, },),
            ],).toEqual([
              [],
              [{ start: 0, end: 28, text: '- The cat naps\n- in the sun.', },],
            ],);
          },
        },),
        it({
          name: 'NAMES NO BLOCK for a span that crosses two blocks, lies past the English, or lies in the front matter',
          fn: async () => {
            const english = 'The cat naps.\n\nThe fish swims.';
            const withFront = '---\ntitle: Mittens\n---\n\nThe cat naps.';
            expect([
              blockHolding({ english, start: 10, end: 20, },),
              blockHolding({ english, start: 20, end: 90, },),
              blockHolding({ english: withFront, start: 11, end: 18, },),
            ],).toEqual([[], [], [],],);
          },
        },),
      ],
    },),
    describe({
      name: blockStandingOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'NAMES THE KIND OF BLOCK, AND NO BLOCK, FOR A SPAN IN A TABLE, A CODE BLOCK OR A SETEXT HEADING, wherever each '
            + 'stands, and the block with no kind for a paragraph, an ATX heading or a span in no block',
          fn: async () => {
            /**
             Where the first stand of a needle in an English stands among its blocks.
             */
            function standingOfNeedle({ english, needle, }: { readonly english: string; readonly needle: string; },): unknown {
              return blockStandingOf({
                english,
                start: english.indexOf(needle,),
                end: english.indexOf(needle,) + needle.length,
              },);
            }
            expect([
              standingOfNeedle({ english: '| a | b |\n| - | - |\n| cat naps | x |\n', needle: 'cat naps', },),
              standingOfNeedle({ english: '~~~\nthe cat naps\n~~~\n\nAfter.', needle: 'cat naps', },),
              standingOfNeedle({ english: 'The cat\nnaps here\n--------\n\nAfter.', needle: 'naps', },),
              standingOfNeedle({ english: '- item\n\n  | a | b |\n  | - | - |\n  | cat naps | x |\n\n- Next.\n', needle: 'cat naps', },),
              standingOfNeedle({ english: '> The cat naps\n> =============\n\nAfter.', needle: 'cat naps', },),
              standingOfNeedle({ english: '> ## The cat naps\n\nAfter.', needle: 'cat naps', },),
              standingOfNeedle({ english: 'The cat naps.\n\nAfter.', needle: 'cat naps', },),
              standingOfNeedle({ english: 'The cat naps.', needle: 'dog', },),
            ],).toEqual([
              { block: [], spliceOnlyIn: ['table',], },
              { block: [], spliceOnlyIn: ['code block',], },
              { block: [], spliceOnlyIn: ['setext heading',], },
              { block: [], spliceOnlyIn: ['table',], },
              { block: [], spliceOnlyIn: ['setext heading',], },
              { block: [{ start: 2, end: 17, text: '## The cat naps', },], spliceOnlyIn: [], },
              { block: [{ start: 0, end: 13, text: 'The cat naps.', },], spliceOnlyIn: [], },
              { block: [], spliceOnlyIn: [], },
            ],);
          },
        },),
        it({
          name: 'CUTS A MULTI-LINE BLOCK QUOTE PARAGRAPH FROM ITS FIRST CHARACTER, so the first line carries no marker and every '
            + 'later line keeps its own',
          fn: async () => {
            expect(blockStandingOf({ english: '> The cat naps\n> in the sun.\n', start: 2, end: 14, },),).toEqual({
              block: [{ start: 2, end: 28, text: 'The cat naps\n> in the sun.', },],
              spliceOnlyIn: [],
            },);
          },
        },),
      ],
    },),
  ],
},);
