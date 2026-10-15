/** Built object-keyed membership lookup retains native weak-map results for caller values. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';

/** Independent consumer compares built results with native weak-map queries. */
type MembershipModule = Readonly<{
  readOriginalMembership: (input: Readonly<{ records: object; handle: unknown }>) => unknown;
}>;

/**
 Require the built lookup without importing implementation contracts.

 @param value - copied native lookup namespace

 @returns assertion exposing independent membership consumer contract

 @throws Error when original membership reader is unavailable
 */
function assertMembershipModule(value: unknown): asserts value is MembershipModule {
  if ((value === null) || ((typeof value) !== 'object') || !('readOriginalMembership' in value))
    throw new Error('Built original membership reader is unavailable');
  /** Original callable export follows namespace membership narrowing. */
  const reader = value.readOriginalMembership;
  if ((typeof reader) !== 'function') throw new Error('Built original membership reader is unavailable');
}

/** Native constructor consumers use this copied lookup. */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/membership-read.ts',
  import.meta.url,
).href);
assertMembershipModule(loaded);
/** Explicit narrowing remains stable inside test callbacks. */
const membershipModule: MembershipModule = loaded;

//region Object and function publication retain native membership for every caller query category.
await describe({ name: '', children: [
  it({ name: 'matches native queries for owned objects and functions plus foreign and primitive inputs', fn: async function originalQueries() {
    /** Ordinary object handles remain the native constructor's publication boundary. */
    const member = {};
    /** Callable objects are valid object-keyed membership identities. */
    function callableMember(): void { /* Identity only; this member is never invoked. */ }
    /** Independent original record is returned without copying. */
    const record = Object.freeze({});
    /** Native map receives only the same object-keyed publication supported by original owners. */
    const records = new WeakMap<object, object>([[member, record], [callableMember, record]]);
    /** Foreign callable identity must remain absent just like a foreign object. */
    function foreignCallable(): void { /* Identity only; this member is never invoked. */ }
    for (const handle of [member, callableMember, {}, foreignCallable, undefined, null, false, 0, 0n, '', Symbol('foreign'), Symbol.for('foreign')]) {
      /** Native invocation accepts arbitrary query values without changing publication. */
      const expected: unknown = Reflect.apply(records.get, records, [handle]);
      assert.equal(membershipModule.readOriginalMembership({ records, handle }), expected);
    }
    assert.equal(membershipModule.readOriginalMembership({ records, handle: member }), record);
    assert.equal(membershipModule.readOriginalMembership({ records, handle: callableMember }), record);
  } }),
] });
//endregion
