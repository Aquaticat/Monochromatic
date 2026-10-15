/** Prepared completion keeps original aggregate causes and lifecycle failure precedence. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { complete, PreparedBatchExecutionError } from './native-prepared-completion-fixture.ts';

await describe({ name: 'prepared completion failures', children: [
  //region Retained lifecycle failures own error causes before native rejections are inspected.
  it({ name: 'retains duplicate and nullish lifecycle failures before any native rejection', fn: async function lifecycleFailures() {
    const decision = { block: true, reason: 'original failure' };
    const failure = Object.freeze({ original: 'opaque failure' });
    const failures = [failure, undefined, null, failure];
    const settled = [{ get status() {
      throw new Error('Native status was read before retained failure');
    } }];
    assert.throws(function reject() {
      complete({ batchState: { decision }, failures, settled, snapshots: undefined });
    }, function originalError(error: unknown) {
      assert.ok(error instanceof PreparedBatchExecutionError);
      assert.equal(error.name, 'Error');
      assert.equal(error.message, 'Prepared batch retained lifecycle failures');
      assert.equal(error.diagnosticRecord.outcomes, settled);
      assert.equal(error.diagnosticRecord.assessmentDecision, decision);
      assert.ok(error.cause instanceof AggregateError);
      assert.deepEqual(error.cause.errors, failures);
      assert.notEqual(error.cause.errors, failures);
      assert.equal(Object.isFrozen(error.diagnosticRecord), false);
      return true;
    });
    assert.equal(Object.isFrozen(failures), false);
    assert.equal(Object.isFrozen(settled), false);
  } }),
  it({ name: 'uses the second original decision read in retained failure diagnostics', fn: async function failureDecision() {
    const decisions = [{ block: false }, { block: true }];
    const observed: unknown[] = [];
    const batchState = { get decision() {
      const decision = decisions[observed.length];
      observed.push(decision);
      return decision;
    } };
    assert.throws(function reject() {
      complete({ batchState, failures: [null] });
    }, function originalError(error: unknown) {
      assert.ok(error instanceof PreparedBatchExecutionError);
      assert.equal(error.diagnosticRecord.assessmentDecision, decisions[1]);
      return true;
    });
    assert.deepEqual(observed, decisions);
  } }),
  //endregion
  //region Unhandled rejections retain declaration order and original reason values without deduplication.
  it({ name: 'reports only rejected reasons while retaining the complete native outcome array', fn: async function nativeFailures() {
    const failure = Object.freeze({ original: 'native rejection' });
    const decision = { block: false };
    const settled = [
      { status: 'fulfilled', get value() { throw new Error('Fulfilled value read during failed completion'); } },
      { status: 'rejected', reason: failure },
      { status: 'rejected', reason: undefined },
      { status: 'rejected', reason: null },
      { status: 'rejected', reason: failure },
    ];
    assert.throws(function reject() {
      complete({ batchState: { decision }, settled, snapshots: undefined });
    }, function originalError(error: unknown) {
      assert.ok(error instanceof PreparedBatchExecutionError);
      assert.equal(error.message, 'Prepared batch has unhandled native outcomes');
      assert.equal(error.diagnosticRecord.outcomes, settled);
      assert.equal(error.diagnosticRecord.assessmentDecision, decision);
      assert.ok(error.cause instanceof AggregateError);
      assert.deepEqual(error.cause.errors, [failure, undefined, null, failure]);
      return true;
    });
  } }),
  it({ name: 'filters every status before observing rejected reasons and final decision', fn: async function rejectionOrder() {
    const events: string[] = [];
    const batchState = { get decision() {
      events.push('decision');
      return { block: false };
    } };
    const settled = ['one', 'two'].map(function rejected(name) {
      return { get status() {
        events.push(`status:${name}`);
        return 'rejected';
      }, get reason() {
        events.push(`reason:${name}`);
        return name;
      } };
    });
    assert.throws(function reject() {
      complete({ batchState, settled });
    }, PreparedBatchExecutionError);
    assert.deepEqual(events, ['decision', 'status:one', 'status:two', 'reason:one', 'reason:two', 'decision']);
  } }),
  it({ name: 'preserves opaque rejected-reason getter failure without aggregate wrapping', fn: async function reasonFailure() {
    const failure: unknown = Object.freeze({ reason: 'original rejection getter' });
    assert.throws(function reject() {
      complete({ settled: [{ status: 'rejected', get reason() {
        throw failure;
      } }] });
    }, function originalFailure(error: unknown) {
      return error === failure;
    });
  } }),
  //endregion
] });
