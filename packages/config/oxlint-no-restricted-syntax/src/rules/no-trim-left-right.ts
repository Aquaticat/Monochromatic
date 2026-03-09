import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

/**
 * Bans `.trimLeft()` and `.trimRight()` in favor of `.trimStart()` and `.trimEnd()`.
 *
 * `trimLeft()` and `trimRight()` are deprecated aliases introduced before
 * the language adopted logical naming conventions. The standard names
 * `trimStart()` and `trimEnd()` align with `padStart()`/`padEnd()` and
 * avoid directional assumptions in RTL contexts.
 *
 * @example
 * ```ts
 * // Bad
 * str.trimLeft();
 * str.trimRight();
 *
 * // Good
 * str.trimStart();
 * str.trimEnd();
 * ```
 */
export const noTrimLeftRight: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow .trimLeft()/.trimRight(). Use .trimStart()/.trimEnd() instead.',
      recommended: true,
    },
    messages: {
      forbiddenLeft: '.trimLeft() is deprecated. Use .trimStart() instead.',
      forbiddenRight: '.trimRight() is deprecated. Use .trimEnd() instead.',
    },
  },
  createOnce(context: Context): VisitorWithHooks {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
    return {
      CallExpression(node: Span): void {
        // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const callNode = node as Span & Record<string, unknown>;
        // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const callee = callNode['callee'] as Record<string, unknown> | undefined;
        if (callee === undefined || callee === null) {
          return;
        }

        if (callee['type'] !== 'MemberExpression' || callee['computed'] === true) {
          return;
        }

        // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const property = callee['property'] as Record<string, unknown> | undefined;
        if (property === undefined || property === null) {
          return;
        }

        const {name} = property;
        if (name === 'trimLeft') {
          context.report({
            node,
            messageId: 'forbiddenLeft',
          });
        } else if (name === 'trimRight') {
          context.report({
            node,
            messageId: 'forbiddenRight',
          });
        }
      },
    } as VisitorWithHooks;
  },
};
