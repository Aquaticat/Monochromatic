// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-member-access, typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
import type {
  Context,
  CreateOnceRule,
  Fixer,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import {
  buildParamFix,
  paramsNeedFix,
} from '../utility/param-fix.ts';
import {
  at,
  rangeOf,
} from '../utility/range.ts';

/**
 * Enforces one parameter per line in function declarations and expressions.
 *
 * In ESTree (used by oxlint JS plugins), `node.params` is a plain array
 * of parameter nodes without a wrapper container. This rule handles the
 * detection and fix logic directly instead of delegating to
 * `checkItemsPerLine`, which expects a container node with delimiters.
 *
 * @example
 * ```ts
 * // Bad
 * function create(name: string, age: number): void {}
 *
 * // Good
 * function create(
 *   name: string,
 *   age: number,
 * ): void {}
 * ```
 */
export const paramPerLine: CreateOnceRule = {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    docs: {
      description:
        'Require each function parameter to be on its own line when there are 2 or more parameters.',
      recommended: true,
    },
    messages: {
      paramPerLine: 'Each function parameter must be on its own line.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    /**
     * Checks function parameters and reports if they share lines.
     *
     * @param node - function declaration or expression AST node
     */
    function checkFunction(node: Span,): void {
      const fnNode = node as Span & Record<string, unknown>;
      const params = fnNode['params'] as Span[] | null | undefined;
      if (params === undefined || params === null || params.length < 2)
        return;

      const sourceText = context.sourceCode.getText();
      const firstRange = rangeOf(at({
        arr: params,
        index: 0,
      },),);
      const lastRange = rangeOf(at({
        arr: params,
        index: params.length - 1,
      },),);

      /** Find the `(` before the first param. */
      const openParen = sourceText.lastIndexOf(
        '(',
        firstRange[0],
      );
      /** Find the `)` after the last param. */
      const closeParen = sourceText.indexOf(
        ')',
        lastRange[1],
      );

      if (openParen === -1 || closeParen === -1)
        return;

      if (!paramsNeedFix({
        sourceText,
        openParen,
        closeParen,
        params,
      },)) {
        return;
      }

      context.report({
        node,
        messageId: 'paramPerLine',
        fix(fixer: Fixer,) {
          return buildParamFix({
            fixer,
            sourceText,
            openParen,
            closeParen,
            params,
            context,
          },);
        },
      },);
    }

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
    } as VisitorWithHooks;
  },
};
