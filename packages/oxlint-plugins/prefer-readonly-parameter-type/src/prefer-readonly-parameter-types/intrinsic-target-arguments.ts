/**
 * Intrinsic effect target argument selection.
 *
 * @module
 */

import type {
  CallExpression,
  Expression,
} from 'typescript/unstable/ast';

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
  if (target.kind === 'arguments-from')
    return call.arguments
      .slice(target.startIndex,);
  /**
   * Fixed call argument named by intrinsic target.
   */
  const argument = call.arguments[target.index];
  return argument === undefined ? [] : [argument,];
}
