/**
 * Caller origins a returned callable can reach once whoever received it invokes.
 *
 * Returning parameter-reachable state is permitted by `doc/decision/prefer-readonly-result-provenance.md`
 * on one stated condition: that callers keep tracking the value through the recorded returned
 * origins. `return config.row` satisfies it. `return (): Row => config.row` does not, because
 * `expressionOrigins` has no provenance successors for a function expression, so nothing is
 * recorded and no caller can substitute through it. The precondition fails rather than the
 * policy applying, which is what makes this a false offer instead of a permitted return.
 *
 * Opacity rather than a returned origin. A returned origin asserts that a caller can reach
 * these parameters through this result; what a returned callable carries is the capability to
 * reach them by invoking it. `packagedCallableOrigins` over-approximates, scanning the whole
 * subtree including nested callable bodies, and an over-approximation is safe on a channel
 * that withholds and unsafe on one that claims. Nothing today discharges on the strength of a
 * returned set, so the reuse would not break yet; it would state the wrong relation and break
 * as soon as something did.
 *
 * Silent, like every other retention. There is no call to name and no boundary a reader could
 * inspect, so the provenance goes through the retention vocabulary and the offer is simply
 * withheld.
 *
 * @module
 */

import type { Node, } from 'typescript/unstable/ast';
import type { Project, } from 'typescript/unstable/sync';

import {
  addOpaqueEffect,
  callableDeclaration,
} from './effect-call-resolution.ts';
import { effectOriginLocation, } from './effect-origin-location.ts';
import { packagedCallableOrigins, } from './effect-packaged-callable-origins.ts';
import { retentionProvenance, } from './effect-retention-provenance.ts';
import {
  type MutableEffectSummary,
  OWNED_CALLABLE_UNAVAILABLE,
  type SlotOrigins,
} from './effect-summary-model.ts';

/**
 * Records opacity for every caller origin a returned callable captured.
 *
 * @param project - TypeScript project resolving the returned expression.
 *
 * @param bindingOriginBySymbolId - Parameter and alias origins of the returning callable.
 *
 * @param summary - Summary receiving opacity.
 *
 * @param returned - Expression handed back by one return statement.
 *
 * @mutates summary - Adds an opaque slot and retention provenance per captured origin.
 *
 * @example
 * ```ts
 * recordReturnedCallableCapture({ project, bindingOriginBySymbolId, summary, returned });
 * ```
 */
export function recordReturnedCallableCapture({
  project,
  bindingOriginBySymbolId,
  summary,
  returned,
}: {
  readonly project: Project;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, SlotOrigins>;
  readonly summary: MutableEffectSummary;
  readonly returned: Node;
},): void {
  /**
   * Callable the returned expression resolves to, absent when a value is returned instead.
   *
   * Resolved rather than tested syntactically, so returning a closure by name behaves like
   * returning it inline, which is the same resolution the store path and the call edge use.
   */
  const callable = callableDeclaration({
    project,
    node: returned,
  },);
  if (callable === OWNED_CALLABLE_UNAVAILABLE)
    return;
  /**
   * Where the return sits, so the fact points at the escape rather than at the callable.
   */
  const location = effectOriginLocation({ node: returned, },);
  /**
   * Retention provenance naming what the return handed out.
   */
  const provenance = retentionProvenance({
    target: 'a callable returned to its caller',
    location,
  },);
  packagedCallableOrigins({
    project,
    bindingOriginBySymbolId,
    packaged: callable,
  },)
    .forEach(function recordCapturedSlot(affectedSlot,): void {
      addOpaqueEffect({
        summary,
        affectedSlot,
        provenance,
      },);
    },);
}
