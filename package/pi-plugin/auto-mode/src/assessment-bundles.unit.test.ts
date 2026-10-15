/**
 Built sender and native judgment exercise complete parallel assessment bundles. @module
 */
import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers/promises';
import {describe,it} from '@monochromatic-dev/module-test/ts';
import {createAssessmentSender} from '@monochromatic-dev/pi-plugin-auto-mode';
import {createBudgetFixture,captureBudgetRejection} from './native-judgment-budget-fixture.ts';
import {decisionFixtureRequest,decisionFixtureText} from './decision-wire-fixture.ts';
import {assessmentFixtureKey} from './assessment-transport-fixture.ts';

//region Independently authored questions retain adversarial text and exact answer identity.
/**
 Produce distinct original questions without relying on the partitioning implementation.
 @param count - original membership size
 @returns complete native wire
 */
function requestBody(count: number): string {
 const original=decisionFixtureRequest();
 return JSON.stringify({...original,questions:Object.fromEntries(Array.from({length:count},function question(_,index){
  return [`original_${index}`,original.questions.head_1];
 }))});
}
/**
 Return a complete independently specified provider predicate response.
 @param body - actual provider wire to echo
 @returns local provider response
 */
function respond(body: string): Response {
 const request=JSON.parse(body);
 assert.equal(JSON.parse(request.input).fullPolicy,decisionFixtureText);
 assert.ok(request.questions.length<=200);
 return Response.json({model:'openai/gpt-6-luna-decisions',answers:request.questions.map((question: {name:string})=>({
  type:'predicate',name:question.name,probability:0.875
 })),usage:{input_tokens:10,output_tokens:1}});
}
//endregion

//region Real budget owner constrains the built sender's physical HTTP invocations.
await describe({name:'assessment call bundles',children:[
 it({name:'617 questions start three calls in parallel then complete the fourth with exact names',fn:async function completeWorkspaceBatch(){
  const {budget}=createBudgetFixture();
  const gate=Promise.withResolvers<void>();
  const bodies:string[]=[];
  let active=0;
  let peak=0;
  const send=createAssessmentSender({now:()=>0,readCredential:()=>assessmentFixtureKey,fetchImpl:async function localHttp(_url,options){
   assert.equal(typeof options?.body,'string');
   const body=String(options?.body);
   bodies.push(body);
   active+=1;
   peak=Math.max(peak,active);
   if(bodies.length<=3)await gate.promise;
   active-=1;
   return respond(body);
  }});
  const pending=budget.dispatch(input=>send({...input,body:requestBody(617)}));
  await setImmediate();
  assert.equal(bodies.length,3);
  gate.resolve();
  const result=JSON.parse(await pending);
  assert.equal(peak,3);
  assert.deepEqual(bodies.map(body=>JSON.parse(body).questions.length),[200,200,200,17]);
  assert.deepEqual(Object.keys(result.answers),Array.from({length:617},(_,index)=>`original_${index}`));
  assert.ok(Object.values(result.answers).every(answer=>typeof answer==='object'&&answer!==null&&'noul' in answer&&answer.noul===0.875));
  assert.equal(result.usage.input_tokens,40);
  assert.equal(result.usage.output_tokens,4);
  assert.equal(result.usage.requests.length,4);
  assert.equal(budget.finish().bundles,2);
  assert.equal(budget.diagnostics().calls,4);
 }}),
 ...[1,200,201,600,601,1800].map(count=>it({name:`preserves complete membership for ${count} questions`,fn:async function verifyPartitionBoundary(){
  const {budget}=createBudgetFixture();
  const bodies:string[]=[];
  const send=createAssessmentSender({now:()=>0,readCredential:()=>assessmentFixtureKey,fetchImpl:async function localHttp(_url,options){
   const body=String(options?.body);
   bodies.push(body);
   return respond(body);
  }});
  const result=JSON.parse(await budget.dispatch(input=>send({...input,body:requestBody(count)})));
  assert.equal(Object.keys(result.answers).length,count);
  assert.equal(bodies.length,Math.ceil(count/200));
  assert.equal(budget.finish().bundles,Math.ceil(count/600));
 }})),
 it({name:'rejects a fourth bundle without invoking its operations',fn:async function enforceBundleCeiling(){
  const {budget}=createBudgetFixture();
  let calls=0;
  const operations=Array.from({length:3},()=>async function localOperation(){calls+=1;return calls;});
  const error=await captureBudgetRejection(budget.dispatch(async function consumeBundles({runBundle}){
   await runBundle(operations);
   await runBundle(operations);
   await runBundle(operations);
   await runBundle(operations);
  }));
  assert.match(String(error),/three sequential call bundles/u);
  assert.equal(calls,9);
  assert.equal(budget.diagnostics().bundles,3);
  assert.equal(budget.diagnostics().calls,9);
 } }),
 it({name:'cancellation after the first bundle prevents remaining calls and answer publication',fn:async function cancelRemainingBundle(){
  const {budget,controller}=createBudgetFixture();
  let calls=0;
  const send=createAssessmentSender({now:()=>0,readCredential:()=>assessmentFixtureKey,fetchImpl:async function localHttp(_url,options){
   calls+=1;
   if(calls===3)controller.abort(new Error('fixture cancellation'));
   return respond(String(options?.body));
  }});
  const error=await captureBudgetRejection(budget.dispatch(input=>send({...input,body:requestBody(617)})));
  assert.ok(error instanceof Error);
  assert.equal(calls,3);
  assert.equal(budget.diagnostics().bundles,1);
 }}),
 it({name:'a malformed answer prevents all partial evidence from escaping',fn:async function rejectMalformedPartition(){
  const {budget}=createBudgetFixture();
  let calls=0;
  const send=createAssessmentSender({now:()=>0,readCredential:()=>assessmentFixtureKey,fetchImpl:async function localHttp(_url,options){
   calls+=1;
   if(calls===2)return Response.json({model:'openai/gpt-6-luna-decisions',answers:[],usage:{input_tokens:0,output_tokens:0}});
   return respond(String(options?.body));
  }});
  const error=await captureBudgetRejection(budget.dispatch(input=>send({...input,body:requestBody(617)})));
  assert.ok(error instanceof AggregateError);
  assert.equal(calls,3);
  assert.equal(budget.diagnostics().bundles,1);
 }}),
]});
//endregion
