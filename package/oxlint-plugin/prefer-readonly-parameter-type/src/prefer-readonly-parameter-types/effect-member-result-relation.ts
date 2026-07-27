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
  isPropertyAccessExpression,
} from 'typescript/unstable/ast/is';
import type {
  Checker,
  Project,
  Type,
} from 'typescript/unstable/sync';

import {
  memberResultProvenance,
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
  if (!isPropertyAccessExpression(call.expression,))
    return RESULT_NOT_RECEIVER_STATE;
  /**
   * Expression the member was called on.
   */
  const receiver = call.expression
    .expression;
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
  /**
   * Result constituents compared against the receiver-held type.
   */
  const candidates = identityCandidates({ type: resultType, },);
  return candidates.includes(heldType,)
    ? receiver
    : RESULT_NOT_RECEIVER_STATE;
}
