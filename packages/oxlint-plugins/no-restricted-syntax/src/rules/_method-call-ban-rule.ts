import type {
  Context,
  CreateOnceRule,
  ESTree,
  VisitorWithHooks,
} from '@oxlint/plugins';
import type { ForeignBorrowed, } from '@monochromatic-dev/config-oxlint-shared/ts';

import {
  getStaticCallMemberName,
  NO_STATIC_MEMBER_NAME,
} from './ast-shared.ts';

/**
 * Creates an oxlint rule that bans calling any of a set of method names
 * as `x.methodName()`, regardless of receiver type. Method names are read
 * via {@link getStaticCallMemberName}.
 *
 * Config-level overrides in `oxlint.config.ts` are unaffected;
 * this only flags member-call expressions matching `methodNames`.
 *
 * @param methodNames - method names that trigger the rule when called as `x.methodName()`
 *
 * @param description - human-readable description for the rule's docs
 *
 * @param message - error message shown when a banned method call is found
 *
 * @returns oxlint `CreateOnceRule` that reports calls to any of the banned method names
 *
 * @example
 * ```ts
 * export const noHasownproperty = methodCallBanRule({
 *   methodNames: ['hasOwnProperty'],
 *   description: 'Disallow .hasOwnProperty(). Use Object.hasOwn() instead.',
 *   message: '.hasOwnProperty() is banned. Use Object.hasOwn(obj, key) instead.',
 * });
 * ```
 */
export function methodCallBanRule({
  methodNames,
  description,
  message,
}: {
  readonly methodNames: readonly string[];
  readonly description: string;
  readonly message: string;
},): CreateOnceRule {
  return {
    meta: {
      type: 'suggestion',
      docs: {
        description,
        recommended: true,
      },
      messages: {
        forbidden: message,
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
           * Static member name for `x.methodName()` calls.
           */
          const methodName = getStaticCallMemberName({ call: node, },);
          if (methodName === NO_STATIC_MEMBER_NAME)
            return;
          if (!methodNames.includes(methodName,))
            return;
          context.report({
            node,
            messageId: 'forbidden',
          },);
        },
      };
    },
  };
}
