/**
 Built original judgment cancellation, clock and response lifetime.
 @module
 */
import assert from 'node:assert/strict';
import {describe,it} from '@monochromatic-dev/module-test/ts';
import {nativeBudget} from './native-judgment-budget-module-fixture.ts';

import {createBudgetFixture} from './native-judgment-budget-fixture.ts';

const {
  JudgmentBudgetError,
  JudgmentCancelledError
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
  it({name:'keeps preparation eligible after the advisory time target',fn:function allowLatePreparation() {
    const {budget,clock}=createBudgetFixture();
    clock.at=60_000;
    budget.checkpoint();
    assert.equal(budget.diagnostics().retired,false);
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
  it({name:'admits a complete response after the advisory time target',fn:async function admitLateResponse() {
    const {budget,clock}=createBudgetFixture();
    const response=await budget.dispatch(function completeAfterTarget() {
      clock.at=60_000;
      return Promise.resolve('late response');
    });
    assert.equal(response,'late response');
    assert.equal(budget.diagnostics().records.at(0)?.state,'succeeded');
    assert.equal(budget.diagnostics().running,false);
  }})
]});
//endregion
