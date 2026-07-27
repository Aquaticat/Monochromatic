/**
 * Owned call-edge construction for effect propagation.
 *
 * Every argument contributes the origins of everything it packages, with no filter
 * derived from what the callee's authored `@mutates` blocks happen to name. An earlier
 * revision narrowed an object-literal argument to the contract-named property names
 * whenever the callee's parameter was a destructuring pattern, which `ST9` makes the
 * normal shape here. That let an authored comment delete a recorded mutation: a callee
 * writing through a property its contract omitted had that write attributed to nothing,
 * and the caller's parameter was then offered as readonly. `directRestrictedRowEffect`
 * in the result-provenance fixture is the measured case, and
 * `doc/decision/prefer-readonly-contract-name-narrowing.md` records why the precise
 * version has to measure the callee instead of reading its contract.
 *
 * @module
 */

import type { CallExpression, } from 'typescript/unstable/ast';
import type { Project, } from 'typescript/unstable/sync';

import { expressionContainsForeignBorrowed, } from './foreign-borrowed-classifier.ts';

/**
 * Sentinel marking a formal that no single actual argument fills.
 */
const NO_SOLE_POSITION = -1;
import {
  callableKey,
  type EffectCallableDeclaration,
  type MutableEffectSummary,
  OWNED_CALLABLE_UNAVAILABLE,
} from './effect-summary-model.ts';
import { callableDeclaration, } from './effect-call-resolution.ts';
import { formalActualPositions, } from './effect-formal-actual-mapping.ts';

/**
 * Adds one owned call edge with caller-relative parameter roots.
 *
 * @param project - TypeScript project resolving callbacks and provenance.
 *
 * @param call - Owned call expression.
 *
 * @param callee - Exact owned callable declaration.
 *
 * @param allArgumentIndexes - Caller roots packaged by each argument.
 *
 * @param summary - Caller summary receiving edge.
 *
 * @param foreignInbound - Whether call belongs directly to caller summary.
 *
 * @param analysisRoot - Optional external implementation root.
 *
 * @mutates summary - Appends exact owned call edge.
 *
 * @example
 * ```ts
 * addOwnedCallEdge({ project, call, callee, allArgumentIndexes, summary, foreignInbound });
 * ```
 */
export function addOwnedCallEdge({
  project,
  call,
  callee,
  allArgumentIndexes,
  summary,
  foreignInbound,
  analysisRoot,
}: {
  readonly project: Project;
  readonly call: CallExpression;
  readonly callee: EffectCallableDeclaration;
  readonly allArgumentIndexes: readonly (readonly number[])[];
  readonly summary: MutableEffectSummary;
  readonly foreignInbound: boolean;
  readonly analysisRoot?: string;
}): void {
  /**
   * Actual positions each formal can receive, covering `this`, rest and spread.
   */
  const positionsByFormal = formalActualPositions({
    callee,
    call,
  },);
  /**
   * Caller origins packaged into each formal, unioned over the positions it can receive.
   */
  const originsByFormal = positionsByFormal
    .map(function originsForFormal(positions,): readonly number[] {
      /**
       * Distinct caller parameters reaching this formal.
       */
      const origins = new Set<number>();
      positions.forEach(function collectPosition(position,): void {
        (allArgumentIndexes[position] ?? [])
          .forEach(function collectOrigin(origin,): void {
            origins.add(origin,);
          },);
      },);
      return [...origins,];
    },);
  /**
   * Owned callback declarations paired with actual argument positions.
   */
  const callbacks = call.arguments
    .map(function callbackDeclaration(argument,) {
      return callableDeclaration({
        project,
        node: argument,
        ...(analysisRoot === undefined) ? {} : { analysisRoot, },
      },);
    },);
  /**
   * Sole actual position filling each formal, absent when several or none can.
   *
   * A callback identity names one declaration, so it only means anything for a formal
   * fed by exactly one actual. A rest formal or one past a spread reports no callback,
   * which makes `propagateInvokedCapabilities` treat its invocation as unresolved rather
   * than assume an owned body it cannot name.
   */
  const soleByFormal = positionsByFormal
    .map(function soleForFormal(positions,): number {
      return positions.length === 1 ? positions[0] ?? NO_SOLE_POSITION : NO_SOLE_POSITION;
    },);
  summary.calls
    .push({
    calleeKey: callableKey(callee,),
    calleeFileName: callee.getSourceFile()
      .fileName,
    /* Effect propagation and foreign-ownership propagation read the same origins.
     * The two stay separate fields because they answer different questions, and a
     * per-property effect model would give the first one a narrower answer that is
     * measured rather than authored. Until then, narrowing either would drop origins. */
    arguments: originsByFormal,
    foreignArguments: originsByFormal,
    /* Every covered actual must carry the marker for the formal to count as foreign,
     * because a foreign formal suppresses the readonly offer. Claiming foreignness for a
     * formal that might receive an ordinary argument would suppress an offer this
     * analysis never proved safe, so an unfilled or multiply-filled formal claims
     * nothing. */
    directForeignArguments: positionsByFormal
      .map(function foreignForFormal(positions,): boolean {
        return (positions.length > 0)
          && positions.every(function positionIsForeign(position,): boolean {
            /**
             * Actual argument at this position, absent when the call supplies none.
             */
            const argument = call.arguments[position];
            return (argument !== undefined)
              && expressionContainsForeignBorrowed({
                project,
                node: argument,
              },);
          },);
      },),
    foreignInbound,
    callbackKeys: soleByFormal
      .map(function callbackKeyForFormal(position,) {
        /**
         * Resolved callback at the sole filling position, when there is one.
         */
        const candidate = position === NO_SOLE_POSITION
          ? OWNED_CALLABLE_UNAVAILABLE
          : callbacks[position] ?? OWNED_CALLABLE_UNAVAILABLE;
        return candidate === OWNED_CALLABLE_UNAVAILABLE
          ? OWNED_CALLABLE_UNAVAILABLE
          : callableKey(candidate,);
      },),
    callbackFileNames: soleByFormal
      .map(function callbackFileNameForFormal(position,) {
        /**
         * Resolved callback at the sole filling position, when there is one.
         */
        const candidate = position === NO_SOLE_POSITION
          ? OWNED_CALLABLE_UNAVAILABLE
          : callbacks[position] ?? OWNED_CALLABLE_UNAVAILABLE;
        return candidate === OWNED_CALLABLE_UNAVAILABLE
          ? OWNED_CALLABLE_UNAVAILABLE
          : candidate.getSourceFile()
            .fileName;
      },),
  },);
}
