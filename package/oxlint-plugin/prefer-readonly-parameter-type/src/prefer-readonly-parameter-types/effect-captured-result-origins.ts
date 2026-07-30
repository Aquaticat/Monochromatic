/**
 * Caller origins a callee's result carries because it invoked a callable the caller packaged.
 *
 * Captures were admitted on one channel only: a callee that could not account for the callable
 * it received. That is the retention case, and it left the other half of what a callee does with
 * a callable unanswered. A callee can also invoke it and hand the result on:
 *
 * ```ts
 * function invokeSupplied(supplied: () => Row,): Row {
 *   return supplied();
 * }
 *
 * function handInlineToInvoker(inlineInvoked: Config,): Row {
 *   return invokeSupplied((): Row => inlineInvoked.row,);
 * }
 * ```
 *
 * `invokeSupplied` records `returned=[0]`, so the edge already says its result carries whatever
 * formal zero carries, and `handInlineToInvoker` recorded nothing at all: the capture sat in
 * `capturedOriginsByFormal`, which the substitution walk never reads.
 *
 * What that costs is a caller further out. A return of caller state is permitted on the condition
 * that callers substitute through recorded returned origins, so `handInlineToInvoker` keeping its
 * offer is the policy working, exactly as it does for a direct `return direct.row`. The condition
 * is what failed. Measured:
 *
 * ```ts
 * function storeInvokedResult(storedThrough: Config,): void {
 *   rowHolder.row = handInlineToInvoker(storedThrough,);
 * }
 * ```
 *
 * recorded nothing and was offered, while the same store of a directly returning callee's result
 * recorded `opaque=[0]` and withheld. A store is not a permitted return, so that is a false offer,
 * and the cause is a returned set that omitted the capture rather than a store path that missed it.
 *
 * Both readings of a returned callable formal agree here, which is why one relation answers for
 * both. `returned=[0]` can mean the result is the callable itself, and then the caller now holds
 * something that captures the origin; or it can mean the result is what invoking the callable
 * produced, and then the caller holds the origin directly. Either way the caller's result carries
 * it.
 *
 * @module
 */

import type { EffectSlot, } from './effect-slot-identity.ts';
import type {
  CallEdge,
  MutableEffectSummary,
} from './effect-summary-model.ts';

/**
 * Origins carried by nothing, shared so a slot packaging no capture allocates none.
 */
const NO_CAPTURED_ORIGINS: readonly EffectSlot[] = [];

/**
 * Re-files an edge's per-formal captures under the callee slots those formals own.
 *
 * The substitution walk is indexed by callee slot, because a callee records its returned facts
 * against slots rather than against parameters, and captures are recorded per formal, because a
 * capture is not inside the value and has no property key to file it under. This is the one
 * translation between the two, and it repeats a formal's captures across every slot that formal
 * owns rather than choosing one: the callee's returned fact names whichever slot it named, and a
 * capture reaching the formal reaches the callable however the formal was decomposed.
 *
 * @param calleeSummary - Callee summary naming which formal owns each of its slots.
 *
 * @param edge - Owned call edge carrying captures per formal.
 *
 * @returns captures per callee slot, empty at every slot whose formal packaged none.
 *
 * @example
 * ```ts
 * capturedOriginsByCalleeSlot({ calleeSummary, edge });
 * ```
 */
export function capturedOriginsByCalleeSlot({
  calleeSummary,
  edge,
}: {
  readonly calleeSummary: MutableEffectSummary;
  readonly edge: CallEdge;
},): readonly (readonly EffectSlot[])[] {
  return calleeSummary.slots
    .parameterOfSlot
    .map(function capturesForSlot(owner,): readonly EffectSlot[] {
      return edge.capturedOriginsByFormal[owner] ?? NO_CAPTURED_ORIGINS;
    },);
}
