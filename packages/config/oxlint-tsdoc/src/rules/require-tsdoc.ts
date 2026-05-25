import type {
  Context,
  CreateOnceRule,
  VisitorWithHooks,
} from '@oxlint/plugins';

import { shouldIgnoreFile, } from '../tsdoc-utils.ts';

import { reportMissing, } from './node-extraction.ts';

/**
 * Requires TSDoc comments on every documentable declaration, including
 * local variables inside function bodies and block scopes.
 *
 * FunctionExpression and ArrowFunctionExpression are excluded because
 * their TSDoc is owned by the enclosing VariableDeclaration or
 * MethodDefinition node.
 *
 * For-loop bindings (`for (const x of arr)`, `for (let i = 0; ...)`)
 * are excluded because they have no natural site for TSDoc.
 *
 * @example
 * ```ts
 * // Bad; missing TSDoc on local
 * /\** Doubles a value. *\/
 * function double(n: number): number {
 *   const result = n * 2;
 *   return result;
 * }
 *
 * // Good
 * /\** Doubles a value. *\/
 * function double(n: number): number {
 *   /\** Computed double of the input. *\/
 *   const result = n * 2;
 *   return result;
 * }
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
  createOnce(context: Context,): VisitorWithHooks {
    /**
     * Mutable visitor traversal state shared across AST callbacks.
     *
     * AGENTS.md bans function-root `let` for cleanliness; an object with
     * a mutable property carries the same state in a single `const` binding.
     */
    const state = {
      /** True when the next VariableDeclaration is a for-loop binding (for/for-of/for-in init). */
      inForLoopInit: false,
    };

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
    return {
      before() {
        if (shouldIgnoreFile(context.filename,))
          return false;
        return undefined;
      },
      FunctionDeclaration(node,): void {
        reportMissing({
          node,
          context,
        },);
      },
      ClassDeclaration(node,): void {
        reportMissing({
          node,
          context,
        },);
      },
      MethodDefinition(node,): void {
        reportMissing({
          node,
          context,
        },);
      },
      TSInterfaceDeclaration(node,): void {
        reportMissing({
          node,
          context,
        },);
      },
      TSTypeAliasDeclaration(node,): void {
        reportMissing({
          node,
          context,
        },);
      },
      TSEnumDeclaration(node,): void {
        reportMissing({
          node,
          context,
        },);
      },
      ForStatement(): void {
        state.inForLoopInit = true;
      },
      ForOfStatement(): void {
        state.inForLoopInit = true;
      },
      ForInStatement(): void {
        state.inForLoopInit = true;
      },
      VariableDeclaration(node,): void {
        if (state.inForLoopInit) {
          state.inForLoopInit = false;
          return;
        }
        reportMissing({
          node,
          context,
        },);
      },
      PropertyDefinition(node,): void {
        reportMissing({
          node,
          context,
        },);
      },
      TSEnumMember(node,): void {
        reportMissing({
          node,
          context,
        },);
      },
      Property(node,): void {
        if ((node.kind
          === 'get') || (node.kind
          === 'set')) {
          reportMissing({
            node,
            context,
          },);
        }
      },
    } as VisitorWithHooks;
  },
};
