/** Independent program execution fixtures expose original runtime and judgment boundaries. @module */
import assert from 'node:assert/strict';
import type { ProgramRuntimeFixture, RuntimeFixtureModule, RuntimeFixtureCall, RuntimeFixtureValue, RuntimeFixtureFailure, RuntimeFixtureControl, RuntimeFixtureTool } from './native-program-runtime-fixture-types.ts';

/** Independently authored native result guards use the built guard category under test. */
type RuntimeGuardModule = Readonly<{ scriptValueGuard: (input: Readonly<{ error: unknown }>) => Error }>;
/** Require original runtime exports before consuming their public source and lifetime boundaries.
 @param value - built native namespace
 @returns narrowed independent runtime contract
 @throws Error when the original runtime exports are unavailable
 */
function assertRuntimeModule(value: unknown): asserts value is RuntimeFixtureModule {
  if ((value === null) || ((typeof value) !== 'object') || (!('createReachedProgramRun' in value))
    || ((typeof value.createReachedProgramRun) !== 'function') || (!('ReachedProgramRuntimeError' in value))
    || ((typeof value.ReachedProgramRuntimeError) !== 'function')) throw new Error('Built original program runtime is unavailable');
}
/** Require the original guard factory before authoring category-specific conversion failures.
 @param value - built native guard namespace
 @returns independently declared guard factory
 @throws Error when the original guard factory is unavailable
 */
function assertGuardModule(value: unknown): asserts value is RuntimeGuardModule {
  if ((value === null) || ((typeof value) !== 'object') || (!('scriptValueGuard' in value))
    || ((typeof value.scriptValueGuard) !== 'function')) throw new Error('Built original native value guard is unavailable');
}
/** Dynamic built loading prevents production declarations from prescribing fixture expectations. */
const loaded: unknown = await import(new URL('../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/program-runtime.mjs', import.meta.url).href);
assertRuntimeModule(loaded);
/** Independent runtime namespace also permits malformed-publication diagnostic probes. */
export const runtimeFixtureModule: RuntimeFixtureModule = loaded;
/** Original guard authoring remains separate from runtime guard-retention observations. */
const loadedGuard: unknown = await import(new URL('../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/script-value-guard.ts', import.meta.url).href);
assertGuardModule(loadedGuard);
/** Explicit narrowing remains available to delayed fixture guard construction. */
const guardModule: RuntimeGuardModule = loadedGuard;

//region Original source and native lifetimes remain independently controlled by fixture consumers.
/** Author an original native result guard for category-specific runtime conversion probes.
 @param error - independently supplied original caught failure
 @returns built original native value guard
 @example createRuntimeFixtureGuard(originalFailure);
 */
export function createRuntimeFixtureGuard(error: unknown): Error {
  return guardModule.scriptValueGuard({ error });
}
/** Create original source groups, native completion tickets, and independently observable judgment callbacks.
 @returns built program runtime with original caller-owned input and outcome controls
 @example createProgramRuntimeFixture();
 */
export function createProgramRuntimeFixture(): ProgramRuntimeFixture {
  /** Program identity remains distinct from original source and reached-group handles. */
  const program = Object.freeze({ original: 'program' });
  /** Source sites include a shared group and a separate later group in declared order. */
  const sites = Object.freeze([
    Object.freeze({ group: 0, ordinal: 0, alias: 'first' }),
    Object.freeze({ group: 0, ordinal: 1, alias: 'second' }),
    Object.freeze({ group: 1, ordinal: 0, alias: 'later' }),
  ]);
  /** Original declaration identity is captured before runtime construction. */
  const declaration = Object.freeze({ source: 'original program source', sites });
  /** Canonical reached views remain independently frozen and keyed by original source ordinals. */
  const views = [0, 1].map(function reachedView(ordinal) {
    return Object.freeze({
      handle: Object.freeze({ original: 'group', ordinal }), declaration,
      members: Object.freeze(sites.filter(function belongs(site) { return site.group === ordinal; }).map(function reachedMember(site) {
        const args = Object.freeze({ site: site.alias });
        return Object.freeze({ ...site, args, argsJSON: JSON.stringify(args) });
      })),
    });
  });
  /** Original parent cancellation is independent from every native member signal. */
  const parent = new AbortController();
  /** Original native callbacks each retain their independently controlled signal. */
  const native = sites.map(function cancellation() { return new AbortController(); });
  /** Every reached group has independently controlled original native outcomes. */
  const tickets = views.map(function completionsForGroup(view) { return view.members.map(function nativeCompletion() { return Promise.withResolvers<unknown>(); }); });
  /** Complete-group inputs are retained without replacing their member association. */
  const calls: RuntimeFixtureCall[] = [];
  /** Script-value callbacks expose the exact original native outcome they receive. */
  const converted: RuntimeFixtureValue[] = [];
  /** Guard retention records original failure values independently of returned guard identity. */
  const marked: RuntimeFixtureFailure[] = [];
  /** Stable fixture guard token distinguishes retention from ordinary failure propagation. */
  const guard = new Error('original retained program guard');
  /** Retained guard order is independently controlled by the fixture judgment. */
  const guards: Error[] = [];
  /** Callback events expose original construction and currentness ordering. */
  const events: string[] = [];
  /** Reader outputs may change independently while source publication remains fixed. */
  const control: RuntimeFixtureControl = {
    programView: Object.freeze({ declaration }),
    views: new Map(views.map(function groupView(view, ordinal) { return [ordinal, view]; })),
    currentViews: new Map(views.map(function originalReader(view) { return [view.handle, view]; })),
    failure: new Error('original callback failure'), value: 'original converted value',
  };
  /** Observe one original callback before its optional publication or failure.
   @param point - original callback boundary
   @throws Error when the fixture selects this callback as failing
   */
  function step(point: string): void {
    events.push(point);
    control.onStep?.(point);
    if (control.failAt === point) throw control.failure;
  }
  /** Original judgment callbacks retain their receiver and exact program identity. */
  const judgment = {
    programFor(original: object): unknown { assert.equal(this, judgment); assert.equal(original, program); step('program'); return control.programView; },
    reachProgramGroup({ program: original, ordinal }: Readonly<{ program: object; ordinal: number }>): unknown { assert.equal(this, judgment); assert.equal(original, program); step(`reach:${ordinal}`); return control.views.get(ordinal); },
    reachedGroupFor(handle: object): unknown { assert.equal(this, judgment); step('read-group'); return control.currentViews.get(handle); },
    markProgramGuard(input: RuntimeFixtureFailure): Error { assert.equal(this, judgment); assert.equal(input.program, program); marked.push(input); step('mark'); guards.push(guard); return guard; },
    inspectProgram(original: object): Readonly<{ guardFailures: readonly Error[] }> { assert.equal(this, judgment); assert.equal(original, program); step('inspect-program'); return { guardFailures: guards }; },
  };
  /** Original parent and native consumer functions are independently bound input capabilities. */
  const input = {
    judgment, program, signal: parent.signal,
    assertParentCurrent(): void { assert.equal(this, undefined); step('parent'); },
    dispatchGroup(call: RuntimeFixtureCall): unknown {
      assert.equal(this, undefined);
      calls.push(call);
      step('dispatch');
      const ordinal = views.findIndex(function originalHandle(view) { return view.handle === call.handle; });
      const groupTickets = tickets[ordinal];
      assert.ok(groupTickets);
      return groupTickets.map(function completion(ticket) { return ticket.promise; });
    },
    scriptValueFor(value: RuntimeFixtureValue): unknown { assert.equal(this, undefined); converted.push(value); step('convert'); return control.value; },
  };
  /** Construction reads original program publication before exposing runtime tools. */
  const run = runtimeFixtureModule.createReachedProgramRun(input);
  /** Select an original public tool whose identity belongs to this runtime.
   @param index - original declaration position
   @returns original published program tool
   */
  function tool(index = 0): RuntimeFixtureTool {
    const selected = run.tools[index];
    assert.ok(selected);
    return selected;
  }
  /** Invoke the selected original source call with its independently declared arguments and signal.
   @param index - original declaration position
   @returns original native transport result
   */
  async function invoke(index = 0): Promise<unknown> {
    const site = sites[index];
    const controller = native[index];
    assert.ok(site);
    assert.ok(controller);
    const args = views[site.group]?.members[site.ordinal]?.args;
    return await tool(index).execute(args, { signal: controller.signal });
  }
  /** Select original native completion tickets without replacing their identities.
   @param ordinal - original source group ordinal
   @returns independently controlled original native completions
   */
  function completions(ordinal = 0): readonly PromiseWithResolvers<unknown>[] {
    const selected = tickets[ordinal];
    assert.ok(selected);
    return selected;
  }
  return { program, declaration, views, parent, native, calls, converted, marked, guard, guards, events, control, input, run, tool, invoke, completions };
}
//endregion
