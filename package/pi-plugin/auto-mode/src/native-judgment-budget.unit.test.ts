/**
 Built original judgment attempt accounting and scoped cleanup.
 @module
 */
import assert from 'node:assert/strict';
import {describe,it} from '@monochromatic-dev/module-test/ts';
import {nativeBudget} from './native-judgment-budget-module-fixture.ts';

import {captureBudgetRejection,createBudgetFixture} from './native-judgment-budget-fixture.ts';

const {
  JudgmentAttemptLimitError,
  JudgmentBudgetError,
  JudgmentCancelledError,
  JudgmentDeadlineError
}=nativeBudget;

//region Attempts share one original allowance and cannot overlap.
await describe({name:'',children:[
  it({name:'preserves successful responses and closes evidence',fn:async function closeSuccessfulBudget() {
    const {budget}=createBudgetFixture();
    const value=await budget.dispatch(function successfulAttempt() { 
      return Promise.resolve('original result'); 
    });
    assert.equal(value,'original result');
    assert.equal(budget.diagnostics().running,false);
    assert.equal(budget.finish().finished,true);
    assert.throws(function rejectFinishedCheckpoint() { 
      budget.checkpoint(); 
    },JudgmentBudgetError);
  }}),
  it({name:'uses one classified retry within the shared attempt limit',fn:async function consumeOriginalAttempts() {
    const transportFailure=new Error('retryable transport failure');
    const {budget}=createBudgetFixture({classify:function classifyOriginalFailure(error) { 
      return error===transportFailure; 
    }});
    const value=await budget.dispatch(function failThenComplete({attempt}) {
      if(attempt===1)throw transportFailure;
      return Promise.resolve(attempt);
    });
    assert.equal(value,2);
    assert.equal(budget.diagnostics().retryUsed,true);
    assert.deepEqual(budget.diagnostics().records.map(function readAttemptState(record) { 
      return record.state; 
    }),['failed','succeeded']);
    assert.equal(await captureBudgetRejection(budget.dispatch(function cannotRetryAgain() { 
      throw transportFailure; 
    })),transportFailure);
    assert.equal(budget.diagnostics().attempts,3);
    const exhausted=await captureBudgetRejection(budget.dispatch(function overAttemptLimit() { 
      return Promise.resolve('unreachable'); 
    }));
    assert.ok(exhausted instanceof JudgmentAttemptLimitError);
    assert.equal(budget.diagnostics().running,false);
  }}),
  it({name:'rejects overlapping attempts and closure during transport',fn:async function rejectOverlappingAttempt() {
    const {budget}=createBudgetFixture();
    const pending=Promise.withResolvers<number>();
    const first=budget.dispatch(function pendingAttempt() { 
      return pending.promise; 
    });
    const overlap=await captureBudgetRejection(budget.dispatch(function overlappingAttempt() { 
      return Promise.resolve(1); 
    }));
    assert.ok(overlap instanceof JudgmentBudgetError);
    assert.throws(function cannotFinishPendingAttempt() { 
      budget.finish(); 
    },JudgmentBudgetError);
    pending.resolve(7);
    assert.equal(await first,7);
    assert.equal(budget.diagnostics().running,false);
  }}),
  it({name:'retains original transport and classifier failures',fn:async function retainClassificationFailure() {
    const transportFailure=new Error('transport failed');
    const classifierFailure=new Error('classifier failed');
    const {budget}=createBudgetFixture({classify:function failedClassification() { 
      throw classifierFailure; 
    }});
    const error=await captureBudgetRejection(budget.dispatch(function failedTransport() { 
      throw transportFailure; 
    }));
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors,[transportFailure,classifierFailure]);
    assert.equal(budget.diagnostics().running,false);
  }}),
  it({name:'keeps stable error identities and original causes',fn:function preserveErrorConstruction() {
    const cause=new Error('original cause');
    for(const Constructor of [JudgmentBudgetError,JudgmentDeadlineError,JudgmentCancelledError,JudgmentAttemptLimitError]) {
      const error=new Constructor('original message',{cause});
      assert.equal(error.name,Constructor.name);
      assert.equal(error.message,'original message');
      assert.equal(error.cause,cause);
      assert.ok(error instanceof JudgmentBudgetError);
    }
    return Promise.resolve();
  }})
]});
//endregion
