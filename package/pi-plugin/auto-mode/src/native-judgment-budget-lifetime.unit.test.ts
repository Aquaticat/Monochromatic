/**
 Built original judgment cancellation, clock and response lifetime.
 @module
 */
import assert from 'node:assert/strict';
import {describe,it} from '@monochromatic-dev/module-test/ts';
import {nativeBudget} from './native-judgment-budget-module-fixture.ts';

import {captureBudgetRejection,createBudgetFixture} from './native-judgment-budget-fixture.ts';

const {
  JudgmentBudgetError,
  JudgmentCancelledError,
  JudgmentDeadlineError
}=nativeBudget;

//region Original lifetime retirement cannot be reset by a later clock reading.
await describe({name:'',children:[
  it({name:'retires on original cancellation',fn:function cancelOriginalBudget() {
    const {budget,controller}=createBudgetFixture();
    controller.abort(new Error('cancelled by original owner'));
    assert.throws(function cancelledCheckpoint() { 
      budget.checkpoint(); 
    },JudgmentCancelledError);
    assert.equal(budget.diagnostics().retired,true);
    return Promise.resolve();
  }}),
  it({name:'retains deadline expiry after the clock is reset',fn:function keepOriginalRetirement() {
    const {budget,clock}=createBudgetFixture();
    clock.at=5_000;
    assert.throws(function expiredCheckpoint() { 
      budget.checkpoint(); 
    },JudgmentDeadlineError);
    clock.at=0;
    assert.throws(function retirementCannotBeReversed() { 
      budget.checkpoint(); 
    },JudgmentDeadlineError);
    return Promise.resolve();
  }}),
  it({name:'rejects a backwards clock',fn:function rejectClockReversal() {
    const {budget,clock}=createBudgetFixture();
    clock.at=-1;
    assert.throws(function reversedClock() { 
      budget.checkpoint(); 
    },JudgmentBudgetError);
    assert.equal(budget.diagnostics().retired,true);
    return Promise.resolve();
  }}),
  it({name:'discards a response after the original deadline',fn:async function discardLateResponse() {
    const {budget,clock}=createBudgetFixture();
    const error=await captureBudgetRejection(budget.dispatch(function completeAfterDeadline() {
      clock.at=5_000;
      return Promise.resolve('late response');
    }));
    assert.ok(error instanceof JudgmentDeadlineError);
    assert.equal(budget.diagnostics().records.at(0)?.state,'discarded');
    assert.equal(budget.diagnostics().running,false);
  }})
]});
//endregion
