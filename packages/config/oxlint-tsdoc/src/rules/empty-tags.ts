/**
 * TSDoc empty modifier tag validation rule.
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
 * Enforces that TSDoc tags which should not have content are empty.
 *
 * Modifier tags like `\@public`, `\@readonly`, `\@override`, `\@sealed`,
 * `\@virtual`, `\@alpha`, `\@beta`, `\@internal`, `\@experimental`,
 * `\@eventProperty`, and `\@packageDocumentation` must not have content.
 */
export const emptyTags: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce that TSDoc modifier tags have no content.',
      recommended: true,
    },
    messages: {
      nonEmpty: 'TSDoc modifier tag "{{tag}}" must not have content.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    /** Tags that must be standalone (no content after them). */
    const modifierTags = new Set([
      '@public',
      '@readonly',
      '@override',
      '@sealed',
      '@virtual',
      '@alpha',
      '@beta',
      '@internal',
      '@experimental',
      '@eventProperty',
      '@packageDocumentation',
    ],);

    return createTsdocVisitor({
      context,
      handler: function emptyTagsHandler(
        _node,
        comment,
      ): void {
        /** Comment body split into lines; each is inspected independently for modifier-tag misuse. */
        const lines = getCommentLines(comment,);
        lines.forEach(function checkLine(
          line,
          index,
        ): void {
          /** Line stripped of indent and `*` so the leading `@tag` (if any) is at column 0. */
          const trimmed = line
            .trimStart()
            .replace(
              COMMENT_LINE_PREFIX,
              '',
            )
            .trimStart();
          /** Match of `@tag <text>`; null when the line carries no tag with trailing text. */
          const tagMatch = (/^(@\w+)\s+(.+)/).exec(trimmed,);
          if (tagMatch === null)
            return;
          /** Captured tag name and remainder; both populate the diagnostic and gate the report. */
          const {
            1: tag,
            2: rest,
          } = tagMatch;
          if (tag !== undefined
            && modifierTags.has(tag,)
            && rest !== undefined
            && rest.trim().length > 0)
          {
            context.report({
              loc: {
                start: {
                  line: comment.loc.start.line + index,
                  column: 0,
                },
              },
              messageId: 'nonEmpty',
              data: { tag, },
            },);
          }
        },);
      },
    },);
  },
};
