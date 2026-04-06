/**
 * TSDoc parameter name and description validation rules.
 *
 * Extracted from `params.ts` to keep files under 100 countable lines.
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
 * Requires that every `\@param` tag has a parameter name.
 *
 * Reports `\@param - description` (missing name before the hyphen).
 */
export const requireParamName: CreateOnceRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require @param tags to specify a parameter name.',
      recommended: true,
    },
    messages: {
      missingName: '@param tag is missing a parameter name.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    return createFunctionTsdocVisitor(
      context,
      function requireParamNameHandler(
        _node,
        result,
      ): void {
        result.docComment.params.blocks.forEach(function checkBlock(block,): void {
          if (block.parameterName.trim().length === 0) {
            context.report({
              node: result.comment,
              messageId: 'missingName',
            },);
          }
        },);
      },
    );
  },
};

/**
 * Requires that every `\@param` tag has a description after the parameter name.
 *
 * Uses `PlainTextEmitter.hasAnyTextContent` to detect empty `\@param`
 * tags where the TSDoc parser creates a paragraph node containing only
 * whitespace or soft breaks.
 *
 * @example
 * ```ts
 * // Bad -- no description
 * /\** \@param name *\/
 * function foo(name: string): void {}
 *
 * // Good
 * /\** \@param name - user name to display *\/
 * function foo(name: string): void {}
 * ```
 */
export const requireParamDescription: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require descriptions for @param tags.',
      recommended: true,
    },
    messages: {
      missingDescription: '@param "{{paramName}}" is missing a description.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    return createFunctionTsdocVisitor(
      context,
      function requireParamDescHandler(
        _node,
        result,
      ): void {
        result.docComment.params.blocks.forEach(function checkBlock(block,): void {
          if (!PlainTextEmitter.hasAnyTextContent(block.content,)) {
            context.report({
              node: result.comment,
              messageId: 'missingDescription',
              data: { paramName: block.parameterName, },
            },);
          }
        },);
      },
    );
  },
};
