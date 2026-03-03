import { PlainTextEmitter } from '@microsoft/tsdoc';

import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import {
  functionReturnsValue,
  parseTsdocForNode,
  shouldIgnoreFile,
  type TsdocParseResult,
} from '../tsdoc-utils.ts';

//region Shared

/**
 * Creates a visitor for function-like nodes with TSDoc comments.
 *
 * @param context - oxlint rule context
 * @param callback - invoked with node and parsed TSDoc
 * @returns visitor with hooks
 */
function createFunctionTsdocVisitor(
  context: Context,
  callback: (node: Span & Record<string, unknown>, result: TsdocParseResult) => void,
): VisitorWithHooks {
  /** Checks a function-like node. */
  function check(node: Span): void {
    const result = parseTsdocForNode(node, context);
    if (result === undefined) {
      return;
    }
    callback(node as Span & Record<string, unknown>, result);
  }

  return {
    before(): false | undefined {
      if (shouldIgnoreFile(context.filename)) {
        return false;
      }
    },
    FunctionDeclaration: check,
    FunctionExpression: check,
    ArrowFunctionExpression: check,
    MethodDefinition: check,
  } as VisitorWithHooks;
}

//endregion Shared

/**
 * Requires `@returns` tag for functions that return a value.
 *
 * Skips void/never return types, constructors, and setters.
 *
 * @example
 * ```ts
 * // Bad -- missing @returns
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
  createOnce(context: Context): VisitorWithHooks {
    return createFunctionTsdocVisitor(context, function requireReturnsCallback(node, result): void {
      if (!functionReturnsValue(node)) {
        return;
      }
      if (result.docComment.returnsBlock === undefined) {
        context.report({
          node: result.comment,
          messageId: 'missing',
        });
      }
    });
  },
};

/**
 * Validates `@returns` tag consistency with the function signature.
 *
 * Reports `@returns` on void functions, and missing `@returns` on
 * functions with non-void return types (when `@returns` is present
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
  createOnce(context: Context): VisitorWithHooks {
    return createFunctionTsdocVisitor(context, function requireReturnsCheckCallback(node, result): void {
      if (!functionReturnsValue(node) && result.docComment.returnsBlock !== undefined) {
        context.report({
          node: result.comment,
          messageId: 'voidReturn',
        });
      }
    });
  },
};

/**
 * Requires that `@returns` tags have a description.
 *
 * Uses `PlainTextEmitter.hasAnyTextContent` to detect empty `@returns`
 * tags where the TSDoc parser creates a paragraph node containing only
 * whitespace or soft breaks.
 *
 * @example
 * ```ts
 * // Bad -- empty @returns
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
  createOnce(context: Context): VisitorWithHooks {
    return createFunctionTsdocVisitor(context, function requireReturnsDescCallback(_node, result): void {
      const returnsBlock = result.docComment.returnsBlock;
      if (returnsBlock === undefined) {
        return;
      }
      if (!PlainTextEmitter.hasAnyTextContent(returnsBlock.content)) {
        context.report({
          node: result.comment,
          messageId: 'missingDescription',
        });
      }
    });
  },
};
