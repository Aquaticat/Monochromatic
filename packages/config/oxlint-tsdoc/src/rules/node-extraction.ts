/**
 * AST node name and kind extraction utilities for TSDoc diagnostics.
 *
 * Extracted from `require-tsdoc.ts` to keep files under 100 countable lines.
 *
 * @module
 */

import type {
  Context,
  Span,
} from '@oxlint/plugins';

import { findTsdocComment, } from '../tsdoc-utils.ts';

/** Human-readable labels for AST node types that require TSDoc. */
export const NODE_KIND_LABELS: Readonly<Record<string, string>> = {
  FunctionDeclaration: 'function',
  ClassDeclaration: 'class',
  MethodDefinition: 'method',
  TSInterfaceDeclaration: 'interface',
  TSTypeAliasDeclaration: 'type alias',
  TSEnumDeclaration: 'enum',
  TSEnumMember: 'enum member',
  VariableDeclaration: 'variable',
  PropertyDefinition: 'property',
  Property: 'accessor',
};

/**
 * Extracts a human-readable name from an AST node for diagnostic messages.
 *
 * @param node - AST node to extract name from
 *
 * @returns declaration name, or "anonymous" when no name is available
 *
 * @example
 * ```ts
 * const name = extractNodeName(functionNode); // e.g. 'myFunction'
 * ```
 */
export function extractNodeName(node: Span,): string {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
  const typed = node as Span & Record<string, unknown>;

  // VariableDeclaration: dig into declarators[0].id.name
  if (typed.type === 'VariableDeclaration') {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    const declarations = typed.declarations as Record<string, unknown>[] | undefined;
    if (declarations !== undefined && declarations.length > 0) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
      const id = declarations[0]?.id as Record<string, unknown> | undefined;
      if (id !== undefined && typeof id.name === 'string')
        return id.name;
    }
    return 'anonymous';
  }

  // MethodDefinition / PropertyDefinition / Property: key.name
  if (typed.type === 'MethodDefinition'
    || typed.type === 'PropertyDefinition'
    || typed.type === 'Property')
  {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    const key = typed.key as Record<string, unknown> | undefined;
    if (key !== undefined && typeof key.name === 'string')
      return key.name;
    return 'anonymous';
  }

  // Most declarations: .id.name
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
  const id = typed.id as Record<string, unknown> | undefined;
  if (id !== undefined && typeof id.name === 'string')
    return id.name;

  // FunctionDeclaration without name, TSEnumMember with direct name
  if (typeof typed.name === 'string')
    return typed.name;

  return 'anonymous';
}

/**
 * Resolves a human-readable kind label for an AST node type.
 *
 * @param node - AST node to get kind for
 *
 * @returns kind label like "function", "class", "variable"
 *
 * @example
 * ```ts
 * extractNodeKind(functionNode) // → 'function'
 * ```
 */
export function extractNodeKind(node: Span,): string {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
  const nodeType = (node as Span & Record<string, unknown>).type as string | undefined;
  if (nodeType === undefined)
    return 'declaration';
  return NODE_KIND_LABELS[nodeType] ?? 'declaration';
}

/**
 * Parameters for {@link reportMissing}.
 */
export type ReportMissingParams = {
  /** AST node that should have TSDoc. */
  node: Span;
  /** Oxlint rule context. */
  context: Context;
};

/**
 * Reports a diagnostic when node lacks a TSDoc comment.
 *
 * @example
 * ```ts
 * reportMissing({ node, context });
 * ```
 */
export function reportMissing({
  node,
  context,
}: ReportMissingParams,): void {
  if (findTsdocComment({
    node,
    context,
  },) === undefined) {
    context.report({
      node,
      messageId: 'missing',
      data: {
        kind: extractNodeKind(node,),
        name: extractNodeName(node,),
      },
    },);
  }
}
