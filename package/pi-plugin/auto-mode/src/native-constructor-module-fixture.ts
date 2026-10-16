/**
 Independent consumer contracts for built original judgment construction. @module
 */

/**
 Retained diagnostics expose original accounting without extending eligibility.
 */
export type ConstructorFixtureView = Readonly<{
  prepared: boolean;
  finished: boolean;
  accounting: Readonly<{
    startedAt: number;
    targetAt: number;
    retired: boolean
  }>;
  memberExecutions: readonly object[];
  childGroups: readonly object[];
}>;

/**
 Direct construction consumers exercise original ownership before preparation.
 */
export type ConstructorFixtureJudgment = Readonly<{
  inspect: () => ConstructorFixtureView;
  checkpoint: () => void;
  readSourceSnapshot: () => unknown;
  inspectBatch: (batch: object) => unknown;
}>;

/**
 Original occurrence arguments remain independent of implementation declarations.
 */
export type ConstructorFixtureInput = Readonly<{
  startedAt: number;
  signal: AbortSignal;
  response: object;
  stream: object;
}>;

/**
 Native entry must retain its original error and constructor identities.
 */
type ConstructorModule = Readonly<{
  createJudgmentConstructor: (options: Readonly<Record<string, unknown>>) =>
    (input: ConstructorFixtureInput) => ConstructorFixtureJudgment;
  JudgmentConstructionError: new (message: string) => Error;
}>;

/**
 Require the native bridge before interpreting its constructor contract.

 @param value - copied native namespace

 @returns assertion exposing independent constructor operations

 @throws Error when original constructor exports are unavailable
 */
function assertConstructorModule(value: unknown): asserts value is ConstructorModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('createJudgmentConstructor' in value))
    || (!('JudgmentConstructionError' in value))
    || ((typeof value.createJudgmentConstructor) !== 'function')
    || ((typeof value.JudgmentConstructionError) !== 'function'))
    throw new Error('Built original judgment constructor is unavailable');
}

/**
 Consumer loads the same stable entry used by native session ownership.
 */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/child-constructor.mjs',
  import.meta.url,
).href);
assertConstructorModule(loaded);
/**
 Explicit namespace narrowing remains available inside independent test callbacks.
 */
export const constructorModule: ConstructorModule = loaded;
