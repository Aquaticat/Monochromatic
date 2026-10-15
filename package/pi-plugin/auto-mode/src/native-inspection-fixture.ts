/** Independent currentness and retained-state capabilities for built inspection. @module */
import assert from 'node:assert/strict';
import { inspectionModule, type InspectionFixtureRecord, type InspectionFixture } from './native-inspection-module-fixture.ts';

//region Each fixture retains original records while callbacks expose observation order.
/**
 Construct independent mutable owners and immutable identities for native inspection.
 @returns built owner with observable capabilities and replaceable lifecycle state
 */
export function createInspectionFixture(): InspectionFixture {
  /** Every callback records entry before a configured original failure. */
  const events: string[] = [];
  /** Callback failures retain exact identity. */
  const failures = new Map<string, Error>();
  /** Optional callback mutation proves when the owner reads shared state. */
  const state: { onStep?: (point: string) => void } = {};
  /**
   Record original callback order before effects or failure.
   @param point - capability boundary being observed
   @returns nothing after completing boundary observation
   @throws Error when selected callback fails
   */
  function visit(point: string): void {
    events.push(point);
    state.onStep?.(point);
    /** Failure is the original object supplied by the test. */
    const failure = failures.get(point);
    if (failure !== undefined) throw failure;
  }
  /** Original member signals remain shared by reference. */
  const controller = new AbortController();
  /** Deliberately nonalphabetic identifiers expose declaration ordering. */
  const byMember = new Map<string, object>();
  /** Shared original records remain independently mutable. */
  const bindings = new WeakMap<object, InspectionFixtureRecord>();
  /** Records remain accessible to assertions without consulting production helpers. */
  const records: InspectionFixtureRecord[] = [];
  /** Prepared source views have distinguishable original identities. */
  const preparedViews = [Object.freeze({ source: 'z' }), Object.freeze({ source: 'a' })];
  /** Native root and child readers return the same retained sentinels. */
  const views = new Map<object, object>();
  for (const [ordinal, id] of ['z', 'absent', 'a'].entries()) {
    /** Original handles contain no fixture identifiers. */
    const handle = Object.freeze({});
    /** Each record starts unentered with its original prepared input. */
    const record: InspectionFixtureRecord = { prepared: { input: { path: `/original/${id}` } }, effectiveSignal: controller.signal };
    if (ordinal !== 1) {
      /** Prepared views and native program handles are separate identities. */
      const view = preparedViews[ordinal === 0 ? 0 : 1];
      assert.ok(view !== undefined);
      record.preparedProgram = { view };
      record.program = { handle: Object.freeze({}) };
      views.set(record.program.handle, Object.freeze({ root: id }));
    }
    if (ordinal === 1) record.execution = { state: 'active' };
    if (ordinal === 2) record.execution = { state: 'returned' };
    records.push(record);
    byMember.set(id, handle);
    bindings.set(handle, record);
  }
  /** Group order deliberately differs from root declaration order. */
  const childGroups = [{ handle: Object.freeze({}) }, { handle: Object.freeze({}) }];
  for (const [ordinal, group] of childGroups.entries()) views.set(group.handle, Object.freeze({ group: ordinal }));
  /** Original preparation state remains readable after failure. */
  const preparation: { prepared: boolean; preparationFailed: boolean; preparationFailure?: unknown; handle?: object } = { prepared: false, preparationFailed: false };
  /** Original terminal state remains readable after closure. */
  const lifecycle: { finished: boolean; closeFailed: boolean; finalRecord?: unknown } = { finished: false, closeFailed: false };
  /** Accounting is an opaque original result, not reconstructed by inspection. */
  const accounting = Object.freeze({ remaining: 7 });
  /** Original dependency facade result must retain identity. */
  const file = Object.freeze({ content: 'original' });
  /** Captured arguments prove the original handle and prepared path are forwarded. */
  const fileCalls: Readonly<{ handle: unknown; absolutePath: unknown }>[] = [];
  /** Capabilities are independent of implementation type aliases. */
  const input = {
    preparation, lifecycle, byMember, bindings, childGroups,
    budget: { diagnostics() { visit('accounting'); return accounting; } },
    knownMember(member: unknown) {
      visit('ownership');
      assert.ok((member !== null) && ((typeof member) === 'object'));
      /** Only this fixture's original handle resolves. */
      const record = bindings.get(member);
      assert.ok(record !== undefined);
      return record;
    },
    assertDependenciesCurrent() { visit('dependencies'); },
    parentCurrent(record: InspectionFixtureRecord) { visit('parent'); assert.ok(records.includes(record)); },
    ready() { visit('ready'); },
    originalFile(call: Readonly<{ handle: unknown; absolutePath: unknown }>) { visit('file'); fileCalls.push(call); return file; },
    inspectProgram(handle: object) { visit('program'); assert.ok(views.has(handle)); return views.get(handle); },
    inspectReachedGroup(handle: object) { visit('group'); assert.ok(views.has(handle)); return views.get(handle); },
  };
  /** Factory must not eagerly call any supplied capability. */
  const owner = inspectionModule.createJudgmentInspection(input);
  return { owner, events, failures, state, controller, byMember, bindings, records, preparedViews, views, childGroups, preparation, lifecycle, accounting, file, fileCalls };
}
//endregion
