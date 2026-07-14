/**
 * Intrinsic effect target argument selection.
 *
 * @module
 */

import type {
  CallExpression,
  Expression,
} from 'typescript/unstable/ast';
import {
  isArrayLiteralExpression,
  isObjectLiteralExpression,
} from 'typescript/unstable/ast/is';

import type { IntrinsicEffectTarget, } from './intrinsic-effect-catalog.ts';

/**
 * Selects call arguments named by one intrinsic effect target.
 *
 * @param call - Exact call expression.
 *
 * @param target - Fixed argument or variadic argument suffix.
 *
 * @returns selected call arguments; receiver targets return none.
 *
 * @example
 * ```ts
 * intrinsicTargetArguments({ call, target });
 * ```
 */
export function intrinsicTargetArguments({
  call,
  target,
}: {
  readonly call: CallExpression;
  readonly target: IntrinsicEffectTarget;
}): readonly Expression[] {
  if (target.kind === 'receiver')
    return [];
  /**
   * Arguments selected by fixed position or variadic suffix.
   */
  const selected = target.kind === 'arguments-from'
    ? call.arguments
      .slice(target.startIndex,)
    : [call.arguments[target.index],]
      .filter(function present(argument,): argument is Expression {
        return argument !== undefined;
      },);
  if (target.freshContainerShieldsContents !== true)
    return selected;
  return selected.filter(function callerOwnedContainer(argument,): boolean {
    return (!isObjectLiteralExpression(argument,))
      && (!isArrayLiteralExpression(argument,));
  },);
}
