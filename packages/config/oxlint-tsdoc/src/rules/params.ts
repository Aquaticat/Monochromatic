import { PlainTextEmitter } from '@microsoft/tsdoc';

import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import {
  extractDestructuredParamNames,
  extractDocParamNames,
  extractParamNames,
  findTsdocComment,
  parseTsdocForNode,
  shouldIgnoreFile,
  type TsdocParseResult,
} from '../tsdoc-utils.ts';

//region Shared

/** Function-like node types that can have parameters. */
const FUNCTION_LIKE_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'MethodDefinition',
  'TSAbstractMethodDefinition',
]);

/**
 * Checks whether a node is function-like (can have parameters).
 *
 * @param node - AST node to test
 *
 * @returns true for function-like nodes
 */
function isFunctionLike(node: Span & Record<string, unknown>): boolean {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- oxlint plugin API is untyped
  return FUNCTION_LIKE_TYPES.has(node.type as string);
}

/**
 * Creates a visitor for function-like nodes that have TSDoc comments.
 *
 * @param context - oxlint rule context
 *
 * @param handler - invoked with node and parsed TSDoc for each function-like node
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
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- oxlint plugin API is untyped
    const typedNode = node as Span & Record<string, unknown>;
    if (!isFunctionLike(typedNode)) {
      return;
    }
    const result = parseTsdocForNode(node, context);
    if (result === undefined) {
      return;
    }
    handler(typedNode, result);
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
 * Validates that `\@param` tag names match the function's actual parameter names.
 *
 * Reports mismatches, incorrect order, and `\@param` tags for nonexistent parameters.
 * Allows `\@param` tags that match property names from destructured parameters
 * (ObjectPattern/ArrayPattern), since documenting destructured properties by
 * name is a common TSDoc convention.
 *
 * @example
 * ```ts
 * // Bad -- parameter name doesn't match
 * /\** \@param x - description *\/
 * function foo(name: string): void {}
 *
 * // Good
 * /\** \@param name - description *\/
 * function foo(name: string): void {}
 *
 * // Good -- destructured property names are allowed
 * /\** \@param value - item to process *\/
 * function foo({ value }: Options): void {}
 * ```
 */
export const checkParamNames: CreateOnceRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Validate that @param names match function parameter names.',
      recommended: true,
    },
    messages: {
      mismatch: '@param "{{docName}}" does not match parameter "{{paramName}}".',
      extra: '@param "{{docName}}" does not match any function parameter.',
      order: '@param tags are not in the same order as the function parameters.',
    },
  },
  createOnce(context: Context): VisitorWithHooks {
    return createFunctionTsdocVisitor(context, function checkParamNamesHandler(node, result): void {
      const paramNames = extractParamNames(node);
      const docParamNames = extractDocParamNames(result.docComment);
      const destructuredNames = extractDestructuredParamNames(node);

      // Check each documented param exists in the function signature
      docParamNames.forEach(function checkDocParam(docName, index): void {
        // Allow @param tags that match destructured property names
        if (destructuredNames.has(docName)) {
          return;
        }

        const correspondingParam = paramNames[index];
        if (correspondingParam === undefined) {
          // Extra @param with no matching parameter
          if (!paramNames.includes(docName)) {
            context.report({
              node: result.comment,
              messageId: 'extra',
              data: { docName },
            });
          } else {
            context.report({
              node: result.comment,
              messageId: 'order',
            });
          }
        } else if (docName !== correspondingParam) {
          context.report({
            node: result.comment,
            messageId: 'mismatch',
            data: { docName, paramName: correspondingParam },
          });
        }
      });
    });
  },
};

/**
 * Requires `\@param` tags for all function parameters.
 *
 * @example
 * ```ts
 * // Bad -- missing \@param for `count`
 * /\** \@param name - user name *\/
 * function greet(name: string, count: number): void {}
 *
 * // Good
 * /\**
 *  * \@param name - user name
 *  * \@param count - greeting count
 *  *\/
 * function greet(name: string, count: number): void {}
 * ```
 */
export const requireParam: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require @param tags for all function parameters.',
      recommended: true,
    },
    messages: {
      missing: 'Missing @param tag for "{{paramName}}".',
    },
  },
  createOnce(context: Context): VisitorWithHooks {
    return createFunctionTsdocVisitor(context, function requireParamHandler(node, result): void {
      const paramNames = extractParamNames(node);
      const docParamNames = new Set(extractDocParamNames(result.docComment));

      paramNames.forEach(function checkParam(paramName): void {
        if (!docParamNames.has(paramName)) {
          context.report({
            node: result.comment,
            messageId: 'missing',
            data: { paramName },
          });
        }
      });
    });
  },
};

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
  createOnce(context: Context): VisitorWithHooks {
    return createFunctionTsdocVisitor(context, function requireParamNameHandler(_node, result): void {
      result.docComment.params.blocks.forEach(function checkBlock(block): void {
        if (block.parameterName.trim().length === 0) {
          context.report({
            node: result.comment,
            messageId: 'missingName',
          });
        }
      });
    });
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
  createOnce(context: Context): VisitorWithHooks {
    return createFunctionTsdocVisitor(context, function requireParamDescHandler(_node, result): void {
      result.docComment.params.blocks.forEach(function checkBlock(block): void {
        if (!PlainTextEmitter.hasAnyTextContent(block.content)) {
          context.report({
            node: result.comment,
            messageId: 'missingDescription',
            data: { paramName: block.parameterName },
          });
        }
      });
    });
  },
};
