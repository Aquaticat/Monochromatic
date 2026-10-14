/**
 Native consumer controls for changed dependencies after approval.

 @module
 */
import {strict as assert} from 'node:assert';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {inspect} from 'node:util';

//region Native execution changes exercise original dependency guards after approval

/**
 Original judgment methods used by the consumer control, without access to private guard state.
 */
type ControlJudgment = {
 /** Original member handle retains prepared identity. */
 memberFor(id:string):object;
 /** Assessed input is inspected through the original member owner. */
 preparedMemberFor(member:object):{readonly prepared:{readonly input:{code:string}}};
 /** Budget observations establish that execution did not restart assessment. */
 inspect():{readonly accounting:{readonly attempts:number}};
 /** Original dependency failure remains observable after the operation stops. */
 assertDependenciesCurrent():unknown;
};

/**
 Measured calls belong to the active disposable consumer.
 */
type ControlObservations = {
 /** Entered child effects distinguish an execution stop from an assessment stop. */
 readonly executions:number;
 /** Original inference attempts cannot restart during execution. */
 readonly assessments:number;
};

/**
 Change disposable dependencies only after the first approved child has entered.

 @param mode - selected controlled dependency change

 @returns native consumer hooks and assertions

 @throws AssertionError when the selected control or its original dependency evidence differs
 */
export function createApprovedChangeControl(mode:string|undefined){
 assert.ok([undefined,'policy','cancel','arguments'].includes(mode));
 /**
  The complete declared program contains one producer and its parallel successor pair.
  */
 const COMPLETE_CHILD_CALLS=3;
 /**
  Control-owned observations retain cancellation cleanup without changing the judgment.
  */
 const state:{changed:boolean;argumentAttempts:number;abortTask?:Promise<void>}={changed:false,argumentAttempts:0};
 /**
  Exercise the selected original dependency after one actual child entry.
  */
 async function beforeChildReturn({session,env,executions,judgment}:{
  readonly session:{abort():Promise<void>};
  readonly env:{readonly options:{readonly cwd:string}};
  readonly executions:number;
  readonly judgment:ControlJudgment
 }){
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
 /**
  Compare observable execution and assessment counts with the selected dependency change.
  */
 function verify({judgment,observations}:{readonly judgment:ControlJudgment;readonly observations:ControlObservations}){
  if(mode==='arguments'){
   assert.ok(state.argumentAttempts>0);
   assert.equal(observations.executions,COMPLETE_CHILD_CALLS);
   console.log(JSON.stringify({approvedChange:mode,argumentAttempts:state.argumentAttempts,executions:observations.executions}));
   return;
  }
  assert.ok(state.changed,'The original selected dependency must actually change');
  assert.equal(observations.executions,1,'Changed dependencies must prevent the remaining child calls');
  assert.equal(observations.assessments,1,'Execution failure cannot reopen the assessment budget');
  assert.equal(judgment.inspect().accounting.attempts,1);
  /**
   Retain the thrown original failure without an assertion callback that can hide its cause.
   */
  const failures:unknown[]=[];
  try{judgment.assertDependenciesCurrent();}
  catch(error){failures.push(error);}
  assert.equal(failures.length,1);
  assert.ok(Error.isError(failures[0]));
  const detail=inspect(failures[0],{depth:8,maxStringLength:2_048});
  assert.ok(!detail.includes('DependencyDeadlineError'),'A deadline failure does not prove the changed dependency guard');
  console.log(detail);
  console.log(JSON.stringify({approvedChange:mode,executions:observations.executions,assessments:observations.assessments}));
 }
 /**
  The original abort task settles before the disposable session is destroyed.
  */
 async function drain(){if(state.abortTask)await state.abortTask;}
 return Object.freeze({beforeChildReturn,verify,drain});
}

//endregion Native execution changes exercise original dependency guards after approval
