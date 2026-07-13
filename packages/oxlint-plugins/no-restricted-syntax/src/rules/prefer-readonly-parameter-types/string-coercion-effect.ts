import type {
  Checker,
  Project,
} from 'typescript/unstable/sync';
import type { CallExpression, } from 'typescript/unstable/ast';
import { isIdentifier, } from 'typescript/unstable/ast/is';

import {
  intrinsicCallableEffectQuery,
  NO_INTRINSIC_QUERY,
} from './intrinsic-effect-query.ts';

/**
 * Exact provenance label used for object-capable global String conversion.
 */
export const STRING_OBJECT_COERCION_PROVENANCE =
  'global String object conversion through Symbol.toPrimitive, toString, or valueOf';

/**
 * Reports whether call resolves to ECMAScript global String conversion.
 *
 * Local functions named String must remain ordinary owned calls,
 * while exact global conversion needs a coercion-hook explanation.
 *
 * @param call - Call whose exact callable identity is queried.
 *
 * @param checker - Checker resolving callable symbol.
 *
 * @param project - Project proving ECMAScript declaration provenance.
 *
 * @returns Whether call is exact global String conversion.
 *
 * @example
 * ```ts
 * isGlobalStringConversion({ call, checker, project });
 * ```
 */
export function isGlobalStringConversion({
  call,
  checker,
  project,
}: {
  readonly call: CallExpression;
  readonly checker: Checker;
  readonly project: Project;
},): boolean {
  if (!isIdentifier(call.expression,))
    return false;
  /**
   * Exact symbol reached through call expression.
   */
  const callableSymbol = checker.getResolvedSymbol(call.expression,);
  if (callableSymbol === undefined)
    return false;

  /**
   * Audited declaration identity for callable symbol.
   */
  const query = intrinsicCallableEffectQuery({
    memberSymbol: callableSymbol,
    project,
  },);
  if (query === NO_INTRINSIC_QUERY)
    return false;

  if (query
    .provenance
    .kind
    !== 'ecmascript')
    return false;
  if (query.ownerType !== 'globalThis')
    return false;
  return query.member === 'String';
}
