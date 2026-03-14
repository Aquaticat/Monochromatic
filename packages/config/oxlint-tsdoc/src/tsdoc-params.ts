/**
 * Parameter extraction utilities for TSDoc rules.
 *
 * Functions for extracting parameter names from function-like AST nodes,
 * including support for destructured parameters and binding patterns.
 *
 * @module
 */

import type {
  DocComment,
  DocParamBlock,
} from '@microsoft/tsdoc';

import type {
  Span,
} from '@oxlint/plugins';

/**
 * Unwraps a MethodDefinition or TSAbstractMethodDefinition to its inner
 * function value, or returns the node itself for other function-like types.
 *
 * @param node - AST node representing a function-like declaration
 *
 * @returns inner function node, or undefined when node has no `.value`
 */
function unwrapMethodDefinition(node: Record<string, unknown>): Record<string, unknown> | undefined {
  if (node.type === 'MethodDefinition' || node.type === 'TSAbstractMethodDefinition') {
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
function extractRawParams(node: Record<string, unknown>): readonly Record<string, unknown>[] {
  const target = unwrapMethodDefinition(node);
  if (target === undefined) {
    return [];
  }
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
export function extractParamNames(node: Span & Record<string, unknown>): readonly string[] {
  return extractRawParams(node).flatMap(function extractName(param): readonly string[] {
    return extractBindingName(param);
  });
}

/**
 * Recursively extracts binding names from a parameter pattern.
 *
 * @param pattern - AST binding pattern node
 *
 * @returns array of extracted name strings
 */
function extractBindingName(pattern: Record<string, unknown>): readonly string[] {
  if (pattern.type === 'Identifier') {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    const name = pattern.name as string;
    // Skip `this` parameter in TypeScript
    return name === 'this' ? [] : [name];
  }
  if (pattern.type === 'AssignmentPattern') {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    return extractBindingName(pattern.left as Record<string, unknown>);
  }
  if (pattern.type === 'RestElement') {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    return extractBindingName(pattern.argument as Record<string, unknown>);
  }
  if (pattern.type === 'TSParameterProperty') {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    return extractBindingName(pattern.parameter as Record<string, unknown>);
  }
  // ObjectPattern, ArrayPattern, and other types don't map to individual @param names
  return [];
}

/**
 * Collects property names from destructured parameters (ObjectPattern/ArrayPattern).
 *
 * For `function foo({ a, b }: Options)`, returns `['a', 'b']`.
 * For `function foo(x: number, { a }: Options)`, returns `['a']`.
 * Named parameters (Identifier) are excluded since `extractParamNames`
 * already handles those.
 *
 * Supports nested unwrapping through AssignmentPattern (default values),
 * RestElement (rest patterns), and TSParameterProperty (constructor params).
 *
 * @param node - AST node representing a function-like declaration
 *
 * @returns set of property name strings from all destructured parameters
 *
 * @example
 * ```ts
 * // function foo({ value, strs }: Options): void
 * const destructured = extractDestructuredParamNames(node);
 * // Set { 'value', 'strs' }
 * ```
 */
export function extractDestructuredParamNames(node: Span & Record<string, unknown>): ReadonlySet<string> {
  const names = new Set<string>();

  for (const param of extractRawParams(node)) {
    collectDestructuredNames(param, names);
  }

  return names;
}

/**
 * Recursively collects property names from a destructured parameter pattern
 * into the provided set.
 *
 * @param pattern - AST binding pattern node
 *
 * @param names - mutable set to collect names into
 */
function collectDestructuredNames(pattern: Record<string, unknown>, names: Set<string>): void {
  if (pattern.type === 'Identifier') {
    // Named params are handled by extractParamNames, skip here
    return;
  }
  if (pattern.type === 'AssignmentPattern') {
    // `{ a = defaultValue }` -- unwrap to the left side
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    collectDestructuredNames(pattern.left as Record<string, unknown>, names);
    return;
  }
  if (pattern.type === 'RestElement') {
    // `...rest` inside destructuring
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    collectDestructuredNames(pattern.argument as Record<string, unknown>, names);
    return;
  }
  if (pattern.type === 'TSParameterProperty') {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    collectDestructuredNames(pattern.parameter as Record<string, unknown>, names);
    return;
  }
  if (pattern.type === 'ObjectPattern') {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    const properties = pattern.properties as Record<string, unknown>[] | undefined;
    if (properties === undefined) {
      return;
    }
    for (const prop of properties) {
      if (prop.type === 'RestElement') {
        // `{ ...rest }` inside object destructuring
        collectDestructuredNames(prop, names);
      } else {
        // Property node -- extract the key name
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const key = prop.key as Record<string, unknown> | undefined;
        if (key !== undefined && key.type === 'Identifier') {
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
          names.add(key.name as string);
        }
      }
    }
    return;
  }
  if (pattern.type === 'ArrayPattern') {
    // Array destructuring: `[a, b]` -- elements are binding patterns
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    const elements = pattern.elements as (Record<string, unknown> | null)[] | undefined;
    if (elements === undefined) {
      return;
    }
    for (const element of elements) {
      if (element !== null) {
        collectDestructuredNames(element, names);
      }
    }
  }
  // Unknown pattern types are silently ignored
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
export function extractDocParamNames(docComment: DocComment): readonly string[] {
  return docComment.params.blocks.map(function getParamName(block: DocParamBlock): string {
    return block.parameterName;
  });
}

/**
 * Checks whether a function-like node has a non-void return type or return statements.
 *
 * @param node - AST node to inspect
 *
 * @returns true when function appears to return a value
 */
export function functionReturnsValue(node: Span & Record<string, unknown>): boolean {
  // Check kind on the outer MethodDefinition BEFORE unwrapping to .value,
  // because `kind` ("constructor", "get", "set", "method") is a property
  // of MethodDefinition, not of the inner FunctionExpression.
  if (node.type === 'MethodDefinition' || node.type === 'TSAbstractMethodDefinition') {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    const kind = (node as Record<string, unknown>).kind as string | undefined;
    if (kind === 'constructor' || kind === 'set') {
      return false;
    }
  }

  const target = unwrapMethodDefinition(node);

  if (target === undefined) {
    return false;
  }

  // Check for explicit void/never return type annotation
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
  const returnType = target.returnType as Record<string, unknown> | undefined | null;
  if (returnType !== undefined && returnType !== null) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    const typeAnnotation = returnType.typeAnnotation as Record<string, unknown> | undefined;
    if (typeAnnotation !== undefined) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
      const tsType = typeAnnotation.type as string | undefined;
      if (tsType === 'TSVoidKeyword' || tsType === 'TSNeverKeyword') {
        return false;
      }
      /**
       * Handle `Promise<void>` and `Promise<never>` return types.
       * The AST represents these as `TSTypeReference` with `typeName.name === 'Promise'`
       * and a single type parameter of `TSVoidKeyword` or `TSNeverKeyword`.
       */
      if (tsType === 'TSTypeReference') {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const typeName = (typeAnnotation).typeName as Record<string, unknown> | undefined;
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const name = typeName?.name as string | undefined;
        if (name === 'Promise') {
          // oxc AST uses `typeArguments` (not `typeParameters`) for generic type arguments
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
          const typeArgs = (typeAnnotation).typeArguments as Record<string, unknown> | undefined;
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
          const params = typeArgs?.params as Record<string, unknown>[] | undefined;
          if (params !== undefined && params.length === 1) {
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
            const innerType = params[0]?.type as string | undefined;
            if (innerType === 'TSVoidKeyword' || innerType === 'TSNeverKeyword') {
              return false;
            }
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
export function isGeneratorFunction(node: Span & Record<string, unknown>): boolean {
  const target = unwrapMethodDefinition(node);

  if (target === undefined) {
    return false;
  }

  return target.generator === true;
}
