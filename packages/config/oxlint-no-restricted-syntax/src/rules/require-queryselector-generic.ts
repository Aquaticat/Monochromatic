import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

/**
 * Method names that require an explicit generic type parameter.
 *
 * - `querySelector` returns `Element | null` by default
 * - `querySelectorAll` returns `NodeListOf<Element>` by default
 * - `closest` returns `Element | null` by default
 *
 * All three lose the specific element type without a generic.
 * Requiring `<E>` forces callers to declare intent (e.g.
 * `querySelector<HTMLInputElement>('input')`), which narrows the return
 * type and avoids downstream casts or non-null assertions.
 */
const SELECTOR_METHODS = new Set(['querySelector', 'querySelectorAll', 'closest']);

/**
 * Bans `querySelector()`, `querySelectorAll()`, and `closest()` calls
 * without an explicit generic type parameter.
 *
 * Without a generic, these methods return `Element | null` or
 * `NodeListOf<Element>`, requiring a cast or non-null assertion to access
 * element-specific properties. Requiring the generic at the call site
 * keeps the return type precise and self-documenting.
 *
 * @example
 * ```ts
 * // Bad
 * const el = document.querySelector('.my-input');
 * const els = document.querySelectorAll('.item');
 * const parent = el.closest('.card');
 *
 * // Good
 * const el = document.querySelector<HTMLInputElement>('.my-input');
 * const els = document.querySelectorAll<HTMLLIElement>('.item');
 * const parent = el.closest<HTMLDivElement>('.card');
 * ```
 */
export const requireQueryselectorGeneric: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require explicit generic type parameter on querySelector/querySelectorAll/closest calls.',
      recommended: true,
    },
    messages: {
      missing: '{{method}}() must specify a generic type parameter, e.g. {{method}}<HTMLElement>(...).',
    },
  },
  createOnce(context: Context): VisitorWithHooks {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
    return {
      CallExpression(node: Span): void {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const callNode = node as Span & Record<string, unknown>;
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const callee = callNode['callee'] as Record<string, unknown> | null | undefined;
        if (callee === undefined || callee === null) {
          return;
        }

        if (callee['type'] !== 'MemberExpression' || callee['computed'] === true) {
          return;
        }

        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const property = callee['property'] as Record<string, unknown> | null | undefined;
        if (property === undefined || property === null) {
          return;
        }

        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const methodName = property['name'] as string | undefined;
        if (methodName === undefined || !SELECTOR_METHODS.has(methodName)) {
          return;
        }

        /** oxc represents generic type arguments as `typeArguments` on `CallExpression`. */
        const typeArgs = callNode['typeArguments'];
        if (typeArgs !== undefined && typeArgs !== null) {
          return;
        }

        context.report({
          node,
          messageId: 'missing',
          data: { method: methodName },
        });
      },
    } as VisitorWithHooks;
  },
};
