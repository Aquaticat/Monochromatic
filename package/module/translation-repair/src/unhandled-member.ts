import { isJsonRecord, } from './json-guard.ts';

//region Unhandled member refusal
// What a branch chain over a union ends in, so a member the chain does not
// name is a build error and, if the build is silenced, a loud failure rather
// than whatever the last branch happened to answer.

/**
 Raises the failure for a union member that no branch of a chain handled.

 Unreachable while the chain names every member, which the `never` parameter
 guarantees: a union that gains a member leaves the call site passing a value
 that is not `never`, and the file stops compiling. This runs only if someone
 widens a union and silences that error with an assertion.

 NAMES THE SHAPE AND NOT THE VALUE. The members this guards can carry text
 fields, and the message reaches a pass's stdout, so a member is described by
 its discriminant when it has one and by its runtime type otherwise. Printing
 the member would print corpus wording on the day a union grows.

 @param what - which union was being read, for the message

 @param member - the value no branch handled, typed `never` so a widened union
 fails to compile at the call site rather than throwing here

 @throws {@link Error} always

 @example
 ```ts
 return refuseUnhandledMember({ what: 'lane comparison fault', member: fault, },);
 ```
 */
export function refuseUnhandledMember(
  {
    what,
    member,
  }: {
    readonly what: string;
    readonly member: never;
  },
): never {
  /**
   Member as a value, since `never` admits no property reads.
   */
  const carried: unknown = member;
  if (isJsonRecord(carried,) && ((typeof carried.kind) === 'string')) {
    throw new Error(
      `unreachable: ${what} carries a member no branch handles: kind ${carried.kind}`,
    );
  }
  throw new Error(`unreachable: ${what} carries a member no branch handles: type ${typeof carried}`,);
}

//endregion Unhandled member refusal
