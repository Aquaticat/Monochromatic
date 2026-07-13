/**
 * Imported and global observational call classification.
 *
 * @module
 */

import type {
  CallExpression,
  Node,
} from 'typescript/unstable/ast';
import { isIdentifier, } from 'typescript/unstable/ast/is';
import type {
  Checker,
  Project,
} from 'typescript/unstable/sync';

import {
  intrinsicEffect,
  NO_INTRINSIC_EFFECT,
} from './intrinsic-effect-catalog.ts';
import {
  intrinsicCallableEffectQuery,
  NO_INTRINSIC_QUERY,
} from './intrinsic-effect-query.ts';

/**
 * Tests whether imported or global callable expression has audited zero-target effect.
 *
 * @param project - TypeScript project resolving callable declaration.
 *
 * @param checker - TypeScript checker resolving callable symbol.
 *
 * @param expression - Callable expression to classify.
 *
 * @returns whether exact callable is observational for every argument.
 *
 * @example
 * ```ts
 * isAuditedObservationalExpression({ project, checker, expression });
 * ```
 */
export function isAuditedObservationalExpression({
  project,
  checker,
  expression,
}: {
  readonly project: Project;
  readonly checker: Checker;
  readonly expression: Node;
},): boolean {
  if (!isIdentifier(expression,))
    return false;
  /**
   * Resolved imported or global callable symbol.
   */
  const callableSymbol = checker.getResolvedSymbol(expression,);
  if (callableSymbol === undefined)
    return false;
  /**
   * Exact module/global callable query.
   */
  const query = intrinsicCallableEffectQuery({
    project,
    memberSymbol: callableSymbol,
  },);
  if (query === NO_INTRINSIC_QUERY)
    return false;
  /**
   * Audited callable effect when exact identity is cataloged.
   */
  const effect = intrinsicEffect(query,);
  return (effect !== NO_INTRINSIC_EFFECT) && (effect.targets
    .length
    === 0);
}

/**
 * Tests whether imported or global call has fully audited zero-target effect.
 *
 * @param project - TypeScript project resolving callable declaration.
 *
 * @param checker - TypeScript checker resolving callable symbol.
 *
 * @param call - Call expression under effect analysis.
 *
 * @returns whether exact callable is observational for every argument.
 *
 * @example
 * ```ts
 * isAuditedObservationalCallable({ project, checker, call });
 * ```
 */
export function isAuditedObservationalCallable({
  project,
  checker,
  call,
}: {
  readonly project: Project;
  readonly checker: Checker;
  readonly call: CallExpression;
}): boolean {
  return isAuditedObservationalExpression({
    project,
    checker,
    expression: call.expression,
  },);
}
