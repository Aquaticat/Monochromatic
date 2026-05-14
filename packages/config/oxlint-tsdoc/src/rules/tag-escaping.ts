/**
 * TSDoc inline tag escaping rule.
 *
 * Extracted from `structural-tags.ts` to keep files under 100 countable lines.
 *
 * @module
 */

import type {
  Context,
  CreateOnceRule,
  VisitorWithHooks,
} from '@oxlint/plugins';

import {
  COMMENT_LINE_PREFIX,
  createTsdocVisitor,
  getCommentLines,
} from './tsdoc-visitors.ts';

/**
 * Enforces that `*\/` inside TSDoc content is escaped as `*\\/`.
 *
 * An unescaped `*\/` would prematurely close the comment block.
 */
export const escapeInlineTags: CreateOnceRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce escaping of `*/` inside TSDoc comments.',
      recommended: true,
    },
    messages: {
      unescaped: String.raw`Unescaped '*/' inside TSDoc content. Use '*\/' instead.`,
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    return createTsdocVisitor({
      context,
      handler: function escapeHandler(
        _node,
        comment,
      ): void {
        /** Comment body split into lines; the last (legitimate closer) is dropped before scanning. */
        const lines = getCommentLines(comment,);
        // Skip the last line which is the legitimate closing `*/`
        lines
          .slice(
            0,
            -1,
          )
          .forEach(function checkLine(
            line,
            index,
          ): void {
            // Skip the first line opener
            if (index === 0 && line.trimEnd().endsWith('*',))
              return;
            /** Line stripped of indent and `*` so an embedded `*\/` becomes detectable in content. */
            const trimmed = line.trimStart().replace(
              COMMENT_LINE_PREFIX,
              '',
            );
            // Look for `*/` not preceded by backslash inside content
            if (/(?<!\\)\*\//.test(trimmed,)) {
              context.report({
                loc: {
                  start: {
                    line: comment.loc.start.line + index,
                    column: 0,
                  },
                },
                messageId: 'unescaped',
              },);
            }
          },);
      },
    },);
  },
};
