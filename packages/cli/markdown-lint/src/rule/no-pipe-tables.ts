import {
  diagnose,
  offsetsOf,
  positionOf,
} from '../node-source.ts';
import { toHtmlTable, } from '../to-html-table.ts';
import type {
  Diagnostic,
  Rule,
  RuleContext,
} from '../types.ts';
import { walk, } from '../walk.ts';

/**
 * Rule id.
 */
const ID = 'no-pipe-tables';

/**
 * Message shown for each banned pipe table. Leads with the preferred forms; the
 * HTML autofix is named only as the mechanical fallback, never the recommended
 * authoring form.
 */
const DETAIL = 'Markdown pipe tables force each row onto one line; prefer headings or lists. '
  + '`--fix` converts to an HTML table as a fallback.';

/**
 * Walk the tree and flag every `table` node. A top-level, unindented table
 * (direct child of the root, starting at column 1) carries a fix that replaces
 * its whole source span with an HTML `<table>`; an indented or blockquote-nested
 * table is report-only so a fix cannot corrupt its block prefix.
 *
 * @param tree - mdast tree under lint
 *
 * @param source - original source, for the HTML conversion and offsets
 *
 * @returns one diagnostic per pipe table
 */
function checkNoPipeTables({
  tree,
  source,
}: RuleContext,): readonly Diagnostic[] {
  /**
   * Diagnostics collected across the walk.
   */
  const diagnostics: Diagnostic[] = [];
  for (const {
    node,
    ancestors,
  } of walk(tree,)) {
    if (node.type !== 'table') {
      continue;
    }
    /**
     * Whether the table is a direct child of the root (its only ancestor).
     */
    const topLevel = ancestors.length === 1;
    /**
     * Whether the table starts at column 1 (unindented).
     */
    const unindented = positionOf(node,)
      .start
      .column
      === 1;
    if (!(topLevel && unindented)) {
      diagnostics.push(diagnose({
        ruleId: ID,
        message: DETAIL,
        node,
      },),);
      continue;
    }
    /**
     * Table's half-open source offsets, replaced wholesale by the fix.
     */
    const {
      start,
      end,
    } = offsetsOf(node,);
    diagnostics.push(diagnose({
      ruleId: ID,
      message: DETAIL,
      node,
      fix: {
        start,
        end,
        insertText: toHtmlTable({
          table: node,
          source,
        },)
          .join('\n',),
      },
    },),);
  }
  return diagnostics;
}

/**
 * Bans Markdown pipe tables. An HTML `<table>` parses as `html`, not a `table`
 * node, so it is never flagged. Custom rule ported from the token-based
 * markdownlint plugin to mdast.
 */
export const noPipeTables: Rule = {
  id: ID,
  fixable: true,
  check: checkNoPipeTables,
};
