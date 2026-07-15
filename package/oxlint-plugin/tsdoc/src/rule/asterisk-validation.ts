/**
 * TSDoc asterisk validation rule.
 *
 * Extracted from `structural.ts` to keep files under 100 countable lines.
 *
 * @module
 */

import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type {
  Context,
  CreateOnceRule,
  VisitorWithHooks,
} from '@oxlint/plugins';

import {
  commentLineReportLoc,
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
  /**
   * Handles effectful plugin callback.
   *
   * @param context - Foreign callback value carrying diagnostic capability.
   *
   * @mutates context - Emits Oxlint diagnostics through foreign rule context.
   *
   * @example
   * ```ts
   * createOnce(context);
   * ```
   */
  createOnce(context: ForeignBorrowed<Context>,): VisitorWithHooks {
    return createTsdocVisitor({
      context,
      handler: function noMultiHandler(
        _node,
        comment,
      ): void {
        /**
         * Comment body split into lines; opener and closer are sliced off before scanning.
         */
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
            /**
             * Leading-whitespace-stripped line; needed to detect a `**` that should be a single `*`.
             */
            const trimmed = line.trimStart();
            // After the leading *, check for immediate additional *
            if ((trimmed.startsWith('**',))
              && (!trimmed.startsWith('*/',))) {
              context.report({
                loc: commentLineReportLoc({
                  comment,
                  lineOffset: index + 1,
                },),
                messageId: 'extra',
              },);
            }
          },);
      },
    },);
  },
};
