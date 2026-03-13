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
 *
 * @param handler - invoked with node and parsed TSDoc
 *
 * @returns visitor with hooks
 */
function createFunctionTsdocVisitor(
  context: Context,
  handler: (node: Span & Record<string, unknown>, result: TsdocParseResult) => void,
): VisitorWithHooks {
  /**
   * Checks a function-like node for TSDoc and invokes handler.
   *
   * @param node - AST node to check
   */
  function check(node: Span): void {
    const result = parseTsdocForNode(node, context);
    if (result === undefined) {
      return;
    }
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- oxlint plugin API is untyped
    handler(node as Span & Record<string, unknown>, result);
  }

  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
  return {
    before() {
      if (shouldIgnoreFile(context.filename)) {
        return false;
      }
      return;
    },
    FunctionDeclaration: check,
    FunctionExpression: check,
    ArrowFunctionExpression: check,
    MethodDefinition: check,
  } as VisitorWithHooks;
}

//endregion Shared

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
  createOnce(context: Context): VisitorWithHooks {
    return createFunctionTsdocVisitor(context, function requireReturnsHandler(node, result): void {
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
  createOnce(context: Context): VisitorWithHooks {
    return createFunctionTsdocVisitor(context, function requireReturnsCheckHandler(node, result): void {
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
 * Requires that returns tags have a description.
 *
 * Uses `PlainTextEmitter.hasAnyTextContent` to detect empty returns
 * tags where the TSDoc parser creates a paragraph node containing only
 * whitespace or soft breaks.
 *
 * @example
 * ```ts
 * // Bad -- empty returns tag
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
    return createFunctionTsdocVisitor(context, function requireReturnsDescHandler(_node, result): void {
      const { returnsBlock } = result.docComment;
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
