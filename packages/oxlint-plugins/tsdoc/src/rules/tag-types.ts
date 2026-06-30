/**
 * TSDoc structural validation rule.
 *
 * `validTypes` reports structural problems found by the in-house comment
 * scanner (missing `@param` hyphen, unclosed or empty inline tags).
 *
 * @module
 */

import type {
  Context,
  CreateOnceRule,
  VisitorWithHooks,
} from '@oxlint/plugins';

import {
  commentReportLoc,
  createParsedTsdocVisitor,
} from './tsdoc-visitors.ts';

/**
 * Reports structural TSDoc problems from the in-house comment scanner.
 *
 * Catches a `\@param` tag missing its hyphen separator and malformed inline
 * tags (unclosed `{\@link`, empty `{\@link}`).
 */
export const validTypes: CreateOnceRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Report structural TSDoc problems found by the comment scanner.',
      recommended: true,
    },
    messages: {
      parseError: 'TSDoc: {{message}}',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    return createParsedTsdocVisitor({
      context,
      handler: function validTypesHandler(
        _node,
        result,
      ): void {
        result.messages
          .forEach(function reportMessage(message,): void {
          context.report({
            loc: commentReportLoc(result.comment,),
            messageId: 'parseError',
            data: { message: `${message.messageId}: ${message.unformattedText}`, },
          },);
        },);
      },
    },);
  },
};

export { noTypes, } from './type-annotations.ts';
