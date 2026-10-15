/** Original prepared completion preserves envelope and snapshot identity. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { complete, PreparedBatchContractError } from './native-prepared-completion-fixture.ts';

await describe({ name: 'prepared completion values', children: [
  //region Successful completion retains original values and freezes only the original public boundaries.
  it({ name: 'preserves decision and first snapshot identity with independent frozen output values', fn: async function envelope() {
    const decision = { block: false };
    const value = { native: true };
    const members = [{ id: 'one' }];
    const snapshots = [members, [{ id: 'later' }]];
    const settled = [{ status: 'fulfilled', value }, { status: 'fulfilled', value: undefined }];
    const result = complete({ batchState: { decision }, settled, snapshots });
    assert.equal(result.decision, decision);
    assert.equal(result.assessmentCount, 2);
    assert.equal(result.members, members);
    assert.deepEqual(result.outcomes, [value, undefined]);
    assert.equal(result.outcomes[0], value);
    assert.notEqual(result.outcomes, settled);
    assert.ok(Object.isFrozen(result));
    assert.ok(Object.isFrozen(result.outcomes));
    assert.equal(Object.isFrozen(value), false);
    assert.equal(Object.isFrozen(decision), false);
    assert.equal(Object.isFrozen(members), false);
    assert.equal(Object.isFrozen(settled), false);
  } }),
  it({ name: 'creates a fresh frozen empty member fallback when no assessment snapshot exists', fn: async function absentSnapshot() {
    const first = complete();
    const second = complete();
    assert.equal(first.assessmentCount, 0);
    assert.deepEqual(first.members, []);
    assert.deepEqual(first.outcomes, []);
    assert.ok(Object.isFrozen(first.members));
    assert.notEqual(first.members, second.members);
    assert.notEqual(first.outcomes, second.outcomes);
  } }),
  it({ name: 'retains an existing empty first snapshot and its assessment count', fn: async function emptySnapshot() {
    const members: unknown[] = [];
    const result = complete({ snapshots: [members] });
    assert.equal(result.members, members);
    assert.equal(result.assessmentCount, 1);
    assert.equal(Object.isFrozen(members), false);
  } }),
  ...[null, false, 0, '', { block: true, reason: 'original block' }].map(function originalDecision(decision) {
    return it({ name: `preserves an original defined decision ${JSON.stringify(decision)}`, fn: async function definedDecision() {
      assert.doesNotThrow(function retainedDecision() {
        assert.equal(complete({ batchState: { decision } }).decision, decision);
      });
    } });
  }),
  it({ name: 'preserves original nullish snapshot fallback without converting false values', fn: async function nullishSnapshot() {
    for (const first of [undefined, null]) {
      const result = complete({ snapshots: [first] });
      assert.deepEqual(result.members, []);
      assert.ok(Object.isFrozen(result.members));
      assert.equal(result.assessmentCount, 1);
    }
    assert.equal(complete({ snapshots: [false] }).members, false);
  } }),
  it({ name: 'observes decision, native status, snapshot, and native value in original order', fn: async function readOrder() {
    const events: string[] = [];
    const first = { block: false };
    const last = { block: true };
    const batchState = { get decision() {
      events.push('decision');
      return events.length === 1 ? first : last;
    } };
    const settled = [{ get status() {
      events.push('status');
      return 'fulfilled';
    }, get value() {
      events.push('value');
      return 'native result';
    } }];
    const snapshots = new Proxy([['member']], { get(target, key, receiver): unknown {
      events.push(`snapshot:${String(key)}`);
      return Reflect.get(target, key, receiver);
    } });
    const result = complete({ batchState, settled, snapshots });
    assert.equal(result.decision, last);
    assert.deepEqual(result.outcomes, ['native result']);
    assert.deepEqual(events, ['decision', 'status', 'decision', 'snapshot:length', 'snapshot:0', 'value']);
  } }),
  //endregion
  //region Absent admission and opaque observation failures retain original identity and precedence.
  it({ name: 'rejects absent admission before reading failures or native outcomes', fn: async function absentDecision() {
    assert.throws(function reject() {
      complete({ batchState: {}, failures: undefined, settled: undefined, snapshots: undefined });
    }, function originalError(error: unknown) {
      assert.ok(error instanceof PreparedBatchContractError);
      assert.equal(error.message, 'Prepared batch completed without admission outcome');
      assert.equal(error.name, 'Error');
      return true;
    });
  } }),
  it({ name: 'preserves opaque decision and native-value getter failures', fn: async function getterFailures() {
    const failure: unknown = Object.freeze({ reason: 'original completion getter' });
    for (const input of [
      { batchState: { get decision() { throw failure; } } },
      { settled: [{ status: 'fulfilled', get value() { throw failure; } }] },
      { settled: [{ get status() { throw failure; } }] },
    ]) {
      assert.throws(function reject() {
        complete(input);
      }, function sameFailure(error: unknown) {
        return error === failure;
      });
    }
  } }),
  //endregion
] });
