/**
 * TSDoc returns tag validation rules.
 *
 * @module
 */

import type {
  Context,
  CreateOnceRule,
  VisitorWithHooks,
} from '@oxlint/plugins';

import { functionReturnsValue, } from '../tsdoc-utils.ts';

import { createFunctionTsdocVisitor, } from './tsdoc-visitors.ts';

/**
 * Requires returns tag for functions that return a value.
 *
 * Skips void/never return types, constructors, and setters.
 *
 * @example
 * ```ts
 * // Bad -- missing returns tag
 * /\** Adds numbers. *\/
 * function add(a: number, b: number): number { return a + b; }
 *
 * // Good
 * /\**
 *  * Adds numbers.
 *  * @returns sum of a and b
 *  *\/
 * function add(a: number, b: number): number { return a + b; }
 * ```
 */
export const requireReturns: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require @returns tag for functions that return a value.',
      recommended: true,
    },
    messages: {
      missing: 'Missing @returns tag for function that returns a value.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    return createFunctionTsdocVisitor(
      context,
      function requireReturnsHandler(
        node,
        result,
      ): void {
        if (!functionReturnsValue(node,))
          return;
        if (result.docComment.returnsBlock === undefined) {
          context.report({
            node: result.comment,
            messageId: 'missing',
          },);
        }
      },
    );
  },
};

/**
 * Validates returns tag consistency with the function signature.
 *
 * Reports returns tag on void functions, and missing returns tag on
 * functions with non-void return types (when returns tag is present
 * but the function doesn't return a value).
 */
export const requireReturnsCheck: CreateOnceRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Validate @returns tag consistency with function signature.',
      recommended: true,
    },
    messages: {
      voidReturn: 'Function has void/never return type but has @returns tag.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    return createFunctionTsdocVisitor(
      context,
      function requireReturnsCheckHandler(
        node,
        result,
      ): void {
        if (!functionReturnsValue(node,)
          && result.docComment.returnsBlock !== undefined)
        {
          context.report({
            node: result.comment,
            messageId: 'voidReturn',
          },);
        }
      },
    );
  },
};

export { requireReturnsDescription, } from './returns-description.ts';
