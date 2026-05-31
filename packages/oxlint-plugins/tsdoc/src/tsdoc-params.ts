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
import type { ReadonlyDeep, } from 'type-fest';

import {
  extractRawParams,
  isRecord,
  type ReadonlyRecord,
} from './ast-access.ts';

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
  node: Span & ReadonlyRecord,
): readonly string[] {
  return extractRawParams(node,)
    .flatMap(function extractName(param,): readonly string[] {
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
function extractBindingName(pattern: ReadonlyRecord,): readonly string[] {
  if (pattern.type
    === 'Identifier') {
    /**
     * Identifier text of the parameter binding; `this` is skipped because it is not a real param.
     */
    const { name, } = pattern;
    // Skip `this` parameter in TypeScript
    if ((typeof name)
      !== 'string')
      return [];
    return name === 'this' ? [] : [name,];
  }
  if (pattern.type
    === 'AssignmentPattern') {
    /**
     * Binding side of `name = default`; recurse to collect the actual name.
     */
    const { left, } = pattern;
    return isRecord(left,) ? extractBindingName(left,) : [];
  }
  if (pattern.type
    === 'RestElement') {
    /**
     * Inner binding of `...rest`; recurse to collect its name.
     */
    const { argument, } = pattern;
    return isRecord(argument,) ? extractBindingName(argument,) : [];
  }
  if (pattern.type
    === 'TSParameterProperty') {
    /**
     * Inner parameter of a TS constructor `public/private` param; recurse on it.
     */
    const { parameter, } = pattern;
    return isRecord(parameter,) ? extractBindingName(parameter,) : [];
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
export function extractDocParamNames(docComment: ReadonlyDeep<DocComment>,): readonly string[] {
  return docComment.params
    .blocks
    .map(
      function getParamName(block: ReadonlyDeep<DocParamBlock>,): string {
        return block.parameterName;
      },
    );
}

export { extractDestructuredParamNames, } from './tsdoc-destructured.ts';

export {
  functionReturnsValue,
  isGeneratorFunction,
} from './tsdoc-params-returns.ts';
