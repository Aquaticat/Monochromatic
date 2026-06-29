import type {
  Context,
  CreateOnceRule,
  ESTree,
  Fixer,
  VisitorWithHooks,
} from '@oxlint/plugins';

import {
  getEqualityDetectorArgumentText,
  getInstanceofErrorArgumentText,
  isNegatedEqualityOperator,
} from './prefer-error-is-error.detectors.ts';
import { getIsNativeErrorArgumentText, } from './prefer-error-is-error.node-util.ts';
import { buildErrorIsErrorCall, } from './prefer-error-is-error.syntax.ts';

//region Reporting

/**
 * Reports a replaceable alternative Error detector.
 *
 * @param context - Oxlint rule context.
 *
 * @param node - Node to report and replace.
 *
 * @param argumentText - Source text for value being tested.
 *
 * @param negated - Whether replacement should be negated.
 *
 * @example
 * ```ts
 * reportReplacement({ context, node, argumentText: 'error', negated: false });
 * ```
 */
function reportReplacement(
  {
    context,
    node,
    argumentText,
    negated,
  }: {
    readonly context: Context;
    readonly node: ESTree.Node;
    readonly argumentText: string;
    readonly negated: boolean;
  },
): void {
  /**
   * Canonical Error.isError call replacement.
   */
  const callText = buildErrorIsErrorCall({ argumentText, },);
  /**
   * Final replacement, optionally preserving a negated detector.
   */
  const replacement = negated ? `!${callText}` : callText;
  context.report({
    node,
    messageId: 'forbidden',
    fix(fixer: Fixer,): ReturnType<Fixer['replaceText']> {
      return fixer.replaceText(
        node,
        replacement,
      );
    },
  },);
}

//endregion Reporting

/**
 * Prefers `Error.isError()` over older Error detection idioms.
 *
 * `instanceof Error` fails across realms, `Object.prototype.toString` checks are
 * verbose and stringly typed, constructor comparisons reject Error subclasses,
 * and Node's `util.types.isNativeError()` is deprecated in favor of
 * `Error.isError()`.
 *
 * @example
 * ```ts
 * // Bad
 * value instanceof Error;
 * Object.prototype.toString.call(value) === '[object Error]';
 * util.types.isNativeError(value);
 *
 * // Good
 * Error.isError(value,);
 * ```
 */
export const preferErrorIsError: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description:
        'Disallow legacy Error detection. Use Error.isError() instead.',
      recommended: true,
    },
    messages: {
      forbidden:
        'Use Error.isError(value) instead of legacy Error detection methods.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    return {
      BinaryExpression(node: ESTree.BinaryExpression,): void {
        /**
         * `value instanceof Error` argument text, if matched.
         */
        const instanceofArgumentText = getInstanceofErrorArgumentText({
          context,
          binary: node,
        },);
        if ((typeof instanceofArgumentText) !== 'symbol') {
          reportReplacement({
            context,
            node,
            argumentText: instanceofArgumentText,
            negated: false,
          },);
          return;
        }
        /**
         * Equality-based detector argument text, if matched.
         */
        const equalityArgumentText = getEqualityDetectorArgumentText({
          context,
          binary: node,
        },);
        if ((typeof equalityArgumentText) === 'symbol')
          return;
        reportReplacement({
          context,
          node,
          argumentText: equalityArgumentText,
          negated: isNegatedEqualityOperator({ operator: node.operator, }),
        },);
      },
      CallExpression(node: ESTree.CallExpression,): void {
        /**
         * Node isNativeError detector argument text, if matched.
         */
        const argumentText = getIsNativeErrorArgumentText({
          context,
          call: node,
        },);
        if ((typeof argumentText) === 'symbol')
          return;
        reportReplacement({
          context,
          node,
          argumentText,
          negated: false,
        },);
      },
    };
  },
};
