import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';
import type { ReadonlyDeep, } from 'type-fest';

import type { ReadonlyRecord, } from '../ast-access.ts';
import {
  isGeneratorFunction,
  NO_TSDOC,
  parseTsdocForNode,
  shouldIgnoreFile,
  type TsdocParseResult,
} from '../tsdoc-utils.ts';

import { commentReportLoc, } from './tsdoc-visitors.ts';

//region Shared

/**
 * Parameters for the local {@link createFunctionTsdocVisitor}.
 */
type CreateFunctionTsdocVisitorParams = {
  /**
   * Oxlint rule context.
   */
  readonly context: Context;
  /**
   * Invoked with node and parsed TSDoc.
   */
  readonly handler: (
    node: Span & ReadonlyRecord,
    result: ReadonlyDeep<TsdocParseResult>,
  ) => void;
};

/**
 * Creates a visitor for function-like nodes with TSDoc comments.
 *
 * Local variant: skips ArrowFunctionExpression because arrow functions
 * cannot be generators, so yields-related rules never need to visit them.
 *
 * @returns visitor with hooks
 */
function createFunctionTsdocVisitor({
  context,
  handler,
}: CreateFunctionTsdocVisitorParams,): VisitorWithHooks {
  /**
   * Checks a function-like node for TSDoc and invokes handler.
   *
   * @param node - AST node to check
   */
  function check(node: Span,): void {
    /**
     * Parsed TSDoc bundle for the node; absent means no TSDoc and the handler is skipped.
     */
    const result = parseTsdocForNode({
      node,
      context,
    },);
    if (result === NO_TSDOC)
      return;
    /**
     * Narrowed view that exposes the host AST's untyped extra properties to the handler.
     */
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    const typedNode = node as Span & Record<string, unknown>;
    handler(
      typedNode,
      result,
    );
  }

  /**
   * Visitor object built up before the unsafe cast that satisfies the host's index-signature type.
   */
  const visitor = {
    before() {
      if (shouldIgnoreFile(context.filename,))
        return false;
      return undefined;
    },
    FunctionDeclaration: check,
    FunctionExpression: check,
    MethodDefinition: check,
  } as VisitorWithHooks;
  return visitor;
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
function hasYieldsTag(result: ReadonlyDeep<TsdocParseResult>,): boolean {
  return result.comment
    .value
    .includes('@yields',);
}

/**
 * Requires yield documentation for generator functions.
 *
 * @example
 * ```ts
 * // Bad; missing yield documentation for generator
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
    return createFunctionTsdocVisitor({
      context,
      handler: function requireYieldsHandler(
        node,
        result,
      ): void {
        if (!isGeneratorFunction(node,))
          return;
        if (!hasYieldsTag(result,)) {
          context.report({
            loc: commentReportLoc(result.comment,),
            messageId: 'missing',
          },);
        }
      },
    },);
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
    return createFunctionTsdocVisitor({
      context,
      handler: function requireYieldsCheckHandler(
        node,
        result,
      ): void {
        if ((!isGeneratorFunction(node,)) && hasYieldsTag(result,)) {
          context.report({
            loc: commentReportLoc(result.comment,),
            messageId: 'notGenerator',
          },);
        }
      },
    },);
  },
};
