/**
 * TSDoc asterisk validation rule.
 *
 * Extracted from `structural.ts` to keep files under 100 countable lines.
 *
 * @module
 */

import type {
  Context,
  CreateOnceRule,
  VisitorWithHooks,
} from '@oxlint/plugins';

import {
  createTsdocVisitor,
  getCommentLines,
} from './tsdoc-visitors.ts';

/**
 * Disallows multiple consecutive asterisks in TSDoc comment lines.
 *
 * Lines like ` ** text` are not valid TSDoc.
 */
export const noMultiAsterisks: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow extra asterisks at the start of TSDoc comment lines.',
      recommended: true,
    },
    messages: {
      extra: 'Extra asterisk at start of TSDoc comment line.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    return createTsdocVisitor({
      context,
      handler: function noMultiHandler(
        _node,
        comment,
      ): void {
        /** Comment body split into lines; opener and closer are sliced off before scanning. */
        const lines = getCommentLines(comment,);
        // Skip first line (opening) and last line (closing)
        lines
          .slice(
            1,
            -1,
          )
          .forEach(function checkLine(
            line,
            index,
          ): void {
            /** Leading-whitespace-stripped line; needed to detect a `**` that should be a single `*`. */
            const trimmed = line.trimStart();
            // After the leading *, check for immediate additional *
            if (trimmed.startsWith('**',) && !trimmed.startsWith('*/',)) {
              context.report({
                loc: {
                  start: {
                    line: comment.loc.start.line + index + 1,
                    column: 0,
                  },
                },
                messageId: 'extra',
              },);
            }
          },);
      },
    },);
  },
};
