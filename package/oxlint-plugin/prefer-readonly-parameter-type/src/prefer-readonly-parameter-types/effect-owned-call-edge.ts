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
import {
  callableKey,
  type EffectCallableDeclaration,
  type MutableEffectSummary,
  OWNED_CALLABLE_UNAVAILABLE,
} from './effect-summary-model.ts';
import { callableDeclaration, } from './effect-call-resolution.ts';

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
   * Owned callback declarations paired with argument positions.
   */
  const callbacks = call.arguments
    .map(function callbackDeclaration(argument,) {
      return callableDeclaration({
        project,
        node: argument,
        ...(analysisRoot === undefined) ? {} : { analysisRoot, },
      },);
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
    arguments: allArgumentIndexes,
    foreignArguments: allArgumentIndexes,
    directForeignArguments: call.arguments
      .map(function foreignArgument(argument,): boolean {
        return expressionContainsForeignBorrowed({
          project,
          node: argument,
        },);
      },),
    foreignInbound,
    callbackKeys: callbacks
      .map(function callbackKey(candidate,) {
        return candidate === OWNED_CALLABLE_UNAVAILABLE
          ? OWNED_CALLABLE_UNAVAILABLE
          : callableKey(candidate,);
      },),
    callbackFileNames: callbacks
      .map(function callbackFileName(candidate,) {
        return candidate === OWNED_CALLABLE_UNAVAILABLE
          ? OWNED_CALLABLE_UNAVAILABLE
          : candidate.getSourceFile()
            .fileName;
      },),
  },);
}
