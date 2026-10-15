/** Native wrapper failures retain original guard classification and shared group ownership. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { PreparedBatchContractError } from './native-prepared-completion-fixture.ts';
import { createExecutableFixture, createGuard } from './native-prepared-executable-fixture.ts';

await describe({ name: 'prepared native wrapper failures', children: [
  //region Ordinal and queue failures precede retained active failures and context guard state.
  it({ name: 'rejects an undeclared ordinal before touching turn, currentness, or guard state', fn: async function absentOrdinal() {
    const fixture = createExecutableFixture();
    const [tool] = fixture.wrap({ serial: true, batchState: undefined });
    assert.ok(tool);
    await assert.rejects(tool.execute('missing'), function originalError(error) {
      assert.ok(error instanceof PreparedBatchContractError);
      assert.equal(error.message, 'Execution has no declared member ordinal');
      return true;
    });
    assert.deepEqual(fixture.events, []);
    assert.deepEqual(fixture.failures, []);
  } }),
  ...[false, true].map(function turnFailure(asynchronous) {
    return it({ name: `preserves ${asynchronous ? 'asynchronous' : 'synchronous'} turn failure without retaining it as native failure`, fn: async function originalTurnFailure() {
      const fixture = createExecutableFixture();
      const failure: unknown = createGuard();
      fixture.control.waitForTurn = asynchronous ? async function rejectedTurn() { throw failure; } : function thrownTurn() { throw failure; };
      const [tool] = fixture.wrap({ serial: true });
      assert.ok(tool);
      await assert.rejects(tool.execute('one'), function sameFailure(error) { return error === failure; });
      assert.deepEqual(fixture.events, ['turn:0']);
      assert.deepEqual(fixture.failures, []);
      assert.equal(fixture.batchState.executionGuardFailed, false);
    } });
  }),
  it({ name: 'retains active admission failure before inspecting an existing guard failure', fn: async function activeFailure() {
    const fixture = createExecutableFixture();
    const failure: unknown = Object.freeze({ reason: 'original currentness' });
    fixture.control.active = function failCurrentness() { throw failure; };
    const [tool] = fixture.wrap({ batchState: undefined });
    assert.ok(tool);
    await assert.rejects(tool.execute('one'), function sameFailure(error) { return error === failure; });
    assert.deepEqual(fixture.events, ['member-execute']);
    assert.deepEqual(fixture.failures, [failure]);
  } }),
  //endregion
  //region Only original native guard instances close execution; ordinary failures remain unretained here.
  ...[undefined, null, Object.freeze({ reason: 'ordinary opaque native failure' })].map(function nativeFailure(failure, index) {
    return it({ name: `retains ordinary native rejection identity ${index} without closing the group`, fn: async function ordinaryFailure() {
      const fixture = createExecutableFixture();
      const originalFailure: unknown = failure;
      fixture.control.execute = async function rejectNative() { throw originalFailure; };
      const [tool] = fixture.wrap();
      assert.ok(tool);
      await assert.rejects(tool.execute('one'), function sameFailure(error) { return error === failure; });
      assert.deepEqual(fixture.failures, []);
      assert.equal(fixture.batchState.executionGuardFailed, false);
    } });
  }),
  ...[false, true].map(function guardFailure(asynchronous) {
    return it({ name: `retains ${asynchronous ? 'asynchronous' : 'synchronous'} native guard and blocks later original member execution`, fn: async function originalGuardFailure() {
      const fixture = createExecutableFixture();
      const guard = createGuard();
      fixture.control.execute = asynchronous ? async function rejectedGuard() { throw guard; } : function thrownGuard() { throw guard; };
      const [first, second] = fixture.wrap({ tools: [fixture.original, fixture.original] });
      assert.ok(first);
      assert.ok(second);
      await assert.rejects(first.execute('one'), function original(error) { return error === guard; });
      assert.equal(fixture.batchState.executionGuardFailed, true);
      assert.deepEqual(fixture.failures, [guard]);
      await assert.rejects(second.execute('two'), function blocked(error) {
        assert.ok(error instanceof PreparedBatchContractError);
        assert.equal(error.message, 'An execution context guard failed; remaining group members cannot start');
        assert.equal(fixture.failures[1], error);
        return true;
      });
      assert.deepEqual(fixture.events, ['member-execute', 'execute', 'member-execute']);
      assert.equal(fixture.invocations.length, 1);
    } });
  }),
  //endregion
] });
