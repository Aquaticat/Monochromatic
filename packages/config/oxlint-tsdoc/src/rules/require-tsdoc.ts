import type {
  Context,
  CreateOnceRule,
  VisitorWithHooks,
} from '@oxlint/plugins';

import { shouldIgnoreFile } from '../tsdoc-utils.ts';

import { reportMissing } from './node-extraction.ts';

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
    /** Tracks nesting depth inside block scopes (for-loop bodies, if-else, try-catch). */
    let blockDepth = 0;
    /** True when the next VariableDeclaration is a for-loop binding (for/for-of/for-in init). */
    let inForLoopInit = false;

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
      BlockStatement(): void { blockDepth++; },
      'BlockStatement:exit'(): void { blockDepth--; },
      ForStatement(): void { inForLoopInit = true; },
      ForOfStatement(): void { inForLoopInit = true; },
      ForInStatement(): void { inForLoopInit = true; },
      VariableDeclaration(node): void {
        if (inForLoopInit) {
          inForLoopInit = false;
          return;
        }
        if (scopeDepth === 0 && blockDepth === 0) {
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
