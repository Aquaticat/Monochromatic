// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-member-access, typescript/no-unsafe-argument, typescript/no-unsafe-return, typescript/strict-boolean-expressions -- ArrowFunctionExpression parent chain is untyped; all member access is inherently unsafe
import type {
  Context,
  CreateOnceRule,
  Fixer,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import { extractParamsText, } from './arrow-function-params.ts';

/**
 * Minimal local type for `ArrowFunctionExpression` AST nodes.
 *
 * The full interface is defined internally by `@oxlint/plugins` but not
 * included in its public exports. This covers the properties accessed
 * by this rule.
 */
type ArrowFunctionExpression = Span & {
  /** AST node type discriminant. */
  type: 'ArrowFunctionExpression';
  /** Whether the body is a single expression (concise body). */
  expression: boolean;
  /** Whether the function is async. */
  async: boolean;
  /** Generic type parameter list, if present. */
  typeParameters?: Span | null;
  /** Return type annotation, if present. */
  returnType?: Span | null;
  /** Function body (block or expression). */
  body: Span;
  /** Parent AST node (VariableDeclarator, CallExpression, etc.). */
  // oxlint-disable-next-line typescript/no-explicit-any -- parent chain is inherently untyped in oxlint plugin API
  parent: Record<string, any>;
};

/**
 * Bans arrow function expressions in favor of named function declarations
 * and named function expressions.
 *
 * Arrow functions produce anonymous entries in stack traces, making debugging
 * harder. Named functions provide clear trace names, are hoisted for flexible
 * ordering, and signal intent more explicitly.
 *
 * Auto-fix handles the common `const name = (...) => ...` pattern by converting
 * it to a `function name(...) { ... }` declaration. `export const` is similarly
 * converted to `export function`. Other contexts (callbacks, object properties)
 * are reported but not auto-fixed because naming them requires human judgment.
 *
 * @example
 * ```ts
 * // Bad
 * const double = (x: number): number => x * 2;
 * items.map((item) => item.value);
 *
 * // Good
 * function double(x: number): number { return x * 2; }
 * items.map(function getValue(item) { return item.value; });
 * ```
 */
export const noArrowFunction: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description:
        'Disallow arrow function expressions. Use named function declarations or named function expressions instead.',
      recommended: true,
    },
    messages: {
      forbidden:
        'Arrow functions are banned. Use named function declarations or named function expressions instead.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
    return {
      ArrowFunctionExpression(node: ArrowFunctionExpression,): void {
        /**
         * Only auto-fix when the arrow is the direct initializer of a variable declaration:
         * `const name = (...) => ...` or `export const name = (...) => ...`.
         *
         * Callbacks, object properties, and other contexts are too context-dependent
         * to auto-fix reliably.
         */
        const { parent, } = node;
        if (
          parent.type !== 'VariableDeclarator'
          || parent.id.type !== 'Identifier'
          || parent.parent.type !== 'VariableDeclaration'
          || parent.parent.declarations.length !== 1
        ) {
          context.report({ node, messageId: 'forbidden', },);
          return;
        }

        /** Variable name from the declarator (e.g. `foo` in `const foo = ...`). */
        const { name, } = parent.id;

        /** Whether the grandparent declaration is exported. */
        const grandparent = parent.parent.parent;
        const isExported = grandparent.type === 'ExportNamedDeclaration';

        /** The full declaration node to replace (including `export` if present). */
        const replaceNode = isExported ? grandparent : parent.parent;

        /** Async prefix if the arrow is async. */
        const asyncPrefix = node.async ? 'async ' : '';

        /** Generic type parameters if present. */
        const typeParamsText =
          node.typeParameters !== null && node.typeParameters !== undefined
            ? context.sourceCode.getText(node.typeParameters,)
            : '';

        /**
         * Source text of the parameter list including parentheses.
         * Extracted from the range between params start and body/returnType start,
         * stripping the `=>` arrow token.
         */
        const paramsText = extractParamsText({
          fullText: context.sourceCode.getText(node,),
          node,
        },);

        /** Return type annotation if present. */
        const returnTypeText = node.returnType !== null && node.returnType !== undefined
          ? context.sourceCode.getText(node.returnType,)
          : '';

        /** Body text, wrapping expression bodies in `{ return ...; }`. */
        const bodyText = node.expression
          ? `{ return ${context.sourceCode.getText(node.body,)} }`
          : context.sourceCode.getText(node.body,);

        /** Export keyword prefix. */
        const exportPrefix = isExported ? 'export ' : '';

        /** Assembled function declaration. */
        const replacement =
          `${exportPrefix}${asyncPrefix}function ${name}${typeParamsText}${paramsText}${returnTypeText} ${bodyText}`;

        context.report({
          node,
          messageId: 'forbidden',
          fix(fixer: Fixer,) {
            return fixer.replaceText(replaceNode, replacement,);
          },
        },);
      },
    } as VisitorWithHooks;
  },
};
