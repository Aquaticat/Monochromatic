/**
 * Element-flow derivation for default-library read-only view calls.
 *
 * @module
 */

import type {
  CallExpression,
  Expression,
} from 'typescript/unstable/ast';
import {
  type Checker,
  type Project,
  SignatureKind,
  type Type,
} from 'typescript/unstable/sync';

import {
  callableDeclaration,
  parameterIndex,
} from './effect-call-resolution.ts';
import { typeDefinitelyCallable, } from './effect-definitely-callable.ts';
import { expressionCanCarryMutableState, } from './effect-primitive-origin.ts';
import {
  callableKey,
  type EffectCallableDeclaration,
  type ElementApplication,
  type MutableEffectSummary,
  OWNED_CALLABLE_UNAVAILABLE,
  PARAMETER_INDEX_UNAVAILABLE,
} from './effect-summary-model.ts';

/**
 * Sentinel when a read-only view call leaves reachable user code unproven.
 */
export const READONLY_VIEW_UNDISCHARGED: unique symbol = Symbol(
  'read-only view call has unanalyzable reachable user code',
);

/**
 * One call argument whose semantic type resolved.
 */
type TypedArgument = {
  readonly argument: Expression;
  readonly argumentType: Type;
};

/**
 * One observer argument backed by an owned implementation.
 */
type OwnedObserver = TypedArgument & {
  readonly declaration: EffectCallableDeclaration;
};

/**
 * Collects callback parameter positions carrying receiver-reachable state.
 *
 * TypeScript instantiates the member signature with the receiver's own type
 * argument, so the parameter types that expose receiver state are the identical
 * `Type` instances rather than merely equivalent ones. Both the element type and
 * the receiver type count: `forEach` hands the whole array to a third parameter,
 * which reaches the same state without touching an element parameter.
 *
 * @param checker - TypeScript checker resolving parameter types.
 *
 * @param argument - Caller-supplied observer expression.
 *
 * @param elementType - Receiver element type.
 *
 * @param receiverType - Receiver collection type.
 *
 * @returns parameter positions exposing receiver-reachable state.
 *
 * @example
 * ```ts
 * receiverReachableParameterIndexes({ checker, argument, elementType, receiverType });
 * ```
 */
function receiverReachableParameterIndexes({
  checker,
  argument,
  argumentType,
  elementType,
  receiverType,
}: {
  readonly checker: Checker;
  readonly argument: Expression;
  readonly argumentType: Type;
  readonly elementType: Type;
  readonly receiverType: Type;
},): readonly number[] {
  /**
   * Call signatures exposed by observer argument.
   */
  const signatures = checker.getSignaturesOfType(
    argumentType,
    SignatureKind.Call,
  );
  /**
   * Observer parameter symbols, absent when the argument exposes no signature.
   */
  const observerParameters = signatures[0]
    ?.getParameters()
    ?? [];
  return observerParameters
    .flatMap(function reachableParameter(
      parameterSymbol,
      observerParameterIndex,
    ): readonly number[] {
      /**
       * Instantiated observer parameter type at this call.
       */
      const parameterType = checker.getTypeOfSymbolAtLocation(
        parameterSymbol,
        argument,
      );
      // An unresolved parameter type counts as reachable: failing to prove a
      // position safe must widen what propagates, never narrow it.
      /**
       * Whether this position exposes state reachable from the receiver.
       */
      const reachable = (parameterType === undefined)
        || (parameterType === elementType)
        || (parameterType === receiverType);
      return reachable
        ? [observerParameterIndex,]
        : [];
    },);
}

/**
 * Derives element-flow relations for one default-library read-only view call.
 *
 * Answers only the reachable-user-code question; the caller has already proven
 * that the member cannot restructure the receiver. Every path that cannot be
 * derived returns the undischarged sentinel so the receiver stays opaque:
 * a member observing elements with no caller-supplied observer, such as `join`
 * or a bare `toSorted()`, supplies nothing to analyze, and an observer whose
 * implementation is not owned source cannot be analyzed at all.
 *
 * @param project - TypeScript project resolving observer declarations.
 *
 * @param checker - TypeScript checker resolving receiver and parameter types.
 *
 * @param call - Read-only view call expression.
 *
 * @param receiver - Receiver expression rooted at a caller parameter.
 *
 * @param receiverParameterIndex - Caller parameter owning receiver.
 *
 * @param analysisRoot - Optional external implementation root.
 *
 * @returns derived relations, or sentinel when reachable code stays unproven.
 *
 * @example
 * ```ts
 * readonlyViewElementApplications({ project, checker, call, receiver, receiverParameterIndex });
 * ```
 */
export function readonlyViewElementApplications({
  project,
  checker,
  call,
  receiver,
  receiverParameterIndex,
  analysisRoot,
}: {
  readonly project: Project;
  readonly checker: Checker;
  readonly call: CallExpression;
  readonly receiver: Expression;
  readonly receiverParameterIndex: number;
  readonly analysisRoot?: string;
},): readonly ElementApplication[] | typeof READONLY_VIEW_UNDISCHARGED {
  /**
   * Receiver collection type carrying the element type argument.
   */
  const receiverType = checker.getTypeAtLocation(receiver,);
  if ((receiverType === undefined) || (!receiverType.isTypeReference()))
    return READONLY_VIEW_UNDISCHARGED;
  /**
   * Type arguments instantiating the read-only view.
   */
  const receiverTypeArguments = checker.getTypeArguments(receiverType,);
  /**
   * Element type behind the read-only view.
   */
  const [elementType,] = receiverTypeArguments;
  if (elementType === undefined)
    return READONLY_VIEW_UNDISCHARGED;
  /**
   * Every argument paired with its resolved type.
   */
  const typedArguments = [...call.arguments,]
    .flatMap(function typedArgument(argument,): readonly TypedArgument[] {
      /**
       * Argument type, absent when the checker cannot resolve it.
       */
      const argumentType = checker.getTypeAtLocation(argument,);
      return (argumentType === undefined)
        ? []
        : [{
          argument,
          argumentType,
        },];
    },);
  /**
   * Argument count at the call site.
   */
  const argumentCount = call.arguments
    .length;
  if (typedArguments.length !== argumentCount)
    return READONLY_VIEW_UNDISCHARGED;
  /**
   * Arguments that are definitely callable at runtime.
   */
  const observers = typedArguments
    .filter(function callableArgument({ argumentType, },): boolean {
      return typeDefinitelyCallable({
        checker,
        type: argumentType,
      },);
    },);
  if (observers.length === 0)
    return READONLY_VIEW_UNDISCHARGED;
  // Anything else passed alongside the observers reaches the member by a route
  // the element-flow derivation does not describe, `map`'s `thisArg` being the
  // standing example, so state arriving that way leaves the call underived.
  if (typedArguments
    .some(function unobservedArgument({ argument, },): boolean {
      return (!observers
        .some(function isObserver(observer,): boolean {
          return observer.argument === argument;
        },))
        && expressionCanCarryMutableState({
          checker,
          node: argument,
        },);
    },))
    return READONLY_VIEW_UNDISCHARGED;
  /**
   * Owned declarations behind every observer argument.
   */
  const ownedObservers = observers
    .flatMap(function ownedObserver({
      argument,
      argumentType,
    },): readonly OwnedObserver[] {
      /**
       * Observer implementation, absent when it is not owned source.
       */
      const declaration = callableDeclaration({
        project,
        node: argument,
        ...(analysisRoot === undefined) ? {} : { analysisRoot, },
      },);
      return (declaration === OWNED_CALLABLE_UNAVAILABLE)
        ? []
        : [{
          argument,
          argumentType,
          declaration,
        },];
    },);
  if (ownedObservers.length !== observers.length)
    return READONLY_VIEW_UNDISCHARGED;
  return ownedObservers
    .map(function application({
      argument,
      argumentType,
      declaration,
    },): ElementApplication {
      return {
        receiverParameterIndex,
        callbackKey: callableKey(declaration,),
        callbackParameterIndexes: receiverReachableParameterIndexes({
          checker,
          argument,
          argumentType,
          elementType,
          receiverType,
        },),
      };
    },);
}

/**
 * Records element-flow relations for a read-only view call on a parameter.
 *
 * @param project - TypeScript project resolving observer declarations.
 *
 * @param checker - TypeScript checker resolving receiver and parameter types.
 *
 * @param bindingOriginBySymbolId - Current callable parameter and alias origins.
 *
 * @param call - Read-only view call expression.
 *
 * @param receiver - Receiver expression whose parameter root is required.
 *
 * @param summary - Caller summary receiving derived relations.
 *
 * @param analysisRoot - Optional external implementation root.
 *
 * @returns whether call was fully derived and needs no opaque fallback.
 *
 * @mutates summary - Appends derived element-flow relations.
 *
 * @example
 * ```ts
 * recordReadonlyViewApplications({ project, checker, bindingOriginBySymbolId, call, receiver, summary });
 * ```
 */
export function recordReadonlyViewApplications({
  project,
  checker,
  bindingOriginBySymbolId,
  call,
  receiver,
  summary,
  analysisRoot,
}: {
  readonly project: Project;
  readonly checker: Checker;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, number>;
  readonly call: CallExpression;
  readonly receiver: Expression;
  readonly summary: MutableEffectSummary;
  readonly analysisRoot?: string;
},): boolean {
  /**
   * Caller parameter owning receiver, when receiver can carry mutable state.
   */
  const receiverParameterIndex = expressionCanCarryMutableState({
      checker,
      node: receiver,
    },)
    ? parameterIndex({
      checker,
      bindingOriginBySymbolId,
      node: receiver,
    },)
    : PARAMETER_INDEX_UNAVAILABLE;
  if (receiverParameterIndex === PARAMETER_INDEX_UNAVAILABLE)
    return false;
  /**
   * Derived relations, or sentinel when reachable user code stays unproven.
   */
  const applications = readonlyViewElementApplications({
    project,
    checker,
    call,
    receiver,
    receiverParameterIndex,
    ...(analysisRoot === undefined) ? {} : { analysisRoot, },
  },);
  if (applications === READONLY_VIEW_UNDISCHARGED)
    return false;
  applications.forEach(function record(application,): void {
    summary.elementApplications
      .push(application,);
  },);
  return true;
}
