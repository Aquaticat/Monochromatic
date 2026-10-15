/**
 Independent built judgment API consumer contracts. @module
 */

/**
 Untyped callers expose exact runtime argument lists and method receivers.
 */
export type FixtureAPICall = (
  this: unknown,
  ...args: readonly unknown[]
) => unknown;

/**
 Consumer observes frozen public keys without borrowing implementation contracts.
 */
export type FixturePublicAPI = Readonly<Record<string, FixtureAPICall>>;

/**
 Assembly accepts independently instrumented owners.
 */
type APIModule = Readonly<{
  createJudgmentAPI: (input: Readonly<Record<string, unknown>>) => FixturePublicAPI;
}>;

/**
 Require the built factory before observing public call boundaries.

 @param value - copied native module namespace

 @returns assertion exposing independent consumer contract

 @throws Error when original public assembly export is unavailable
 */
function assertAPIModule(value: unknown): asserts value is APIModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('createJudgmentAPI' in value)))
    throw new Error('Built judgment API export is unavailable');
  /**
   Factory lookup follows namespace membership narrowing.
   */
  const factory = value.createJudgmentAPI;
  if ((typeof factory) !== 'function') throw new Error('Built judgment API export is unavailable');
}

/**
 Copied artifact is the same module consumed by native judgment construction.
 */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/judgment-api.ts',
  import.meta.url,
).href);
assertAPIModule(loaded);

/**
 Fixed factory preserves independent owner instrumentation across cases.
 */
export const apiModule: APIModule = loaded;
