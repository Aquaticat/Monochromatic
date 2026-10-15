/** Built scheduling admission preserves original cloning and failure precedence. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { PreparedBatchContractError, schedule } from './native-prepared-schedule-fixture.ts';

await describe({ name: 'prepared schedule admission', children: [
  //region Original admission rejects malformed members before cloning or inspecting later inputs.
  ...[undefined, null, {}, [], 'calls'].map(function invalidCalls(calls) {
    return it({ name: `rejects the original nonmember input ${JSON.stringify(calls)}`, fn: async function admission() {
      assert.throws(function reject() { schedule({ calls }); }, function originalError(error: unknown) {
        return (error instanceof PreparedBatchContractError) && (error.message === 'Prepared batch requires one to64 unique named members');
      });
    } });
  }),
  ...[{ type: 'other' }, { id: 1 }, { id: '' }, { name: 1 }, { name: '' }].map(function malformedMember(override) {
    return it({ name: `rejects malformed member ${JSON.stringify(override)} before cloning`, fn: async function memberAdmission() {
      const call = { type: 'toolCall', id: 'one', name: 'tool', arguments: function uncloneable() { return true; }, ...override };
      assert.throws(function reject() { schedule({ calls: [call], executionMode: 'invalid' }); }, { message: 'Prepared batch requires one to64 unique named members' });
    } });
  }),
  it({ name: 'preserves native property failures for null members', fn: async function nullMember() {
    assert.throws(function reject() { schedule({ calls: [null] }); }, TypeError);
  } }),
  it({ name: 'accepts whitespace names and identifiers without trimming', fn: async function whitespace() {
    assert.doesNotThrow(function accept() {
      assert.equal(schedule({ calls: [{ type: 'toolCall', id: ' ', name: ' ', arguments: {} }] }).serial, false);
    });
  } }),
  it({ name: 'accepts exactly 64 members with repeated names but rejects 65 before cloning', fn: async function memberLimit() {
    const calls = Array.from({ length: 64 }, function member(_, index) {
      return { type: 'toolCall', id: String(index), name: 'tool', arguments: {} };
    });
    assert.doesNotThrow(function inclusiveBound() { assert.equal(schedule({ calls }).scheduled.length, 64); });
    assert.throws(function overBound() {
      schedule({ calls: [...calls, { type: 'toolCall', id: 'extra', name: 'tool', arguments: function uncloneable() { return true; } }] });
    }, { message: 'Prepared batch requires one to64 unique named members' });
  } }),
  it({ name: 'rejects duplicate identifiers before attempting a clone', fn: async function duplicateIds() {
    const call = { type: 'toolCall', id: 'one', name: 'tool', arguments: function uncloneable() { return true; } };
    assert.throws(function duplicate() { schedule({ calls: [call, call] }); }, { message: 'Prepared batch requires one to64 unique named members' });
  } }),
  //endregion
  //region Cloning owns snapshots independently and precedes mode or capability validation.
  it({ name: 'clones each member separately and freezes only the group and its member objects', fn: async function snapshots() {
    const args = { nested: { value: true } };
    const calls = ['one', 'two'].map(function member(id) { return { type: 'toolCall', id, name: 'tool', arguments: args, extra: new Date(0) }; });
    const result = schedule({ calls });
    assert.deepEqual(result.scheduled, calls);
    assert.notEqual(result.scheduled, calls);
    assert.ok(Object.isFrozen(result.scheduled));
    for (const [index, call] of result.scheduled.entries()) {
      assert.notEqual(call, calls[index]);
      assert.notEqual(call.arguments, args);
      assert.ok(Object.isFrozen(call));
      assert.equal(Object.isFrozen(call.arguments), false);
    }
    assert.notEqual(result.scheduled[0]?.arguments, result.scheduled[1]?.arguments);
    assert.equal(Object.isFrozen(calls), false);
    assert.equal(Object.isFrozen(args), false);
  } }),
  it({ name: 'retains structured clone failure before invalid mode and absent judgment', fn: async function cloneFailure() {
    assert.throws(function uncloneable() {
      schedule({ calls: [{ type: 'toolCall', id: 'one', name: 'tool', arguments: function unsupported() { return true; } }], executionMode: 'invalid', executionJudgment: null });
    }, { name: 'DataCloneError' });
  } }),
  it({ name: 'reads cloned data before rejecting mode and mode before judgment support', fn: async function failureOrder() {
    const events: string[] = [];
    const call = { type: 'toolCall', id: 'one', name: 'tool', get arguments() { events.push('clone'); return {}; } };
    assert.throws(function invalidMode() { schedule({ calls: [call], executionMode: 'invalid', executionJudgment: null }); }, { message: 'Unknown batch execution mode' });
    assert.deepEqual(events, ['clone']);
  } }),
  it({ name: 'propagates the original opaque getter exception during cloning', fn: async function opaqueFailure() {
    const failure: unknown = Object.freeze({ reason: 'original clone getter' });
    const call = { type: 'toolCall', id: 'one', name: 'tool', get arguments() { throw failure; } };
    assert.throws(function fail() { schedule({ calls: [call] }); }, function sameFailure(error: unknown) { return error === failure; });
  } }),
  //endregion
] });
