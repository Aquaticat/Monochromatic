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
 *
 * @param handler - invoked with node and parsed TSDoc
 *
 * @returns visitor with hooks
 */
function createFunctionTsdocVisitor(
  context: Context,
  handler: (node: Span & Record<string, unknown>, result: TsdocParseResult,) => void,
): VisitorWithHooks {
  /**
   * Checks a function-like node for TSDoc and invokes handler.
   *
   * @param node - AST node to check
   */
  function check(node: Span,): void {
    const result = parseTsdocForNode(
      node,
      context,
    );
    if (result === undefined)
      return;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    handler(
      node as Span & Record<string, unknown>,
      result,
    );
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
  return {
    before() {
      if (shouldIgnoreFile(context.filename,))
        return false;
      return undefined;
    },
    FunctionDeclaration: check,
    FunctionExpression: check,
    MethodDefinition: check,
  } as VisitorWithHooks;
}

//endregion Shared

/**
 * Checks whether a TSDoc comment documents yielded values.
 *
 * TSDoc standard doesn't define a yields tag natively, so this checks
 * the raw comment text for the tag pattern.
 *
 * @param result - parsed TSDoc result
 *
 * @returns true when yielded values are documented
 */
function hasYieldsTag(result: TsdocParseResult,): boolean {
  return result.comment.value.includes('@yields',);
}

/**
 * Requires yield documentation for generator functions.
 *
 * @example
 * ```ts
 * // Bad -- missing yield documentation for generator
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
  createOnce(context: Context,): VisitorWithHooks {
    return createFunctionTsdocVisitor(
      context,
      function requireYieldsHandler(node, result,): void {
        if (!isGeneratorFunction(node,))
          return;
        if (!hasYieldsTag(result,)) {
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
 * Validates yield tag consistency with generator functions.
 *
 * Reports yield documentation on non-generator functions.
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
  createOnce(context: Context,): VisitorWithHooks {
    return createFunctionTsdocVisitor(
      context,
      function requireYieldsCheckHandler(node, result,): void {
        if (!isGeneratorFunction(node,) && hasYieldsTag(result,)) {
          context.report({
            node: result.comment,
            messageId: 'notGenerator',
          },);
        }
      },
    );
  },
};
