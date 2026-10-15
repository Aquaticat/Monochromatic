/**
 Original native parallel successors retain declaration order and borrowed inspection. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import type {
  NativeGroupCandidate,
  NativeMemberCandidate,
  NativeParallelCall,
  ProfileSuccessors,
  ProfileSuccessorsInput
} from './profile-successors-types.ts';

/**
 Inspection tracing excludes source and argument values.
 */
const l = tagged({ tag: 'auto-mode-profile-successors' });
/**
 Original syntax profile bounds the complete successor collection.
 */
const maximumSuccessors = 32;

//region Retain original short-circuit member and combinator admission.
/**
 Inspect only the original static member predicate.

 @param node - parser-owned member candidate
 
 @param object - required original receiver name
 
 @param property - required original method name
 
 @returns whether original static-member checks succeed
 */
function member({
  node,
  object,
  property
}: Readonly<{
  node?: NativeMemberCandidate;
  object: string;
  property: string
}>): boolean {
  return (node?.type === 'MemberExpression') && (!node.computed)
    && (!node.optional)
    && (node.object
      .type
      === 'Identifier')
    && (node.object
      .name
      === object)
    && (node.property
      .type
      === 'Identifier')
    && (node.property
      .name
      === property);
}
/**
 Narrow using the original combinator predicate without additional syntax reads.

 @param group - original awaited expression
 
 @returns whether original complete combinator admission succeeds
 */
function isNativeGroup(group: NativeGroupCandidate): group is NativeParallelCall {
  return (group.type === 'CallExpression') && (!group.optional)
    && [
      'all',
      'allSettled'
    ].some(function isPromiseGroupMethod(name) {
      return member({
        node: group.callee,
        object: 'Promise',
        property: name
      });
    })
    && (group.arguments
      .length
      === 1);
}
//endregion

//region Preserve original mapping, source ownership, and declaration publication.
/**
 Inspect complete native successors using the caller's original binding and producer.

 @param returned - admitted original awaited return statement
 
 @param declaration - admitted original immutable binding declaration
 
 @param producer - original producer callsite retained by identity
 
 @param allowed - original callable membership
 
 @param source - original unwrapped source text
 
 @param prefix - original parser wrapper excluded from callsite spans
 
 @param inspectCall - original call inspector retaining private pattern ownership
 
 @param ResultProgramProfileError - original diagnostic constructor
 
 @returns original declaration parts without additional freezing
 
 @throws Error for unsupported combinators, collections, or successor calls
 
 @example inspectProfileSuccessors({ returned, declaration, producer, allowed, source, prefix, inspectCall, ResultProgramProfileError });
 */
export function inspectProfileSuccessors({
  returned,
  declaration,
  producer,
  allowed,
  source,
  prefix,
  inspectCall,
  ResultProgramProfileError
}: ProfileSuccessorsInput): ProfileSuccessors {
  /**
   Tracing observes the boundary without examining borrowed syntax.
   */
  const cl = tagged({
    tag: inspectProfileSuccessors.name,
    l
  });
  cl.debug('inspecting original native parallel successors');
  /**
   Caller already established the awaited return statement.
   */
  const group = returned.argument
    .argument;
  if (!isNativeGroup(group)) throw new ResultProgramProfileError('native parallel combinator required');
  /**
   Original admission requires exactly one complete successor array.
   */
  const { 0: array } = group.arguments;
  if (!((array.type === 'ArrayExpression') && (array.elements
    .length
    > 0)
    && (array.elements
      .length
      <= maximumSuccessors))) {
    throw new ResultProgramProfileError('complete successor member array required');
  }
  /**
   Original mapping rereads the binding for each actual member.
   */
  const successors = array.elements
    .map(function inspectSuccessorCall(
      call,
      ordinal
    ) {
    return inspectCall({
      call,
      group: 1,
      ordinal,
      bindingName: declaration.id
        .name,
      allowed,
      source,
      prefix
    });
  });
  return {
    bindingName: declaration.id
      .name,
    groups: [
      {
        ordinal: 0,
        kind: 'awaited-producer',
        members: [producer]
      },
      {
        ordinal: 1,
        kind: group.callee
          .property
          .name,
        members: successors
      },
    ],
    sites: [
      producer,
      ...successors
    ],
    profile: 'awaited-string-result-then-literal-parallel',
  };
}
//endregion
