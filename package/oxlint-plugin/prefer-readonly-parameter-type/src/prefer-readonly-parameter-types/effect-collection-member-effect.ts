/**
 * Structural and reachability claims for one default-library collection call.
 *
 * @module
 */

import type {
  CallExpression,
  Expression,
  Node,
} from 'typescript/unstable/ast';
import type {
  Checker,
  Project,
} from 'typescript/unstable/sync';

import {
  COLLECTION_STRUCTURE_MUTATED,
  COLLECTION_STRUCTURE_PRESERVED,
  collectionStructureClaim,
} from './effect-default-library-readonly-view.ts';
import { parameterIndex, } from './effect-call-resolution.ts';
import { expressionCanCarryMutableState, } from './effect-primitive-origin.ts';
import {
  addEffectIndex,
  type MutableEffectSummary,
  PARAMETER_INDEX_UNAVAILABLE,
} from './effect-summary-model.ts';
import { recordReadonlyViewApplications, } from './effect-readonly-view-application.ts';

/**
 * Records both claims for one default-library collection call.
 *
 * The two claims stay independent, because a member can restructure its receiver
 * and run user code over it in the same call. `Map.getOrInsertComputed` inserts
 * and invokes a caller-supplied factory; `Array.sort(comparator)` reorders and
 * invokes the comparator. Each records its mutation and then, separately, has its
 * observers analyzed.
 *
 * Only a fully answered call is discharged. A restructuring member whose
 * reachable user code cannot be derived reports its mutation and still falls
 * through to the opaque boundary, so a bare `Array.sort()`, which reorders and
 * runs the default comparator's string coercion, ends up both mutated and
 * opaque rather than silently accepted.
 *
 * @param project - TypeScript project resolving observer declarations.
 *
 * @param checker - TypeScript checker resolving receiver and parameter types.
 *
 * @param bindingOriginBySymbolId - Current callable parameter and alias origins.
 *
 * @param call - Collection call expression.
 *
 * @param receiver - Receiver expression whose parameter root is required.
 *
 * @param declaration - Resolved member declaration.
 *
 * @param summary - Caller summary receiving facts.
 *
 * @param analysisRoot - Optional external implementation root.
 *
 * @returns whether call was fully derived and needs no opaque fallback.
 *
 * @mutates summary - Adds receiver mutation and derived element-flow relations.
 *
 * @example
 * ```ts
 * recordCollectionMemberEffect({ project, checker, bindingOriginBySymbolId, call, receiver, declaration, summary });
 * ```
 */
export function recordCollectionMemberEffect({
  project,
  checker,
  bindingOriginBySymbolId,
  call,
  receiver,
  declaration,
  summary,
  analysisRoot,
}: {
  readonly project: Project;
  readonly checker: Checker;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, number>;
  readonly call: CallExpression;
  readonly receiver: Expression;
  readonly declaration: Node;
  readonly summary: MutableEffectSummary;
  readonly analysisRoot?: string;
},): boolean {
  /**
   * What this member does to the receiver's own structure.
   */
  const structure = collectionStructureClaim({
    project,
    declaration,
  },);
  if ((structure !== COLLECTION_STRUCTURE_PRESERVED)
    && (structure !== COLLECTION_STRUCTURE_MUTATED))
    return false;
  if (structure === COLLECTION_STRUCTURE_MUTATED) {
    /**
     * Caller parameter owning receiver, when receiver can carry mutable state.
     */
    const mutatedParameterIndex = expressionCanCarryMutableState({
        checker,
        node: receiver,
      },)
      ? parameterIndex({
        checker,
        bindingOriginBySymbolId,
        node: receiver,
      },)
      : PARAMETER_INDEX_UNAVAILABLE;
    addEffectIndex({
      target: summary.directMutated,
      value: mutatedParameterIndex,
    },);
  }
  return recordReadonlyViewApplications({
    project,
    checker,
    bindingOriginBySymbolId,
    call,
    receiver,
    summary,
    ...(analysisRoot === undefined) ? {} : { analysisRoot, },
  },);
}
