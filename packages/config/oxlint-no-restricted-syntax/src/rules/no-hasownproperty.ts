import type {
  Context,
  CreateOnceRule,
  Span,
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
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
    return {
      CallExpression(node: Span,): void {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const callNode = node as Span & Record<string, unknown>;
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const callee = callNode['callee'] as Record<string, unknown> | null | undefined;
        if (callee === undefined || callee === null)
          return;

        if (callee['type'] !== 'MemberExpression' || callee['computed'] === true)
          return;

        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const property = callee['property'] as Record<string, unknown> | null | undefined;
        if (property === undefined
          || property === null
          || property['name'] !== 'hasOwnProperty')
        {
          return;
        }

        context.report({
          node,
          messageId: 'forbidden',
        },);
      },
    } as VisitorWithHooks;
  },
};
