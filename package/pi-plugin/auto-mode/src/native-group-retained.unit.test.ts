/** Retained collector snapshots preserve original values without claiming native effects. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createLifetimeFixture } from './native-group-lifetime-fixture.ts';

//region Inspection creates frozen snapshots while native outcome and failure identities remain original.
await describe({ name: '', children: [
  it({ name: 'snapshots declaration order and live counts without freezing caller-owned records', fn: async function inspect() {
    /** Retained reads are independent of eligibility and invoke no original callbacks. */
    const f = createLifetimeFixture();
    /** Native outcome identity survives snapshot publication. */
    const completion = Object.freeze({ status: 'fulfilled' as const, value: Object.freeze({ original: 'native' }) });
    /** Failure occurrence identity is retained separately from its diagnostic value. */
    const occurrence = Object.freeze({ identity: {}, ordinal: 2, at: 'original boundary', error: Object.freeze({ original: 'failure' }) });
    /** Explicit member access verifies the independent fixture actually supplies the inspected record. */
    const [record] = f.records;
    assert.ok(record);
    record.completion = completion;
    f.failures.push(occurrence);
    f.state.primary = { occurrence };
    f.state.unboundOutcomes.push('unbound');
    /** First snapshot freezes containers while retaining original nested values. */
    const first = f.owner.inspect();
    assert.deepEqual(Object.keys(first), ['phase', 'phaseAtReturn', 'failed', 'failure', 'failures', 'dispatches', 'unboundPending', 'unboundOutcomes', 'members', 'executionState', 'effectQualification']);
    assert.equal(first.phase, 'collecting');
    assert.equal(first.phaseAtReturn, undefined);
    assert.equal(first.failed, true);
    assert.equal(first.failure, occurrence.error);
    assert.equal(first.failures[0], occurrence);
    assert.notEqual(first.failures, f.failures);
    assert.equal(first.dispatches, 7);
    assert.equal(first.unboundPending, 3);
    assert.equal(first.unboundOutcomes, f.state.unboundOutcomes);
    assert.deepEqual(first.members, [
      { ordinal: 17, arrival: 'matched', state: 'pending', completion },
      { ordinal: 23, arrival: 'unarrived', state: 'unarrived', completion: undefined },
    ]);
    assert.equal(first.members[0]?.completion, completion);
    assert.equal(first.executionState, 'owned-by-native-consumer-not-inferred');
    assert.equal(first.effectQualification, 'not-established');
    assert.equal(Object.isFrozen(first), true);
    assert.equal(Object.isFrozen(first.members), true);
    assert.equal(Object.isFrozen(first.members[0]), true);
    assert.equal(Object.isFrozen(first.failures), true);
    assert.equal(Object.isFrozen(f.records), false);
    assert.equal(Object.isFrozen(record), false);
    assert.equal(Object.isFrozen(f.failures), false);
    assert.equal(Object.isFrozen(f.state.unboundOutcomes), false);
    record.state = 'fulfilled';
    f.state.phase = 'settled';
    f.state.dispatches = 11;
    f.state.unboundPending = 0;
    f.failures.push({ ...occurrence, ordinal: 3 });
    /** Later inspection reads current state without rewriting previous snapshots. */
    const second = f.owner.inspect();
    assert.notEqual(second, first);
    assert.notEqual(second.members, first.members);
    assert.notEqual(second.members[0], first.members[0]);
    assert.equal(first.members[0]?.state, 'pending');
    assert.equal(second.members[0]?.state, 'fulfilled');
    assert.equal(first.failures.length, 1);
    assert.equal(second.failures.length, 2);
    assert.equal(second.phase, 'settled');
    assert.equal(second.dispatches, 11);
    assert.equal(second.unboundPending, 0);
    assert.equal(f.events.length, 0);
  } }),
  it({ name: 'retains explicit absent failure and closed transport phase without inventing success', fn: async function closed() {
    /** Closing completed transport does not create an original failure occurrence. */
    const f = createLifetimeFixture();
    f.state.phase = 'dispatching';
    f.owner.retire();
    /** Inspection remains available after transport closure. */
    const view = f.owner.inspect();
    assert.equal(view.phase, 'closed');
    assert.equal(view.phaseAtReturn, 'dispatching');
    assert.equal(view.failed, false);
    assert.equal(view.failure, undefined);
    assert.equal(view.failures.length, 0);
    assert.equal(view.members[0]?.completion, undefined);
    assert.equal(view.executionState, 'owned-by-native-consumer-not-inferred');
    assert.equal(view.effectQualification, 'not-established');
  } }),
] });
//endregion
