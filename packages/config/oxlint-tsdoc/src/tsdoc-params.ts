/**
 * Parameter extraction utilities for TSDoc rules.
 *
 * Functions for extracting parameter names from function-like AST nodes,
 * including support for binding patterns.
 *
 * @module
 */

import type {
  DocComment,
  DocParamBlock,
} from '@microsoft/tsdoc';

import type { Span, } from '@oxlint/plugins';

/**
 * Unwraps a MethodDefinition or TSAbstractMethodDefinition to its inner
 * function value, or returns the node itself for other function-like types.
 *
 * @param node - AST node representing a function-like declaration
 *
 * @returns inner function node, or undefined when node has no `.value`
 */
function unwrapMethodDefinition(
  node: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if ((node.type === 'MethodDefinition')
    || (node.type === 'TSAbstractMethodDefinition'))
  {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    return node.value as Record<string, unknown> | undefined;
  }
  return node;
}

/**
 * Extracts the raw `params` array from a function-like AST node.
 *
 * Handles unwrapping MethodDefinition to its inner function value.
 *
 * @param node - AST node representing a function-like declaration
 *
 * @returns raw parameter AST nodes, or empty array when absent
 */
function extractRawParams(
  node: Record<string, unknown>,
): readonly Record<string, unknown>[] {
  /** Inner function value (for methods) or the node itself; the `.params` array lives here. */
  const target = unwrapMethodDefinition(node,);
  if (target === undefined)
    return [];
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
  return target.params as Record<string, unknown>[] | undefined ?? [];
}

/**
 * Extracts parameter names from a function-like AST node.
 *
 * Handles FunctionDeclaration, FunctionExpression, ArrowFunctionExpression,
 * MethodDefinition, and TSMethodSignature nodes.
 *
 * @param node - AST node representing a function-like declaration
 *
 * @returns array of parameter name strings, excluding rest-element `...` prefix
 *
 * @example
 * ```ts
 * const names = extractParamNames(functionNode);
 * // ['first', 'second', 'options']
 * ```
 */
export function extractParamNames(
  node: Span & Record<string, unknown>,
): readonly string[] {
  return extractRawParams(node,).flatMap(function extractName(param,): readonly string[] {
    return extractBindingName(param,);
  },);
}

/**
 * Recursively extracts binding names from a parameter pattern.
 *
 * @param pattern - AST binding pattern node
 *
 * @returns array of extracted name strings
 */
function extractBindingName(pattern: Record<string, unknown>,): readonly string[] {
  if (pattern.type === 'Identifier') {
    /** Identifier text of the parameter binding; `this` is skipped because it is not a real param. */
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    const name = pattern.name as string;
    // Skip `this` parameter in TypeScript
    return name === 'this' ? [] : [name,];
  }
  if (pattern.type === 'AssignmentPattern') {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    return extractBindingName(pattern.left as Record<string, unknown>,);
  }
  if (pattern.type === 'RestElement') {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    return extractBindingName(pattern.argument as Record<string, unknown>,);
  }
  if (pattern.type === 'TSParameterProperty') {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    return extractBindingName(pattern.parameter as Record<string, unknown>,);
  }
  // ObjectPattern, ArrayPattern, and other types don't map to individual @param names
  return [];
}

/**
 * Extracts documented param names from a parsed TSDoc comment.
 *
 * @param docComment - parsed TSDoc DocComment
 *
 * @returns array of parameter names found in param tags
 *
 * @example
 * ```ts
 * const docParamNames = extractDocParamNames(result.docComment);
 * ```
 */
export function extractDocParamNames(docComment: DocComment,): readonly string[] {
  return docComment.params.blocks.map(
    function getParamName(block: DocParamBlock,): string {
      return block.parameterName;
    },
  );
}

export { extractDestructuredParamNames, } from './tsdoc-destructured.ts';

export {
  functionReturnsValue,
  isGeneratorFunction,
} from './tsdoc-params-returns.ts';
