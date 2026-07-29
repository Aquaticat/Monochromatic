/**
 * What one return statement records, and the policy that decides it.
 *
 * Returning parameter-reachable state is not itself an effect: the caller already holds the
 * parameter, so handing back a piece of it grants no capability the caller lacked. Recording
 * which parameters a result can carry is what lets a caller keep tracking that value, and that
 * tracking is the condition under which treating a return as benign stays sound. Until callers
 * substitute through this fact, no receiver opacity may be discharged on the strength of it.
 * `doc/decision/prefer-readonly-result-provenance.md` records the policy.
 *
 * Split out of `direct-effect-summary.ts` for its line budget, which the returned-callable
 * capture pushed over. Nothing about the behaviour moved with it.
 *
 * @module
 */

import type { Node, } from 'typescript/unstable/ast';
import type {
  Checker,
  Project,
} from 'typescript/unstable/sync';

import { expressionOrigins, } from './effect-binding-origins.ts';
import { expressionCanCarryMutableState, } from './effect-primitive-origin.ts';
import { targetResultSites, } from './effect-result-binding.ts';
import { recordResultApplicationSites, } from './effect-result-substitution.ts';
import { recordReturnedCallableCapture, } from './effect-returned-callable.ts';
import {
  addEffectSlots,
  type MutableEffectSummary,
  type SlotOrigins,
} from './effect-summary-model.ts';

/**
 * Records everything one returned expression contributes.
 *
 * @param project - TypeScript project resolving origins.
 *
 * @param checker - Checker deciding whether a returned value can carry state.
 *
 * @param bindingOriginBySymbolId - Parameter and alias origins of this callable.
 *
 * @param resultSitesBySymbolId - Call sites each local binding can hold a result of.
 *
 * @param summary - Summary receiving returned origins, captures and deferred uses.
 *
 * @param returned - Expression handed back by one return statement.
 *
 * @mutates summary - Adds returned origins, captured opacity and a deferred result use.
 *
 * @example
 * ```ts
 * recordReturnEffects({ project, checker, bindingOriginBySymbolId, summary, returned });
 * ```
 */
export function recordReturnEffects({
  project,
  checker,
  bindingOriginBySymbolId,
  resultSitesBySymbolId,
  summary,
  returned,
}: {
  readonly project: Project;
  readonly checker: Checker;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, SlotOrigins>;
  readonly resultSitesBySymbolId: ReadonlyMap<number, ReadonlySet<string>>;
  readonly summary: MutableEffectSummary;
  readonly returned: Node;
},): void {
      /* Returning a callable is not returning a value the caller can track. The accepted
   * decision permits returning parameter-reachable state on one stated condition, that
   * callers keep tracking it through the recorded returned origins, and
   * `expressionOrigins` has no provenance successors for a function expression, so
   * `return (): Row => config.row` records no returned origin and no caller can
   * substitute through it. The condition fails rather than the policy applying.
   *
   * Falsified rather than argued: `ReadonlyDeep` applied, type-checked clean beside a
   * control whose direct write was rejected, and the driver changed the caller's row
   * through the returned closure.
   *
   * Opacity rather than a returned origin, which was the tempting reuse. A returned
   * origin asserts a caller can reach these parameters through this result, and what a
   * returned closure carries is the capability to reach them by invoking it.
   * `packagedCallableOrigins` over-approximates, scanning nested callable bodies, and
   * an over-approximation is safe on a channel that withholds and unsafe on one that
   * claims. Nothing today discharges on a returned set, so this would not break yet;
   * it would state the wrong relation and break whenever something did. */
  recordReturnedCallableCapture({
    project,
    bindingOriginBySymbolId,
    summary,
    returned,
  },);
  /* Only a returned value that can carry state records anything. A returned
   * primitive derived from a parameter grants the caller nothing: measured on
   * `readOnlyLookupEffect`, which returns `(facts.get(key) ?? new Set()).size`,
   * where the resolver correctly reaches `facts` through the property access and
   * the `??`, and recording that as a returned origin would claim the caller can
   * reach the map through a `number`. */
  if (expressionCanCarryMutableState({
    checker,
    node: returned,
  },)) {
    addEffectSlots({
      target: summary.directReturned,
      values: expressionOrigins({
    project,
    bindingOriginBySymbolId,
    node: returned,
      },),
    },);
    /* Returning another callable's result carries whatever that result carries, and
     * the resolver above cannot see it: a callee's summary does not exist while its
     * callers are scanned. Without this, `b` returning `a(x,)` records no returned
     * origin at all, so no caller of `b` can substitute through it either. */
    /* Asked of the binding record rather than of the expression alone, which every write and
     * store site has done since the deferred relation existed while this one had not. So
     * `return [firstRow(config,),][0] as Row` named no site: a call underlies neither the
     * element access nor the array literal, it underlies a member of the literal, and only the
     * widened walk looks there. Falsified. */
    recordResultApplicationSites({
      summary,
      sites: targetResultSites({
        project,
        resultSitesBySymbolId,
        node: returned,
      },),
      kind: 'returned',
    },);
  }
}
