import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

/**
 * Checks whether an AST node is a RegExp literal or `new RegExp(...)` expression.
 *
 * @param node - AST node to check
 *
 * @returns true when node is clearly a RegExp
 */
function isRegExpNode(node: Record<string, unknown>): boolean {
  const {type} = node;
  /* oxc serializes RegExpLiteral as ESTree `Literal` with a `regex` property. */
  if (type === 'Literal' && node['regex'] !== undefined && node['regex'] !== null) {
    return true;
  }
  if (type === 'NewExpression') {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- oxlint plugin API is untyped
    const callee = node['callee'] as Record<string, unknown> | null | undefined;
    if (callee !== null && callee !== undefined) {
      return callee['type'] === 'Identifier' && callee['name'] === 'RegExp';
    }
  }
  return false;
}

/**
 * Bans `RegExp.prototype.exec()` in favor of `String.prototype.match()`
 * and `String.prototype.matchAll()`.
 *
 * Three APIs exist for regex matching:
 * - `regexp.test(str)` -- boolean check (enforced by `unicorn/prefer-regexp-test`)
 * - `str.match(re)` -- single match with capture groups
 * - `str.matchAll(re)` -- all matches
 *
 * `regexp.exec()` is redundant with `.match()` for non-global regexps and
 * with `.matchAll()` for global regexps. Standardizing on the `String`
 * methods reduces cognitive overhead.
 *
 * Only fires on calls where the callee is clearly a RegExp (regex literal
 * or `new RegExp(...)`), not on arbitrary `.exec()` calls like `cli.exec()`.
 *
 * @example
 * ```ts
 * // Bad
 * const result = /(\d+)/.exec(input);
 * const result = new RegExp('\\d+').exec(input);
 *
 * // Good
 * const result = input.match(/(\d+)/);
 * const results = input.matchAll(/(\d+)/g);
 * ```
 */
export const noRegexpExec: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow RegExp.prototype.exec(). Use String.prototype.match() or matchAll() instead.',
      recommended: true,
    },
    messages: {
      forbidden: 'RegExp.exec() is banned. Use str.match(regexp) or str.matchAll(regexp) instead.',
    },
  },
  createOnce(context: Context): VisitorWithHooks {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
    return {
      CallExpression(node: Span): void {
        // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const callNode = node as Span & Record<string, unknown>;
        // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const callee = callNode['callee'] as Record<string, unknown> | null | undefined;
        if (callee === undefined || callee === null) {
          return;
        }

        /* oxc uses `MemberExpression` with a `computed` boolean, not separate Static/Computed types. */
        if (callee['type'] !== 'MemberExpression' || callee['computed'] === true) {
          return;
        }

        // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const property = callee['property'] as Record<string, unknown> | null | undefined;
        if (property === undefined || property === null || property['name'] !== 'exec') {
          return;
        }

        // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const object = callee['object'] as Record<string, unknown> | null | undefined;
        if (object === undefined || object === null) {
          return;
        }

        if (isRegExpNode(object)) {
          context.report({
            node,
            messageId: 'forbidden',
          });
        }
      },
    } as VisitorWithHooks;
  },
};
