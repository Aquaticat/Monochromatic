/** Independent original runner binding fixtures control callbacks without owning implementation state. @module */
import assert from 'node:assert/strict';
import type { RunnerBindingModule, RunnerBindingFixture, RunnerBindingInput, RunnerBindingAdmission, RunnerBindingCall, RunnerBindingResult } from './native-runner-binding-fixture-types.ts';

/** Require the built helper before exercising its public association boundary.
 @param value - built native namespace
 @returns independently authored callable contract
 @throws Error when original runner binding export is missing
 */
function assertRunnerBindingModule(value: unknown): asserts value is RunnerBindingModule {
  if ((value === null) || (typeof value !== 'object') || !('bindReachedProgramGroup' in value)
    || (typeof value.bindReachedProgramGroup !== 'function')) throw new Error('Built original runner binding is unavailable');
}
/** Independent consumer loads the artifact emitted for native host use. */
const loaded: unknown = await import(new URL('../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/program-runner-binding.ts', import.meta.url).href);
assertRunnerBindingModule(loaded);
/** Explicit namespace narrowing remains available to delayed fixture callbacks. */
export const runnerBindingModule: RunnerBindingModule = loaded;

//region Independently owned parent, scope, native call, and judgment observations.
/** Construct original runner association inputs and callback observations.
 @returns fixture exposing the built binding helper through its original inputs
 @example createRunnerBindingFixture();
 */
export function createRunnerBindingFixture(): RunnerBindingFixture {
  /** Callback observations record ownership ordering without inspecting implementation logs. */
  const events: string[] = [];
  /** Native admission calls preserve the exact original arrays and callback. */
  const admissions: RunnerBindingAdmission[] = [];
  /** Native forwarding observations retain original call identity and copied options. */
  const native: RunnerBindingFixture['native'] = [];
  /** Recorder identity differs from both parent and reached-group identities. */
  const recorder = Object.freeze({ original: 'recorder' });
  /** Original judgment slots remain caller-owned opaque handles. */
  const slots = Object.freeze([Object.freeze({ original: 'slot zero' }), Object.freeze({ original: 'slot one' })]);
  /** Tests can publish state or throw an opaque failure at each original callback boundary. */
  const control: RunnerBindingFixture['control'] = { failure: new Error('original binding callback failed'), value: Object.freeze({ original: 'native value' }) };
  /** Observe original callback order before its optional publication or failure.
   @param point - original callback boundary
   @throws Error when the fixture selects this callback to throw
   */
  function step(point: string): void {
    events.push(point);
    control.onStep?.(point);
    if (control.failAt === point) throw control.failure;
  }
  /** Native recorder construction must retain its original receiver and empty argument list. */
  const NestedCallRecorder: typeof Map = new Proxy(Map, {
    construct(target, args, receiver): object {
      assert.equal(target, Map);
      assert.deepEqual(args, []);
      assert.equal(receiver, NestedCallRecorder);
      step('recorder');
      return recorder;
    },
  });
  /** Original native method is called as a captured function, without a host receiver. */
  const host: RunnerBindingInput['runner']['host'] = {
    runOwnedToolCall(this: unknown, call: RunnerBindingCall, options: unknown): unknown {
      assert.equal(this, undefined);
      native.push({ call, options });
      step('native');
      return control.value;
    },
  };
  /** Scope membership begins empty and retains both private owner and public parent label. */
  const runner: RunnerBindingInput['runner'] = { scopes: new Map(), host };
  /** Duplicate names distinguish first-match lookup from ordinal association or reverse selection. */
  const tools = Object.freeze([Object.freeze({ name: 'first' }), Object.freeze({ name: 'second' }), Object.freeze({ name: 'first' })]);
  /** Judgment admission retains its original receiver and supplies exact existing slot identities. */
  const judgment = {
    bindProgramCalls(input: RunnerBindingAdmission): readonly object[] {
      assert.equal(this, judgment);
      admissions.push(input);
      step('bind');
      return slots;
    },
  };
  /** Complete reached-group order deliberately differs from the tool snapshot. */
  const group = Object.freeze({
    handle: Object.freeze({ original: 'group' }),
    members: Object.freeze(['second', 'first'].map(function declaredMember(name) {
      return Object.freeze({ handle: Object.freeze({ name }), declaration: Object.freeze({ name, args: Object.freeze({ original: name }) }), signal: new AbortController().signal });
    })),
  });
  /** Exact original construction inputs remain available for malformed-boundary probes. */
  const input: RunnerBindingInput = {
    runner, tools, origin: { prepared: { id: 'parent' }, judgment }, carrier: { token: Object.freeze({ original: 'parent owner' }) }, group, NestedCallRecorder,
    assertParentCurrent(): void { 
      step('parent'); 
    },
  };
  /** Bind through the built helper while retaining fixture input identity.
   @returns original binding result
   */
  function bind(): RunnerBindingResult { 
    return runnerBindingModule.bindReachedProgramGroup(input); 
  }
  /** Read the original admission callback after successful binding.
   @returns independently captured original native call admission
   */
  function admission(): RunnerBindingAdmission {
    /** Admission must exist before a test invokes the captured native callback. */
    const [value] = admissions;
    assert.ok(value);
    return value;
  }
  return { input, recorder, events, admissions, native, slots, control, bind, admission };
}
//endregion
