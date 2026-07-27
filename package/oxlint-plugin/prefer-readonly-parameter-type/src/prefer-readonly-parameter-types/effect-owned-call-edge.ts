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
import { isIdentifier, } from 'typescript/unstable/ast/is';
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
  /* An explicit `this` parameter occupies a formal index while receiving no argument, so
   * every per-argument array has to start one slot later or propagation reads the wrong
   * formal. `explicitThisEffect` in the call-edge fixture measured the off-by-one: the
   * callee recorded its write on formal one, the caller's only argument sat at edge zero,
   * and the write reached nobody. */
  const formalOffset = calleeHasThisParameter({ callee, },) ? 1 : 0;
  /**
   * Placeholder entries aligning argument arrays with formal parameter indexes.
   */
  const formalPadding = Array.from(
    { length: formalOffset, },
    function emptyFormal(): readonly number[] {
      return [];
    },
  );
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
    arguments: [
      ...formalPadding,
      ...allArgumentIndexes,
    ],
    foreignArguments: [
      ...formalPadding,
      ...allArgumentIndexes,
    ],
    directForeignArguments: [
      ...formalPadding.map(function unmarkedFormal(): boolean {
        return false;
      },),
      ...call.arguments
        .map(function foreignArgument(argument,): boolean {
          return expressionContainsForeignBorrowed({
            project,
            node: argument,
          },);
        },),
    ],
    foreignInbound,
    callbackKeys: [
      ...formalPadding.map(function unavailableFormalCallback(): typeof OWNED_CALLABLE_UNAVAILABLE {
        return OWNED_CALLABLE_UNAVAILABLE;
      },),
      ...callbacks
        .map(function callbackKey(candidate,) {
          return candidate === OWNED_CALLABLE_UNAVAILABLE
            ? OWNED_CALLABLE_UNAVAILABLE
            : callableKey(candidate,);
        },),
    ],
    callbackFileNames: [
      ...formalPadding.map(function unavailableFormalFileName(): typeof OWNED_CALLABLE_UNAVAILABLE {
        return OWNED_CALLABLE_UNAVAILABLE;
      },),
      ...callbacks
        .map(function callbackFileName(candidate,) {
          return candidate === OWNED_CALLABLE_UNAVAILABLE
            ? OWNED_CALLABLE_UNAVAILABLE
            : candidate.getSourceFile()
              .fileName;
        },),
    ],
  },);
}

/**
 * Tests whether a callee declares an explicit `this` parameter.
 *
 * @param callee - Callable declaration whose formals are inspected.
 *
 * @returns whether formal index zero receives no argument.
 *
 * @example
 * ```ts
 * calleeHasThisParameter({ callee });
 * ```
 */
function calleeHasThisParameter({
  callee,
}: {
  readonly callee: EffectCallableDeclaration;
},): boolean {
  /**
   * First declared formal, absent for a callable taking nothing.
   */
  const first = callee.parameters[0];
  if (first === undefined)
    return false;
  return isIdentifier(first.name,)
    && (first.name
      .getText() === 'this');
}
