import type {
  Context,
  CreateOnceRule,
  ESTree,
  VisitorWithHooks,
} from '@oxlint/plugins';

/**
 * Bans `.hasOwnProperty()` method calls in favor of `Object.hasOwn()`.
 *
 * `Object.hasOwn(obj, key)` was introduced in ES2022 as the modern replacement
 * for `Object.prototype.hasOwnProperty.call(obj, key)` and `obj.hasOwnProperty(key)`.
 * It is shorter, works on objects created with `Object.create(null)`,
 * and cannot be shadowed by a property named `hasOwnProperty`.
 *
 * @example
 * ```ts
 * // Bad
 * obj.hasOwnProperty('key');
 * Object.prototype.hasOwnProperty.call(obj, 'key');
 *
 * // Good
 * Object.hasOwn(obj, 'key');
 * ```
 */
export const noHasownproperty: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow .hasOwnProperty(). Use Object.hasOwn() instead.',
      recommended: true,
    },
    messages: {
      forbidden: '.hasOwnProperty() is banned. Use Object.hasOwn(obj, key) instead.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    return {
      CallExpression(node: ESTree.CallExpression,): void {
        /** Call target; only `x.hasOwnProperty()` member calls qualify for the rule. */
        const { callee, } = node;
        if ((callee.type !== 'MemberExpression') || callee.computed)
          return;
        if ((callee.property.type !== 'Identifier')
          || (callee.property.name !== 'hasOwnProperty'))
        {
          return;
        }
        context.report({
          node,
          messageId: 'forbidden',
        },);
      },
    };
  },
};
