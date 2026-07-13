import type {
  Context,
  CreateOnceRule,
  ESTree,
  VisitorWithHooks,
} from '@oxlint/plugins';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  getStaticCallMemberName,
  NO_STATIC_MEMBER_NAME,
} from './ast-shared.ts';

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
const SELECTOR_METHODS = new Set([
  'querySelector',
  'querySelectorAll',
  'closest',
],);

/**
 * Bans {@link SELECTOR_METHODS} calls (`querySelector()`,
 * `querySelectorAll()`, and `closest()`, matched via
 * {@link getStaticCallMemberName}) without an explicit generic type
 * parameter.
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
      description:
        'Require explicit generic type parameter on querySelector/querySelectorAll/closest calls.',
      recommended: true,
    },
    messages: {
      missing:
        '{{method}}() must specify a generic type parameter, e.g. {{method}}<HTMLElement>(...).',
    },
  },
  /**
   * Handles foreign Oxlint callback.
   *
   * @param context - Foreign rule context receiving diagnostics.
   *
   * @mutates context - Emits Oxlint diagnostics through foreign rule context.
   *
   * @example
   * ```ts
   * createOnce(context);
   * ```
   */
  createOnce(context: ForeignBorrowed<Context>,): VisitorWithHooks {
    return {
      CallExpression(node: ForeignBorrowed<ESTree.CallExpression>,): void {
        /**
         * Member-access identifier name; matched against {@link SELECTOR_METHODS}.
         */
        const methodName = getStaticCallMemberName({ call: node, },);
        if (methodName === NO_STATIC_MEMBER_NAME)
          return;
        if (!SELECTOR_METHODS.has(methodName,))
          return;
        if ((node.typeArguments
          !== null) && (node.typeArguments
            !== undefined))
          return;
        context.report({
          node,
          messageId: 'missing',
          data: { method: methodName, },
        },);
      },
    };
  },
};
