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

/**
 * Reports a diagnostic when node lacks a TSDoc comment.
 *
 * @param node - AST node that should have TSDoc
 *
 * @param context - oxlint rule context
 */
function reportMissing(node: Span, context: Context): void {
  if (findTsdocComment(node, context) === undefined) {
    context.report({ node, messageId: 'missing' });
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
      missing: 'Missing TSDoc comment.',
    },
  },
  createOnce(context: Context): VisitorWithHooks {
    /** Tracks nesting depth inside function-like scopes. */
    let scopeDepth = 0;

    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
    return {
      before(): false | undefined {
        if (shouldIgnoreFile(context.filename)) {
          return false;
        }
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
