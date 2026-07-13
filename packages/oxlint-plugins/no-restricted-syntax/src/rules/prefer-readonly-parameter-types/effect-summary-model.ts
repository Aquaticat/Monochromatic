/**
 * Shared data model and AST utilities for callable effect summaries.
 *
 * @module
 */

import type {
  CallSignatureDeclaration,
  ConstructorTypeNode,
  ConstructSignatureDeclaration,
  FunctionLikeDeclaration,
  FunctionTypeNode,
  MethodSignatureDeclaration,
  Node,
} from 'typescript/unstable/ast';
import {
  isCallSignatureDeclaration,
  isConstructorTypeNode,
  isConstructSignatureDeclaration,
  isElementAccessExpression,
  isFunctionLikeDeclaration,
  isFunctionTypeNode,
  isMethodSignatureDeclaration,
  isPropertyAccessExpression,
} from 'typescript/unstable/ast/is';

/**
 * Sentinel when expression root does not resolve to callable parameter.
 */
export const PARAMETER_INDEX_UNAVAILABLE: unique symbol = Symbol(
  'expression root lacks callable parameter index',
);

/**
 * Sentinel when semantic call target has no owned callable declaration.
 */
export const OWNED_CALLABLE_UNAVAILABLE: unique symbol = Symbol(
  'call target lacks owned callable declaration',
);

/**
 * Callable implementation or bodyless source signature covered by effect contract.
 */
export type EffectCallableDeclaration =
  | FunctionLikeDeclaration
  | CallSignatureDeclaration
  | ConstructSignatureDeclaration
  | MethodSignatureDeclaration
  | FunctionTypeNode
  | ConstructorTypeNode;

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Node mirrors TypeScript semantic AST identity required for narrowing. */
/**
 * Tests whether node participates in callable effect contract.
 *
 * @param node - TypeScript AST node to classify.
 *
 * @returns whether node is callable implementation or supported signature.
 *
 * @example
 * ```ts
 * if (isEffectCallableDeclaration(node)) {
 *   node.parameters;
 * }
 * ```
 */
export function isEffectCallableDeclaration(node: Node,): node is EffectCallableDeclaration {
  return isFunctionLikeDeclaration(node,)
    || isCallSignatureDeclaration(node,)
    || isConstructSignatureDeclaration(node,)
    || isMethodSignatureDeclaration(node,)
    || isFunctionTypeNode(node,)
    || isConstructorTypeNode(node,);
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/**
 * One callback-parameter relation inferred from owned function body.
 */
export type CallbackRelation = {
  readonly callbackParameterIndex: number;
  readonly callbackArgumentIndex: number;
  readonly sourceParameterIndex: number;
};

/**
 * One owned call edge with caller-relative argument roots.
 */
export type CallEdge = {
  readonly calleeKey: string;
  readonly arguments: readonly (
    number | typeof PARAMETER_INDEX_UNAVAILABLE
  )[];
  readonly callbackKeys: readonly (
    string | typeof OWNED_CALLABLE_UNAVAILABLE
  )[];
};

/**
 * Mutable internal summary while fixed point is computed.
 */
export type MutableEffectSummary = {
  readonly parameterCount: number;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, number>;
  readonly directMutated: Set<number>;
  readonly directOpaque: Set<number>;
  readonly opaqueProvenanceByParameter: Map<number, Set<string>>;
  readonly mutated: Set<number>;
  readonly opaque: Set<number>;
  readonly relations: CallbackRelation[];
  readonly calls: CallEdge[];
};

/* oxlint-disable typescript/prefer-readonly-parameter-types -- FunctionLikeDeclaration mirrors TypeScript semantic identity required for stable lookup. */
/**
 * Builds stable declaration key across TypeScript API node wrapper instances.
 *
 * @param declaration - Function-like declaration to identify.
 *
 * @returns source path and span identity.
 *
 * @example
 * ```ts
 * const key = callableKey(declaration);
 * ```
 */
export function callableKey(declaration: EffectCallableDeclaration,): string {
  /**
   * Source file owning declaration.
   */
  const sourceFile = declaration.getSourceFile();
  return `${sourceFile.fileName}:${String(declaration.pos,)}:${String(declaration.end,)}:${String(declaration.kind,)}`;
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Mutable set is intentional fixed-point accumulator. */
/**
 * Adds parameter index to effect set.
 *
 * @param target - Effect set receiving index.
 *
 * @param value - Parameter index to add.
 *
 * @returns whether value was newly added.
 *
 * @mutates target - Adds resolved parameter index.
 *
 * @example
 * ```ts
 * addEffectIndex({ target: indexes, value: 0 });
 * ```
 */
export function addEffectIndex({
  target,
  value,
}: {
  readonly target: Set<number>;
  readonly value: number | typeof PARAMETER_INDEX_UNAVAILABLE;
},): boolean {
  if (value === PARAMETER_INDEX_UNAVAILABLE)
    return false;
  /**
   * Size before insertion detects fixed-point progress.
   */
  const priorSize = target.size;
  target.add(value,);
  return target.size !== priorSize;
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Node mirrors TypeScript semantic AST identity required for traversal. */
/**
 * Collects all descendants using explicit work stack.
 *
 * @param root - AST subtree root.
 *
 * @returns nodes in depth-first order including root.
 *
 * @example
 * ```ts
 * const nodes = collectAstNodes(sourceFile);
 * ```
 */
export function collectAstNodes(root: Node,): readonly Node[] {
  /**
   * Collected nodes in traversal order.
   */
  const nodes: Node[] = [];
  /**
   * Explicit traversal stack avoids recursive flat-tree traversal.
   */
  const stack: Node[] = [root,];
  while (stack.length > 0) {
    /**
     * Next node, absent only when stack changed unexpectedly.
     */
    const node = stack.pop();
    if (node === undefined)
      continue;
    nodes.push(node,);
    node.forEachChild(function collect(child,): undefined {
      stack.push(child,);
      return undefined;
    },);
  }
  return nodes;
}

/**
 * Removes property and element access layers from expression.
 *
 * @param node - Expression whose receiver root is required.
 *
 * @returns deepest receiver node.
 *
 * @example
 * ```ts
 * const root = expressionRoot(propertyAccess);
 * ```
 */
export function expressionRoot(node: Node,): Node {
  /**
   * Mutable cursor descending through access expressions.
   */
  const cursor: { current: Node; } = { current: node, };
  while (isPropertyAccessExpression(cursor.current,)
    || isElementAccessExpression(cursor.current,)) {
    cursor.current = cursor.current
      .expression;
  }
  return cursor.current;
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
