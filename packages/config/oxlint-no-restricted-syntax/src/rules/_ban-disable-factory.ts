import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

/** Pattern matching oxlint-disable directives (file-level or next-line). */
const DISABLE_DIRECTIVE_PATTERN = /oxlint-disable(?:-next-line)?\b/;

/**
 * Creates an oxlint rule that bans inline `oxlint-disable` comments
 * targeting a specific rule ID. Config-level overrides in `.oxlintrc.json`
 * are unaffected — only inline `// oxlint-disable` and
 * `// oxlint-disable-next-line` comments are flagged.
 *
 * @param ruleId - full rule ID to ban disabling (e.g. `tsdoc/require-tsdoc`)
 *
 * @param description - human-readable description for the rule's docs
 *
 * @param message - error message shown when the banned disable is found
 *
 * @returns oxlint `CreateOnceRule` that scans all comments for the banned disable
 *
 * @example
 * ```ts
 * export const noDisableNoSwitch = banDisableRule({
 *   ruleId: 'no-restricted-syntax/no-switch',
 *   description: 'Disallow disabling no-switch. Use if/else or Record lookups.',
 *   message: 'Disabling no-switch is not allowed. Use if/else chains or Record lookups.',
 * });
 * ```
 */
export function banDisableRule({ ruleId, description, message }: {
  ruleId: string;
  description: string;
  message: string;
}): CreateOnceRule {
  return {
    meta: {
      type: 'problem',
      docs: {
        description,
        recommended: true,
      },
      messages: {
        forbidden: message,
      },
    },
    createOnce(context: Context): VisitorWithHooks {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
      return {
        Program(_node: Span): void {
          context.sourceCode.getAllComments().forEach(function checkComment(comment) {
            if (DISABLE_DIRECTIVE_PATTERN.test(comment.value) && comment.value.includes(ruleId)) {
              context.report({
                node: comment,
                messageId: 'forbidden',
              });
            }
          });
        },
      } as VisitorWithHooks;
    },
  };
}
