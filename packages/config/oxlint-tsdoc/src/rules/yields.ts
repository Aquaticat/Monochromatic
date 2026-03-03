import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import {
  isGeneratorFunction,
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
    MethodDefinition: check,
  } as VisitorWithHooks;
}

//endregion Shared

/**
 * Checks whether a TSDoc comment contains `@yields` tag.
 *
 * TSDoc standard doesn't define `@yields` natively, so check the raw comment text.
 *
 * @param result - parsed TSDoc result
 * @returns true when @yields is documented
 */
function hasYieldsTag(result: TsdocParseResult): boolean {
  return result.comment.value.includes('@yields');
}

/**
 * Requires `@yields` tag for generator functions.
 *
 * @example
 * ```ts
 * // Bad -- missing @yields for generator
 * /\** Generates numbers. *\/
 * function* count(): Generator<number> { yield 1; }
 *
 * // Good
 * /\**
 *  * Generates numbers.
 *  * @yields sequential integers
 *  *\/
 * function* count(): Generator<number> { yield 1; }
 * ```
 */
export const requireYields: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require @yields tag for generator functions.',
      recommended: true,
    },
    messages: {
      missing: 'Missing @yields tag for generator function.',
    },
  },
  createOnce(context: Context): VisitorWithHooks {
    return createFunctionTsdocVisitor(context, function requireYieldsCallback(node, result): void {
      if (!isGeneratorFunction(node)) {
        return;
      }
      if (!hasYieldsTag(result)) {
        context.report({
          node: result.comment,
          messageId: 'missing',
        });
      }
    });
  },
};

/**
 * Validates `@yields` tag consistency with generator functions.
 *
 * Reports `@yields` on non-generator functions.
 */
export const requireYieldsCheck: CreateOnceRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Validate @yields tag consistency with generator functions.',
      recommended: true,
    },
    messages: {
      notGenerator: 'Function is not a generator but has @yields tag.',
    },
  },
  createOnce(context: Context): VisitorWithHooks {
    return createFunctionTsdocVisitor(context, function requireYieldsCheckCallback(node, result): void {
      if (!isGeneratorFunction(node) && hasYieldsTag(result)) {
        context.report({
          node: result.comment,
          messageId: 'notGenerator',
        });
      }
    });
  },
};
