import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import type { Table, } from 'mdast';
import type { ReadonlyDeep, } from 'type-fest';

import {
  applyFixes,
  fixSource,
} from '../fix.ts';
import { runRules, } from '../lint.ts';
import { parse, } from '../parse.ts';
import { toHtmlTable, } from '../to-html-table.ts';
import type { Diagnostic, } from '../types.ts';
import { walk, } from '../walk.ts';
import { noPipeTables, } from './no-pipe-tables.ts';

/**
 * Run only `no-pipe-tables` over a source.
 *
 * @param source - Markdown or MDX source
 *
 * @param mdx - whether to parse as MDX
 *
 * @returns diagnostics from the rule
 */
function lintTables(
  source: string,
  mdx: boolean,
): readonly Diagnostic[] {
  return runRules({
    rules: [noPipeTables,],
    source,
    mdx,
  },);
}

/**
 * Parse a source and return its first `table` node, for transform tests.
 *
 * @param source - Markdown source containing a table
 *
 * @returns first table node
 */
function firstTable(source: string,): ReadonlyDeep<Table> {
  for (const { node, } of walk(parse({
    source,
    mdx: false,
  },),)) {
    if (node.type === 'table') {
      return node;
    }
  }
  throw new Error('no table found',);
}

/**
 * Pipe table covering alignment, an escaped pipe, and inline Markdown.
 */
const PIPE_TABLE = [
  '| Name | Age | Note |',
  '| :--- | --: | :--: |',
  String.raw`| Bob  | 30  | a \| b |`,
  '| Sue  | 25  | **x** |',
  '',
].join('\n',);

/**
 * Expected HTML rendering of {@link PIPE_TABLE}.
 */
const EXPECTED_HTML = [
  '<table>',
  '<thead>',
  '<tr>',
  '<th align="left">Name</th>',
  '<th align="right">Age</th>',
  '<th align="center">Note</th>',
  '</tr>',
  '</thead>',
  '<tbody>',
  '<tr>',
  '<td align="left">Bob</td>',
  '<td align="right">30</td>',
  '<td align="center">a | b</td>',
  '</tr>',
  '<tr>',
  '<td align="left">Sue</td>',
  '<td align="right">25</td>',
  '<td align="center">**x**</td>',
  '</tr>',
  '</tbody>',
  '</table>',
];

/**
 * Pipe table containing Markdown-escaped and raw HTML-special characters.
 */
const UNSAFE_PIPE_TABLE = [
  '| Payload |',
  '| - |',
  String.raw`| \<img src=x onerror=alert(1)> & <b>"x"</b> ' |`,
  '',
].join('\n',);

/**
 * HTML table that must never be flagged (parses as raw `html`, not a `table`).
 */
const HTML_TABLE = [
  '<table>',
  '<tr>',
  '<td>kept</td>',
  '</tr>',
  '</table>',
  '',
].join('\n',);

await describe({
  name: 'no-pipe-tables',
  children: [
    it({
      name: 'flags a pipe table at its first line with a fix',
      fn: async function flagsPipeTable() {
        /**
         * Diagnostics for the pipe table.
         */
        const diagnostics = lintTables(PIPE_TABLE, false,);
        expect(diagnostics.length,).toBe(1,);
        /**
         * First (only) diagnostic.
         */
        const first = nonNullishOrThrow(diagnostics[0],);
        expect(first.line,).toBe(1,);
        expect(first.fix,).toBeTruthy();
      },
    },),
    it({
      name: 'does not flag a raw HTML table',
      fn: async function allowsHtmlTable() {
        expect(lintTables(HTML_TABLE, false,).length,).toBe(0,);
      },
    },),
    it({
      name: 'does not flag prose containing a pipe',
      fn: async function allowsProse() {
        expect(lintTables('# Title\n\nA paragraph with a | pipe in prose.\n', false,).length,).toBe(0,);
      },
    },),
    it({
      name: 'flags a blockquote-nested table without a fix',
      fn: async function blockquoteReportOnly() {
        /**
         * Diagnostics for the blockquote-nested table.
         */
        const diagnostics = lintTables([
          '> | A | B |',
          '> | - | - |',
          '> | 1 | 2 |',
          '',
        ].join('\n',), false,);
        expect(diagnostics.length,).toBe(1,);
        expect(nonNullishOrThrow(diagnostics[0],).fix,).toBeFalsy();
      },
    },),
    it({
      name: 'converts a pipe table to HTML (alignment, escaped pipe, inline markdown)',
      fn: async function transformMatches() {
        expect([...toHtmlTable({
          table: firstTable(PIPE_TABLE,),
          source: PIPE_TABLE,
        },),],).toEqual(EXPECTED_HTML,);
      },
    },),
    it({
      name: 'escapes HTML-special cell text when converting',
      fn: async function escapesHtml() {
        /**
         * Rendered HTML for the unsafe table.
         */
        const html = toHtmlTable({
          table: firstTable(UNSAFE_PIPE_TABLE,),
          source: UNSAFE_PIPE_TABLE,
        },).join('\n',);
        expect(html.includes('<img src=x',),).toBe(false,);
        expect(html.includes('&lt;img src=x onerror=alert(1)&gt;',),).toBe(true,);
        expect(html.includes('&amp;',),).toBe(true,);
        expect(html.includes('&quot;x&quot;',),).toBe(true,);
        expect(html.includes('&#39;',),).toBe(true,);
      },
    },),
    it({
      name: 'applyFixes converts the table and is idempotent',
      fn: async function fixIdempotent() {
        /**
         * Source after one fix pass.
         */
        const fixed = applyFixes({
          source: PIPE_TABLE,
          diagnostics: lintTables(PIPE_TABLE, false,),
        },);
        expect(fixed.includes('<table>',),).toBe(true,);
        expect(fixed.includes('| Name |',),).toBe(false,);
        expect(lintTables(fixed, false,).length,).toBe(0,);
      },
    },),
    it({
      name: 'fixSource settles to clean and is a no-op on the result',
      fn: async function fixSourceSettles() {
        /**
         * First fixpoint result.
         */
        const once = fixSource({
          rules: [noPipeTables,],
          source: PIPE_TABLE,
          mdx: false,
        },);
        expect(once.diagnostics.length,).toBe(0,);
        /**
         * Re-fixing the settled source.
         */
        const twice = fixSource({
          rules: [noPipeTables,],
          source: once.source,
          mdx: false,
        },);
        expect(twice.source,).toBe(once.source,);
      },
    },),
  ],
},);
