/**
 * Shared call-arity matching for intrinsic effect targets.
 *
 * @module
 */

import type { CallExpression, } from 'typescript/unstable/ast';

import type { IntrinsicEffectTarget, } from './intrinsic-effect-catalog.ts';

/**
 * Tests whether an effect target applies to current overloaded call arity.
 *
 * @param target - Audited receiver or argument target.
 *
 * @param call - Exact intrinsic call.
 *
 * @returns Whether target has no arity guard or matches current call.
 *
 * @example
 * ```ts
 * targetMatchesCallArity({ target, call });
 * ```
 */
export function targetMatchesCallArity({
  target,
  call,
}: {
  readonly target: IntrinsicEffectTarget;
  readonly call: CallExpression;
}): boolean {
  /**
   * Optional exact arity attached to target.
   */
  const { callArgumentCount, } = target;
  if (callArgumentCount === undefined)
    return true;
  /**
   * Actual number of arguments supplied by current call.
   */
  const { length: actualArgumentCount, } = call.arguments;
  return callArgumentCount === actualArgumentCount;
}
