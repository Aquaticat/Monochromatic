/**
 * TSDoc returns description validation rule.
 *
 * Extracted from `returns.ts` to keep files under 100 countable lines.
 *
 * @module
 */

import { PlainTextEmitter, } from '@microsoft/tsdoc';

import type {
  Context,
  CreateOnceRule,
  VisitorWithHooks,
} from '@oxlint/plugins';

import { createFunctionTsdocVisitor, } from './tsdoc-visitors.ts';

/**
 * Requires that returns tags have a description.
 *
 * Uses `PlainTextEmitter.hasAnyTextContent` to detect empty returns
 * tags where the TSDoc parser creates a paragraph node containing only
 * whitespace or soft breaks.
 *
 * @example
 * ```ts
 * // Bad; empty returns tag
 * /\** @returns *\/
 * function getName(): string { return 'name'; }
 *
 * // Good
 * /\** @returns display name of current user *\/
 * function getName(): string { return 'name'; }
 * ```
 */
export const requireReturnsDescription: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require descriptions for @returns tags.',
      recommended: true,
    },
    messages: {
      missingDescription: '@returns tag is missing a description.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    return createFunctionTsdocVisitor({
      context,
      handler: function requireReturnsDescHandler(
        _node,
        result,
      ): void {
        const { returnsBlock, } = result.docComment;
        if (returnsBlock === undefined)
          return;
        if (!PlainTextEmitter.hasAnyTextContent(returnsBlock.content,)) {
          context.report({
            node: result.comment,
            messageId: 'missingDescription',
          },);
        }
      },
    },);
  },
};
