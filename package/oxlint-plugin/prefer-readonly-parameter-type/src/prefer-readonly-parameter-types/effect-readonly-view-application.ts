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
import {
  expressionCanCarryMutableState,
  resultExposesMutableState,
  typeCanCarryMutableState,
} from './effect-primitive-origin.ts';
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
 * One call argument whose semantic type resolved, kept at its own position.
 */
type TypedArgument = {
  readonly argument: Expression;
  readonly argumentType: Type;
  readonly argumentIndex: number;
};

/**
 * One observer argument backed by an owned implementation.
 */
type OwnedObserver = TypedArgument & {
  readonly declaration: EffectCallableDeclaration;
};

/**
 * Sentinel when the member does not describe what an argument position receives.
 */
const OBSERVED_POSITIONS_UNAVAILABLE: unique symbol = Symbol(
  'member signature does not describe observer parameter positions',
);

/**
 * Collects callback parameter positions carrying receiver-reachable state.
 *
 * Read from the member's own instantiated signature, never from how the observer
 * annotates itself. TypeScript instantiates the member with the receiver's type
 * arguments, so inside that signature the types exposing receiver state are the
 * identical `Type` instances rather than merely equivalent ones. Both those
 * arguments and the receiver type count: `forEach` hands the whole array to a
 * third parameter, reaching the same state without any element parameter.
 *
 * The observer's own annotations cannot be used for this. A pre-declared
 * function passed by reference, `states.map(operations.render)`, annotates its
 * parameter independently, producing a structurally identical but distinct type
 * that matches nothing. Matching against it silently found no position, and
 * discharging on that emptiness dropped a real mutation.
 *
 * @param checker - TypeScript checker resolving parameter types.
 *
 * @param call - Read-only view call whose member signature is authoritative.
 *
 * @param argumentIndex - Position of observer among call arguments.
 *
 * @param elementTypes - Types the receiver view is instantiated over.
 *
 * @param receiverType - Receiver collection type.
 *
 * @returns positions exposing receiver state, or sentinel when undescribed.
 *
 * @example
 * ```ts
 * observedParameterIndexes({ checker, call, argumentIndex, elementTypes, receiverType });
 * ```
 */
function observedParameterIndexes({
  checker,
  call,
  argumentIndex,
  elementTypes,
  receiverType,
}: {
  readonly checker: Checker;
  readonly call: CallExpression;
  readonly argumentIndex: number;
  readonly elementTypes: readonly Type[];
  readonly receiverType: Type;
},): readonly number[] | typeof OBSERVED_POSITIONS_UNAVAILABLE {
  /**
   * Member parameter symbol receiving observer at this position.
   */
  const memberParameter = checker.getResolvedSignature(call,)
    ?.getParameters()[argumentIndex];
  if (memberParameter === undefined)
    return OBSERVED_POSITIONS_UNAVAILABLE;
  /**
   * Callback type the member declares for this position.
   */
  const declaredObserverType = checker.getTypeOfSymbolAtLocation(
    memberParameter,
    call.expression,
  );
  if (declaredObserverType === undefined)
    return OBSERVED_POSITIONS_UNAVAILABLE;
  // An optional member parameter, `toSorted(compareFn?)`, types as a union with
  // `undefined`, which exposes no call signature at all. Strip it first, or every
  // optional-observer member would look undescribed and stay opaque.
  /**
   * Declared callback type with any optionality removed.
   */
  const presentObserverType = checker.getNonNullableType(
    declaredObserverType,
  );
  if (presentObserverType === undefined)
    return OBSERVED_POSITIONS_UNAVAILABLE;
  /**
   * Call signature the member declares for this position.
   */
  const [declaredSignature,] = checker.getSignaturesOfType(
    presentObserverType,
    SignatureKind.Call,
  );
  if (declaredSignature === undefined)
    return OBSERVED_POSITIONS_UNAVAILABLE;
  return declaredSignature
    .getParameters()
    .flatMap(function reachableParameter(
      parameterSymbol,
      observerParameterIndex,
    ): readonly number[] {
      /**
       * Instantiated member callback parameter type at this call.
       */
      const parameterType = checker.getTypeOfSymbolAtLocation(
        parameterSymbol,
        call.expression,
      );
      // An unresolved parameter type counts as reachable: failing to prove a
      // position safe must widen what propagates, never narrow it.
      /**
       * Whether this position exposes state reachable from the receiver.
       */
      const reachable = (parameterType === undefined)
        || (parameterType === receiverType)
        || elementTypes.includes(parameterType,);
      return reachable
        ? [observerParameterIndex,]
        : [];
    },);
}

/**
 * Tests whether a call result is receiver state rather than something newly built.
 *
 * Matches by `Type` identity against the receiver's instantiated element types,
 * because the member's signature is instantiated with those arguments, so receiver
 * state appearing in a result is the identical instance rather than an equivalent
 * one. Only state-carrying matches count, since sharing a primitive element type
 * exposes nothing: `readonly string[]` filtered to `string[]` copies primitives.
 *
 * Receiver identity is deliberately not matched. A member returning the receiver
 * itself, `sort` and `reverse`, is a mutator, so the structural claim has already
 * recorded the mutation and nothing reachable through the result is new. Matching it
 * here regressed `mutableSortObserverEffect` from a derived mutation to a mutation
 * plus an opaque boundary, which is the rule saying it cannot tell about a call it
 * fully understands.
 *
 * @param checker - TypeScript checker resolving result type arguments.
 *
 * @param resultType - Instantiated result type of one call.
 *
 * @param elementTypes - Types the receiver collection is instantiated over.
 *
 * @returns whether result may alias caller-owned receiver state.
 *
 * @example
 * ```ts
 * resultAliasesReceiverState({ checker, resultType, elementTypes, });
 * ```
 */
function resultAliasesReceiverState({
  checker,
  resultType,
  elementTypes,
}: {
  readonly checker: Checker;
  readonly resultType: Type;
  readonly elementTypes: readonly Type[];
},): boolean {
  /**
   * Result itself plus anything a constructed result holds.
   */
  const resultCandidates = [
    resultType,
    ...resultType.isTypeReference()
      ? checker.getTypeArguments(resultType,)
      : [],
  ];
  return resultCandidates
    .some(function aliasesState(candidate,): boolean {
      return elementTypes.includes(candidate,)
        && typeCanCarryMutableState({
          checker,
          type: candidate,
        },);
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
  // Every type argument counts, not just the first. `ReadonlyArray<T>` puts its
  // element at 0, but `ReadonlyMap<K, V>` puts the key there and the value that
  // callbacks receive at 1, so reading only position 0 misses map values.
  /**
   * Types the read-only view is instantiated over.
   */
  const elementTypes = checker.getTypeArguments(receiverType,);
  if (elementTypes.length === 0)
    return READONLY_VIEW_UNDISCHARGED;
  // A member that builds a collection result routes it through
  // `ArraySpeciesCreate`, which reads `constructor[Symbol.species]` and calls
  // whatever it returns. That user code then receives everything the result
  // holds, which for `filter`, `slice`, `concat`, `flat` and an identity `map`
  // is the receiver's own elements. Measured in
  // `doc/decision/prefer-readonly-effect-model-split.md`.
  //
  // Whether a member consults species is not derivable: `toReversed`, `with`
  // and `toSpliced` build new arrays without it. So the derivable and
  // conservative test is what the result could carry. A result holding only
  // primitives keeps receiver state out of the channel however it is built,
  // which is what rescues `map` with a primitive-returning observer.
  //
  // Species is not the only way state leaves through the result. A member can
  // simply hand an element back, `find` and `findLast` returning `T | undefined`,
  // and that element is the receiver's own. Both routes are the same question,
  // what the result exposes, so both go through one predicate.
  //
  // This over-restricts members that return the receiver itself, `sort`, and
  // members that never construct, `reduce` accumulating into an array, since
  // neither is distinguishable here. Both directions fail closed.
  /**
   * Instantiated result type of this call.
   */
  const resultType = checker.getTypeAtLocation(call,);
  if (resultType === undefined)
    return READONLY_VIEW_UNDISCHARGED;
  if (resultExposesMutableState({
    checker,
    type: resultType,
  },))
    return READONLY_VIEW_UNDISCHARGED;
  // Being a generic instantiation does not make a result freshly built. That is a
  // fact about the type's representation, not about where the value came from, and
  // reading it as provenance let one case through: `rows.reduce((kept) => kept)`
  // over `string[][]` returns the accumulator it was handed, whose type is `string[]`,
  // a type reference whose only argument is primitive. The exposure test above reads
  // that as a fresh container of primitives and discharges, so `first.push('x')`
  // mutated a caller-owned row unreported, while the same mutation through `rows[0]`
  // was reported.
  //
  // Identity separates them. The member's signature is instantiated with the
  // receiver's type arguments, so a result that is receiver state is the identical
  // `Type` instance rather than merely an equivalent one, exactly as observed
  // positions are matched. State-carrying only: a `readonly string[]` filtered to
  // `string[]` shares the primitive element type and exposes nothing.
  if (resultAliasesReceiverState({
    checker,
    resultType,
    elementTypes,
  },))
    return READONLY_VIEW_UNDISCHARGED;
  /**
   * Every argument paired with its resolved type.
   */
  const typedArguments = [...call.arguments,]
    .flatMap(function typedArgument(
      argument,
      argumentIndex,
    ): readonly TypedArgument[] {
      /**
       * Argument type, absent when the checker cannot resolve it.
       */
      const argumentType = checker.getTypeAtLocation(argument,);
      return (argumentType === undefined)
        ? []
        : [{
          argument,
          argumentType,
          argumentIndex,
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
      argumentIndex,
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
          argumentIndex,
          declaration,
        },];
    },);
  if (ownedObservers.length !== observers.length)
    return READONLY_VIEW_UNDISCHARGED;
  /**
   * Positions the member hands receiver state to, per observer.
   */
  const observedPositions = ownedObservers
    .map(function positionsFor({ argumentIndex, },) {
      return observedParameterIndexes({
        checker,
        call,
        argumentIndex,
        elementTypes,
        receiverType,
      },);
    },);
  if (observedPositions
    .some(function undescribed(positions,): boolean {
      return positions === OBSERVED_POSITIONS_UNAVAILABLE;
    },))
    return READONLY_VIEW_UNDISCHARGED;
  return ownedObservers
    .map(function application(
      { declaration, },
      observerIndex,
    ): ElementApplication {
      /**
       * Positions for this observer, already proven described above.
       */
      const positions = observedPositions[observerIndex];
      return {
        receiverParameterIndex,
        callbackKey: callableKey(declaration,),
        callbackParameterIndexes: (positions === undefined)
            || (positions === OBSERVED_POSITIONS_UNAVAILABLE)
          ? []
          : positions,
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
