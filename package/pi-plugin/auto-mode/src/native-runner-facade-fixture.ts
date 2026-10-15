/** Independent original runtime capabilities expose facade publication and drainage. @module */
import assert from 'node:assert/strict';
import type { FacadeFixtureBinding, FacadeFixtureControl, FacadeFixtureInput, FacadeFixtureModule, FacadeFixtureRun, FacadeFixtureRuntimeInput, RunnerFacadeFixture } from './native-runner-facade-fixture-types.ts';

/** Require the built facade before exposing its independently declared fixture surface.
 @param value - original built module namespace
 @returns checked independently declared facade module
 @throws Error when built facade is unavailable
 */
function assertFacade(value: unknown): asserts value is FacadeFixtureModule {
  if ((value === null) || ((typeof value) !== 'object') || (!('createDeclaredProgramFacade' in value)) || ((typeof value.createDeclaredProgramFacade) !== 'function')) throw new Error('Built declared program facade is unavailable');
}
/** Original aggregate error constructor remains the same production artifact. */
type GuardModule = Readonly<{ NativeExecutionGuardError: FacadeFixtureInput['NativeExecutionGuardError'] }>;
/** Require original aggregate error construction without copying diagnostic implementation.
 @param value - original built error namespace
 @returns checked original guard namespace
 @throws Error when original guard constructor is unavailable
 */
function assertGuard(value: unknown): asserts value is GuardModule {
  if ((value === null) || ((typeof value) !== 'object') || (!('NativeExecutionGuardError' in value)) || ((typeof value.NativeExecutionGuardError) !== 'function')) throw new Error('Built native execution guard is unavailable');
}
/** Dynamic built loading keeps independent fixture declarations out of production contracts. */
const loaded: unknown = await import(new URL('../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/program-runner-facade.ts', import.meta.url).href);
assertFacade(loaded);
/** Checked built facade stays available to malformed-input diagnostic probes. */
export const facadeFixtureModule: FacadeFixtureModule = loaded;
/** Original error is loaded through the same native artifact loader. */
const loadedGuard: unknown = await import(new URL('../dist/native/contract/lifecycle/execution-context-carrier/execute.mjs', import.meta.url).href);
assertGuard(loadedGuard);
/** Explicit narrowing remains available inside delayed fixture construction. */
const guardModule: GuardModule = loadedGuard;

//region Every test controls original native execution independently from runtime drainage.
/** Create isolated facade owners and observable original callback boundaries.
 @returns original input, runtime callbacks, and independently controlled native work
 @example createRunnerFacadeFixture();
 */
export function createRunnerFacadeFixture(): RunnerFacadeFixture {
  const steps: string[] = [];
  const observations: unknown[][] = [];
  const control: FacadeFixtureControl = { failure: Object.freeze({ original: 'failure' }) };
  const program = Object.freeze({ original: 'program' });
  const value = Object.freeze({ original: 'converted' });
  const bound: FacadeFixtureBinding = { slots: [{ original: 'first slot' }, { original: 'second slot' }], tickets: [0, 1].map(function ticket(ordinal) {
    return { promise: Promise.resolve({ ordinal }), reject(error: unknown): void { 
      observations.push(['reject', ordinal, error]); 
      step(`reject:${ordinal}`); 
    } };
  }) };
  /** Record callback entry before optional original failure or reentry.
   @param point - original callback boundary
   @throws Error when this callback is selected as failing
   */
  function step(point: string): void { 
    steps.push(point); 
    control.onStep?.(point); 
    if (control.failAt === point) throw control.failure; 
  }
  const runtime: FacadeFixtureRun = {
    declaration: Object.freeze({ original: 'declaration' }), tools: Object.freeze([{ original: 'source tool' }]),
    inspect(): unknown { 
      step('inspect'); 
      return value; 
    },
    retire(): void { 
      step('retire'); 
    },
    valueFor(input: unknown): unknown { 
      observations.push(['value', input]); 
      return value; 
    },
    drain(): Promise<void> { 
      assert.equal(this, runtime); 
      step('drain'); 
      return control.drain?.() ?? Promise.resolve(); 
    },
  };
  const state: { runtimeInput?: FacadeFixtureRuntimeInput } = {};
  const judgment = {
    openProgram(input: unknown): object { 
      assert.equal(this, judgment); 
      observations.push(['open', input]); 
      step('open'); 
      return program; 
    },
    scriptValueFor(input: unknown): unknown { 
      assert.equal(this, judgment); 
      observations.push(['convert', input]); 
      step('convert'); 
      return value; 
    },
  };
  const input: FacadeFixtureInput = {
    tools: Object.freeze([{ name: 'first' }, { name: 'first' }, { name: 'last' }]), code: 'original source', carrier: { token: Object.freeze({ original: 'parent token' }) },
    origin: { prepared: { id: 'parent id', name: 'parent tool', input: { code: 'original source' } }, signal: new AbortController().signal, judgment },
    assertParentCurrent(): void { 
      assert.equal(this, undefined); 
      step('parent'); 
    },
    bindGroup(binding: unknown): FacadeFixtureBinding { 
      assert.equal(this, undefined); 
      observations.push(['bind', binding]); 
      step('bind'); 
      return bound; 
    },
    executeGroup(execution: unknown): Promise<void> { 
      assert.equal(this, undefined); 
      observations.push(['execute', execution]); 
      step('execute'); 
      return control.execution?.() ?? Promise.resolve(); 
    },
    createReachedProgramRun(runtimeInput: FacadeFixtureRuntimeInput): FacadeFixtureRun { 
      assert.equal(this, undefined); 
      state.runtimeInput = runtimeInput; 
      step('runtime'); 
      return runtime; 
    },
    NativeExecutionGuardError: guardModule.NativeExecutionGuardError,
  };
  /** Construct the built facade after test-specific input or callback changes.
   @returns frozen original runtime facade
   */
  function create(): FacadeFixtureRun { 
    return facadeFixtureModule.createDeclaredProgramFacade(input); 
  }
  /** Read original callbacks captured by the independently controlled runtime.
   @returns original runtime constructor input
   */
  function runtimeInput(): FacadeFixtureRuntimeInput { 
    assert.ok(state.runtimeInput); 
    return state.runtimeInput; 
  }
  return { input, steps, observations, control, program, bound, runtime, value, create, runtimeInput };
}
//endregion
