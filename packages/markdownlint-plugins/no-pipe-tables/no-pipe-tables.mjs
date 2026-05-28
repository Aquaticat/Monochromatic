// @ts-check

import toHtmlTable from './to-html-table.mjs';

/** @typedef {import('markdownlint').MicromarkToken} MicromarkToken */
/** @typedef {import('markdownlint').RuleParams} RuleParams */
/** @typedef {import('markdownlint').RuleOnError} RuleOnError */

/**
 * Message shown for each banned pipe table. Leads with the preferred forms;
 * HTML is named only as the mechanical fallback the autofix emits, never the
 * recommended authoring form (see docs/philosophy/agents.md).
 */
const DETAIL = 'Markdown pipe tables force each row onto one line; prefer headings or lists. '
  + '`mise run format:markdownlint` autofixes to an HTML table as a fallback.';

/** Message for the continuation lines a pipe table occupies after its first. */
const DETAIL_CONTINUATION = 'Part of a banned Markdown pipe table.';

/**
 * Collect every `table` token from a micromark token tree, walking iteratively
 * with an explicit work-stack rather than recursing: the tree can degenerate
 * into a deep spine and JS has no tail-call elimination, so recursion would risk
 * stack overflow on adversarial input. Tables never nest, so descent stops at a
 * table.
 *
 * @param {readonly MicromarkToken[]} rootTokens Top-level micromark tokens.
 * @returns {MicromarkToken[]} Every `table` token, including nested ones.
 */
function collectTables(rootTokens) {
  const tables = [];
  const stack = [...rootTokens];
  while (stack.length > 0) {
    const token = stack.pop();
    if (token === undefined) {
      continue;
    }
    if (token.type === 'table') {
      tables.push(token);
      continue;
    }
    for (const child of token.children) {
      stack.push(child);
    }
  }
  return tables;
}

/**
 * Report a pipe table and, when it is top-level, attach a fix that replaces it
 * with an HTML `<table>`. markdownlint fixes are line-scoped, so a multi-line
 * block is rewritten by replacing the first line with the whole HTML block and
 * deleting each remaining line; this surfaces one report per table line until
 * `--fix` runs.
 *
 * @param {{ table: MicromarkToken, params: RuleParams, onError: RuleOnError, fixable: boolean }} input
 *   Table token, rule params, error callback, and whether a fix is safe to emit.
 * @returns {void} Nothing.
 */
function reportTable({ table, params, onError, fixable }) {
  if (!fixable) {
    onError({
      lineNumber: table.startLine,
      detail: DETAIL,
      context: params.lines[table.startLine - 1],
    });
    return;
  }

  onError({
    lineNumber: table.startLine,
    detail: DETAIL,
    context: params.lines[table.startLine - 1],
    fixInfo: {
      editColumn: 1,
      deleteCount: params.lines[table.startLine - 1].length,
      insertText: toHtmlTable(table).join('\n'),
    },
  });

  for (let line = table.startLine + 1; line <= table.endLine; line += 1) {
    onError({
      lineNumber: line,
      detail: DETAIL_CONTINUATION,
      context: params.lines[line - 1],
      fixInfo: { deleteCount: -1 },
    });
  }
}

/**
 * markdownlint custom rule banning Markdown pipe tables. HTML `<table>` parses
 * as `htmlFlow`, not a `table` token, so HTML tables are never flagged. Only
 * top-level tables are autofixed; tables inside blockquotes or indented contexts
 * are reported without a fix so `--fix` cannot corrupt their prefixes.
 *
 * @type {import('markdownlint').Rule}
 */
const noPipeTables = {
  names: ['no-pipe-tables'],
  description: 'Markdown pipe tables (use an HTML table or lists)',
  tags: ['table'],
  parser: 'micromark',
  // params/onError signature is dictated by markdownlint's Rule API, so the
  // single-destructured-object-parameter convention does not apply here.
  function: function noPipeTablesRule(params, onError) {
    const topLevel = new Set();
    for (const token of params.parsers.micromark.tokens) {
      if (token.type === 'table') {
        topLevel.add(token);
      }
    }
    for (const table of collectTables(params.parsers.micromark.tokens)) {
      reportTable({
        table,
        params,
        onError,
        fixable: topLevel.has(table) && table.startColumn === 1,
      });
    }
  },
};

export default noPipeTables;
