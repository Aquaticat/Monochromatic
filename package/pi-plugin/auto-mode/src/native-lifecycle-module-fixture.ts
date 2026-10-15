/**
 Independent consumer contracts for the built original judgment lifecycle. @module
 */
import type { FixtureSelection } from './native-selection-fixture.ts';
import type { NativeBudget } from './native-judgment-budget-module-fixture.ts';

//region Consumer contracts preserve original identities without importing source implementation types.
/**
 Transport receives the exact original selection request and budget attempt.
 */
export type LifecycleAttempt = Parameters<Parameters<NativeBudget['dispatch']>[0]>[0] & Readonly<{
  request: ReturnType<FixtureSelection['requestFor']>;
}>;

/**
 Closure consumers observe retained diagnostics and explicit permission qualifiers.
 */
export type LifecycleClosure = Readonly<{
  status: string;
  evidenceOnly?: boolean;
  retainedOnly?: boolean;
  policyVerdict?: string;
  instructionAuthority?: string;
  humanPermission?: boolean;
  dependencies?: unknown;
  failure?: unknown;
  accounting: ReturnType<NativeBudget['diagnostics']>;
  parentJSON?: string;
  batches: readonly unknown[];
}>;

/**
 Original lifecycle exposes operation exclusion and terminal evidence independently.
 */
export type FixtureLifecycle = Readonly<{
  state: {
    operating: boolean;
    assessing: boolean;
    finished: boolean;
    closeFailed: boolean;
    finalRecord?: LifecycleClosure;
  };
  operation: <Result>(run: () => Result) => Result;
  issue: FixtureSelection['issue'];
  assess: (batch: unknown) => Promise<ReturnType<FixtureSelection['settle']>>;
  captureBatchEvidence: FixtureSelection['captureBatchEvidence'];
  assertBatchEvidence: FixtureSelection['assertCapturedBatchIdentity'];
  captureClaimEvidence: FixtureSelection['captureEvidence'];
  assertClaimEvidence: FixtureSelection['assertCapturedIdentity'];
  finalize: () => LifecycleClosure;
}>;

/**
 Independent construction contract supplies controlled original capabilities.
 */
type LifecycleModule = Readonly<{
  createJudgmentLifecycle: (input: Readonly<{
    knownSelection: () => FixtureSelection;
    ready: () => void;
    active: () => void;
    bindingSegment: <Result>(run: () => Result) => Result;
    assertDependenciesCurrent: () => void;
    budget: NativeBudget;
    finalizeDependencies: (handle: object) => unknown;
    readDependencyHandle: () => object;
    parentJSON: string;
    send: (attempt: LifecycleAttempt) => Promise<unknown>;
  }>) => FixtureLifecycle;
}>;

/**
 Require the original factory in the copied consumer artifact.
 
 @param value - built namespace before admission
 
 @returns assertion exposing the independent consumer contract
 
 @throws Error when the original factory is unavailable
 */
function assertLifecycleModule(value: unknown): asserts value is LifecycleModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('createJudgmentLifecycle' in value))
    || ((typeof value.createJudgmentLifecycle) !== 'function')) throw new Error('Built judgment lifecycle export is unavailable');
}

/**
 Dynamic loading reaches the same artifact used by original judgment construction.
 */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/judgment-lifecycle.ts',
  import.meta.url,
).href);
assertLifecycleModule(loaded);
/**
 Checked native factory remains fixed across independent fixture instances.
 */
export const lifecycleModule: LifecycleModule = loaded;
//endregion
