/**
 * Whether a view call's result is accounted for by a verified relation.
 *
 * @module
 */

import type {
  CallExpression,
  Node,
} from 'typescript/unstable/ast';
import type {
  Checker,
  Project,
  Type,
} from 'typescript/unstable/sync';

import {
  callResultComesFromObserver,
  callResultElementReceiver,
  RESULT_NOT_RECEIVER_STATE,
} from './effect-member-result-relation.ts';
import { resultExposesMutableState, } from './effect-primitive-origin.ts';
import { resultEscapesCallable, } from './effect-result-escape.ts';
import { resultAliasesReceiverState, } from './effect-view-result-aliasing.ts';

/**
 * Tests whether a call's result leaves state unaccounted for.
 *
 * This replaces a test that read type shape where the claim is about provenance:
 * `rows.map(row => ({ chars: row.count }))` builds objects holding one number that share
 * nothing with the caller, and it was refused because `Row` is not primitive. That refusal
 * is the defect issue #414 reports, and no rewrite resolves it.
 *
 * Replaced rather than removed, because deleting it outright is unsound for `toSorted`,
 * which builds a fresh array of the receiver's own elements while its observer only compares
 * them. No relation names that result and no observer fact does either, so it would discharge
 * with a write through the sorted copy attributed to nothing.
 *
 * So a state-carrying result must have a relation covering it:
 *
 * - an observer-derived result is answered by `propagateElementApplications`, which marks the
 *   receiver opaque when the observer hands its element back;
 * - a container of receiver elements is answered by the element step, which attributes writes
 *   through it, and additionally has to stay inside this callable, because nothing attributes
 *   a use that leaves;
 * - anything else keeps failing closed exactly as before.
 *
 * The aliasing test is the fallback for a member with no relation, and it yields to one that
 * has it. `filter` returns `Slice[]` from `readonly Slice[]`, whose element type is the
 * receiver's own by identity, so running it first refuses exactly the containers the relation
 * was built to describe. Measured: with the relation verified and the escape question
 * answered, `plainFilterCount` stayed opaque while its result never left the callable. What
 * the fallback still catches is what it was written for: `rows.reduce((kept) => kept)` hands
 * back the accumulator it was given, and `reduce` has no relation.
 *
 * @param project - TypeScript project proving default-library ownership.
 *
 * @param checker - TypeScript checker resolving signature and types.
 *
 * @param call - View call whose result is being accounted for.
 *
 * @param resultType - Instantiated result type of this call.
 *
 * @param elementTypes - Types the receiver view is instantiated over.
 *
 * @param body - Enclosing callable body, absent when there is none to scan.
 *
 * @returns whether the result carries state no relation accounts for.
 *
 * @example
 * ```ts
 * viewResultUnaccounted({ project, checker, call, resultType, elementTypes, body });
 * ```
 */
export function viewResultUnaccounted({
  project,
  checker,
  call,
  resultType,
  elementTypes,
  body,
}: {
  readonly project: Project;
  readonly checker: Checker;
  readonly call: CallExpression;
  readonly resultType: Type;
  readonly elementTypes: readonly Type[];
  readonly body?: Node;
},): boolean {
  /**
   * Whether the result is built out of what the observer returned.
   */
  const observerDerived = callResultComesFromObserver({
    project,
    checker,
    call,
  },);
  /**
   * Whether the result is a verified container of the receiver's own elements.
   */
  const containerDerived = callResultElementReceiver({
    project,
    checker,
    call,
  },) !== RESULT_NOT_RECEIVER_STATE;
  if (resultExposesMutableState({
    checker,
    type: resultType,
  },)) {
    if ((!observerDerived) && (!containerDerived))
      return true;
    if (containerDerived
      && ((body === undefined)
        || resultEscapesCallable({
          project,
          body,
          call,
          elementStepsAttributed: true,
        },)))
      return true;
  }
  return (!observerDerived)
    && (!containerDerived)
    && resultAliasesReceiverState({
      checker,
      resultType,
      elementTypes,
    },);
}
