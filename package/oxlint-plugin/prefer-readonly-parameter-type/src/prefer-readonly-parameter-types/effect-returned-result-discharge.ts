/**
 * Whether a returned result's callers can all be seen to substitute for it.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type {
  CallExpression,
  Node,
} from 'typescript/unstable/ast';
import {
  isCallExpression,
  isReturnStatement,
} from 'typescript/unstable/ast/is';
import type { Project, } from 'typescript/unstable/sync';

import {
  bindingDeclarationInitializer,
  NO_BINDING_INITIALIZER,
} from './effect-binding-initializer.ts';
import { expressionContainsForeignBorrowed, } from './foreign-borrowed-classifier.ts';
import {
  memberCallReceiver,
  NO_MEMBER_RECEIVER,
} from './effect-member-call-receiver.ts';
import { isEffectCallableDeclaration, } from './effect-summary-model.ts';

/**
 * Returned-result discharge logger.
 */
const l = tagged({ tag: 'effect-returned-result-discharge', },);

/**
 * Tests whether a call is returned outright, as the whole returned expression.
 *
 * The narrowest form of the question, and narrower than a first attempt that asked
 * `valueConsumer` for the position and tested its parent. That ascends through every step
 * passing a value outward, so it admitted calls reaching a return from other positions.
 * Measured: the wider form discharged one further diagnostic and changed nothing else, so
 * the reach was never about the position test and this form is kept for being the smaller
 * claim.
 *
 * `return rows.slice(0,);` qualifies. A call bound first, placed in a literal, spread,
 * wrapped, or handed to another call on its way to the return does not. Those may well be
 * dischargeable too, and none of them is proven by this.
 *
 * @param call - Call whose position is being classified.
 *
 * @returns whether this call is exactly what its callable returns.
 *
 * @example
 * ```ts
 * callIsReturnedOutright({ call });
 * ```
 */
function callIsReturnedOutright(
  { call, }: { readonly call: CallExpression; },
): boolean {
  /**
   * Syntactic context holding this call.
   */
  const { parent, } = call;
  if (!isReturnStatement(parent,))
    return false;
  return parent.expression === call;
}

/**
 * Tests whether every caller of the callable owning a body is one this analysis can see.
 *
 * The precondition `effect-result-escape.ts` names. Returning parameter-reachable state is
 * benign by accepted policy, but the escape charge stands "until a caller substitutes
 * through `directReturned`", so discharging it requires knowing every caller is one the
 * fixed point will reach.
 *
 * Asked here rather than through `completeForeignBorrowedGraph`, which answers the same
 * question while building an ownership fixed point this decision does not need. The
 * underlying query is one checker call, measured at roughly one to two milliseconds per
 * declaration on workspace source, so asking it directly costs a fraction of that graph and
 * needs none of its state threaded into this layer.
 *
 * Completeness means what it means for that graph: every usage TypeScript can enumerate
 * resolves. A callable exported from a published package has consumers TypeScript cannot
 * enumerate, so this answers true for it, which is the completeness notion the ownership
 * inference already trusts. Adopting a different one here would leave the two disagreeing
 * about identical callables.
 *
 * @param project - TypeScript project enumerating signature usage.
 *
 * @param body - Body of the callable whose callers are in question.
 *
 * @returns whether every enumerable usage resolves.
 *
 * @example
 * ```ts
 * callersAllResolve({ project, body });
 * ```
 */
function callersAllResolve({
  project,
  body,
}: {
  readonly project: Project;
  readonly body: Node;
},): boolean {
  /**
   * Callable owning this body, which is what usage is enumerated for.
   */
  const declaration = body.parent;
  if (!isEffectCallableDeclaration(declaration,))
    return false;
  try {
    /**
     * Every usage of this callable's signature the project can enumerate.
     */
    const usages = project.checker
      .getSignatureUsage(declaration,);
    /* An empty enumeration is refused rather than accepted, and the distinction is the
     * whole soundness of this test. `every` over nothing is true, so a callable with no
     * caller in the program would discharge vacuously, and a callable with no caller in the
     * program is exactly the one whose callers this analysis cannot see: an exported
     * `returnedLookupEffect` handing back a `Set` the caller owns has consumers outside
     * this repository that no enumeration reaches. Requiring a caller means the discharge
     * rests on substitution that demonstrably happens rather than on the absence of
     * evidence. */
    if (usages.length === 0)
      return false;
    return usages
      .every(function usageResolves(usage,): boolean {
        /**
         * Call this usage stands for, absent when it is not one this project resolves.
         */
        const resolved = usage.call
          ?.resolve(project,);
        return resolved !== undefined;
      },);
  }
  catch (error) {
    /* Failing closed, and the only correct direction here. An enumeration this cannot
     * perform is exactly the case where callers may exist unseen, so the charge stands. */
    l.error(`signature usage unavailable, keeping the escape charge: ${String(error,)}`,);
    return false;
  }
}

/**
 * Tests whether a returned result's escape charge is answered by its callers.
 *
 * Returning is the one escape whose destination this analysis can follow, and only where it
 * can see everyone who receives it. Three conditions, each added for a measured case rather
 * than for symmetry.
 *
 * The result must be returned outright, so the position is the one being reasoned about.
 * Every caller must be enumerable and resolvable, because a caller the fixed point never
 * visits never substitutes, and the returned fact would then be recorded and read by nobody.
 *
 * And the receiver must not carry foreign-borrowed state, which is the condition
 * enumeration found rather than reasoning. Discharging without it silenced
 * `filterForeignFixtureTree`, `filterAliasedForeignFixtureTree` and `sortForeignFixtureTree`,
 * and `effect-opaque-boundary.ts` records the first two as having "lost their finding
 * entirely" once already, diagnosed as a defect and fixed. `ForeignBorrowed` marks an
 * ownership boundary, and a container returned out of foreign-owned state is not something
 * an in-program caller accounts for however completely it enumerates: what the caller
 * substitutes is provenance, and the effects on that side of the boundary are what this
 * analysis does not model.
 *
 * @param project - TypeScript project resolving usage and ownership.
 *
 * @param call - Call whose result carries the escape charge.
 *
 * @param body - Body of the callable returning it.
 *
 * @returns whether the charge is answered and may be discharged.
 *
 * @example
 * ```ts
 * returnedResultDischargeable({ project, call, body });
 * ```
 */
export function returnedResultDischargeable({
  project,
  call,
  body,
}: {
  readonly project: Project;
  readonly call: CallExpression;
  readonly body: Node;
},): boolean {
  if (!callIsReturnedOutright({ call, },))
    return false;
  /* Asked at the base of the receiver chain rather than at the immediate receiver, because
   * the shapes this exists for compose members. `tree.children.slice().filter(observer,)`
   * has a call for its receiver, and a call carries no ownership of its own, so asking the
   * immediate receiver answered no and discharged all three foreign cases anyway. Measured
   * before and after adding this descent. */
  /**
   * Base of the receiver chain, with composed member calls descended.
   */
  const base: { current: Node | typeof NO_MEMBER_RECEIVER; } = {
    current: memberCallReceiver({ call, },),
  };
  /**
   * Expressions already descended through, so an alias cycle cannot spin this.
   */
  const visited = new Set<Node>();
  while ((base.current !== NO_MEMBER_RECEIVER)
    && (!visited.has(base.current,))) {
    visited.add(base.current,);
    if (isCallExpression(base.current,)) {
      base.current = memberCallReceiver({ call: base.current, },);
      continue;
    }
    /* Names are descended too, and the same hop the element walk uses.
     * `const copied = tree.children.slice(); return copied.filter(observer,);` puts a name
     * where the composed form puts a call, and stopping at the name left
     * `filterAliasedForeignFixtureTree` discharged while its two siblings were restored.
     * Its own doc calls it the aliased spelling of the case beside it, so the two agreeing
     * is the point of it existing. */
    /**
     * Value this name was declared with, when it names one local declaration.
     */
    const declared = bindingDeclarationInitializer({
      project,
      checker: project.checker,
      node: base.current,
    },);
    if (declared === NO_BINDING_INITIALIZER)
      break;
    base.current = declared;
  }
  if ((base.current !== NO_MEMBER_RECEIVER)
    && expressionContainsForeignBorrowed({
      project,
      node: base.current,
    },))
    return false;
  return callersAllResolve({
    project,
    body,
  },);
}
