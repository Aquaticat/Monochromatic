/**
 Tests for the line readers the nesting bound counts with: the blanks opening
 a line, the container markers after them, a fence a line may open, and
 whether a line is a thematic break.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  blanksEnd,
  containerPrefixOf,
  fenceOf,
  indentationOf,
  isRuleLine,
  NO_FENCE,
} from '../dist/final/node/index.mjs';

//region Nesting line lexing tests

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: blanksEnd.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'FINDS the first character that is no space or tab, from a position, and the end of a line of blanks',
          fn: async () => {
            expect(blanksEnd({ line: ' \t cat', from: 0, },),).toBe(3,);
            expect(blanksEnd({ line: ' \t cat', from: 3, },),).toBe(3,);
            expect(blanksEnd({ line: ' \t ', from: 0, },),).toBe(3,);
            expect(blanksEnd({ line: '', from: 0, },),).toBe(0,);
          },
        },),
      ],
    },),

    describe({
      name: indentationOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'COUNTS a space as one column and a tab as four, and says where the indentation ends',
          fn: async () => {
            expect(indentationOf({ line: '    cat', },),).toEqual({ columns: 4, end: 4, },);
            expect(indentationOf({ line: '\t cat', },),).toEqual({ columns: 5, end: 2, },);
            expect(indentationOf({ line: 'cat', },),).toEqual({ columns: 0, end: 0, },);
          },
        },),
      ],
    },),

    describe({
      name: containerPrefixOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'READS quotation marks, bullet markers, ordered markers and footnote labels as markers, one each',
          fn: async () => {
            expect(containerPrefixOf({ line: '> > cat', start: 0, },),).toEqual({
              end: 3,
              count: 2,
              beyondColumn: 0,
            },);
            expect(containerPrefixOf({ line: '1. - cat', start: 0, },),).toEqual({
              end: 4,
              count: 2,
              beyondColumn: 0,
            },);
            expect(containerPrefixOf({ line: '[^1]: cat', start: 0, },),).toEqual({
              end: 5,
              count: 1,
              beyondColumn: 0,
            },);
            expect(containerPrefixOf({ line: '+ cat', start: 0, },),).toEqual({
              end: 1,
              count: 1,
              beyondColumn: 0,
            },);
          },
        },),
        it({
          name: 'READS a bullet that ends its line as a marker and a mark with no blank after it as none',
          fn: async () => {
            expect(containerPrefixOf({ line: '-', start: 0, },),).toEqual({
              end: 1,
              count: 1,
              beyondColumn: 0,
            },);
            expect(containerPrefixOf({ line: '-not a list', start: 0, },),).toEqual({
              end: 0,
              count: 0,
              beyondColumn: 0,
            },);
            expect(containerPrefixOf({ line: '2024.cat', start: 0, },),).toEqual({
              end: 0,
              count: 0,
              beyondColumn: 0,
            },);
            expect(containerPrefixOf({ line: '[^1 cat]: no', start: 0, },),).toEqual({
              end: 0,
              count: 0,
              beyondColumn: 0,
            },);
          },
        },),
        it({
          name: 'NAMES the one-based column of the 257th marker as the first past the bound, and counts them all',
          fn: async () => {
            expect(containerPrefixOf({ line: `${'>'.repeat(300,)} cat`, start: 0, },),).toEqual({
              end: 300,
              count: 300,
              beyondColumn: 257,
            },);
          },
        },),
        it({
          name: 'STARTS reading at the position it is given, after the indentation',
          fn: async () => {
            expect(containerPrefixOf({ line: '  > cat', start: 2, },),).toEqual({
              end: 3,
              count: 1,
              beyondColumn: 0,
            },);
          },
        },),
      ],
    },),

    describe({
      name: fenceOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'READS a run of three or more backticks or tildes as a fence, with its character and length',
          fn: async () => {
            expect(fenceOf({ line: '```ts', },),).toEqual({ character: '`', length: 3, },);
            expect(fenceOf({ line: '~~~~', },),).toEqual({ character: '~', length: 4, },);
          },
        },),
        it({
          name: 'READS two backticks, prose and an empty line as no fence',
          fn: async () => {
            expect(fenceOf({ line: '``', },),).toEqual(NO_FENCE,);
            expect(fenceOf({ line: 'cat', },),).toEqual(NO_FENCE,);
            expect(fenceOf({ line: '', },),).toEqual(NO_FENCE,);
            expect(NO_FENCE,).toEqual({ character: '', length: 0, },);
          },
        },),
      ],
    },),

    describe({
      name: isRuleLine.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'READS a line of only stars, underscores, hyphens, spaces and tabs as a rule',
          fn: async () => {
            expect(isRuleLine({ line: '* * *', },),).toBe(true,);
            expect(isRuleLine({ line: '___', },),).toBe(true,);
            expect(isRuleLine({ line: '- - -\t', },),).toBe(true,);
          },
        },),
        it({
          name: 'READS a line with any other character as no rule',
          fn: async () => {
            expect(isRuleLine({ line: 'cat', },),).toBe(false,);
            expect(isRuleLine({ line: '**bold**', },),).toBe(false,);
            expect(isRuleLine({ line: '***~', },),).toBe(false,);
          },
        },),
      ],
    },),
  ],
},);

//endregion Nesting line lexing tests
