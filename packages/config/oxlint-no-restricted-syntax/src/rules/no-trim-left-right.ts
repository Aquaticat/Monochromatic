import type {
  Context,
  CreateOnceRule,
  ESTree,
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
      description:
        'Disallow .trimLeft()/.trimRight(). Use .trimStart()/.trimEnd() instead.',
      recommended: true,
    },
    messages: {
      forbiddenLeft: '.trimLeft() is deprecated. Use .trimStart() instead.',
      forbiddenRight: '.trimRight() is deprecated. Use .trimEnd() instead.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    return {
      CallExpression(node: ESTree.CallExpression,): void {
        /** Call target; only `x.trimLeft()` / `x.trimRight()` member calls trigger the rule. */
        const { callee, } = node;
        if ((callee.type
          !== 'MemberExpression') || callee
          .computed)
          return;
        if (callee.property
          .type
          !== 'Identifier')
          return;
        /** Member-access identifier name; matched against the deprecated trim aliases. */
        const { name, } = callee.property;
        if (name === 'trimLeft') {
          context.report({
            node,
            messageId: 'forbiddenLeft',
          },);
        }
        else if (name === 'trimRight') {
          context.report({
            node,
            messageId: 'forbiddenRight',
          },);
        }
      },
    };
  },
};
