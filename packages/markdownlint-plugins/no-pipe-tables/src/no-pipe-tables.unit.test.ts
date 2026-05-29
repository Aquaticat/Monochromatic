import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw';
import {
  applyFixes,
  type LintError,
  type MicromarkToken,
  type Rule,
} from 'markdownlint';
import { lint, } from 'markdownlint/sync';

// Test against the BUILT artifact (the bundled, minified dist that
// markdownlint-cli2 actually loads under Node), not the source. Run via the
// package's `buildAndTest` task so the dist is fresh.
import rules, { toHtmlTable, } from '../dist/final/node/index.mjs';

/** Name of the rule under test. */
const RULE = 'no-pipe-tables';

/**
 * Lint one Markdown string with only `no-pipe-tables` enabled.
 *
 * @param content - Markdown source
 *
 * @returns reported errors for that source
 */
function lintString(content: string,): LintError[] {
  const results = lint({
    strings: { t: content, },
    customRules: rules,
    config: { default: false, [RULE]: true, },
  },);
  return results.t ?? [];
}

/**
 * Errors that belong to the `no-pipe-tables` rule.
 *
 * @param errors - all reported errors
 *
 * @returns subset whose `ruleNames` include the rule
 */
function ruleErrors(errors: readonly LintError[],): LintError[] {
  const matches: LintError[] = [];
  for (const error of errors) {
    if (error.ruleNames.includes(RULE,)) {
      matches.push(error,);
    }
  }
  return matches;
}

/**
 * Parse Markdown and return its first `table` token (for transform tests).
 *
 * @param content - Markdown source
 *
 * @returns first table token
 */
function firstTableToken(content: string,): MicromarkToken {
  const captured: MicromarkToken[] = [];
  // `string`-typed so the comparison does not depend on the gfm-table
  // `TokenTypeMap` augmentation (see src/token.ts), matching markdownlint's own
  // `filterByTypes` approach.
  const tableType: string = 'table';
  const captureRule: Rule = {
    names: ['capture',],
    description: 'capture',
    tags: ['test',],
    parser: 'micromark',
    function: function captureFn(params,) {
      for (const token of params.parsers.micromark.tokens) {
        if (token.type === tableType) {
          captured.push(token,);
        }
      }
    },
  };
  lint({ strings: { t: content, }, customRules: [captureRule,], config: { default: false, capture: true, }, },);
  return nonNullishOrThrow(captured[0],);
}

/** Pipe table covering alignment, an escaped pipe, and inline Markdown. */
const PIPE_TABLE = [
  '| Name | Age | Note |',
  '| :--- | --: | :--: |',
  String.raw`| Bob  | 30  | a \| b |`,
  '| Sue  | 25  | **x** |',
  '',
].join('\n',);

/** Expected HTML rendering of {@link PIPE_TABLE}. */
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

/** HTML table that must never be flagged (parses as `htmlFlow`). */
const HTML_TABLE = [
  '<table>',
  '<tr>',
  '<td>kept</td>',
  '</tr>',
  '</table>',
  '',
].join('\n',);

/** Blockquote-nested table: flagged, but not autofixed. */
const BLOCKQUOTE_TABLE = [
  '> | A | B |',
  '> | - | - |',
  '> | 1 | 2 |',
  '',
].join('\n',);

/** Pipe table containing Markdown-escaped and raw HTML-special characters. */
const UNSAFE_HTML_PIPE_TABLE = [
  '| Payload |',
  '| - |',
  String.raw`| \<img src=x onerror=alert(1)> & <script>"x"</script> ' |`,
  '',
].join('\n',);

/** Expected HTML rendering of {@link UNSAFE_HTML_PIPE_TABLE}. */
const EXPECTED_SAFE_HTML = [
  '<table>',
  '<thead>',
  '<tr>',
  '<th>Payload</th>',
  '</tr>',
  '</thead>',
  '<tbody>',
  '<tr>',
  '<td>&lt;img src=x onerror=alert(1)&gt; &amp; &lt;script&gt;&quot;x&quot;&lt;/script&gt; &#39;</td>',
  '</tr>',
  '</tbody>',
  '</table>',
];

await describe({
  name: RULE,
  children: [
    it({
      name: 'flags a pipe table at its first line with a fix',
      fn: async function flagsPipeTable() {
        const errors = ruleErrors(lintString(PIPE_TABLE,),);
        expect(errors.length,).toBeGreaterThan(0,);
        const first = nonNullishOrThrow(errors[0],);
        expect(first.lineNumber,).toBe(1,);
        // markdownlint normalizes an absent fix to null, so a real fix is truthy.
        expect(first.fixInfo,).toBeTruthy();
      },
    },),
    it({
      name: 'does not flag an HTML table',
      fn: async function allowsHtmlTable() {
        expect(ruleErrors(lintString(HTML_TABLE,),).length,).toBe(0,);
      },
    },),
    it({
      name: 'does not flag table-free prose',
      fn: async function allowsProse() {
        expect(ruleErrors(lintString('# Title\n\nA paragraph with a | pipe in prose.\n',),).length,).toBe(0,);
      },
    },),
    it({
      name: 'flags a blockquote-nested table without a fix',
      fn: async function blockquoteReportOnly() {
        const errors = ruleErrors(lintString(BLOCKQUOTE_TABLE,),);
        expect(errors.length,).toBeGreaterThan(0,);
        const first = nonNullishOrThrow(errors[0],);
        // null (markdownlint's normalized "no fix") is falsy: report-only.
        expect(first.fixInfo,).toBeFalsy();
      },
    },),
    it({
      name: 'converts a pipe table to the expected HTML (alignment, escaped pipe, inline markdown)',
      fn: async function transformMatches() {
        expect(
          toHtmlTable(firstTableToken(PIPE_TABLE,),),
        ).toEqual(EXPECTED_HTML,);
      },
    },),
    it({
      name: 'escapes HTML-special cell text when converting to HTML',
      fn: async function transformEscapesHtml() {
        expect(
          toHtmlTable(firstTableToken(UNSAFE_HTML_PIPE_TABLE,),),
        ).toEqual(EXPECTED_SAFE_HTML,);
      },
    },),
    it({
      name: 'autofix keeps Markdown-escaped tags as inert HTML text',
      fn: async function autofixEscapesHtml() {
        const fixed = applyFixes(
          UNSAFE_HTML_PIPE_TABLE,
          lintString(UNSAFE_HTML_PIPE_TABLE,),
        );
        expect(fixed.includes('<img src=x',),).toBe(false,);
        expect(fixed.includes('<script>',),).toBe(false,);
        expect(fixed.includes('&lt;img src=x onerror=alert(1)&gt;',),).toBe(true,);
        expect(fixed.includes('&amp;',),).toBe(true,);
        expect(fixed.includes('&quot;x&quot;',),).toBe(true,);
        expect(fixed.includes('&#39;',),).toBe(true,);
        expect(ruleErrors(lintString(fixed,),).length,).toBe(0,);
      },
    },),
    it({
      name: 'autofix output is valid and idempotent',
      fn: async function autofixIdempotent() {
        const fixed = applyFixes(PIPE_TABLE, lintString(PIPE_TABLE,),);
        expect(fixed.includes('<table>',),).toBe(true,);
        expect(fixed.includes('| Name |',),).toBe(false,);
        expect(ruleErrors(lintString(fixed,),).length,).toBe(0,);
      },
    },),
  ],
},);
