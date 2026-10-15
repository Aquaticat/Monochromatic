/**
 Independent built original source collection consumer contracts. @module
 */

/**
 Original collector identity and current binding are independently observable.
 */
export type FixtureSourceOwner = Readonly<{
  receipt: unknown;
  collector: Readonly<{
    capture: (options: Readonly<{ signal: AbortSignal }>) => unknown;
    assertObservedFresh: (snapshot: unknown) => void;
  }>;
  readSourceSnapshot: () => unknown;
  publishJudgmentSources: (sources: unknown) => void;
  readCurrentSourceBinding: () => Readonly<{
    request: unknown;
    sources: unknown
  }>;
}>;

/**
 Factory accepts independent capabilities without implementation type imports.
 */
type SourceModule = Readonly<{
  createJudgmentSources: (input: Readonly<Record<string, unknown>>) => FixtureSourceOwner;
}>;

/**
 Require the built factory before exercising original source capabilities.

 @param value - copied native module namespace

 @returns assertion exposing independent consumer contract

 @throws Error when original source factory is unavailable
 */
function assertSourceModule(value: unknown): asserts value is SourceModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('createJudgmentSources' in value)) || ((typeof value.createJudgmentSources) !== 'function'))
    throw new Error('Built judgment source export is unavailable');
}

/**
 Import the copied artifact consumed by native judgment construction.
 */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/judgment-sources.ts',
  import.meta.url,
).href);
assertSourceModule(loaded);
/**
 Fixed factory retains independent original collection lifetimes across cases.
 */
export const sourceModule: SourceModule = loaded;
