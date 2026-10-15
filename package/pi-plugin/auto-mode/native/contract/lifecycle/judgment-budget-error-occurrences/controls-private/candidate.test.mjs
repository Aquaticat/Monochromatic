import assert from 'node:assert/strict';
import {
  createJudgmentBudget,
  JudgmentAttemptLimitError,
  JudgmentBudgetError,
  JudgmentCancelledError,
  JudgmentDeadlineError
} from './candidate.mjs';

//region Disposable clocks and cancellation exercise the built original budget without network access.
/** Default transport failures do not receive a retry. */
function noRetry() {
  return false;
}

/**
 Own each test's clock and cancellation independently.
 @param {{classify?: (error: unknown) => boolean}} [options] - fixed transport classification
 */
function fixture({classify=noRetry}={}) {
  const clock={at:0};
  const controller=new AbortController();
  const budget=createJudgmentBudget({
    now:function readClock() { return clock.at; },
    signal:controller.signal,
    isRetryableTransportFailure:classify
  });
  return {budget,clock,controller};
}

{
  const {budget}=fixture();
  const value=await budget.dispatch(function successfulAttempt() { return Promise.resolve('original result'); });
  assert.equal(value,'original result');
  assert.equal(budget.diagnostics().running,false);
  assert.equal(budget.finish().finished,true);
  assert.throws(function rejectFinishedCheckpoint() { budget.checkpoint(); },JudgmentBudgetError);
}

{
  const transportFailure=new Error('retryable transport failure');
  const {budget}=fixture({classify:function classifyOriginalFailure(error) { return error===transportFailure; }});
  const value=await budget.dispatch(function failThenComplete({attempt}) {
    if(attempt===1)throw transportFailure;
    return Promise.resolve(attempt);
  });
  assert.equal(value,2);
  assert.equal(budget.diagnostics().retryUsed,true);
  assert.deepEqual(budget.diagnostics().records.map(function readAttemptState(record) { return record.state; }),[
    'failed',
    'succeeded'
  ]);
  await assert.rejects(budget.dispatch(function cannotRetryAgain() { throw transportFailure; }),transportFailure);
  assert.equal(budget.diagnostics().attempts,3);
  await assert.rejects(budget.dispatch(function overAttemptLimit() { return Promise.resolve('unreachable'); }),JudgmentAttemptLimitError);
  assert.equal(budget.diagnostics().running,false);
}

{
  const {budget}=fixture();
  /** @type {PromiseWithResolvers<number>} */
  const pending=Promise.withResolvers();
  const first=budget.dispatch(function pendingAttempt() { return pending.promise; });
  await assert.rejects(budget.dispatch(function overlappingAttempt() { return Promise.resolve(1); }),JudgmentBudgetError);
  assert.throws(function cannotFinishPendingAttempt() { budget.finish(); },JudgmentBudgetError);
  pending.resolve(7);
  assert.equal(await first,7);
  assert.equal(budget.diagnostics().running,false);
}

{
  const {budget,controller}=fixture();
  controller.abort(new Error('cancelled by original owner'));
  assert.throws(function cancelledCheckpoint() { budget.checkpoint(); },JudgmentCancelledError);
  assert.equal(budget.diagnostics().retired,true);
}

{
  const {budget,clock}=fixture();
  clock.at=5_000;
  assert.throws(function expiredCheckpoint() { budget.checkpoint(); },JudgmentDeadlineError);
  clock.at=0;
  assert.throws(function retirementCannotBeReversed() { budget.checkpoint(); },JudgmentDeadlineError);
}

{
  const {budget,clock}=fixture();
  clock.at=-1;
  assert.throws(function reversedClock() { budget.checkpoint(); },JudgmentBudgetError);
  assert.equal(budget.diagnostics().retired,true);
}

{
  const {budget,clock}=fixture();
  await assert.rejects(budget.dispatch(function completeAfterDeadline() {
    clock.at=5_000;
    return Promise.resolve('late response');
  }),JudgmentDeadlineError);
  assert.equal(budget.diagnostics().records[0].state,'discarded');
  assert.equal(budget.diagnostics().running,false);
}

{
  const transportFailure=new Error('transport failed');
  const classifierFailure=new Error('classifier failed');
  const {budget}=fixture({classify:function failedClassification() { throw classifierFailure; }});
  await assert.rejects(budget.dispatch(function failedTransport() { throw transportFailure; }),function retainedFailures(error) {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors,[transportFailure,classifierFailure]);
    return true;
  });
  assert.equal(budget.diagnostics().running,false);
}

{
  const cause=new Error('original cause');
  for(const Constructor of [JudgmentBudgetError,JudgmentDeadlineError,JudgmentCancelledError,JudgmentAttemptLimitError]) {
    const error=new Constructor('original message',{cause});
    assert.equal(error.name,Constructor.name);
    assert.equal(error.message,'original message');
    assert.equal(error.cause,cause);
    assert.ok(error instanceof JudgmentBudgetError);
  }
}
console.log(JSON.stringify({
  complete:true,
  successAndClosure:true,
  classifiedRetry:true,
  attemptLimit:true,
  overlappingAttemptRejected:true,
  cancellation:true,
  deadlineAndClockRetirement:true,
  lateResponseDiscarded:true,
  classifierFailureRetained:true,
  stableErrorNamesAndCauses:true,
  providerRequests:0
}));
//endregion
