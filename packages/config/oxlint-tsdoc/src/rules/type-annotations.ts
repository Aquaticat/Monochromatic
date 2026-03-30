/**
 * TSDoc type annotation disallow rule.
 *
 * Extracted from `tag-types.ts` to keep files under 100 countable lines.
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
} from './tsdoc-visitors.ts';

/**
 * Disallows type annotations in TSDoc tags.
 *
 * In TypeScript projects, types are expressed via type annotations, not JSDoc-style
 * `{Type}` syntax. Reports param/returns with `{Type}` syntax.
 */
export const noTypes: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow JSDoc-style type annotations in TSDoc comments.',
      recommended: true,
    },
    messages: {
      noType:
        'Type annotations in TSDoc are not allowed in TypeScript. Remove the "{{{type}}}" type.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    /** Regex detecting JSDoc-style type annotations like `{Type}` after a tag. */
    const typePattern = /@\w+\s+\{([^}]+)\}/g;

    return createTsdocVisitor(
      context,
      function noTypesHandler(_node, comment,): void {
        const lines = comment.value.split('\n',);
        lines.forEach(function checkLine(line, index,): void {
          const trimmed = line.trimStart().replace(COMMENT_LINE_PREFIX, '',).trimStart();
          // Reset regex state
          typePattern.lastIndex = 0;
          let match = typePattern.exec(trimmed,);
          while (match !== null) {
            context.report({
              loc: {
                start: { line: comment.loc.start.line + index, column: 0, },
              },
              messageId: 'noType',
              data: { type: match[1] ?? 'unknown', },
            },);
            match = typePattern.exec(trimmed,);
          }
        },);
      },
    );
  },
};
