/** Built lifecycle assessment preserves original attempts, terminal failures, and exclusion cleanup. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createLifecycleFixture } from './native-lifecycle-fixture.ts';
import { captureBudgetRejection } from './native-judgment-budget-fixture.ts';

//region Assessment owns exactly one original batch reservation through every terminal outcome.
await describe({ name: '', children: [
  it({ name: 'preserves request and attempt identities and rejects replay before reading dependencies', fn: async function retainsAttempt() {
    /** Real selection and budget provide independently observable original identities. */
    const f = createLifecycleFixture();
    /** Judgment ownership precedes the first transport attempt. */
    const batch = f.owner.issue([f.claim]);
    /** Selection request identity is stable until terminal settlement. */
    const request = f.selection.requestFor(batch);
    f.events.length = 0;
    /** Original settlement is returned directly, including its canonical answers. */
    const result = await f.owner.assess(batch);
    assert.equal(result, f.selection.resultFor(batch));
    assert.equal(result.answers[0]?.value, 0.75);
    assert.equal(f.attempts.length, 1);
    assert.equal(f.attempts[0]?.request, request);
    assert.equal(f.attempts[0]?.signal, f.controller.signal);
    assert.equal(f.attempts[0]?.deadlineAt, 10_000);
    assert.equal(f.attempts[0]?.attempt, 1);
    assert.ok(Object.isFrozen(f.attempts[0]));
    assert.deepEqual(f.events, ['segment:readBatchRequest:enter', 'selection', 'segment:readBatchRequest:exit', 'dispatch', 'send', 'segment:settleAssessmentAnswer:enter', 'selection', 'segment:settleAssessmentAnswer:exit']);
    assert.equal(f.owner.state.operating, false);
    assert.equal(f.owner.state.assessing, false);
    f.events.length = 0;
    /** Original attempt membership survives completion and is checked before currentness. */
    const repeated = await captureBudgetRejection(f.owner.assess(batch));
    assert.ok(Error.isError(repeated));
    assert.equal(repeated.message, 'Question batch cannot be assessed concurrently or sampled again');
    assert.deepEqual(f.events, []);
  } }),
  it({ name: 'excludes overlapping assessments and synchronous operations until original transport settles', fn: async function excludesOverlap() {
    /** Each deferred transport belongs to this test alone. */
    const f = createLifecycleFixture();
    /** Original batch is reserved before transport begins. */
    const batch = f.owner.issue([f.claim]);
    /** Native promises allow deterministic overlap without timer races. */
    const response = Promise.withResolvers<unknown>();
    f.state.transport = async function deferred() { return await response.promise; };
    /** The original asynchronous operation remains active across caller reentry. */
    const pending = f.owner.assess(batch);
    assert.equal(f.owner.state.operating, true);
    assert.equal(f.owner.state.assessing, true);
    assert.throws(function synchronousOverlap() { f.owner.operation(function nested() { return undefined; }); },
      { name: 'JudgmentConstructionError', message: 'Judgment operations cannot reenter through callbacks' });
    /** An overlap refusal must not release the original operation's guard. */
    const overlap = await captureBudgetRejection(f.owner.assess(batch));
    assert.ok(Error.isError(overlap));
    assert.equal(overlap.message, 'Judgment operations cannot overlap or reenter');
    assert.equal(f.owner.state.operating, true);
    response.resolve({ answerText: '[{"id":"q0","status":"estimate","value":0.5}]', model: 'fixture-model' });
    await pending;
    assert.equal(f.owner.state.operating, false);
    assert.equal(f.owner.state.assessing, false);
    assert.equal(f.owner.captureClaimEvidence(f.claim).model, 'fixture-model');
  } }),
  ...['segment:readBatchRequest:enter', 'segment:readBatchRequest:exit', 'dispatch', 'send', 'segment:settleAssessmentAnswer:enter', 'segment:settleAssessmentAnswer:exit'].map(function injectedBoundary(point) {
    return it({ name: `retains original failure and releases both guards at ${point}`, fn: async function retainsBoundaryFailure() {
      /** Every boundary failure receives its own original judgment lifetime. */
      const f = createLifecycleFixture();
      /** The original failure is installed only after successful issue. */
      const batch = f.owner.issue([f.claim]);
      /** Identity and terminal outcome distinguish original propagation from replacement. */
      const failure = new Error(point);
      f.state.failures.set(point, failure);
      assert.equal(await captureBudgetRejection(f.owner.assess(batch)), failure);
      assert.equal(f.owner.state.operating, false);
      assert.equal(f.owner.state.assessing, false);
      /** A failure after settlement must preserve the successful original record. */
      const result = f.selection.resultFor(batch);
      assert.equal(result.discarded, point !== 'segment:settleAssessmentAnswer:exit');
      if (result.discarded) assert.equal(result.failure, failure);
      else assert.equal(result.answers[0]?.value, 0.75);
      f.state.failures.clear();
      /** Failed attempts remain consumed after the original fault is removed. */
      const repeated = await captureBudgetRejection(f.owner.assess(batch));
      assert.ok(Error.isError(repeated));
      assert.equal(repeated.message, 'Question batch cannot be assessed concurrently or sampled again');
      assert.equal(f.owner.state.operating, false);
    } });
  }),
  ...['requestFor', 'settle'].map(function failedSelection(method) {
    return it({ name: `retains exact selection ${method} failure`, fn: async function retainsSelectionFailure() {
      /** The wrapped selection preserves real inspection and discard behavior. */
      const f = createLifecycleFixture();
      /** Successful issuance must precede the selected later failure. */
      const batch = f.owner.issue([f.claim]);
      /** Original failure survives both transport and retention boundaries. */
      const failure = new Error(method);
      f.state.selection = { ...f.selection, [method]: function fail() { throw failure; } };
      assert.equal(await captureBudgetRejection(f.owner.assess(batch)), failure);
      assert.equal(f.selection.resultFor(batch).failure, failure);
      assert.equal(f.owner.state.operating, false);
      assert.equal(f.owner.state.assessing, false);
    } });
  }),
  ...['inspectBatch', 'discard'].map(function failedRetention(method) {
    return it({ name: `preserves ordered errors without a cause when ${method} fails`, fn: async function retainsPeerFailures() {
      /** Real batch membership isolates failure retention from foreign-handle rejection. */
      const f = createLifecycleFixture();
      /** Original batch is valid before both independent failures are introduced. */
      const batch = f.owner.issue([f.claim]);
      /** The transport failure remains the first peer in the aggregate. */
      const original = new Error('original assessment failure');
      /** The retention failure remains the second peer without becoming a cause. */
      const retention = new Error('original retention failure');
      f.state.failures.set('send', original);
      f.state.selection = { ...f.selection, [method]: function fail() { throw retention; } };
      /** Aggregate properties are asserted explicitly to detect semantic autofixes. */
      const failure = await captureBudgetRejection(f.owner.assess(batch));
      assert.ok(failure instanceof AggregateError);
      assert.equal(failure.message, 'Assessment failure and terminal retention failure');
      assert.deepEqual(failure.errors, [original, retention]);
      assert.equal(failure.errors[0], original);
      assert.equal(failure.errors[1], retention);
      assert.equal(Object.hasOwn(failure, 'cause'), false);
      assert.equal(f.owner.state.operating, false);
      assert.equal(f.owner.state.assessing, false);
    } });
  }),
] });
//endregion
