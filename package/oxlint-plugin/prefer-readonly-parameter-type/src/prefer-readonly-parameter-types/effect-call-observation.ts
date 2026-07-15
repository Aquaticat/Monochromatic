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
  type IntrinsicEffectEntry,
  NO_INTRINSIC_EFFECT,
} from './intrinsic-effect-catalog.ts';
import {
  intrinsicCallableEffectQuery,
  NO_INTRINSIC_QUERY,
} from './intrinsic-effect-query.ts';

/**
 * Resolves audited effect for imported or global callable expression.
 *
 * @param project - TypeScript project resolving callable declaration.
 *
 * @param checker - TypeScript checker resolving callable symbol.
 *
 * @param expression - Callable expression to classify.
 *
 * @returns exact audited effect or absence sentinel.
 *
 * @example
 * ```ts
 * auditedCallableEffect({ project, checker, expression });
 * ```
 */
export function auditedCallableEffect({
  project,
  checker,
  expression,
}: {
  readonly project: Project;
  readonly checker: Checker;
  readonly expression: Node;
},): IntrinsicEffectEntry | typeof NO_INTRINSIC_EFFECT {
  if (!isIdentifier(expression,))
    return NO_INTRINSIC_EFFECT;
  /**
   * Resolved imported or global callable symbol.
   */
  const callableSymbol = checker.getResolvedSymbol(expression,);
  if (callableSymbol === undefined)
    return NO_INTRINSIC_EFFECT;
  /**
   * Exact module/global callable query.
   */
  const query = intrinsicCallableEffectQuery({
    project,
    memberSymbol: callableSymbol,
  },);
  if (query === NO_INTRINSIC_QUERY)
    return NO_INTRINSIC_EFFECT;
  return intrinsicEffect(query,);
}

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
  /**
   * Audited callable effect when exact identity is cataloged.
   */
  const effect = auditedCallableEffect({
    project,
    checker,
    expression,
  },);
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
