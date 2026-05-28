// @ts-check

import assert from 'node:assert/strict';

import { applyFixes } from 'markdownlint';
import { lint } from 'markdownlint/sync';

import rules from './index.mjs';
import toHtmlTable from './to-html-table.mjs';

/** @typedef {import('markdownlint').LintError} LintError */
/** @typedef {import('markdownlint').MicromarkToken} MicromarkToken */

const RULE = 'no-pipe-tables';

/**
 * Lint one Markdown string with only `no-pipe-tables` enabled.
 *
 * @param {string} content Markdown source.
 * @returns {LintError[]} Reported errors for that source.
 */
function lintString(content) {
  const results = lint({
    strings: { t: content },
    customRules: rules,
    config: { default: false, [RULE]: true },
  });
  return results.t;
}

/**
 * Errors that belong to the `no-pipe-tables` rule.
 *
 * @param {readonly LintError[]} errors All reported errors.
 * @returns {LintError[]} Subset whose `ruleNames` include the rule.
 */
function ruleErrors(errors) {
  const matches = [];
  for (const error of errors) {
    if (error.ruleNames.includes(RULE)) {
      matches.push(error);
    }
  }
  return matches;
}

/**
 * Parse Markdown and return its first `table` token (for transform tests).
 *
 * @param {string} content Markdown source.
 * @returns {MicromarkToken} First table token.
 */
function firstTableToken(content) {
  const captured = [];
  const captureRule = {
    names: ['capture'],
    description: 'capture',
    tags: ['test'],
    parser: 'micromark',
    function: function captureFn(params) {
      for (const token of params.parsers.micromark.tokens) {
        if (token.type === 'table') {
          captured.push(token);
        }
      }
    },
  };
  lint({ strings: { t: content }, customRules: [captureRule], config: { default: false, capture: true } });
  return captured[0];
}

const PIPE_TABLE = [
  '| Name | Age | Note |',
  '| :--- | --: | :--: |',
  '| Bob  | 30  | a \\| b |',
  '| Sue  | 25  | **x** |',
  '',
].join('\n');

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

const HTML_TABLE = [
  '<table>',
  '<tr>',
  '<td>kept</td>',
  '</tr>',
  '</table>',
  '',
].join('\n');

const BLOCKQUOTE_TABLE = [
  '> | A | B |',
  '> | - | - |',
  '> | 1 | 2 |',
  '',
].join('\n');

/** @type {Array<{ name: string, fn: () => void }>} */
const tests = [
  {
    name: 'flags a pipe table at its first line with a fix',
    fn: function flagsPipeTable() {
      const errors = ruleErrors(lintString(PIPE_TABLE));
      assert.ok(errors.length >= 1, 'expected at least one no-pipe-tables error');
      assert.equal(errors[0].lineNumber, 1);
      // markdownlint normalizes an absent fix to null, so a real fix is a truthy object.
      assert.ok(errors[0].fixInfo, 'top-level table should carry a fix');
    },
  },
  {
    name: 'does not flag an HTML table',
    fn: function allowsHtmlTable() {
      assert.equal(ruleErrors(lintString(HTML_TABLE)).length, 0);
    },
  },
  {
    name: 'does not flag table-free prose',
    fn: function allowsProse() {
      assert.equal(ruleErrors(lintString('# Title\n\nA paragraph with a | pipe in prose.\n')).length, 0);
    },
  },
  {
    name: 'flags a blockquote-nested table without a fix',
    fn: function blockquoteReportOnly() {
      const errors = ruleErrors(lintString(BLOCKQUOTE_TABLE));
      assert.ok(errors.length >= 1, 'expected the nested table to be flagged');
      // null (markdownlint's normalized "no fix") or undefined both mean report-only.
      assert.ok(!errors[0].fixInfo, 'nested table must not be autofixed');
    },
  },
  {
    name: 'converts a pipe table to the expected HTML (alignment, escaped pipe, inline markdown)',
    fn: function transformMatches() {
      assert.deepEqual(toHtmlTable(firstTableToken(PIPE_TABLE)), EXPECTED_HTML);
    },
  },
  {
    name: 'autofix output is valid and idempotent',
    fn: function autofixIdempotent() {
      const fixed = applyFixes(PIPE_TABLE, lintString(PIPE_TABLE));
      assert.ok(fixed.includes('<table>'), 'fixed output should contain an HTML table');
      assert.ok(!fixed.includes('| Name |'), 'fixed output should no longer contain the pipe row');
      assert.equal(ruleErrors(lintString(fixed)).length, 0, 're-linting the fix should be clean');
    },
  },
];

const failures = [];
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

if (failures.length > 0) {
  throw new Error(`${failures.length} of ${tests.length} no-pipe-tables tests failed: ${failures.join('; ')}`);
}

console.log(`# ${tests.length} no-pipe-tables tests passed`);
