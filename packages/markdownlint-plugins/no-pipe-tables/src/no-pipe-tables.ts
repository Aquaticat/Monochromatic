import type {
  Rule,
  RuleOnError,
} from 'markdownlint';

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw';

import type { ReadonlyToken, } from './token.ts';
import toHtmlTable from './to-html-table.ts';

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
 * Every `table` token from a micromark token tree, walked iteratively with an
 * explicit work-stack rather than recursing: the tree can degenerate into a
 * deep spine and JS has no tail-call elimination, so recursion would risk stack
 * overflow on adversarial input. Tables never nest, so descent stops at a table.
 *
 * @param rootTokens - top-level micromark tokens
 *
 * @returns every `table` token, including nested ones
 */
function collectTables(rootTokens: readonly ReadonlyToken[],): ReadonlyToken[] {
  /** Tables found so far. */
  const tables: ReadonlyToken[] = [];
  /** Work-stack of tokens still to inspect; seeded with the roots. */
  const stack: ReadonlyToken[] = [...rootTokens,];
  while (stack.length > 0) {
    /** Token currently being inspected, popped from the work-stack. */
    const token = stack.pop();
    if (token === undefined) {
      continue;
    }
    if (token.type === 'table') {
      tables.push(token,);
      continue;
    }
    for (const child of token.children) {
      stack.push(child,);
    }
  }
  return tables;
}

/**
 * Parameters for {@link reportTable}.
 */
type ReportTableParams = {
  /** Table token to report. */
  readonly table: ReadonlyToken;
  /** Source lines, for error context and the replaced first-line length. */
  readonly lines: readonly string[];
  /** markdownlint error callback. */
  readonly onError: RuleOnError;
  /** Whether a fix is safe to emit (top-level, unindented). */
  readonly fixable: boolean;
};

/**
 * Report a pipe table and, when it is top-level, attach a fix that replaces it
 * with an HTML `<table>`. markdownlint fixes are line-scoped, so a multi-line
 * block is rewritten by replacing the first line with the whole HTML block and
 * deleting each remaining line; this surfaces one report per table line until
 * `--fix` runs.
 *
 * @param table - table token to report
 *
 * @param lines - source lines, for error context and the replaced first-line length
 *
 * @param onError - markdownlint error callback
 *
 * @param fixable - whether a fix is safe to emit (top-level, unindented)
 */
function reportTable({
  table,
  lines,
  onError,
  fixable,
}: ReportTableParams,): void {
  /** Source text of the table's first line; replaced wholesale by the fix. */
  const firstLine = nonNullishOrThrow(lines[table.startLine - 1],);

  if (!fixable) {
    onError({
      lineNumber: table.startLine,
      detail: DETAIL,
      context: firstLine,
    },);
    return;
  }

  onError({
    lineNumber: table.startLine,
    detail: DETAIL,
    context: firstLine,
    fixInfo: {
      editColumn: 1,
      deleteCount: firstLine.length,
      insertText: toHtmlTable(table,)
        .join('\n',),
    },
  },);

  for (let line = table.startLine + 1; line <= table.endLine; line += 1) {
    onError({
      lineNumber: line,
      detail: DETAIL_CONTINUATION,
      context: nonNullishOrThrow(lines[line - 1],),
      fixInfo: { deleteCount: -1, },
    },);
  }
}

/**
 * markdownlint custom rule banning Markdown pipe tables. HTML `<table>` parses
 * as `htmlFlow`, not a `table` token, so HTML tables are never flagged. Only
 * top-level tables are autofixed; tables inside blockquotes or indented contexts
 * are reported without a fix so `--fix` cannot corrupt their prefixes.
 */
const noPipeTables: Rule = {
  names: ['no-pipe-tables',],
  description: 'Markdown pipe tables (use an HTML table or lists)',
  tags: ['table',],
  parser: 'micromark',
  // params/onError signature is dictated by markdownlint's Rule API, so the
  // single-destructured-object-parameter convention does not apply here.
  function: function noPipeTablesRule(
    params,
    onError,
  ) {
    // Annotated as the read-only view (not destructured) so `token.type ===
    // 'table'` does not depend on the gfm-table `TokenTypeMap` augmentation; the
    // `rootTokens` name differs from the property, so `prefer-destructuring`
    // leaves the annotation intact.
    /** Top-level micromark tokens, viewed read-only. */
    const rootTokens: readonly ReadonlyToken[] = params.parsers
      .micromark
      .tokens;
    /** Tables that are direct children of the document root. */
    const topLevel = new Set<ReadonlyToken>();
    for (const token of rootTokens) {
      if (token.type === 'table') {
        topLevel.add(token,);
      }
    }
    for (const table of collectTables(rootTokens,)) {
      reportTable({
        table,
        lines: params.lines,
        onError,
        fixable: topLevel.has(table,) && (table.startColumn === 1),
      },);
    }
  },
};

export default noPipeTables;
