/**
 * Whether one call's result is verified receiver state, and from which receiver.
 *
 * @module
 */

import type {
  CallExpression,
  Expression,
} from 'typescript/unstable/ast';
import {
  isIdentifier,
  isInterfaceDeclaration,
  isMethodSignatureDeclaration,
} from 'typescript/unstable/ast/is';
import {
  type Checker,
  type Project,
  type Type,
  TypeFlags,
} from 'typescript/unstable/sync';

import {
  memberCallReceiver,
  NO_MEMBER_RECEIVER,
} from './effect-member-call-receiver.ts';
import {
  memberResultProvenance,
  RESULT_RELATION_OBSERVER_RETURN,
  RESULT_RELATION_RECEIVER_ELEMENTS,
  RESULT_RELATION_RECEIVER_VALUE,
  RESULT_RELATION_UNPROVEN,
} from './effect-result-provenance-authority.ts';

/**
 * Sentinel when a call's result is not verified to be receiver state.
 *
 * Covers every reason at once, deliberately: an unproven member, a receiver whose
 * type exposes no arguments, and a result that fails identity validation are all
 * "no verified relation", and distinguishing them would invite treating the
 * near-misses as weaker evidence rather than as no evidence.
 */
export const RESULT_NOT_RECEIVER_STATE: unique symbol = Symbol(
  'call result is not verified receiver state',
);

/**
 * Sentinel when a call selected no default-library interface member.
 *
 * A sentinel rather than `undefined`, because this repo models absence without
 * nullish unions, and the distinction carries meaning here: a call that resolved to
 * nothing is a different fact from one whose member has no verified relation.
 */
const NOT_DEFAULT_LIBRARY_MEMBER: unique symbol = Symbol(
  'call selected no default-library interface member',
);

/**
 * Splits a type into the constituents identity matching should consider.
 *
 * Union traversal is the whole reason this exists. `Array.prototype.at` returns
 * `T | undefined` and `Map.prototype.get` returns `V | undefined`, so every flagship
 * member of the result authority has an optional result. Two predicates in this
 * package guard on `isTypeReference()` before looking at arguments, and a union is
 * not a type reference, so both answer "no" for exactly the members that matter.
 *
 * @param type - Result type to split.
 *
 * @returns constituents to compare, the type itself when it is not a union.
 *
 * @example
 * ```ts
 * identityCandidates({ type: resultType });
 * ```
 */
function identityCandidates({ type, }: { readonly type: Type; },): readonly Type[] {
  return type.isUnionType()
    ? type.getTypes()
    : [type,];
}

/**
 * Tests whether every value the result can be is state the receiver held.
 *
 * A subset test, not an existential one, and the difference matters in both
 * directions.
 *
 * It fixes a false negative. `Map<string, A | B>.get` returns `A | B | undefined`,
 * whose constituents are `A`, `B` and `undefined`, while the held type is the union
 * `A | B` as a single object. Asking whether any result constituent is identical to
 * the held type finds nothing, because the union object itself never appears among the
 * flattened constituents. Normalizing both sides removes that.
 *
 * It is also stricter. Under an existential test a member returning
 * `Labelled | string` would validate on the `Labelled` constituent alone, crediting
 * the receiver for a result that may be a fresh primitive instead. Requiring every
 * constituent to be held state, or absent, refuses that.
 *
 * `undefined` is admitted because every entry in the authority returns an optional:
 * an absent element is not receiver state and cannot be mutated, so its presence says
 * nothing against the relation.
 *
 * @param resultType - Instantiated result type of the call.
 *
 * @param heldType - Receiver-held type at the authority's recorded position.
 *
 * @returns whether the result can only be held state or absence.
 *
 * @example
 * ```ts
 * resultIsHeldState({ resultType, heldType });
 * ```
 */
function resultIsHeldState({
  resultType,
  heldType,
}: {
  readonly resultType: Type;
  readonly heldType: Type;
},): boolean {
  /**
   * Every distinct value the receiver's held position can be.
   */
  const held = new Set(identityCandidates({ type: heldType, },),);
  /**
   * Every distinct value this call's result can be.
   */
  const results = identityCandidates({ type: resultType, },);
  /* An empty result set would satisfy a subset test vacuously, so require that the
   * result contributes at least one held constituent rather than only absence. */
  return results.some(function isHeldState(candidate,): boolean {
      return held.has(candidate,);
    },)
    && results.every(function isHeldStateOrAbsent(candidate,): boolean {
      return held.has(candidate,)
        || ((candidate.flags & TypeFlags.Undefined) !== 0);
    },);
}

/**
 * One default-library interface member a call resolved to.
 */
type DefaultLibraryMember = {
  readonly ownerName: string;
  readonly memberName: string;
};

/**
 * Resolves the default-library interface and member a call selected.
 *
 * @param project - TypeScript project proving default-library ownership.
 *
 * @param checker - TypeScript checker resolving the signature.
 *
 * @param call - Call expression to classify.
 *
 * @returns owner and member names, or sentinel when not a default-library method.
 *
 * @example
 * ```ts
 * defaultLibraryMember({ project, checker, call });
 * ```
 */
function defaultLibraryMember({
  project,
  checker,
  call,
}: {
  readonly project: Project;
  readonly checker: Checker;
  readonly call: CallExpression;
},): DefaultLibraryMember | typeof NOT_DEFAULT_LIBRARY_MEMBER {
  /**
   * Declaration selected by overload resolution.
   */
  const declaration = checker.getResolvedSignature(call,)
    ?.declaration
    ?.resolve(project,);
  if ((declaration === undefined)
    || (!isMethodSignatureDeclaration(declaration,))
    || (!isIdentifier(declaration.name,))
    || (!project
      .program
      .isSourceFileDefaultLibrary(declaration.getSourceFile(),)))
    return NOT_DEFAULT_LIBRARY_MEMBER;
  /**
   * Interface declaring the selected method.
   */
  const owner = declaration.parent;
  if ((!isInterfaceDeclaration(owner,)) || (!isIdentifier(owner.name,)))
    return NOT_DEFAULT_LIBRARY_MEMBER;
  return {
    ownerName: owner.name
      .text,
    memberName: declaration.name
      .text,
  };
}

/**
 * Resolves the receiver whose state a call's result is verified to be.
 *
 * Two independent things must hold, and the authority alone is not enough. The
 * authority says which receiver position a member's result comes from, a fact about
 * ECMA-262 proved by identity probe. Type identity then validates that this call's
 * receiver really is instantiated so that its result is that position: the member's
 * signature is instantiated with the receiver's type arguments, so receiver state in
 * a result is the identical `Type` instance rather than merely an equivalent one.
 *
 * Identity validates an entry and never creates one. A member absent from the
 * authority stays unproven no matter how well its types line up, because matching
 * types cannot distinguish a returned element from a freshly built value of the same
 * type.
 *
 * @param project - TypeScript project proving default-library ownership.
 *
 * @param checker - TypeScript checker resolving signature and types.
 *
 * @param call - Call expression whose result may alias its receiver.
 *
 * @returns receiver expression, or sentinel when no relation is verified.
 *
 * @example
 * ```ts
 * callResultReceiver({ project, checker, call });
 * ```
 */
export function callResultReceiver({
  project,
  checker,
  call,
}: {
  readonly project: Project;
  readonly checker: Checker;
  readonly call: CallExpression;
},): Expression | typeof RESULT_NOT_RECEIVER_STATE {
  /**
   * Expression the member was called on, however the member was named.
   */
  const receiver = memberCallReceiver({ call, },);
  if (receiver === NO_MEMBER_RECEIVER)
    return RESULT_NOT_RECEIVER_STATE;
  /**
   * Default-library interface and member this call selected.
   */
  const member = defaultLibraryMember({
    project,
    checker,
    call,
  },);
  if (member === NOT_DEFAULT_LIBRARY_MEMBER)
    return RESULT_NOT_RECEIVER_STATE;
  /**
   * Verified relation for the selected member.
   */
  const provenance = memberResultProvenance(member,);
  if (provenance === RESULT_RELATION_UNPROVEN)
    return RESULT_NOT_RECEIVER_STATE;
  /* This function answers one question, whether the result IS receiver state, and a
   * container relation answers a different one. `values.slice()` hands back an array that
   * is not the receiver and whose elements are, so returning the receiver here would
   * attribute `copy.push(row)` to an array that never received it. `callResultElementReceiver`
   * answers the container half; keeping them apart is the whole reason there are two. */
  if (provenance.relation !== RESULT_RELATION_RECEIVER_VALUE)
    return RESULT_NOT_RECEIVER_STATE;
  /**
   * Receiver type, whose arguments name what it holds.
   */
  const receiverType = checker.getTypeAtLocation(receiver,);
  if ((receiverType === undefined) || (!receiverType.isTypeReference()))
    return RESULT_NOT_RECEIVER_STATE;
  /**
   * Receiver-held type at the position the authority recorded.
   */
  const heldType = checker.getTypeArguments(receiverType,)
    .at(provenance.receiverTypeArgumentIndex,);
  /**
   * Result type this call produced.
   */
  const resultType = checker.getTypeAtLocation(call,);
  if ((heldType === undefined) || (resultType === undefined))
    return RESULT_NOT_RECEIVER_STATE;
  return resultIsHeldState({
      resultType,
      heldType,
    },)
    ? receiver
    : RESULT_NOT_RECEIVER_STATE;
}

/**
 * Tests whether a call's result is built out of what its observer returned.
 *
 * The third answer to the result question, and the one that needs no receiver: `map` and
 * `flatMap` hold nothing the receiver held, so what their result carries is decided by the
 * observer, which `propagateElementApplications` reads from the observer's own summary.
 * A caller therefore learns nothing here beyond which mechanism owns the answer.
 *
 * @param project - TypeScript project proving default-library ownership.
 *
 * @param checker - TypeScript checker resolving the signature.
 *
 * @param call - Call expression whose result may come from its observer.
 *
 * @returns whether the observer-return relation is verified for this member.
 *
 * @example
 * ```ts
 * callResultComesFromObserver({ project, checker, call });
 * ```
 */
export function callResultComesFromObserver({
  project,
  checker,
  call,
}: {
  readonly project: Project;
  readonly checker: Checker;
  readonly call: CallExpression;
},): boolean {
  /**
   * Default-library interface and member this call selected.
   */
  const member = defaultLibraryMember({
    project,
    checker,
    call,
  },);
  if (member === NOT_DEFAULT_LIBRARY_MEMBER)
    return false;
  /**
   * Verified relation for the selected member.
   */
  const provenance = memberResultProvenance(member,);
  return (provenance !== RESULT_RELATION_UNPROVEN)
    && (provenance.relation === RESULT_RELATION_OBSERVER_RETURN);
}

/**
 * Resolves the receiver whose values a call's fresh container result may hold.
 *
 * The container half of the same question `callResultReceiver` answers for direct values,
 * kept separate because the two demand opposite answers about one value: mutating an
 * element of `values.filter(kept)` reaches the receiver, and mutating the container does
 * not.
 *
 * Validated the same way and with the same limit. The authority establishes the relation,
 * by probe, and type identity only checks that this call is instantiated so the result's
 * element position is the receiver's held position. A narrowing type-predicate overload
 * turns `(A | B)[]` into `A[]`, whose element type is identical to nothing the receiver
 * holds, so this answers with the sentinel and the call stays undischarged. That is
 * withholding rather than asserting, which is the safe direction: nothing may discharge on
 * this answer's absence.
 *
 * @param project - TypeScript project proving default-library ownership.
 *
 * @param checker - TypeScript checker resolving signature and types.
 *
 * @param call - Call expression whose result may hold receiver values.
 *
 * @returns receiver expression, or sentinel when no container relation is verified.
 *
 * @example
 * ```ts
 * callResultElementReceiver({ project, checker, call });
 * ```
 */
export function callResultElementReceiver({
  project,
  checker,
  call,
}: {
  readonly project: Project;
  readonly checker: Checker;
  readonly call: CallExpression;
},): Expression | typeof RESULT_NOT_RECEIVER_STATE {
  /**
   * Expression the member was called on, however the member was named.
   */
  const receiver = memberCallReceiver({ call, },);
  if (receiver === NO_MEMBER_RECEIVER)
    return RESULT_NOT_RECEIVER_STATE;
  /**
   * Default-library interface and member this call selected.
   */
  const member = defaultLibraryMember({
    project,
    checker,
    call,
  },);
  if (member === NOT_DEFAULT_LIBRARY_MEMBER)
    return RESULT_NOT_RECEIVER_STATE;
  /**
   * Verified relation for the selected member.
   */
  const provenance = memberResultProvenance(member,);
  if ((provenance === RESULT_RELATION_UNPROVEN)
    || (provenance.relation !== RESULT_RELATION_RECEIVER_ELEMENTS))
    return RESULT_NOT_RECEIVER_STATE;
  /**
   * Receiver type, whose arguments name what it holds.
   */
  const receiverType = checker.getTypeAtLocation(receiver,);
  if ((receiverType === undefined) || (!receiverType.isTypeReference()))
    return RESULT_NOT_RECEIVER_STATE;
  /**
   * Receiver-held type at the position the authority recorded.
   */
  const heldType = checker.getTypeArguments(receiverType,)
    .at(provenance.receiverTypeArgumentIndex,);
  /**
   * Container type this call produced.
   */
  const resultType = checker.getTypeAtLocation(call,);
  if ((heldType === undefined)
    || (resultType === undefined)
    || (!resultType.isTypeReference()))
    return RESULT_NOT_RECEIVER_STATE;
  /**
   * Type the result container holds at the same position.
   */
  const resultHeldType = checker.getTypeArguments(resultType,)
    .at(provenance.receiverTypeArgumentIndex,);
  return (resultHeldType === heldType)
    ? receiver
    : RESULT_NOT_RECEIVER_STATE;
}
