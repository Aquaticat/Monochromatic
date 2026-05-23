/**
 * Equivalence tests for the line-oriented `catalog:` block parser.
 *
 * `collectIndentedBlock` is the function under refactor (recursive cursor +
 * `[...acc, line]` accumulator to a single linear pass); these cases pin its
 * exact behaviour across the edge cases that distinguish a faithful scan:
 * empty input, cursor past the end, no leading match, both indent characters
 * (space and tab), whitespace-only bodies, indent-only lines with no body,
 * blank-line and non-indented terminators, a mid-array start, and a long run.
 * `parseCatalogFromYaml` exercises the same scan through its real caller.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

import {
  collectIndentedBlock,
  parseCatalogFromYaml,
} from './yaml-parse.ts';

/** Line count for the long-run stack-safety case; one linear pass must collect every line. */
const LONG_BLOCK_LINES = 100_000;

await describe({
  name: 'yaml-parse',
  children: [
    //region collectIndentedBlock
    it({
      name: 'collectIndentedBlock returns empty for an empty line array',
      fn: async () => {
        expect(collectIndentedBlock({
          lines: [],
          from: 0,
        },),).toEqual([],);
      },
    },),

    it({
      name: 'collectIndentedBlock returns empty when from is at or past the end',
      fn: async () => {
        expect(collectIndentedBlock({
          lines: ['  a: 1',],
          from: 1,
        },),).toEqual([],);
      },
    },),

    it({
      name: 'collectIndentedBlock returns empty when the first line is not indented',
      fn: async () => {
        expect(collectIndentedBlock({
          lines: [
            'catalog:',
            '  a: 1',
          ],
          from: 0,
        },),).toEqual([],);
      },
    },),

    it({
      name: 'collectIndentedBlock collects a run of space-indented lines and stops at a non-indented line',
      fn: async () => {
        expect(collectIndentedBlock({
          lines: [
            '  a: 1',
            '  b: 2',
            'next:',
          ],
          from: 0,
        },),).toEqual([
          '  a: 1',
          '  b: 2',
        ],);
      },
    },),

    it({
      name: 'collectIndentedBlock collects tab-indented lines',
      fn: async () => {
        expect(collectIndentedBlock({
          lines: [
            '\ta: 1',
            '\tb: 2',
          ],
          from: 0,
        },),).toEqual([
          '\ta: 1',
          '\tb: 2',
        ],);
      },
    },),

    it({
      name: 'collectIndentedBlock collects both space- and tab-indented lines in one block',
      fn: async () => {
        expect(collectIndentedBlock({
          lines: [
            '  a: 1',
            '\tb: 2',
          ],
          from: 0,
        },),).toEqual([
          '  a: 1',
          '\tb: 2',
        ],);
      },
    },),

    it({
      name: 'collectIndentedBlock stops at a blank line inside the block',
      fn: async () => {
        expect(collectIndentedBlock({
          lines: [
            '  a: 1',
            '',
            '  b: 2',
          ],
          from: 0,
        },),).toEqual(['  a: 1',],);
      },
    },),

    it({
      name: 'collectIndentedBlock stops at an indent-only line that has no body',
      fn: async () => {
        expect(collectIndentedBlock({
          lines: [
            ' ',
            '  a: 1',
          ],
          from: 0,
        },),).toEqual([],);
      },
    },),

    it({
      name: 'collectIndentedBlock collects a whitespace-only line that has a further character',
      fn: async () => {
        expect(collectIndentedBlock({
          lines: [
            '   ',
            '  a: 1',
          ],
          from: 0,
        },),).toEqual([
          '   ',
          '  a: 1',
        ],);
      },
    },),

    it({
      name: 'collectIndentedBlock starts collecting from the given index',
      fn: async () => {
        expect(collectIndentedBlock({
          lines: [
            'catalog:',
            '  a: 1',
            '  b: 2',
          ],
          from: 1,
        },),).toEqual([
          '  a: 1',
          '  b: 2',
        ],);
      },
    },),

    it({
      name: 'collectIndentedBlock excludes indented lines that follow a terminator',
      fn: async () => {
        expect(collectIndentedBlock({
          lines: [
            '  a: 1',
            'after:',
            '  b: 2',
          ],
          from: 0,
        },),).toEqual(['  a: 1',],);
      },
    },),

    it({
      name: 'collectIndentedBlock collects a long contiguous run without overflowing',
      fn: async () => {
        /** Long block of identical indented lines; the recursive predecessor overflowed and copied O(n^2). */
        const longLines: readonly string[] = Array.from(
          { length: LONG_BLOCK_LINES, },
          function indentedLine(): string {
            return '  x';
          },
        );
        expect(collectIndentedBlock({
          lines: longLines,
          from: 0,
        },).length,).toBe(LONG_BLOCK_LINES,);
      },
    },),
    //endregion collectIndentedBlock

    //region parseCatalogFromYaml
    it({
      name: 'parseCatalogFromYaml reads the indented entries under catalog:',
      fn: async () => {
        /** Fixture with a leading packages: block, a catalog: block, and a trailing key. */
        const content = [
          'packages:',
          '  - "packages/*"',
          'catalog:',
          '  foo: ">=1.2.3"',
          '  bar: "*"',
          'other:',
        ].join('\n',);
        expect(parseCatalogFromYaml(content,),).toEqual({
          foo: '>=1.2.3',
          bar: '*',
        },);
      },
    },),

    it({
      name: 'parseCatalogFromYaml returns empty when there is no catalog: header',
      fn: async () => {
        /** Fixture without any catalog: header line. */
        const content = [
          'packages:',
          '  - "packages/*"',
        ].join('\n',);
        expect(parseCatalogFromYaml(content,),).toEqual({},);
      },
    },),

    it({
      name: 'parseCatalogFromYaml reads unquoted values',
      fn: async () => {
        /** Fixture whose single entry uses an unquoted range value. */
        const content = [
          'catalog:',
          '  foo: >=1.0.0',
        ].join('\n',);
        expect(parseCatalogFromYaml(content,),).toEqual({ foo: '>=1.0.0', },);
      },
    },),
    //endregion parseCatalogFromYaml
  ],
},);
