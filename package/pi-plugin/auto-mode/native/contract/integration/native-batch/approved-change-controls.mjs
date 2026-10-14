import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {inspect} from 'node:util';

//region Native execution changes exercise original dependency guards after approval

/** Change disposable dependencies only after the first approved child has entered. */
export function createApprovedChangeControl(mode){
 assert.ok([undefined,'policy','cancel','arguments'].includes(mode));
 const state={changed:false,argumentAttempts:0,abortTask:undefined};
 async function beforeChildReturn({session,env,executions,judgment}){
  if(executions!==1)return;
  if(mode==='arguments'){
   const member=judgment.memberFor('program');
   const {prepared}=judgment.preparedMemberFor(member);
   assert.ok(Object.isFrozen(prepared.input),'Original assessed arguments must stay frozen during approved execution');
   const original=prepared.input.code;
   assert.throws(function changeOriginalPreparedCode(){prepared.input.code='return "different operation";';},TypeError);
   assert.equal(prepared.input.code,original);
   state.argumentAttempts++;
  }
  if(mode==='policy'){
   await writeFile(join(env.options.cwd,'AGENTS.md'),'RUL:\n The complete proposed operation is prohibited.\n');
   state.changed=true;
  }
  if(mode==='cancel'){
   state.abortTask=session.abort();
   state.changed=true;
  }
 }
 function verify({judgment,observations}){
  if(mode==='arguments'){
   assert.ok(state.argumentAttempts>0);
   assert.equal(observations.executions,3);
   console.log(JSON.stringify({approvedChange:mode,argumentAttempts:state.argumentAttempts,executions:observations.executions}));
   return;
  }
  assert.ok(state.changed,'The original selected dependency must actually change');
  assert.equal(observations.executions,1,'Changed dependencies must prevent the remaining child calls');
  assert.equal(observations.assessments,1,'Execution failure cannot reopen the assessment budget');
  assert.equal(judgment.inspect().accounting.attempts,1);
  assert.throws(function checkOriginalDependencies(){judgment.assertDependenciesCurrent();},function originalFailure(error){
   assert.ok(error instanceof Error);
   const detail=inspect(error,{depth:8,maxStringLength:2048});
   assert.ok(!detail.includes('DependencyDeadlineError'),'A deadline failure does not prove the changed dependency guard');
   console.log(detail);
   return true;
  });
  console.log(JSON.stringify({approvedChange:mode,executions:observations.executions,assessments:observations.assessments}));
 }
 async function drain(){await state.abortTask;}
 return Object.freeze({beforeChildReturn,verify,drain});
}

//endregion Native execution changes exercise original dependency guards after approval
