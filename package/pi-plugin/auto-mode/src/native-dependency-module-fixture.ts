/** Independent built dependency eligibility consumer contracts. @module */

/** Original dependency operations separate live authentication from retained release. */
export type FixtureDependencyChecks = Readonly<{
  active: () => void;
  ready: () => void;
  dependencyCheck: <Result>(read: () => Result) => Result;
  bindingSegment: <Result>(run: () => Result) => Result;
  assertDependenciesCurrent: () => unknown;
  isBindingSegmentActive: () => boolean;
}>;

/** Shared original preparation and closure remain independently controlled by each test. */
export type DependencyFixtureState = {
  prepared: boolean;
  preparationFailed: boolean;
  preparationFailure?: unknown;
  finished: boolean;
  closeFailed: boolean;
  finalRecord?: { failure: unknown };
  handle?: object;
};

/** Built factory accepts independent capabilities without importing implementation types. */
type DependencyModule = Readonly<{
  createJudgmentDependencyChecks: (input: Readonly<Record<string, unknown>>) => FixtureDependencyChecks;
}>;

/**
 Require the original built factory before supplying its capabilities.

 @param value - copied native module namespace

 @returns assertion exposing independent consumer contract

 @throws Error when original dependency factory is unavailable
 */
function assertDependencyModule(value: unknown): asserts value is DependencyModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('createJudgmentDependencyChecks' in value))
    || ((typeof value.createJudgmentDependencyChecks) !== 'function')) throw new Error('Built judgment dependency export is unavailable');
}

/** Original import exercises the copied artifact consumed by native judgment construction. */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/judgment-dependencies.ts',
  import.meta.url,
).href);
assertDependencyModule(loaded);
/** Fixed factory preserves independent original lifetimes across test cases. */
export const dependencyModule: DependencyModule = loaded;
