import type {
  Context,
  CreateOnceRule,
  ESTree,
  VisitorWithHooks,
} from '@oxlint/plugins';
import type { ForeignBorrowed, } from './foreign-borrowed.ts';

/**
 * Rule type values accepted by oxlint metadata.
 */
type SimpleBanRuleType = 'layout' | 'problem' | 'suggestion';

/**
 * Predicate for rules that only report some nodes of a visitor type.
 */
type SimpleBanPredicate = (node: ForeignBorrowed<ESTree.Node>) => boolean;

/**
 * Parameters for {@link simpleBanRule}.
 */
export type SimpleBanRuleParams = {
  /**
   * Oxlint meta type for the rule.
   */
  readonly type: SimpleBanRuleType;
  /**
   * Visitor key for the banned syntax node.
   */
  readonly nodeType: string;
  /**
   * Rule documentation description.
   */
  readonly description: string;
  /**
   * Message identifier to report.
   */
  readonly messageId: string;
  /**
   * Diagnostic message for the reported node.
   */
  readonly message: string;
  /**
   * Optional predicate for rules that only ban a subset of nodes.
   */
  readonly shouldReport?: SimpleBanPredicate;
};

/**
 * Creates a rule whose visitor reports one syntax node family.
 *
 * The optional predicate covers small variants such as `try` statements only
 * when they have a `finally` clause. More complex rules should keep a custom
 * visitor so their control flow stays obvious.
 *
 * @param params - rule metadata and visitor description
 *
 * @returns oxlint rule that reports the selected visitor nodes
 *
 * @example
 * ```ts
 * export const noSwitch = simpleBanRule({
 *   type: 'suggestion',
 *   nodeType: 'SwitchStatement',
 *   description: 'Disallow switch statements.',
 *   messageId: 'forbidden',
 *   message: 'Switch statements are banned.',
 * });
 * ```
 */
export function simpleBanRule(params: SimpleBanRuleParams,): CreateOnceRule {
  /**
   * Rule metadata, visitor key, and optional predicate.
   */
  const {
    type,
    nodeType,
    description,
    messageId,
    message,
    shouldReport,
  } = params;
  /**
   * Predicate used for every visited node; defaults to reporting all matches.
   *
   * @param node - syntax node supplied by oxlint
   *
   * @returns whether node should be reported
   */
  function shouldReportNode(node: ForeignBorrowed<ESTree.Node>,): boolean {
    if (shouldReport === undefined)
      return true;
    return shouldReport(node,);
  }

  return {
    meta: {
      type,
      docs: {
        description,
        recommended: true,
      },
      messages: {
        [messageId]: message,
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
        [nodeType](node: ForeignBorrowed<ESTree.Node>,): void {
          if (!shouldReportNode(node,))
            return;
          context.report({
            node,
            messageId,
          },);
        },
      } as VisitorWithHooks;
    },
  };
}
