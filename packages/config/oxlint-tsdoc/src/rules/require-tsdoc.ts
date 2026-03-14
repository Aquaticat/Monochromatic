import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import {
  findTsdocComment,
  shouldIgnoreFile,
} from '../tsdoc-utils.ts';

/** Human-readable labels for AST node types that require TSDoc. */
const NODE_KIND_LABELS: Readonly<Record<string, string>> = {
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
 */
function extractNodeName(node: Span): string {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
  const typed = node as Span & Record<string, unknown>;

  // VariableDeclaration: dig into declarators[0].id.name
  if (typed.type === 'VariableDeclaration') {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    const declarations = typed.declarations as Record<string, unknown>[] | undefined;
    if (declarations !== undefined && declarations.length > 0) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
      const id = declarations[0]?.id as Record<string, unknown> | undefined;
      if (id !== undefined && typeof id.name === 'string') {
        return id.name;
      }
    }
    return 'anonymous';
  }

  // MethodDefinition / PropertyDefinition / Property: key.name
  if (typed.type === 'MethodDefinition' || typed.type === 'PropertyDefinition' || typed.type === 'Property') {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    const key = typed.key as Record<string, unknown> | undefined;
    if (key !== undefined && typeof key.name === 'string') {
      return key.name;
    }
    return 'anonymous';
  }

  // Most declarations: .id.name
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
  const id = typed.id as Record<string, unknown> | undefined;
  if (id !== undefined && typeof id.name === 'string') {
    return id.name;
  }

  // FunctionDeclaration without name, TSEnumMember with direct name
  if (typeof typed.name === 'string') {
    return typed.name;
  }

  return 'anonymous';
}

/**
 * Resolves a human-readable kind label for an AST node type.
 *
 * @param node - AST node to get kind for
 *
 * @returns kind label like "function", "class", "variable"
 */
function extractNodeKind(node: Span): string {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
  const nodeType = (node as Span & Record<string, unknown>).type as string | undefined;
  if (nodeType === undefined) {
    return 'declaration';
  }
  return NODE_KIND_LABELS[nodeType] ?? 'declaration';
}

/**
 * Reports a diagnostic when node lacks a TSDoc comment.
 *
 * @param node - AST node that should have TSDoc
 *
 * @param context - oxlint rule context
 */
function reportMissing(node: Span, context: Context): void {
  if (findTsdocComment(node, context) === undefined) {
    context.report({
      node,
      messageId: 'missing',
      data: { kind: extractNodeKind(node), name: extractNodeName(node) },
    });
  }
}

/**
 * Requires TSDoc comments on module-level documentable declarations.
 *
 * Ported from the original root-level `oxlint-require-tsdoc.ts`.
 *
 * FunctionExpression and ArrowFunctionExpression are intentionally
 * excluded because their TSDoc is owned by the enclosing
 * VariableDeclaration or MethodDefinition node.
 *
 * VariableDeclaration nodes inside function bodies (nonzero scope depth) are
 * skipped because local implementation variables do not warrant TSDoc.
 *
 * @example
 * ```ts
 * // Bad -- missing TSDoc
 * function foo(): void {}
 *
 * // Good
 * /\** Does something. *\/
 * function foo(): void {}
 * ```
 */
export const requireTsdoc: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require TSDoc comments on all documentable declarations.',
      recommended: true,
    },
    messages: {
      missing: 'Missing TSDoc comment on {{kind}} "{{name}}".',
    },
  },
  createOnce(context: Context): VisitorWithHooks {
    /** Tracks nesting depth inside function-like scopes. */
    let scopeDepth = 0;

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
    return {
      before() {
        if (shouldIgnoreFile(context.filename)) {
          return false;
        }
        return undefined;
      },
      FunctionDeclaration(node): void {
        reportMissing(node, context);
        scopeDepth++;
      },
      'FunctionDeclaration:exit'(): void {
        scopeDepth--;
      },
      FunctionExpression(): void {
        scopeDepth++;
      },
      'FunctionExpression:exit'(): void {
        scopeDepth--;
      },
      ArrowFunctionExpression(): void {
        scopeDepth++;
      },
      'ArrowFunctionExpression:exit'(): void {
        scopeDepth--;
      },
      ClassDeclaration(node): void {
        reportMissing(node, context);
      },
      MethodDefinition(node): void {
        reportMissing(node, context);
      },
      TSInterfaceDeclaration(node): void {
        reportMissing(node, context);
      },
      TSTypeAliasDeclaration(node): void {
        reportMissing(node, context);
      },
      TSEnumDeclaration(node): void {
        reportMissing(node, context);
      },
      VariableDeclaration(node): void {
        if (scopeDepth === 0) {
          reportMissing(node, context);
        }
      },
      PropertyDefinition(node): void {
        reportMissing(node, context);
      },
      TSEnumMember(node): void {
        reportMissing(node, context);
      },
      Property(node): void {
        if (node.kind === 'get' || node.kind === 'set') {
          reportMissing(node, context);
        }
      },
    } as VisitorWithHooks;
  },
};
