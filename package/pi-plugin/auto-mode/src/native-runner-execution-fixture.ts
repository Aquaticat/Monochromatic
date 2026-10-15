/** Independent reached-group consumer observes original host, queue, and judgment boundaries. @module */
import assert from 'node:assert/strict';
import type { ExecutionControl, ExecutionDispatch, ExecutionFixture, ExecutionInput, ExecutionModule } from './native-runner-execution-fixture-types.ts';

/** Require the built native execution export before invoking its independent consumer contract.
 @param value - built native namespace
 @returns narrowed original execution factory
 @throws Error when the execution export is absent
 */
function assertExecutionModule(value: unknown): asserts value is ExecutionModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('executeReachedProgramGroup' in value))
    || ((typeof value.executeReachedProgramGroup) !== 'function')) throw new Error('Built runner execution is unavailable');
}
/** Native consumer loads the emitted artifact used by the original runner. */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/program-runner-execution.ts', import.meta.url
).href);
assertExecutionModule(loaded);
/** Explicit narrowing remains available to delayed fixture callbacks. */
export const executionModule: ExecutionModule = loaded;

//region Independent original capabilities expose callback identity and scheduling observations.
/** Construct original group execution with test-owned host and judgment observations.
 @returns independent execution fixture and callback controls
 @example createRunnerExecutionFixture();
 */
export function createRunnerExecutionFixture(): ExecutionFixture {
  /** Original callback ordering remains observable without reading implementation logs. */
  const steps: string[] = [];
  /** Each callback preserves its actual input identities for assertions. */
  const observations: unknown[][] = [];
  /** Native dispatch input is retained separately from every judgment callback. */
  const dispatched: ExecutionDispatch[] = [];
  /** Parent cancellation is independent of original reached-member cancellation. */
  const abort = new AbortController();
  /** Original callback result identity distinguishes delegation from reconstruction. */
  const value = Object.freeze({ original: 'callback value' });
  /** Host context is borrowed without cloning. */
  const context = Object.freeze({ original: 'context' });
  /** Tests can stop a callback or change currentness during original queue acquisition. */
  const control: ExecutionControl = {
    sequential: false,
    failure: Object.freeze({ original: 'failure' }),
    handles: [Object.freeze({ member: 'first' }), Object.freeze({ member: 'second' })]
  };
  /** Record a callback boundary before its optional fixture failure.
   @param point - original callback boundary
   @throws Error when the fixture selected this callback to fail
   */
  function step(point: string): void {
    steps.push(point);
    control.onStep?.(point);
    if (control.failAt === point) throw control.failure;
  }
  /** Original host receiver is checked at every borrowed method boundary. */
  const host: ExecutionInput['runner']['host'] = {
    isSequential(): boolean { assert.equal(this, host); step('sequential'); return control.sequential; },
    getContext(): unknown { assert.equal(this, host); step('context'); return context; },
    prepareOwnedToolCall(hook, parent): unknown { assert.equal(this, host); observations.push(['prepare', hook, parent]); step('prepare'); return value; },
    finishOwnedToolCall(hook, parent): unknown { assert.equal(this, host); observations.push(['after', hook, parent]); step('after'); return value; },
    emit(event): void { assert.equal(this, host); observations.push(['event', event]); step(event.type); }
  };
  /** Original judgment receiver remains unchanged during admission and native invocation. */
  const judgment: ExecutionInput['origin']['judgment'] = {
    reachedGroupFor(group): unknown { assert.equal(this, judgment); observations.push(['current', group]); step('current'); return value; },
    prepareReachedMembers(input): readonly object[] { assert.equal(this, judgment); observations.push(['assess', input]); step('assess'); return control.handles; },
    invokeProgramNative(input): unknown { assert.equal(this, judgment); observations.push(['native', input]); step('native'); return value; }
  };
  /** Recorder callbacks remain independently visible when native dispatch invokes its event callbacks. */
  const recorder: ExecutionInput['bound']['scope']['recorder'] = {
    start(call): unknown { assert.equal(this, recorder); observations.push(['start', call]); step('start'); return value; },
    finish(record, isError, text): void { assert.equal(this, recorder); observations.push(['finish', record, isError, text]); step('finish'); },
    addUsage(usage): void { assert.equal(this, recorder); observations.push(['usage', usage]); step('usage'); }
  };
  /** Calls deliberately use the reverse order of the original definition snapshot. */
  const calls: ExecutionInput['bound']['calls'] = [
    { type: 'toolCall', id: 'parent/1', name: 'second', arguments: Object.freeze({ original: 'first arguments' }) },
    { type: 'toolCall', id: 'parent/2', name: 'first', arguments: Object.freeze({ original: 'second arguments' }) }
  ];
  /** Original runner, group, binding, and judgment remain independently replaceable fixture inputs. */
  const input: ExecutionInput = {
    runner: { host, queueTail: Promise.resolve() },
    origin: { prepared: { id: 'parent' }, response: Object.freeze({ original: 'response' }), signal: abort.signal, judgment },
    group: { handle: Object.freeze({ original: 'group' }), members: [{ signal: new AbortController().signal }, { signal: new AbortController().signal }] },
    bound: {
      scope: { recorder, holdsQueue: false },
      calls,
      tools: [{ name: 'first' }, { name: 'second' }],
      slots: [Object.freeze({ slot: 'first' }), Object.freeze({ slot: 'second' })],
      ordinals: new Map([['parent/1', 0], ['parent/2', 1]]),
      tickets: calls.map(function ticketFor(call) {
        return { resolve(outcome: unknown): void { observations.push(['resolve', call, outcome]); step(`resolve:${call.id}`); } };
      })
    },
    assertParentCurrent(): void { step('parent'); },
    async dispatchPreparedBatch(dispatch): Promise<void> { dispatched.push(dispatch); step('dispatch'); await control.dispatch?.(dispatch); step('dispatch:done'); }
  };
  /** Invoke the built native execution owner with original fixture input identities.
   @returns original execution scope completion
   */
  async function execute(): Promise<void> { await executionModule.executeReachedProgramGroup(input); }
  /** Require completed dispatcher entry before a consumer invokes its native callbacks.
   @returns original captured dispatcher input
   */
  function dispatch(): ExecutionDispatch { const [captured] = dispatched; assert.ok(captured); return captured; }
  return { input, control, steps, observations, dispatched, abort, value, context, execute, dispatch };
}
//endregion
