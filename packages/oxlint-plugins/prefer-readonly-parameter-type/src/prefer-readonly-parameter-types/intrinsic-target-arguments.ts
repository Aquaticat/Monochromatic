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
  isSpreadAssignment,
  isSpreadElement,
} from 'typescript/unstable/ast/is';

import type { IntrinsicEffectTarget, } from './intrinsic-effect-catalog.ts';

/**
 * Whether a fresh literal is closed over authored values rather than spread evaluation.
 *
 * @returns Whether intrinsic mutation of the new container cannot reach spread-source state.
 */
function closedFreshContainer({ argument, }: { readonly argument: Expression; },): boolean {
  if (isObjectLiteralExpression(argument,)) {
    for (const property of argument.properties) {
      if (isSpreadAssignment(property,))
        return false;
    }
    return true;
  }
  if (isArrayLiteralExpression(argument,)) {
    for (const element of argument.elements) {
      if (isSpreadElement(element,))
        return false;
    }
    return true;
  }
  return false;
}

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
    return !closedFreshContainer({ argument, },);
  },);
}
