/**
 * Structural TSDoc rules for comment alignment and multiline format.
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
 * Enforces consistent alignment of asterisks in TSDoc block comments.
 *
 * Each line of a TSDoc comment (except the opener) must have its leading `*`
 * aligned with the first `*` of the opening `/**`.
 */
export const checkAlignment: CreateOnceRule = {
  meta: {
    type: 'layout',
    docs: {
      description: 'Enforce consistent alignment of leading asterisks in TSDoc comments.',
      recommended: true,
    },
    messages: {
      misaligned:
        'TSDoc asterisk misaligned: expected {{expected}} spaces of indent, found {{actual}}.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    return createTsdocVisitor(
      context,
      function checkAlignmentHandler(_node, comment,): void {
        const lines = getCommentLines(comment,);
        if (lines.length < 2)
          return;

        // The opening line `* ...` sets the expected indent
        // comment.loc.start.column is the column of `/*`, so `*` alignment is column + 1
        const expectedIndent = comment.loc.start.column + 1;

        lines.slice(1,).forEach(function checkLine(line, index,): void {
          const trimmed = line.trimStart();
          if (trimmed.length === 0)
            return;
          if (!trimmed.startsWith('*',))
            return;
          const actualIndent = line.length - trimmed.length;
          if (actualIndent !== expectedIndent) {
            context.report({
              loc: {
                start: { line: comment.loc.start.line + index + 1,
                  column: actualIndent, },
              },
              messageId: 'misaligned',
              data: { expected: String(expectedIndent,), actual: String(actualIndent,), },
            },);
          }
        },);
      },
    );
  },
};

/**
 * Enforces that TSDoc comments use multiline block style.
 *
 * Single-line `/** comment *\/` is reported when the content warrants
 * a multiline format (contains tags or multiple sentences).
 */
export const multilineBlocks: CreateOnceRule = {
  meta: {
    type: 'layout',
    docs: {
      description: 'Enforce multiline format for TSDoc block comments.',
      recommended: true,
    },
    messages: {
      singleLine: 'TSDoc comment with tags must use multiline format.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    return createTsdocVisitor(
      context,
      function multilineHandler(_node, comment,): void {
      const lines = getCommentLines(comment,);
      /** Minimum line count for a proper multiline comment: opener, content, closer. */
      const minMultilineLines = 3;
      // A proper multiline comment has at least 3 lines: opener, content, closer
      if (lines.length >= minMultilineLines)
        return;
      // Single-line comment containing a tag should be multiline
      if (comment.value.includes('@',))
        context.report({ node: comment, messageId: 'singleLine', },);
    },
    );
  },
};

export { noMultiAsterisks, } from './asterisk-validation.ts';

export {
  emptyTags,
  escapeInlineTags,
  tagLines,
} from './structural-tags.ts';
