import type {
  Context,
  CreateOnceRule,
  ESTree,
  VisitorWithHooks,
} from '@oxlint/plugins';

/**
 * Creates an oxlint rule that bans calling any of a set of method names
 * as `x.methodName()`, regardless of receiver type.
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
    createOnce(context: Context,): VisitorWithHooks {
      return {
        CallExpression(node: ESTree.CallExpression,): void {
          /**
           * Call target; only `x.methodName()` member calls qualify for the rule.
           */
          const { callee, } = node;
          if ((callee.type
            !== 'MemberExpression') || callee
            .computed)
            return;
          if ((callee.property
            .type
            !== 'Identifier')
            || (!methodNames
              .includes(callee
                .property
                .name,)))
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
}
