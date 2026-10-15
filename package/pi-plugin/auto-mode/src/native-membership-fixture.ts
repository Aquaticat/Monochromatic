/**
 Independent built consumers expose original response and prepared-membership snapshot boundaries. @module
 */

/**
 Original declared identities are copied into frozen response membership records.
 */
export type MembershipIdentity = Readonly<{
  id: string;
  name: string
}>;

/**
 Native response snapshot retains exact serialized content and complete ordered identities.
 */
export type MembershipSnapshot = Readonly<{
  parentJSON: string;
  declaredNames: readonly MembershipIdentity[];
}>;

/**
 Built response entry accepts unknown fixture input to exercise native admission failures.
 */
type MembershipModule = Readonly<{
  captureJudgmentMembership: (response: unknown) => MembershipSnapshot;
}>;

/**
 Built prepared entry keeps malformed fixtures independent of implementation declarations.
 */
type PreparedMembershipModule = Readonly<{
  capturePreparedJudgmentJSON: (input: Readonly<{
    members: unknown;
    declaredNames: readonly MembershipIdentity[];
  }>) => string;
}>;

/**
 Authenticate the built response snapshot entry before supplying independent original content.

 @param value - unknown built module namespace

 @returns assertion exposing the built response snapshot
 */
function assertMembershipModule(value: unknown): asserts value is MembershipModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('captureJudgmentMembership' in value))
    || ((typeof value.captureJudgmentMembership) !== 'function')) throw new Error('Built native membership snapshot is unavailable');
}

/**
 Authenticate the built prepared snapshot entry independently of response admission.

 @param value - unknown built module namespace

 @returns assertion exposing the built prepared snapshot
 */
function assertPreparedModule(value: unknown): asserts value is PreparedMembershipModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('capturePreparedJudgmentJSON' in value))
    || ((typeof value.capturePreparedJudgmentJSON) !== 'function')) throw new Error('Built native prepared snapshot is unavailable');
}

/**
 Original response validation is loaded from the rebuilt artifact used by the native constructor.
 */
const responseModule: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/judgment-membership.ts',
  import.meta.url
).href);
assertMembershipModule(responseModule);
/**
 All response behavior under test comes from the built owner.
 */
export const captureMembership: MembershipModule['captureJudgmentMembership'] = responseModule.captureJudgmentMembership;

/**
 Original prepared validation is loaded from the rebuilt native artifact.
 */
const preparedModule: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/judgment-prepared-input.ts',
  import.meta.url
).href);
assertPreparedModule(preparedModule);
/**
 All prepared behavior under test comes from the built owner.
 */
export const capturePreparedMembership: PreparedMembershipModule['capturePreparedJudgmentJSON'] = preparedModule.capturePreparedJudgmentJSON;

/**
 Create original ordered identities independently of the production snapshot implementation.

 @param count - complete fixture group cardinality

 @returns independently frozen original native identities

 @example membershipNames(2);
 */
export function membershipNames(count: number): readonly MembershipIdentity[] {
  return Object.freeze(Array.from(
    { length: count },
    function declaredIdentity(
      _value,
      index
    ) {
    return Object.freeze({
      id: `call-${index}`,
      name: 'read'
    });
  }
  ));
}
