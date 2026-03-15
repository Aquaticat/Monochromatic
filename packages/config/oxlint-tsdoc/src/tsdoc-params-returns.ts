/**
 * Return-type and generator detection utilities for TSDoc rules.
 *
 * Extracted from `tsdoc-params.ts` to keep files under 100 countable lines.
 *
 * @module
 */

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
  if (node.type === 'MethodDefinition' || node.type === 'TSAbstractMethodDefinition') {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    return node.value as Record<string, unknown> | undefined;
  }
  return node;
}

/**
 * Checks whether a function-like node has a non-void return type or return statements.
 *
 * @param node - AST node to inspect
 *
 * @returns true when function appears to return a value
 */
export function functionReturnsValue(node: Span & Record<string, unknown>,): boolean {
  // Check kind on the outer MethodDefinition BEFORE unwrapping to .value,
  // because `kind` ("constructor", "get", "set", "method") is a property
  // of MethodDefinition, not of the inner FunctionExpression.
  if (node.type === 'MethodDefinition' || node.type === 'TSAbstractMethodDefinition') {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    const kind = (node as Record<string, unknown>).kind as string | undefined;
    if (kind === 'constructor' || kind === 'set')
      return false;
  }

  const target = unwrapMethodDefinition(node,);

  if (target === undefined)
    return false;

  // Check for explicit void/never return type annotation
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
  const returnType = target.returnType as Record<string, unknown> | undefined | null;
  if (returnType !== undefined && returnType !== null) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    const typeAnnotation = returnType.typeAnnotation as
      | Record<string, unknown>
      | undefined;
    if (typeAnnotation !== undefined) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
      const tsType = typeAnnotation.type as string | undefined;
      if (tsType === 'TSVoidKeyword' || tsType === 'TSNeverKeyword')
        return false;
      /**
       * Handle `Promise<void>` and `Promise<never>` return types.
       * The AST represents these as `TSTypeReference` with `typeName.name === 'Promise'`
       * and a single type parameter of `TSVoidKeyword` or `TSNeverKeyword`.
       */
      if (tsType === 'TSTypeReference') {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const typeName = typeAnnotation.typeName as Record<string, unknown> | undefined;
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const name = typeName?.name as string | undefined;
        if (name === 'Promise') {
          // oxc AST uses `typeArguments` (not `typeParameters`) for generic type arguments
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
          const typeArgs = typeAnnotation.typeArguments as
            | Record<string, unknown>
            | undefined;
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
          const params = typeArgs?.params as Record<string, unknown>[] | undefined;
          if (params !== undefined && params.length === 1) {
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
            const innerType = params[0]?.type as string | undefined;
            if (innerType === 'TSVoidKeyword' || innerType === 'TSNeverKeyword')
              return false;
          }
        }
      }
    }
  }

  return true;
}

/**
 * Checks whether a function-like node is a generator (has `generator: true`).
 *
 * @param node - AST node to inspect
 *
 * @returns true when the function is a generator
 */
export function isGeneratorFunction(node: Span & Record<string, unknown>,): boolean {
  const target = unwrapMethodDefinition(node,);

  if (target === undefined)
    return false;

  return target.generator === true;
}
